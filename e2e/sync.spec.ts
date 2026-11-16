import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { expectSeq, ready } from './helpers';

/**
 * Two devices (two browser contexts, separate storage) and a stand-in for /api/sync that keeps
 * the same rules as api/sync.ts: one code, the newer edit wins, a `rev` bumped on every write.
 */
function fakeServer() {
  const rows = new Map<string, Record<string, unknown> & { updated: number; rev: number }>();
  let rev = 0;
  return async (ctx: BrowserContext) =>
    ctx.route('**/api/sync**', async (route) => {
      const req = route.request();
      if (req.headers()['authorization'] !== 'Bearer test-code')
        return route.fulfill({ status: 401, json: { error: 'bad-code' } });
      if (req.method() === 'POST') {
        for (const p of (req.postDataJSON() as { pieces: { id: string; updated: number }[] })
          .pieces) {
          const old = rows.get(p.id);
          if (!old || old.updated < p.updated) rows.set(p.id, { ...p, rev: ++rev });
        }
        return route.fulfill({ json: { rev } });
      }
      const since = Number(new URL(req.url()).searchParams.get('since'));
      const out = [...rows.values()].filter((r) => r.rev > since).sort((a, b) => a.rev - b.rev);
      return route.fulfill({ json: { rows: out, rev, more: false } });
    });
}

async function device(ctx: BrowserContext): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto('/');
  await ready(page);
  return page;
}

async function library(page: Page) {
  if (!(await page.locator('dialog.library[open]').count()))
    await page.getByRole('button', { name: 'Library' }).click();
}
const list = (page: Page) => page.getByRole('list', { name: 'Saved compositions' });

async function join(page: Page, code = 'test-code') {
  await library(page);
  await page.getByRole('button', { name: /^Sync between devices/ }).click();
  await page.getByLabel('Sync code').fill(code);
  await page.getByRole('button', { name: 'Join' }).click();
}

async function syncNow(page: Page) {
  await library(page);
  const fold = page.getByRole('button', { name: /^Sync between devices/ });
  if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
  await page.getByRole('button', { name: 'Sync now' }).click();
  await expect(fold).toContainText('synced');
}

test('a composition saved on one device appears, changes and goes away on the other', async ({
  browser,
}) => {
  const serve = fakeServer();
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await serve(ctxA);
  await serve(ctxB);
  const a = await device(ctxA);
  const b = await device(ctxB);

  // A writes and names its piece, then joins
  await a.keyboard.press('2');
  await a.getByLabel('Name of the composition').fill('From the iPhone');
  await a.getByLabel('Name of the composition').press('Enter');
  await a.waitForTimeout(600);
  await join(a, 'wrong');
  await expect(a.getByText('That code is not the right one.')).toBeVisible();
  await a.getByLabel('Sync code').fill('test-code');
  await a.getByRole('button', { name: 'Join' }).click();
  await expect(a.getByRole('button', { name: /^Sync between devices/ })).toContainText('synced');
  await a.keyboard.press('Escape');

  // B joins: A's piece is there beside its own
  await join(b);
  await expect(list(b).getByRole('button', { name: /^From the iPhone/ })).toBeVisible();
  await expect(list(b).getByRole('listitem')).toHaveCount(2);
  await list(b)
    .getByRole('button', { name: /^From the iPhone/ })
    .click();
  await expectSeq(b, '(2) 3 3 2 2 │ 3 (1) 3 2 4');

  // B changes it; A, which has it open, takes the newer version in
  await b.keyboard.press('1');
  await b.waitForTimeout(600);
  await syncNow(b);
  await syncNow(a);
  await expect(list(a).getByRole('listitem')).toHaveCount(2);
  await a.keyboard.press('Escape');
  await expectSeq(a, '(2) 3 3 2 2 1 │ 3 (1) 3 2 4');

  // B deletes it; A lets it go too
  await library(b);
  await b.getByRole('button', { name: 'Delete From the iPhone' }).click();
  await b.getByRole('button', { name: 'Delete?' }).click();
  await syncNow(b);
  await syncNow(a);
  await expect(list(a).getByRole('listitem')).toHaveCount(1);
  await expect(list(a).getByRole('button', { name: /^From the iPhone/ })).toHaveCount(0);
  await ctxA.close();
  await ctxB.close();
});
