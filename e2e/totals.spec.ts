import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, expectSeq, M, P, ready, score, settle, tap } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('a total over selected groups; tapping its bracket selects what it spans', async ({
  page,
}) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5))); // the first 3 (pulses 2–5)
  await tap(page, at(s, P(9)), ['Shift']); // through the 2 (pulses 8–10)
  await expect(page.getByTestId('selname')).toContainText('8 pulses');
  await page.getByRole('button', { name: 'Total', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove total' })).toBeVisible();
  await expectSeq(page, DEFAULT_SEQ);
  await page.keyboard.press('Escape');

  // the bracket hangs under the first row's band (level 0, 9 px into it)
  const s2 = await score(page);
  const bw = (s2.w - 2 * M) / 4;
  await page.mouse.click(s2.x + M + P(6) * bw, s2.y + 4 + 103 + 2 + 9);
  await expect(page.getByTestId('caretname')).toContainText('8 pulses');
  await page.getByRole('button', { name: 'Remove total' }).click();
  await expect(page.getByRole('button', { name: 'Total', exact: true })).toBeVisible();
  await page.keyboard.press('z');
  await expect(page.getByRole('button', { name: 'Remove total' })).toBeVisible();
});

test('a phrase mark gets a name of your choice, or none', async ({ page }) => {
  await score(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Home'); // caret at the very start
  // a new mark opens its name dialog by itself
  await page.getByRole('button', { name: 'Phrase mark' }).click();
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill('Theme');
  await name.press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();
  await settle(page);
  await page.getByRole('button', { name: 'Name…' }).click();
  await expect(name).toHaveValue('Theme');
  await name.fill('');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Name…' }).click();
  await expect(name).toHaveValue('');
  await page.getByRole('button', { name: 'Remove mark' }).click();
  await expect(page.getByRole('button', { name: 'Phrase mark' })).toBeVisible();
  await expectSeq(page, DEFAULT_SEQ);
});

test('a muted stretch: Mute in the bar, U, undo; it is kept with the piece', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(3.5))); // the first 3
  await tap(page, at(s, P(9)), ['Shift']); // through the 2
  const mute = page.getByRole('button', { name: 'Mute', exact: true });
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('muted: nothing sounds there')).toBeVisible();
  await expectSeq(page, DEFAULT_SEQ);
  await page.keyboard.press('u'); // sounds again
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('z'); // undo: muted again
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(700); // autosave
  await page.reload();
  await ready(page);
  const s2 = await score(page);
  await tap(page, at(s2, P(3.5)));
  await tap(page, at(s2, P(9)), ['Shift']);
  await expect(page.getByRole('button', { name: 'Mute', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
