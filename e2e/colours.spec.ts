import { expect, test } from '@playwright/test';
import { DEFAULT_SEQ, expectSeq, more, ready } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('a tile gets a random colour and its size colour back (button, H, ⇧H, undo)', async ({
  page,
}) => {
  await page.keyboard.press('Shift+KeyA');
  const bar = page.getByRole('toolbar', { name: 'Selected groups' });
  await more(page);
  const back = bar.getByRole('button', { name: 'Size colour' });
  await expect(back).toHaveCount(0);
  await bar.getByRole('button', { name: 'Random colour' }).click();
  await expect(back).toBeVisible();
  await back.click();
  await expect(back).toHaveCount(0);
  await page.keyboard.press('KeyH');
  await expect(back).toBeVisible();
  await page.keyboard.press('Shift+KeyH');
  await expect(back).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+KeyZ');
  await expect(back).toBeVisible();
  await expectSeq(page, DEFAULT_SEQ); // nothing else changed
});

test('palettes: Classic by default, another one is remembered', async ({ page }) => {
  await page.getByText('Colours', { exact: true }).click();
  await expect(page.getByRole('radio', { name: /Classic/ })).toBeChecked();
  await page.getByRole('radio', { name: /Ocean/ }).check();
  await page.reload();
  await ready(page);
  await page.getByText('Colours', { exact: true }).click();
  await expect(page.getByRole('radio', { name: /Ocean/ })).toBeChecked();
});

test('a colour chosen for a tile (Colour…, a swatch, any colour, ⌥H)', async ({ page }) => {
  await page.keyboard.press('Shift+KeyA');
  const bar = page.getByRole('toolbar', { name: 'Selected groups' });
  await more(page);
  await bar.getByRole('button', { name: 'Colour…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Colour' });
  await expect(dialog).toBeVisible();
  const swatch = dialog.getByRole('button', { name: /Classic colour 5 / });
  await swatch.click();
  await expect(swatch).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Size colour' }).click();
  await expect(dialog.getByRole('button', { name: 'Size colour' })).toHaveCount(0);
  await dialog.getByTestId('color-any').fill('#123456');
  await expect(dialog.getByRole('button', { name: 'Size colour' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();
  await expect(bar.getByRole('button', { name: 'Size colour' })).toBeVisible();
  await page.keyboard.press('Alt+KeyH');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expectSeq(page, DEFAULT_SEQ);
});
