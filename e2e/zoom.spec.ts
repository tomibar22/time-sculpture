import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, expectSeq, P, ready, score, settle, tap } from './helpers';

const level = (page: import('@playwright/test').Page) => page.getByTestId('zoom-level');
const STRIDE = 127; // one row of the score (helpers.ts STRIDE)

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('zoom steps in and out, by buttons and ⌥ keys, without touching the music', async ({
  page,
}) => {
  await expect(level(page)).toHaveText('1 bar per row');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(level(page)).toHaveText('2 beats per row');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(level(page)).toHaveText('1 beat per row');
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
  await page.keyboard.press('Alt+Minus');
  await page.keyboard.press('Alt+Minus');
  await page.keyboard.press('Alt+Minus');
  await expect(level(page)).toHaveText('2 bars per row');
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeDisabled(); // 2 bars: all of it
  await page.keyboard.press('Alt+Equal');
  await expect(level(page)).toHaveText('1 bar per row');
  await expectSeq(page, DEFAULT_SEQ);
});

test('zooming keeps the caret where it is on the screen', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(10))); // caret at beat 2½, in the first row
  await settle(page);
  const y0 = (await page.getByTestId('score').boundingBox())!.y;
  // (a click would first scroll the zoom buttons into view; the key keeps the page where it is)
  await page.keyboard.press('Alt+Equal');
  // at 2 beats per row the caret's beat is in the second row: the page moved up by one row
  await expect
    .poll(async () => (await page.getByTestId('score').boundingBox())!.y - y0)
    .toBeCloseTo(-STRIDE, -1);
  await expect(page.getByTestId('caretname')).toBeVisible();
});

test('everything at once, then a tap zooms back in there', async ({ page }) => {
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(level(page)).toHaveText('1 beat per row');
  await page.getByRole('button', { name: 'See everything' }).click();
  await expect(page.getByRole('button', { name: 'See everything' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(level(page)).toHaveText('Everything');
  // the whole piece fits above the dock
  await expect
    .poll(async () => {
      const box = (await page.getByTestId('score').boundingBox())!;
      const dock = (await page.locator('.dock').boundingBox())!;
      return box.y >= 0 && box.y + box.height <= dock.y + 1;
    })
    .toBe(true);
  // a tap in it: back to 1 beat per row, nothing selected or changed
  const s = await score(page);
  await page.mouse.click(s.x + s.w / 2, s.y + 60);
  await expect(level(page)).toHaveText('1 beat per row');
  await expect(page.getByTestId('selname')).toHaveCount(0);
  await expectSeq(page, DEFAULT_SEQ);
  // Esc also leaves the overview
  await page.keyboard.press('Alt+Digit0');
  await expect(level(page)).toHaveText('Everything');
  await page.keyboard.press('Escape');
  await expect(level(page)).toHaveText('1 beat per row');
});
