import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { M, at, DEFAULT_SEQ, expectSeq, P, ready, openSetup, score, tap } from './helpers';

const scoreHeight = async (page: Page) => (await page.getByTestId('score').boundingBox())!.height;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('two cycles per row puts the whole phrase on one row', async ({ page }) => {
  await openSetup(page);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect(page.getByTestId('zoom-level')).toHaveText('2 bars per row');
  const s = await score(page);
  // one row of 8 beats: the 3 that opens cycle 2 sits at beat 4 + 1.0
  const bw = (s.w - 2 * M) / 8;
  await page.mouse.click(s.x + M + 5.1 * bw, s.y + 54);
  await expect(page.getByTestId('selname')).toContainText('Group 3');
  await expect(page.getByTestId('selname')).toContainText('ending');
  // the canvas resizes on its next frame: wait for it rather than reading once
  await expect.poll(async () => (await scoreHeight(page)) < 160).toBe(true);
});

test('Enter breaks the line at the caret, even in the middle of a beat', async ({ page }) => {
  await openSetup(page);
  const s = await score(page);
  const h0 = await scoreHeight(page);
  // caret on the line between the two 3s: pulse 5 = beat 2, +1/4
  await tap(page, at(s, P(5)));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Join rows \(1\)/ })).toBeVisible();
  // rows: 0–1¼, 1¼–5¼, 5¼–8 → one more row than before
  await expect.poll(() => scoreHeight(page)).toBeGreaterThan(h0 + 100);
  // the second row starts with the second 3: tapping its start selects it
  const s2 = await score(page);
  const bw = (s2.w - 2 * M) / 4;
  await page.mouse.click(s2.x + M + 0.3 * bw, s2.y + 54 + 127);
  await expect(page.getByTestId('selname')).toContainText('Group 3');
  // undo removes the break
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('z');
  await expect(page.getByRole('button', { name: /Join rows/ })).toHaveCount(0);
});

test('line breaks are saved with the piece', async ({ page }) => {
  await openSetup(page);
  const s = await score(page);
  await tap(page, at(s, P(5)));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  await page.reload();
  await ready(page);
  await openSetup(page);
  await expect(page.getByRole('button', { name: /Join rows \(1\)/ })).toBeVisible();
  await page.getByRole('button', { name: /Join rows/ }).click();
  await expect(page.getByRole('button', { name: /Join rows/ })).toHaveCount(0);
});

test('Fit rows stretches a row cut short by a break to the full width', async ({ page }) => {
  await openSetup(page);
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

test('P marks the start of a phrase at the caret, and again removes it', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(5))); // not on a beat: beat 2 +1/4
  await page.keyboard.press('p');
  await expect(page.getByTestId('announcer')).toHaveText('Phrase starts here');
  await expect(page.getByRole('button', { name: 'Unmark phrase' })).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.getByRole('button', { name: 'Phrase mark' })).toBeVisible();
  await page.getByRole('button', { name: 'Phrase mark' }).click();
  await page.keyboard.press('z');
  await expect(page.getByRole('button', { name: 'Phrase mark' })).toBeVisible();
});

test('letter shortcuts work with a Hebrew keyboard layout', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(5)));
  // the P key on a Hebrew layout types "פ" but its code is still KeyP
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'פ', code: 'KeyP', bubbles: true })),
  );
  await expect(page.getByRole('button', { name: 'Unmark phrase' })).toBeVisible();
});
