import { expect, test } from '@playwright/test';
import {
  at,
  DEFAULT_SEQ,
  drag,
  expectSeq,
  laneAt,
  P,
  openSetup,
  score,
  showPad,
  tap,
  ready,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('type on the number pad, then undo and redo', async ({ page }) => {
  await showPad(page);
  await page.getByTestId('key-2').click();
  await expectSeq(page, '(2) 3 3 2 2 │ 3 (1) 3 2 4');
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
  await expectSeq(page, DEFAULT_SEQ);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expectSeq(page, '(2) 3 3 2 2 │ 3 (1) 3 2 4');
});

test('a drag from a line selects a range from exactly there (lines are not dragged)', async ({
  page,
}) => {
  const s = await score(page);
  await drag(page, at(s, P(5)), at(s, P(10)));
  await page.keyboard.press('Backspace');
  // the emptied stretch touches the open space, so it becomes open space
  await expectSeq(page, '(2) 3 │ 3 (1) 3 2 4');
});

test('a drag over a group that is not selected selects a range; it never moves it', async ({
  page,
}) => {
  const s = await score(page);
  await drag(page, at(s, P(3.4)), at(s, P(8)));
  await expect(page.getByTestId('caretname')).toContainText('5 pulses');
  await expectSeq(page, DEFAULT_SEQ);
});

test('slide by pulse: select, then drag; the next sound is shortened', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await page.waitForTimeout(400); // not a double click
  await drag(page, at(s, P(3.5)), at(s, P(4.5)));
  await expectSeq(page, '(3) 3 2 2 │ 3 (1) 3 2 4');
  await expect(page.getByTestId('toast')).toContainText('shortened');
});

test('slide by beat with the arrow keys', async ({ page }) => {
  await openSetup(page);
  await page.getByRole('button', { name: 'Beat', exact: true }).click();
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await page.keyboard.press('ArrowRight');
  await expectSeq(page, '(4) 3 1 2 │ 3 (1) 3 2 4');
});

test('reorder in Place mode', async ({ page }) => {
  await openSetup(page);
  await page.getByRole('button', { name: 'Place', exact: true }).click();
  const s = await score(page);
  await tap(page, at(s, P(3)));
  await page.waitForTimeout(400);
  await drag(page, at(s, P(3)), at(s, P(31.5)));
  await expectSeq(page, '(2) 3 2 │ 3 (1) 3 2 4 3');
});

test('shift-click selects a range and merge works', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await tap(page, at(s, P(6.5)), ['Shift']);
  await expect(page.getByTestId('selname')).toContainText('2 selected');
  await page.getByRole('button', { name: 'Merge' }).click();
  await expectSeq(page, '(2) 6 2 │ 3 (1) 3 2 4');
});

test('long-press enters multi-select, then taps add', async ({ page }) => {
  const s = await score(page);
  const p = at(s, P(3.5));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Select several' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await tap(page, at(s, P(9)));
  await expect(page.getByTestId('selname')).toContainText('2 selected');
});

test('tap a beat in the band, then pick its ratio; drag picks a run of beats', async ({ page }) => {
  const s = await score(page);
  await tap(page, laneAt(s, 0));
  const panel = page.getByRole('group', { name: /Subdivision · bar 1, beat 1/ });
  await panel.getByRole('button', { name: '3:1', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('3:1 4:1');
  await expect(page.getByTestId('toast')).toContainText('Beat 1.1 now 3:1');
  // the beat stays picked: try another ratio on it
  await panel.getByRole('button', { name: '5:1', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('4:1 5:1 · 33 pulses');
  // a drag along the band picks every beat it passes
  await drag(page, laneAt(s, 1), laneAt(s, 3));
  const run = page.getByRole('group', { name: /Subdivision · bar 1, beats 2–4/ });
  await run.getByRole('button', { name: '2:1', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('2:1 4:1 5:1 · 27 pulses');
  // every beat at once
  await page.getByRole('button', { name: 'Every beat' }).click();
  await page.getByRole('button', { name: '3:1', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('4×2 · 3:1 · 24 pulses');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: '3:1', exact: true })).toHaveCount(0);
});

test('keyboard: split, remove, undo', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await page.keyboard.press('s');
  await expectSeq(page, '(2) 2 1 3 2 │ 3 (1) 3 2 4');
  await page.keyboard.press('Delete');
  await expectSeq(page, '(2) 3 2 │ 3 (1) 3 2 4');
  await page.keyboard.press('z');
  await expectSeq(page, '(2) 2 1 3 2 │ 3 (1) 3 2 4');
});

test('meter steppers', async ({ page }) => {
  await openSetup(page);
  await page.getByRole('button', { name: 'More beats per bar' }).click();
  await expect(page.getByTestId('beats-value')).toHaveText('5');
  await expect(page.getByTestId('status')).toContainText('40 pulses');
});
