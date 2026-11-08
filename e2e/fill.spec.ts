import { expect, test } from '@playwright/test';
import { DEFAULT_SEQ, expectSeq, ready } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('fill the open space randomly with chosen sizes', async ({ page }) => {
  await page.getByRole('button', { name: 'Fill randomly…' }).click();
  // only 3s: 9 open pulses → exactly 3 3 3
  for (const n of [2, 4, 5, 7]) await page.getByTestId(`fill-${n}`).click();
  await expect(page.getByRole('dialog')).toContainText('1 possible fill');
  await page.getByRole('button', { name: 'Fill', exact: true }).click();
  await expectSeq(page, '(2) 3 3 2 3 3 3 │ 3 (1) 3 2 4');
  await expect(page.getByTestId('status')).toContainText('Complete');
});

test('sizes that cannot fill the space are refused', async ({ page }) => {
  await page.getByRole('button', { name: 'Fill randomly…' }).click();
  for (const n of [2, 3, 5, 7]) await page.getByTestId(`fill-${n}`).click(); // only 4 left
  await expect(page.getByRole('dialog')).toContainText("can't fill 9");
  await expect(page.getByRole('button', { name: 'Fill', exact: true })).toBeDisabled();
});

test('⇧A selects every tile', async ({ page }) => {
  await page.keyboard.press('Shift+A');
  await expect(page.getByTestId('selname')).toContainText('9 selected');
});
