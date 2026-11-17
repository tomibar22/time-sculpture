import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, drag, expectSeq, knobAt, P, ready, score, tap } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('a drag whose release was never heard ends: the selection no longer follows the mouse', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'mouse');
  const s = await score(page);
  const from = at(s, P(13));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y);
  // the button comes back up outside the window: the next move arrives with no button held
  await page.getByTestId('score').evaluate(
    (c, [x, y]) =>
      c.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerType: 'mouse',
          pointerId: 1,
          isPrimary: true,
          buttons: 0,
          clientX: x,
          clientY: y,
        }),
      ),
    [from.x + 60, from.y],
  );
  const name = page.getByTestId('caretname');
  const before = await name.innerText();
  await page.mouse.move(from.x + 200, from.y + 120);
  await expect(name).toHaveText(before);
  await page.mouse.up();
});

test('a click off the score lets go of the selected range, as in a word processor', async ({
  page,
}) => {
  const s = await score(page);
  await tap(page, at(s, P(2)));
  await tap(page, at(s, P(10)), ['Shift']);
  await expect(page.getByTestId('caretname')).toContainText('8 pulses');
  // a control keeps it
  await page.getByRole('button', { name: /Loop/ }).first().click();
  await page.getByRole('button', { name: /Stop/ }).first().click();
  await expect(page.getByTestId('caretname')).toContainText('8 pulses');
  // the page around the score lets go of it
  await page.mouse.click(4, 300);
  await expect(page.getByTestId('caretname')).toContainText('Caret');
});

test('a caret where a row ends shows at both ends; its upper knob selects back from there', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'mouse');
  const s = await score(page);
  // the right gutter of the first row: the caret at the end of bar 1 (= the start of bar 2)
  await page.mouse.click(s.x + s.w - 6, at(s, 0).y);
  await expect(page.getByTestId('caretname')).toHaveText('Caret · bar 2, beat 1');
  await drag(page, knobAt(s, 4, 0), knobAt(s, 3, 0));
  await expect(page.getByTestId('caretname')).toContainText('4 pulses');
});

test('⇧⌘Z redoes, also with the tempo slider in focus', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'keyboard');
  await page.keyboard.press('3');
  await expectSeq(page, '(2) 3 3 2 3 │ 3 (1) 3 2 4');
  await page.getByRole('slider').first().focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expectSeq(page, DEFAULT_SEQ);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expectSeq(page, '(2) 3 3 2 3 │ 3 (1) 3 2 4');
});

test('a new phrase mark asks for its name at once', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(8)));
  await page.getByRole('button', { name: 'Phrase mark' }).click();
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  await expect(name).toBeFocused();
  await name.fill('Answer');
  await name.press('Enter');
  await expect(page.getByTestId('announcer')).toHaveText('Phrase mark: Answer');
});
