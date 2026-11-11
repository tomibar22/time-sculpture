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

test('reshape the line between two groups', async ({ page }) => {
  const s = await score(page);
  await drag(page, at(s, P(5)), at(s, P(6)));
  await expectSeq(page, '(2) 4 2 2 │ 3 (1) 3 2 4');
});

test('stretch an edge into the open space', async ({ page }) => {
  const s = await score(page);
  await drag(page, at(s, P(10)), at(s, P(12)));
  await expectSeq(page, '(2) 3 3 4 │ 3 (1) 3 2 4');
});

test('slide by pulse: the next sound is shortened, silence fills behind', async ({ page }) => {
  const s = await score(page);
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
  await drag(page, at(s, P(1)), at(s, P(31.5)));
  await expectSeq(page, '3 3 2 │ 3 (1) 3 2 4 (2)');
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

test('paint a subdivision on the lane', async ({ page }) => {
  await openSetup(page);
  await page.getByRole('button', { name: '3:1', exact: true }).click();
  const s = await score(page);
  await tap(page, laneAt(s, 0));
  await expect(page.getByTestId('status')).toContainText('3:1 4:1');
  await expect(page.getByTestId('toast')).toContainText('Beat 1.1 now 3:1');
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
