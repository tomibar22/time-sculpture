import { expect, test } from '@playwright/test';
import { DEFAULT_SEQ, expectSeq, fillFold, ready } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('Fill, Land and Vary share one head: move between them on the same stretch', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Fill it…' }).click();
  const head = page.locator('.panel-head');
  await expect(page.getByTestId('panel-browse')).toHaveAttribute('aria-pressed', 'true');
  // the open space is not a passage yet: Vary waits for something written
  await expect(page.getByTestId('panel-vary')).toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('panel-land').click();
  await expect(page.getByTestId('panel-land')).toHaveAttribute('aria-pressed', 'true');
  await expect(head).toContainText('9 pulses');
  // land 3 three times: written, and the stretch stays the region, so Vary can take it on
  await page.getByTestId('land-3').click();
  const ways = page.getByRole('list', { name: 'Ways it lands' });
  await ways.locator('.fill-main').first().click();
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  await expect(page.getByTestId('sequence')).toContainText('3 3 3');
  await expect(page.getByTestId('panel-vary')).not.toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('panel-vary').click();
  await expect(page.getByRole('list', { name: 'Variations' })).toBeVisible();
  // back to Fill: what was just written is under Recent
  await page.getByTestId('panel-browse').click();
  await fillFold(page, 'Shape');
  await expect(page.getByRole('button', { name: /Recent/ }).first()).toBeVisible();
  // Esc closes the panel, the stretch stays selected
  await page.keyboard.press('Escape');
  await expect(page.locator('.fillpanel')).toHaveCount(0);
});

test('Land: keep a way with the heart; a pattern landed comes back as "Lately"', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Land…' }).first().click();
  await page.getByTestId('land-2').click();
  const ways = page.getByRole('list', { name: 'Ways it lands' });
  await ways.getByRole('button', { name: /^Keep / }).first().click();
  await expect(ways.locator('.fill-heart[aria-pressed="true"]')).toHaveCount(1);
  await ways.locator('.fill-main').first().click();
  await ways.locator('.fill-main').first().click();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByRole('button', { name: 'Lately 2' })).toBeVisible();
  // the landing options fold into one line that says what is set
  const opts = page.getByTestId('land-options');
  await expect(opts).toContainText('on the end');
  await opts.click();
  await page.getByTestId('land-on1').click();
  await expect(opts).toContainText('last tile');
});
