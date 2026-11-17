import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, expectSeq, P, ready, score, tap } from './helpers';

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
