import { expect, test } from '@playwright/test';
import { DEFAULT_SEQ, expectSeq, openSetup, ready, settle } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('bars: add some in the middle, remove them again', async ({ page }) => {
  await openSetup(page);
  await page.getByRole('button', { name: 'Add or remove bars…' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'How many: one more' }).click();
  await dialog.getByLabel('Where').selectOption('before');
  await dialog.getByRole('button', { name: 'Add 2 bars before bar 2' }).click();
  await expect(page.getByTestId('bars-value')).toHaveText('4');
  // the bar line was in the open space, so the new bars are open space too
  await expectSeq(page, DEFAULT_SEQ);
  await expect(page.getByTestId('piece-state').first()).toContainText('41 to go');
  await page.getByRole('button', { name: 'Add or remove bars…' }).click();
  // the caret went to where the bars were added: bar 2 is offered
  await dialog.getByRole('button', { name: 'To bar: one more' }).click();
  await dialog.getByRole('button', { name: 'Remove bars 2–3' }).click();
  await expect(page.getByTestId('bars-value')).toHaveText('2');
  await expect(page.getByTestId('piece-state').first()).toContainText('9 to go');
});

test('duplicate with no room adds the bars it needs', async ({ page }) => {
  await page.getByTestId('score').focus();
  await page.keyboard.press('Shift+A');
  await page.keyboard.press('d');
  // 23 pulses to copy, 9 open (which stay where they are, as silence): two more bars make room
  await expect(page.getByTestId('status')).toContainText('4×4');
  await expect(page.locator('.toast')).toContainText('2 bars added');
  await page.keyboard.press('z');
  await expect(page.getByTestId('status')).toContainText('4×2');
  await expectSeq(page, DEFAULT_SEQ);
});

test('metre: a pattern of bars, the same pulses', async ({ page }) => {
  await openSetup(page);
  await page.getByRole('button', { name: 'Metre…' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '+ Another bar' }).click();
  await dialog.getByRole('button', { name: 'Bar 1: one beat less' }).click();
  await dialog.getByRole('button', { name: 'Bar 2: one beat more' }).click();
  await expect(dialog.getByTestId('metre-fit')).toContainText('8 beats = 2 bars · 1 × (3+5)');
  await dialog.getByRole('button', { name: 'Set the metre' }).click();
  await expect(page.getByTestId('status')).toContainText('2 bars · 3+5');
  await expect(page.getByTestId('status')).toContainText('32 pulses');
  await expectSeq(page, DEFAULT_SEQ);
  // it is saved with the piece
  await page.waitForTimeout(700);
  await page.reload();
  await ready(page);
  await expect(page.getByTestId('status')).toContainText('2 bars · 3+5');
});

test('play from a bar chosen by its number', async ({ page }) => {
  await page.getByTestId('play-from').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('start-now')).toContainText('from the top');
  await dialog.getByRole('button', { name: 'Bar: one more' }).click();
  await expect(dialog.getByTestId('start-now')).toContainText('bar 2');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('play-from')).toContainText('bar 2');
});

test('a row with its own number of bars', async ({ page }) => {
  await page.getByTestId('score').focus();
  await page.keyboard.press('Home');
  await settle(page);
  const h0 = (await page.getByTestId('score').boundingBox())!.height;
  await page.getByRole('button', { name: 'Row…' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Bars in the row: one more' }).click();
  await dialog.getByRole('button', { name: 'From this row on' }).click();
  await dialog.getByRole('button', { name: '2 bars a row from here' }).click();
  await settle(page);
  const h1 = (await page.getByTestId('score').boundingBox())!.height;
  expect(h1).toBeLessThan(h0 - 80);
  await page.keyboard.press('z');
  await settle(page);
  expect((await page.getByTestId('score').boundingBox())!.height).toBe(h0);
});
