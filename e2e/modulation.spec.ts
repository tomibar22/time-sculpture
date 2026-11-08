import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, expectSeq, P, ready, score, tap } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('modulate mid-bar, see where the piece lands, fix it, edit and remove', async ({ page }) => {
  const s = await score(page);
  // caret on the line at pulse 8 = bar 1, beat 3 (the end of the second 3)
  await tap(page, at(s, P(8)));
  await page.keyboard.press('t');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Modulate here');
  // 2:1 = 1:1 → a new beat lasts ½ an old one (♩ 72 → 144)
  await dialog
    .getByRole('group', { name: 'Ratio before' })
    .getByRole('button', { name: '2:1' })
    .click();
  await dialog
    .getByRole('group', { name: 'Ratio after' })
    .getByRole('button', { name: '1:1' })
    .click();
  await expect(dialog).toContainText('144');
  await dialog.getByRole('button', { name: 'Modulate', exact: true }).click();
  // 2 main beats + 6 beats at half length = 5 main beats: one past a main 1
  await expect(page.getByTestId('landing')).toContainText('Ends 1 main beat after a main 1');
  await page.getByRole('button', { name: /Add 6 beats at the end/ }).click();
  await expect(page.getByTestId('status')).toContainText('Ends on 1 of the main tempo');
  // the marker opens the modulation for editing; remove it
  await page.keyboard.press('z'); // back to before the fix
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const s2 = await score(page);
  // the modulation starts a new row: its marker sits right after that row's "1"
  await page.mouse.click(s2.x + 4 + 40, s2.y + 4 + 127 + 10);
  await expect(dialog).toContainText('Modulation');
  await dialog.getByRole('button', { name: 'Remove modulation' }).click();
  await expect(page.getByTestId('landing')).toHaveCount(0);
});
