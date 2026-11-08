import { expect, test } from '@playwright/test';
import { at, clearAll, DEFAULT_SEQ, expectSeq, P, score, showPad, tap, ready } from './helpers';

// Default: (2) 3 3 2 │ 3 (1) 3 2 4 — lines at pulses 2, 5, 8; open space 10–19.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('tap a line to place a caret, then type sizes and silences', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(5)));
  await expect(page.getByTestId('caretname')).toContainText('bar 1, beat 2 +1/4');
  await page.keyboard.press('1');
  await expectSeq(page, '(2) 3 1 3 2 │ 3 (1) 3 2 4');
  await page.keyboard.press('Shift+2');
  await expectSeq(page, '(2) 3 1 (2) 3 2 │ 3 (1) 3 2 4');
});

test('quick digits are separate groups', async ({ page }) => {
  await clearAll(page);
  const s = await score(page);
  await tap(page, at(s, P(0.2)));
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await expectSeq(page, '1 2 │ ·');
  await page.keyboard.press('z');
  await expectSeq(page, '1 │ ·');
});

test('typing over a selection replaces it', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await page.keyboard.press('5');
  await expectSeq(page, '(2) 5 3 2 │ 3 (1) 3 2 4');
});

test('Backspace and Delete remove beside the caret', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(5)));
  await page.keyboard.press('Backspace');
  await expectSeq(page, '(2) 3 2 │ 3 (1) 3 2 4');
  await page.keyboard.press('Delete');
  await expectSeq(page, '(2) 2 │ 3 (1) 3 2 4');
});

test('copy a group and paste it at the start of the ending', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await page.keyboard.press('ControlOrMeta+c');
  await tap(page, at(s, P(18.8)));
  await page.keyboard.press('ControlOrMeta+v');
  await expectSeq(page, '(2) 3 3 2 │ 3 3 (1) 3 2 4');
});

test('cut and paste moves a phrase', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5)));
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByTestId('selname')).toContainText('2 selected');
  await page.keyboard.press('ControlOrMeta+x');
  await expectSeq(page, '(2) 2 │ 3 (1) 3 2 4');
  await page.keyboard.press('End');
  await page.keyboard.press('ControlOrMeta+v');
  await expectSeq(page, '(2) 2 │ 3 (1) 3 2 4 3 3');
});

test('Shift+arrows select pulses like text; typing fills the selection', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(2)));
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByTestId('caretname')).toContainText('3 pulses');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(page.getByTestId('caretname')).toContainText('2 pulses');
  // the 2 pulses cut the first 3: typing 1 writes a 1 and silences the rest of the selection
  await page.keyboard.press('1');
  await expectSeq(page, '(2) 1 (1) (1) 3 2 │ 3 (1) 3 2 4');
});

test('the caret moves pulse by pulse, also inside tiles', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(2)));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('caretname')).toContainText('bar 1, beat 1 +3/4');
  // typing inside a tile splits it: head, the new group, then silence for the old tail
  await page.keyboard.press('1');
  await expectSeq(page, '(2) 1 1 (2) 3 2 │ 3 (1) 3 2 4');
});

test('Backspace on a range silences it', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(2)));
  for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Backspace');
  await expectSeq(page, '(2) (6) 2 │ 3 (1) 3 2 4');
});

test('resize and reverse a selection', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(20.5)));
  await tap(page, at(s, P(27)), ['Shift']);
  await page.keyboard.press('Shift+R');
  await expectSeq(page, '(2) 3 3 2 │ 2 3 (1) 3 4');
  await page.keyboard.press('Escape');
  await tap(page, at(s, P(3.5)));
  await page.keyboard.press('+');
  await expectSeq(page, '(2) 4 3 2 │ 2 3 (1) 3 4');
});

test('touch: the number pad and the Paste button work at the caret', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(8)));
  await showPad(page);
  await page.getByTestId('key-4').click();
  await expectSeq(page, '(2) 3 3 4 2 │ 3 (1) 3 2 4');
  const s2 = await score(page); // the tray click scrolled the page
  await tap(page, at(s2, P(3.5)));
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await page.getByRole('button', { name: 'Done, clear the selection' }).click();
  await page.getByRole('button', { name: 'Paste 3' }).click();
  await expectSeq(page, '(2) 3 3 3 4 2 │ 3 (1) 3 2 4');
});

test('paste a phrase typed as text', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await clearAll(page);
  const s = await score(page);
  await tap(page, at(s, P(0.2)));
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', '3 (2) 4');
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  });
  await expectSeq(page, '3 (2) 4 │ ·');
});
