import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, drag, expectSeq, P, score, tap } from './helpers';

// Default: (2) 3 3 2 │ 3 (1) 3 2 4 — the first 3 spans pulses 2–5.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expectSeq(page, DEFAULT_SEQ);
});

test('drag the end grip of a selected group to lengthen it', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await drag(page, at(s, P(5)), at(s, P(7)));
  await expectSeq(page, '(2) 5 1 2 │ 3 (1) 3 2 4');
});

test('drag the end grip back to shorten it: silence fills in', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await drag(page, at(s, P(5)), at(s, P(3)));
  await expectSeq(page, '(2) 1 (2) 3 2 │ 3 (1) 3 2 4');
});

test('drag the start grip to lengthen it to the left', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await drag(page, at(s, P(2)), at(s, P(1)));
  await expectSeq(page, '(1) 4 3 2 │ 3 (1) 3 2 4');
});

test('⌥ arrows trim the end, ⌥⇧ arrows the start', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await page.keyboard.press('Alt+ArrowRight');
  await expectSeq(page, '(2) 4 2 2 │ 3 (1) 3 2 4');
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expectSeq(page, '(3) 3 2 2 │ 3 (1) 3 2 4');
  await page.keyboard.press('Alt+ArrowLeft');
  await expectSeq(page, '(3) 2 (1) 2 2 │ 3 (1) 3 2 4');
});

test('B paints the brush on the beats under the selection', async ({ page }) => {
  await page.getByRole('button', { name: '3:1', exact: true }).click();
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await page.keyboard.press('b');
  await expect(page.getByTestId('status')).toContainText('3:1 4:1');
  await expect(page.getByTestId('toast')).toContainText('Beats 1.1–1.2 now 3:1');
});
