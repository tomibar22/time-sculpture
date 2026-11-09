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

test('a pinch never edits: Safari pinch starting on the band or a line', async ({
  page,
  context,
  browserName,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone' || browserName !== 'chromium', 'touch via CDP');
  for (const where of ['band', 'line'] as const) {
    const el = page.getByTestId('score');
    const s = await score(page);
    const status0 = await page.getByTestId('status').textContent();
    const lvl0 = await level(page).textContent();
    const p = at(s, P(5), where === 'band' ? 42 : 0);
    const cdp = await context.newCDPSession(page);
    const touch = (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      pts: { x: number; y: number; id: number }[],
    ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const gesture = (type: string, scale = 1) =>
      el.evaluate(
        (n, [t, sc]) => {
          const e = Object.assign(new Event(t as string, { cancelable: true }), {
            scale: sc,
            clientX: 200,
            clientY: 300,
          });
          n.dispatchEvent(e);
        },
        [type, scale] as const,
      );
    await gesture('gesturestart');
    // the first finger drifts sideways before the second one lands
    await touch('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
    for (let i = 1; i <= 4; i++) await touch('touchMove', [{ x: p.x + i * 6, y: p.y, id: 1 }]);
    await touch('touchStart', [
      { x: p.x + 24, y: p.y, id: 1 },
      { x: p.x + 90, y: p.y + 30, id: 2 },
    ]);
    for (let i = 1; i <= 10; i++) {
      await touch('touchMove', [
        { x: p.x + 24 - i * 8, y: p.y, id: 1 },
        { x: p.x + 90 + i * 8, y: p.y + 30, id: 2 },
      ]);
      await gesture('gesturechange', 1 + i * 0.12);
    }
    await touch('touchEnd', []);
    await gesture('gestureend');
    await expectSeq(page, DEFAULT_SEQ);
    await expect(page.getByTestId('status')).toHaveText(status0!);
    await expect(level(page)).not.toHaveText(lvl0!);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await expect(level(page)).toHaveText('1 bar per row');
  }
});
