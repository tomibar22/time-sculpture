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
  await b.getByRole('button', { name: 'More for From the iPhone' }).click();
  await b.getByRole('button', { name: 'Delete From the iPhone' }).click();
  await b.getByRole('button', { name: 'Delete?' }).click();
  await syncNow(b);
  await syncNow(a);
  await expect(list(a).getByRole('listitem')).toHaveCount(1);
  await expect(list(a).getByRole('button', { name: /^From the iPhone/ })).toHaveCount(0);
  await ctxA.close();
  await ctxB.close();
});

test('a fill kept with the heart on one device is kept on the other, and let go again', async ({
  browser,
}) => {
  const serve = fakeServer();
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await serve(ctxA);
  await serve(ctxB);
  const a = await device(ctxA);
  const b = await device(ctxB);
  await join(a);
  await a.keyboard.press('Escape');
  await join(b);
  await b.keyboard.press('Escape');

  const kept = (p: Page) =>
    p.evaluate(() => JSON.parse(localStorage.getItem('time-sculpture/prefs') ?? '{}').motifs ?? []);
  const open = async (p: Page) => {
    await p.getByRole('button', { name: 'Fill it…' }).click();
    return p.getByRole('list', { name: 'Ways to fill' });
  };
  // A keeps the first fill
  const listA = await open(a);
  const first = listA.locator('li', { has: a.locator('.fill-heart') }).first();
  const key = (await first.locator('.sr-only').first().innerText()).replace(/\.\s*$/, '').trim();
  await first.locator('.fill-heart').click();
  await a.waitForTimeout(300);
  await expect.poll(() => kept(a)).toHaveLength(1);
  await syncNow(a);
  await syncNow(b);
  await b.keyboard.press('Escape');
  // B has it (kept fills are a device preference in the page's storage)
  await expect.poll(() => kept(b)).toHaveLength(1);
  expect((await kept(b))[0].join(' ')).toBe(key);

  // B lets it go (the heart again, in its own panel); A loses it too
  const listB = await open(b);
  await listB
    .locator('li', { has: b.locator('.fill-heart') })
    .filter({ hasText: key })
    .first()
    .locator('.fill-heart')
    .click();
  await b.waitForTimeout(300);
  await expect.poll(() => kept(b)).toHaveLength(0);
  await syncNow(b);
  await syncNow(a);
  await expect.poll(() => kept(a)).toHaveLength(0);
  await ctxA.close();
  await ctxB.close();
});

test('folders, and the folder a piece is in, go to the other device', async ({ browser }) => {
  const serve = fakeServer();
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await serve(ctxA);
  await serve(ctxB);
  const a = await device(ctxA);
  const b = await device(ctxB);
  await join(a);
  await join(b);

  // A makes a folder and moves its piece in
  await library(a);
  await a.getByRole('button', { name: 'New folder' }).click();
  await a.getByLabel('Name of the folder').fill('Etudes');
  await a.getByLabel('Name of the folder').press('Enter');
  await a.getByRole('button', { name: 'More for First phrase' }).first().click();
  await a.getByRole('button', { name: 'Move to…' }).click();
  await a.getByRole('dialog', { name: /^Move/ }).getByRole('button', { name: 'Etudes' }).click();
  await syncNow(a);
  await syncNow(b);

  // B sees the folder with A's piece in it
  const folder = list(b).getByRole('button', { name: /^Etudes/ });
  await expect(folder).toBeVisible();
  await expect(folder).toContainText('1');
  await folder.click();
  await expect(list(b).getByRole('listitem')).toHaveCount(1);
  await ctxA.close();
  await ctxB.close();
});
