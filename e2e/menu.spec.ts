import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, expectSeq, fingers, P, ready, score } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

const menu = (page: import('@playwright/test').Page) => page.getByTestId('ctx');

test('right-click: a group gets its menu, empty time its own, the beat numbers the bar', async ({
  page,
}) => {
  let s = await score(page);
  // a group that was not selected is selected, and the menu is about it
  await page.mouse.click(at(s, P(3.5)).x, at(s, P(3.5)).y, { button: 'right' });
  await expect(menu(page)).toContainText('Group of 3');
  await expect(page.getByTestId('selname')).toContainText('Group 3');
  await menu(page).getByRole('menuitem', { name: 'Split' }).click();
  await expect(menu(page)).toHaveCount(0);
  await expectSeq(page, '(2) 2 1 3 2 │ 3 (1) 3 2 4');
  await page.keyboard.press('z');
  await expectSeq(page, DEFAULT_SEQ);

  // the open space: a caret there, and the offer to fill it
  s = await score(page);
  await page.mouse.click(at(s, P(12)).x, at(s, P(12)).y, { button: 'right' });
  await expect(menu(page)).toContainText('Bar 1, beat 4');
  await expect(menu(page).getByRole('menuitem', { name: 'Fill these 9 pulses…' })).toBeVisible();
  // Esc puts it away and nothing else happens
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expectSeq(page, DEFAULT_SEQ);

  // the beat numbers of bar 2: the bar's own page; removing it takes its time away
  s = await score(page);
  const ruler = at(s, 5.5);
  await page.mouse.click(ruler.x, ruler.y - 44, { button: 'right' });
  await expect(menu(page)).toContainText('Bar 2');
  await menu(page).getByRole('menuitem', { name: 'Remove bar 2' }).click();
  await expect(page.getByTestId('status')).toContainText('4×1');
  await expect(page.locator('.toast')).toContainText('Bar 2 removed');
  await expectSeq(page, '(2) 3 3 2 │ ·');
});

test('the menu by keyboard, and one step in for the bar', async ({ page }) => {
  const s = await score(page);
  await page.mouse.click(at(s, P(3.5)).x, at(s, P(3.5)).y);
  await page.keyboard.press('Shift+F10');
  await expect(menu(page)).toContainText('Group of 3');
  await menu(page).getByRole('menuitem', { name: 'Bar 1' }).click();
  await expect(menu(page).getByRole('menuitem', { name: 'Add a bar after' })).toBeVisible();
  await menu(page).getByRole('menuitem', { name: 'Add a bar after' }).click();
  await expect(page.getByTestId('status')).toContainText('4×3');
});

test('removing bars: select them, then Backspace twice, the button, or ⇧⌫', async ({ page }) => {
  const s = await score(page);
  const ruler = at(s, 5.5);
  await page.mouse.click(ruler.x, ruler.y - 44, { button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Select the bar' }).click();
  await expect(page.getByTestId('caretname')).toContainText('16 pulses');
  const remove = page.getByRole('button', { name: 'Remove bar 2' });
  await expect(remove).toBeVisible();
  // Backspace empties the bar and offers to take the bar away; a second one does
  await page.keyboard.press('Backspace');
  await expectSeq(page, '(2) 3 3 2 │ ·');
  await expect(page.getByTestId('status')).toContainText('4×2');
  await expect(page.locator('.toast')).toContainText('Bar 2 emptied');
  await page.keyboard.press('Backspace');
  await expect(page.getByTestId('status')).toContainText('4×1');
  await page.keyboard.press('z');
  await page.keyboard.press('z');
  await expectSeq(page, DEFAULT_SEQ);

  // ⇧⌫ with a caret in bar 1: that bar goes, with what is in it
  const s2 = await score(page);
  await page.mouse.click(at(s2, P(12)).x, at(s2, P(12)).y);
  await page.keyboard.press('Shift+Backspace');
  await expect(page.locator('.toast')).toContainText('Bar 1 removed');
  await expect(page.getByTestId('status')).toContainText('4×1');
});

test('a finger held on a group opens its menu; dragging on moves the group instead', async ({
  page,
  hasTouch,
}) => {
  test.skip(!hasTouch, 'touch only');
  const f = await fingers(page);
  let s = await score(page);
  await f.swipe([at(s, P(3.5))], 650);
  await expect(menu(page)).toContainText('Group of 3');
  await menu(page).getByRole('menuitem', { name: 'Select several' }).tap();
  await expect(menu(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Select several' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Done, clear the selection' }).tap();

  // held, then dragged: the menu goes away and the group moves two pulses (over its neighbour)
  s = await score(page);
  await f.swipe([at(s, P(3.5)), at(s, P(5.5))], 650);
  await expect(menu(page)).toHaveCount(0);
  await expectSeq(page, '(4) 3 1 2 │ 3 (1) 3 2 4');

  // held on empty time: the caret's menu; by touch a bar is removed on the second tap
  s = await score(page);
  await f.swipe([at(s, P(13))], 650);
  await expect(menu(page)).toContainText('Bar 1, beat 4');
  await menu(page).getByRole('menuitem', { name: 'Bar 1' }).tap();
  await menu(page).getByRole('menuitem', { name: 'Remove bar 1' }).tap();
  await expect(page.getByTestId('status')).toContainText('4×2');
  await menu(page).getByRole('menuitem', { name: 'Remove bar 1?' }).tap();
  await expect(page.getByTestId('status')).toContainText('4×1');
});
