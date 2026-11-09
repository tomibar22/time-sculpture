import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, expectSeq, P, ready, score, showPad, tap } from './helpers';

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
