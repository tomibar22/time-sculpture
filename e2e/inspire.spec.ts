import { expect, test } from '@playwright/test';
import { DEFAULT_SEQ, expectSeq, openSetup, ready } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('vary a passage: the same time said another way', async ({ page }) => {
  // select the start's 3 3 2 with the keyboard: select all, then vary
  await page.keyboard.press('Shift+KeyA');
  await page.keyboard.press('Shift+KeyV');
  const list = page.getByRole('list', { name: 'Variations' });
  await expect(list).toBeVisible();
  await list.getByRole('button', { name: /Backwards/ }).click();
  // the whole written phrase backwards; the open space became silence inside the range
  const seq = page.getByTestId('sequence');
  await expect(seq).toContainText('4 2 3 (1) 3');
  // "As it was" brings the passage back
  await list.getByRole('button', { name: /As it was/ }).click();
  await expect(seq).toContainText('(2) 3 3 2');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(list).toBeHidden();
});

test('a tihai fills the open space and lands on 1', async ({ page }) => {
  await page.getByRole('button', { name: 'Browse fills…' }).click();
  // 9 open pulses: 3 × phrase + 2 × gap = 9 → 1 3 1 3 1, once size 1 is allowed
  await page.getByTestId('fill-1').click();
  await page.getByRole('button', { name: /^Tihai/ }).click();
  const list = page.getByRole('list', { name: 'Ways to fill' });
  await list.getByRole('button').first().click();
  await expect(page.getByTestId('status')).toContainText('Complete · lands on 1');
  // phrase, gap, phrase, gap, phrase: all sounding tiles
  await expect(page.getByTestId('sequence')).toContainText('1 3 1 3 1');
});

test('loop the selection, and set the tempo by tapping', async ({ page }) => {
  await page.keyboard.press('Shift+KeyA');
  await page.getByRole('button', { name: /Loop/ }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^Tempo/ }).click();
  await page.getByRole('button', { name: '5 faster' }).click();
  await expect(page.getByTestId('tempo-value')).toHaveText('77');
  const tap = page.getByRole('button', { name: /Tap the beat/ });
  for (let i = 0; i < 4; i++) {
    await tap.dispatchEvent('pointerdown');
    await page.waitForTimeout(300);
  }
  // four taps 0.3 s apart ≈ ♩200 (timers are not exact)
  const bpm = Number(await page.getByTestId('tempo-value').textContent());
  expect(bpm).toBeGreaterThan(150);
  expect(bpm).toBeLessThanOrEqual(215);
});

test('the caret stays inside the piece when it gets shorter', async ({ page }) => {
  await page.keyboard.press('End');
  await expect(page.getByTestId('caretname')).toContainText('the very end');
  // make the piece one bar: the caret follows the new end
  await openSetup(page);
  await page.getByRole('button', { name: 'Fewer bars' }).click();
  await expect(page.getByTestId('caretname')).toContainText('the very end');
  await page.keyboard.press('Home');
  await expect(page.getByTestId('caretname')).toContainText('bar 1, beat 1');
});

test('with a selection, Play plays only the selection and stops at its end', async ({ page }) => {
  // the last beat of the piece as a range: 4 pulses, under a second at ♩72
  await page.keyboard.press('End');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft');
  await expect(page.getByTestId('caretname')).toContainText('4 pulses');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  // it stops by itself (the whole piece would take more than six seconds)
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible({
    timeout: 3000,
  });
  // the selection is still there, ready to play again
  await expect(page.getByTestId('caretname')).toContainText('4 pulses');
});
