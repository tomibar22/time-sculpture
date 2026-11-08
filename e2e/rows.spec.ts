import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, expectSeq, P, ready, score, tap } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('two cycles per row puts the whole phrase on one row', async ({ page }) => {
  await page.getByRole('button', { name: 'More bars per row' }).click();
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

test('Enter breaks the line at the caret, even in the middle of a beat', async ({ page }) => {
  const s = await score(page);
  const h0 = (await page.getByTestId('score').boundingBox())!.height;
  // caret on the line between the two 3s: pulse 5 = beat 2, +1/4
  await tap(page, at(s, P(5)));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Join rows \(1\)/ })).toBeVisible();
  // rows: 0–1¼, 1¼–5¼, 5¼–8 → one more row than before
  const h1 = (await page.getByTestId('score').boundingBox())!.height;
  expect(h1).toBeGreaterThan(h0 + 100);
  // the second row starts with the second 3: tapping its start selects it
  const s2 = await score(page);
  const bw = (s2.w - 8) / 4;
  await page.mouse.click(s2.x + 4 + 0.3 * bw, s2.y + 54 + 127);
  await expect(page.getByTestId('selname')).toContainText('Group 3');
  // undo removes the break
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('z');
  await expect(page.getByRole('button', { name: /Join rows/ })).toHaveCount(0);
});

test('line breaks are saved with the piece', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(5)));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  await page.reload();
  await ready(page);
  await expect(page.getByRole('button', { name: /Join rows \(1\)/ })).toBeVisible();
  await page.getByRole('button', { name: /Join rows/ }).click();
  await expect(page.getByRole('button', { name: /Join rows/ })).toHaveCount(0);
});

test('Fit rows stretches a row cut short by a break to the full width', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(5)));
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  // the first row now holds only 1¼ beats; its right side is empty
  const s1 = await score(page);
  const right = { x: s1.x + s1.w - 30, y: s1.y + 54 };
  await page.mouse.click(right.x, right.y);
  await expect(page.getByTestId('selname')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Fit rows' }).click();
  await expect(page.getByRole('switch', { name: 'Fit rows' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  // stretched: the first 3 (pulses 2–5) now reaches the right edge
  const s2 = await score(page);
  await page.mouse.click(s2.x + s2.w - 30, s2.y + 54);
  await expect(page.getByTestId('selname')).toContainText('Group 3');
});
