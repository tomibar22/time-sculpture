import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, expectSeq, P, ready, score, tap } from './helpers';

/** Height of the lane above every row once the piece has an ending or a ×3 (geometry LANE_H). */
const LANE = 18;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('repeat signs, a count and an ending, edited and kept after a reload', async ({ page }) => {
  let s = await score(page);
  // |: between the two 3s, :| after the 2 (pulses 5 and 10 of the first bar)
  await tap(page, at(s, P(5)));
  await page.getByRole('button', { name: '|: Start repeat' }).click();
  await expect(page.getByRole('button', { name: 'Remove |:' })).toBeVisible();
  await tap(page, at(s, P(10)));
  await page.getByRole('button', { name: ':| End repeat' }).click();
  await expect(page.getByTestId('announcer')).toHaveText(
    'End repeat here: the passage plays twice',
  );
  await expect(page.getByTestId('repeat-times')).toHaveText('×2');

  // an ending over the second 3 and the 2 (a range from the caret, shift-click to extend)
  await tap(page, at(s, P(5)));
  await tap(page, at(s, P(10)), ['Shift']);
  await page.getByRole('button', { name: 'Ending…' }).click();
  await expect(page.getByRole('heading', { name: 'New ending' })).toBeVisible();
  // it closes the repeat, so it is the 1st ending
  await expect(page.getByRole('button', { name: '1.', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Add ending' }).click();
  await expect(page.getByTestId('announcer')).toHaveText('Ending 1.');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // now the rows have a lane above them; play the passage three times
  s = await score(page);
  await tap(page, at(s, P(10), LANE));
  await page.getByRole('button', { name: 'Play it one time more' }).click();
  await expect(page.getByTestId('repeat-times')).toHaveText('×3');

  // tap the bracket to edit it: played on passes 1 and 2
  await page.keyboard.press('Escape');
  await page.mouse.click(at(s, P(7)).x, s.y + 4 + LANE / 2);
  await expect(page.getByRole('heading', { name: 'Ending', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '2.', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('announcer')).toHaveText('Ending 1. 2.');

  // the phrase itself is untouched, and everything is saved with the piece
  await expectSeq(page, DEFAULT_SEQ);
  await page.waitForTimeout(600);
  await page.reload();
  await ready(page);
  s = await score(page);
  await tap(page, at(s, P(10), LANE));
  await expect(page.getByTestId('repeat-times')).toHaveText('×3');
  await page.keyboard.press('Escape');
  await page.mouse.click(at(s, P(7)).x, s.y + 4 + LANE / 2);
  await expect(page.getByRole('button', { name: '2.', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Remove ending' }).click();
  await expect(page.getByTestId('announcer')).toHaveText('Ending removed');
});

test('[ and ] put repeat signs at the caret; undo takes them away', async ({ page }) => {
  const s = await score(page);
  await tap(page, at(s, P(5)));
  await page.keyboard.press('BracketLeft');
  await expect(page.getByTestId('announcer')).toHaveText('Start repeat here');
  await tap(page, at(s, P(10)));
  await page.keyboard.press('BracketRight');
  await expect(page.getByRole('button', { name: 'Remove :|' })).toBeVisible();
  await page.keyboard.press('=');
  await expect(page.getByTestId('repeat-times')).toHaveText('×3');
  await page.keyboard.press('z');
  await expect(page.getByTestId('repeat-times')).toHaveText('×2');
  await page.keyboard.press('z');
  await expect(page.getByRole('button', { name: ':| End repeat' })).toBeVisible();
});
