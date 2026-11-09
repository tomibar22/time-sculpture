import { expect, test } from '@playwright/test';
import { DEFAULT_SEQ, expectSeq, ready } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('the stage shows the score alone, plays once with no count-in, and edits nothing', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Stage' }).click();
  const stage = page.locator('.stage');
  await expect(stage).toBeVisible();
  await expect(page.getByRole('heading', { name: 'First phrase' })).toBeVisible();
  // no editing chrome
  await expect(page.locator('.dock')).toHaveCount(0);
  await expect(page.getByTestId('sequence')).toHaveCount(0);

  // settings cycle and are kept
  const count = page.getByRole('button', { name: /^Count-in/ });
  await expect(count).toContainText('1 bar');
  await count.click();
  await count.click();
  await expect(count).toContainText('off');
  const sound = page.getByRole('button', { name: /^Sound/ });
  await sound.click();
  await expect(sound).toContainText('click only');
  await expect(page.getByRole('button', { name: 'Loop' })).toHaveAttribute('aria-pressed', 'false');

  // typing and taps do nothing here
  await page.keyboard.press('3');
  await page.getByTestId('score').click({ position: { x: 100, y: 60 } });

  // fast, once: it plays, the controls step aside, and it stops after landing on 1
  await page.locator('.stage-bar input[type=range]').fill('160');
  await page.keyboard.press('Space');
  await expect(stage).toHaveClass(/quiet/);
  await expect(page.locator('.stage-bars')).toContainText('bar 1 / 2');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 10_000 });
  await expect(stage).not.toHaveClass(/quiet/);

  await page.keyboard.press('Escape');
  await expect(stage).toHaveCount(0);
  await expectSeq(page, DEFAULT_SEQ);
  // remembered
  await page.keyboard.press('f');
  await expect(page.getByRole('button', { name: /^Count-in/ })).toContainText('off');
  await page.keyboard.press('f');
  await expect(stage).toHaveCount(0);
});

test('a count-in shows the beats before the piece starts', async ({ page }) => {
  await page.keyboard.press('f');
  await page.locator('.stage-bar input[type=range]').fill('160');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.countdown')).toHaveText('1');
  await expect(page.locator('.countdown')).toHaveText('2');
  await expect(page.locator('.countdown')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('.stage-bars')).toContainText('bar 1');
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});
