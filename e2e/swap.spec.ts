import { expect, test } from '@playwright/test';
import { at, clearAll, DEFAULT_SEQ, expectSeq, P, ready, score, seq, tap } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('swap two stretches: mark one, select the other, swap; undo puts them back', async ({
  page,
}) => {
  const s = await score(page);
  // the first 3 (pulses 2–5) with the 4 at the very end (pulses 28–32)
  await tap(page, at(s, P(3)));
  await page.getByRole('button', { name: 'Swap…' }).click();
  await expect(page.getByTestId('swapname')).toContainText('now select the other');
  await tap(page, at(s, P(30)));
  await expect(page.getByTestId('swapname')).toContainText('with 4');
  await page.getByRole('button', { name: 'Swap them' }).click();
  // the open space between moves one pulse later and stays open
  await expectSeq(page, '(2) 4 3 2 │ 3 (1) 3 2 3');
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await expectSeq(page, DEFAULT_SEQ);
});

test('swap by keys: X marks, X swaps; Esc cancels', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'keyboard');
  const s = await score(page);
  await tap(page, at(s, P(9))); // the 2 (8–10)
  await page.keyboard.press('x');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('swapname')).toHaveCount(0);
  await tap(page, at(s, P(6))); // the second 3 (5–8)
  await page.keyboard.press('x');
  await tap(page, at(s, P(9)));
  await page.keyboard.press('x');
  await expectSeq(page, '(2) 3 2 3 │ 3 (1) 3 2 4');
});

test('land a long–short shape: every way to give it sizes', async ({ page }) => {
  await clearAll(page);
  await page.getByRole('button', { name: 'Land…' }).first().click();
  await page.getByTestId('land-mode-ls').click();
  for (const x of ['L', 'S', 'S']) await page.getByTestId(`land-${x}`).click();
  await expect(page.getByTestId('land-pattern')).toHaveText('LSS');
  const first = page.locator('.land-list .fill-main').first();
  await expect(first).toContainText('2 : 1 ×8');
  await expect(page.locator('.land-list')).toContainText('4 : 2 ×4');
  await first.click();
  await first.click();
  await expect(seq(page)).toContainText('2 1 1 2 1 1 2 1 1 2 1 1');
});
