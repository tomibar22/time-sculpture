import { expect, test } from '@playwright/test';
import { DEFAULT_SEQ, expectSeq, score, ready } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('two cycles per row puts the whole phrase on one row', async ({ page }) => {
  await page.getByRole('button', { name: 'More cycles per row' }).click();
  await expect(page.getByTestId('per-row-value')).toHaveText('2');
  const s = await score(page);
  // one row of 8 beats: the 3 that opens cycle 2 sits at beat 4 + 1.0
  const bw = (s.w - 8) / 8;
  await page.mouse.click(s.x + 4 + 5.1 * bw, s.y + 54);
  await expect(page.getByTestId('selname')).toContainText('Group 3');
  await expect(page.getByTestId('selname')).toContainText('ending');
  const box = (await page.getByTestId('score').boundingBox())!;
  expect(box.height).toBeLessThan(160);
});

test('a specific row can hold a different number of cycles', async ({ page }) => {
  await page.getByRole('button', { name: 'More cycles', exact: true }).click();
  await page.getByRole('button', { name: 'More cycles', exact: true }).click();
  await page.getByRole('button', { name: 'Rows…' }).click();
  await expect(page.getByRole('dialog').getByRole('listitem')).toHaveCount(4);
  await page.getByRole('button', { name: 'More cycles in row 2' }).click();
  await expect(page.getByTestId('row-2-value')).toHaveText('2');
  await expect(page.getByRole('dialog').getByRole('listitem')).toHaveCount(3);
  await expect(page.getByRole('dialog')).toContainText('cycles 2–3');
  await page.waitForTimeout(700); // autosave debounce
  await page.reload();
  await page.getByRole('button', { name: /^Rows…/ }).click();
  await expect(page.getByTestId('row-2-value')).toHaveText('2');
});
