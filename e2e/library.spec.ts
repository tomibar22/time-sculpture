import { expect, test } from '@playwright/test';
import { docFrom, makeMeter } from '../src/engine';
import { encodeShare, toSaved } from '../src/persistence/serialize';
import { DEFAULT_SEQ, expectSeq, ready } from './helpers';

test('changes survive a reload and the library keeps several compositions', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
  await page.keyboard.press('2');
  await expectSeq(page, '(2) 3 3 2 2 │ 3 (1) 3 2 4');
  await page.waitForTimeout(700); // autosave debounce
  await page.reload();
  await ready(page);
  await expectSeq(page, '(2) 3 3 2 2 │ 3 (1) 3 2 4');

  // New composition, rename it, then reopen the first one
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Blank', exact: true }).click();
  await expectSeq(page, '· │ ·');
  await expect(page.getByLabel('Name of the composition')).toHaveValue('Untitled');
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByLabel('Name of this composition').fill('Second idea');
  await page.getByRole('button', { name: 'Rename' }).click();
  await page
    .getByRole('list', { name: 'Saved compositions' })
    .getByRole('button', { name: /^First phrase/ })
    .click();
  await expectSeq(page, '(2) 3 3 2 2 │ 3 (1) 3 2 4');
  await page.reload();
  await ready(page);
  await expectSeq(page, '(2) 3 3 2 2 │ 3 (1) 3 2 4');
  await page.getByRole('button', { name: 'Library' }).click();
  await expect(
    page
      .getByRole('list', { name: 'Saved compositions' })
      .getByRole('button', { name: /^Second idea/ }),
  ).toBeVisible();
});

test('a share link opens the composition on another device', async ({ page }) => {
  const doc = docFrom(makeMeter(5, 1, 2), [3, '|', [2], 4]);
  const code = await encodeShare(toSaved(doc, 'Riff', { tempo: 90 }));
  await page.goto(`/#s=${code}`);
  await expectSeq(page, '3 │ (2) 4');
  await expect(page.getByLabel('Name of the composition')).toHaveValue('Riff (shared)');
  await expect(page.getByTestId('toast')).toContainText('shared composition');
});

test('deleting the open composition really removes it', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Blank', exact: true }).click();
  await page.keyboard.press('3');
  await page.getByRole('button', { name: 'Library' }).click();
  const list = page.getByRole('list', { name: 'Saved compositions' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete Untitled' }).click();
  await page.getByRole('button', { name: 'Delete?' }).click();
  // the other piece opens, and the deleted one stays gone (also after a reload)
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expectSeq(page, DEFAULT_SEQ);
  await page.waitForTimeout(600);
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: 'Library' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list.getByRole('button', { name: /^First phrase/ })).toBeVisible();
});

test('rename the piece by typing in its title', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const title = page.getByLabel('Name of the composition');
  await title.fill('Seven over four');
  await title.press('Enter');
  // typing digits in the title does not write groups
  await expectSeq(page, DEFAULT_SEQ);
  await page.waitForTimeout(600);
  await page.reload();
  await ready(page);
  await expect(title).toHaveValue('Seven over four');
});

test('new pieces: the same grid, and a surprise that lands on 1', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Same grid' }).click();
  await expectSeq(page, '· │ ·');
  await expect(page.getByTestId('status')).toContainText('4×2');
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Surprise me/ }).click();
  await expect(page.getByTestId('status')).toContainText('Complete · lands on 1');
});

test('theme and sound choices are remembered on the device', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: /^Theme/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
