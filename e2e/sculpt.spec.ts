import { expect, test } from '@playwright/test';
import { DEFAULT_SEQ, expectSeq, ready } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('keep a fill, breed from it, and fill from the next generation', async ({ page }) => {
  await page.getByRole('button', { name: 'Browse fills…' }).click();
  await page.getByTestId('fill-1').click();
  const list = page.getByRole('list', { name: 'Ways to fill' });
  await list
    .getByRole('button', { name: /^Keep / })
    .first()
    .click();
  await expect(page.getByRole('button', { name: /Mine/ })).toBeVisible();
  await page.getByRole('button', { name: /Breed/ }).click();
  await expect(page.getByRole('button', { name: /Generation 1/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await list.locator('.fill-main').first().click();
  await expect(page.getByTestId('status')).toContainText('Complete · lands on 1');
});

test('the map: arrow keys walk between fills, Enter uses one', async ({ page }) => {
  await page.getByRole('button', { name: 'Browse fills…' }).click();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  const map = page.getByRole('application', { name: /Map of/ });
  await map.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('status')).toContainText('Complete · lands on 1');
});

test('vary with a locked group: it keeps its place', async ({ page }) => {
  await page.keyboard.press('Shift+KeyA');
  await page.keyboard.press('Shift+KeyV');
  const lock = page.getByRole('group', { name: 'Lock groups' });
  // lock the first written group (after the opening silence)
  await lock.getByRole('button').nth(1).click();
  await expect(lock.getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  const list = page.getByRole('list', { name: 'Variations' });
  await list.locator('.fill-main').nth(1).click();
  await expect(page.getByTestId('sequence')).toContainText('(2) 3');
  // a new branch, and back to the start through the trail
  await page.getByRole('button', { name: 'From here' }).click();
  const trail = page.getByRole('group', { name: 'Where you have been' });
  await trail.getByRole('button').first().click();
  await expect(page.getByTestId('sequence')).toContainText('(2) 3 3 2');
});
