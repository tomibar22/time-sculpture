import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, expectSeq, P, ready, score, tap } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('fill the open space randomly with chosen sizes', async ({ page }) => {
  await page.getByRole('button', { name: 'Fill randomly…' }).click();
  // only 3s: 9 open pulses → exactly 3 3 3
  for (const n of [2, 4, 5, 7]) await page.getByTestId(`fill-${n}`).click();
  await expect(page.locator('.fillpanel')).toContainText('1 possible fill');
  await page.getByRole('button', { name: 'Fill', exact: true }).click();
  await expectSeq(page, '(2) 3 3 2 3 3 3 │ 3 (1) 3 2 4');
  await expect(page.getByTestId('status')).toContainText('Complete');
});

test('sizes that cannot fill the space are refused', async ({ page }) => {
  await page.getByRole('button', { name: 'Fill randomly…' }).click();
  for (const n of [2, 3, 5, 7]) await page.getByTestId(`fill-${n}`).click(); // only 4 left
  await expect(page.locator('.fillpanel')).toContainText("can't fill 9");
  await expect(page.getByRole('button', { name: 'Fill', exact: true })).toHaveCount(0);
});

test('⇧A selects every tile', async ({ page }) => {
  await page.keyboard.press('Shift+A');
  await expect(page.getByTestId('selname')).toContainText('9 selected');
});

test('browse fills for a selected range, sorted, and pick one', async ({ page }) => {
  const s = await score(page);
  // select the two 3s (pulses 2–8) as tiles, then refill them
  await tap(page, at(s, P(3.5)));
  await tap(page, at(s, P(6.5)), ['Shift']);
  await page.getByRole('button', { name: 'Refill…' }).click();
  for (const n of [4, 5, 7]) await page.getByTestId(`fill-${n}`).click(); // 2 and 3 left
  const list = page.getByRole('list', { name: 'Ways to fill' });
  await expect(list.getByRole('listitem')).toHaveCount(2); // 6 pulses: 2 2 2 or 3 3
  await expect(list.getByRole('button').first()).toContainText('3 ×2'); // shapes first
  await page.getByRole('button', { name: 'Anything' }).click();
  await page.locator('#fill-sort').selectOption('most');
  // a tap tries it (shown, not written); Use writes it
  await list.getByRole('button').first().click();
  await expectSeq(page, DEFAULT_SEQ);
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  await expectSeq(page, '(2) 2 2 2 2 │ 3 (1) 3 2 4');
});
