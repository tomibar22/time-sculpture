import { expect, test } from '@playwright/test';
import { DEFAULT_SEQ, expectSeq, fillFold, more, ready } from './helpers';

// the defaults a newcomer meets: fresh storage, nothing set
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('the bars show the main actions; More shows the rest, and stays open', async ({ page }) => {
  await page.keyboard.press('Shift+KeyA');
  const bar = page.getByRole('toolbar', { name: 'Selected groups' });
  await expect(bar.getByRole('button', { name: 'Split' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Vary…' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Total' })).toHaveCount(0);
  await more(page);
  await expect(page.getByTestId('bar-more')).toHaveText('Less');
  await expect(bar.getByRole('button', { name: 'Total' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Select several' })).toBeVisible();
  // remembered on this device, also for the caret bar
  await page.reload();
  await ready(page);
  await page.keyboard.press('Shift+KeyA');
  await expect(bar.getByRole('button', { name: 'Total' })).toBeVisible();
  await page.getByTestId('bar-more').click();
  await expect(bar.getByRole('button', { name: 'Total' })).toHaveCount(0);
});

test('a newcomer gets one line of help, put away for good', async ({ page }) => {
  const hint = page.getByTestId('first-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('a number to write');
  await hint.getByRole('button', { name: /hide this hint/ }).click();
  await expect(hint).toHaveCount(0);
  await page.reload();
  await ready(page);
  await expect(page.getByTestId('first-hint')).toHaveCount(0);
});

test('Browse folds the sizes and the shapes on every screen', async ({ page }) => {
  await page.getByRole('button', { name: 'Fill it…' }).first().click();
  await expect(page.getByTestId('fill-7')).toBeHidden();
  await fillFold(page, 'Sizes');
  await expect(page.getByTestId('fill-7')).toBeVisible();
});
