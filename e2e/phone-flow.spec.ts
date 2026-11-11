import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, expectSeq, M, openSetup, P, ready, score, showPad, tap } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('Select all from the selection bar', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await page.getByRole('button', { name: 'Select all' }).click();
  await expect(page.getByTestId('selname')).toContainText('9 selected');
});

test('Subdivision… changes the caret’s beat where you are, and again the same beat', async ({
  page,
}) => {
  const s = await score(page);
  await tap(page, at(s, P(5))); // caret inside beat 2 of bar 1 (pulses 4–8)
  await page.getByRole('button', { name: 'Subdivision…' }).click();
  const panel = page.getByRole('group', { name: /Subdivision · bar 1, beat 2/ });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '3:1', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('3:1 4:1 · 31 pulses');
  await panel.getByRole('button', { name: '5:1', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('4:1 5:1 · 33 pulses');
  await expect(panel).toBeVisible();
});

test('Bar before opens a bar at the start to write an opening in', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(5)));
  await page.keyboard.press('Home');
  await page.getByRole('button', { name: 'Bar before' }).click();
  await expect(page.getByTestId('status')).toContainText('4×3');
  await expectSeq(page, '· │ (2) 3 3 2 (9) 3 (1) 3 2 4');
  await showPad(page);
  await page.getByTestId('key-3').click();
  await expectSeq(page, '3 │ (2) 3 3 2 (9) 3 (1) 3 2 4');
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expectSeq(page, DEFAULT_SEQ);
});

test('Bar after adds an open bar at the end; what was written stays in place', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(5)));
  await page.keyboard.press('End');
  await page.getByRole('button', { name: 'Bar after' }).click();
  await expect(page.getByTestId('status')).toContainText('4×3');
  await expectSeq(page, '(2) 3 3 2 (9) 3 (1) 3 2 4 │ ·');
  await showPad(page);
  await page.getByTestId('key-3').click();
  await expectSeq(page, '(2) 3 3 2 (9) 3 (1) 3 2 4 3 │ ·');
});

test('+ Bar at the end in the settings', async ({ page }) => {
  await openSetup(page);
  await page.getByRole('button', { name: '+ Bar at the end' }).click();
  await expect(page.getByTestId('bars-value')).toHaveText('3');
  await expectSeq(page, '(2) 3 3 2 (9) 3 (1) 3 2 4 │ ·');
});

test('the gutters take the caret, even with sound tiles at the very start and end', async ({
  page,
}) => {
  let s = await score(page);
  // make the opening silence (2) a sounding tile, so tiles touch both ends of the piece
  await tap(page, at(s, P(0.2)));
  await page.keyboard.press('2');
  await expectSeq(page, '2 3 3 2 │ 3 (1) 3 2 4');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  s = await score(page);
  const row1 = at(s, 0).y;
  const row2 = at(s, 4).y;
  await tap(page, { x: s.x + M / 2, y: row1 });
  await expect(page.getByTestId('caretname')).toContainText('bar 1, beat 1');
  await expect(page.getByTestId('selname')).toHaveCount(0);
  await tap(page, { x: s.x + s.w - M / 2, y: row2 });
  await expect(page.getByTestId('caretname')).toContainText('the very end');
  // the left gutter of the second row: the start of bar 2
  await tap(page, { x: s.x + M / 2, y: row2 });
  await expect(page.getByTestId('caretname')).toContainText('bar 2, beat 1');
});

test('⇤ and ⇥ on the number pad take the caret to the start and the end', async ({ page }) => {
  await showPad(page);
  await page.getByRole('button', { name: 'Caret to the end' }).click();
  await expect(page.getByTestId('caretname')).toContainText('the very end');
  await page.getByRole('button', { name: 'Caret to the start' }).click();
  await expect(page.getByTestId('caretname')).toContainText('bar 1, beat 1');
});
