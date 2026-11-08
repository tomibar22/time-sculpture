import { expect, test } from '@playwright/test';
import { docFrom, makeMeter } from '../src/engine';
import { encodeShare, toSaved } from '../src/persistence/serialize';
import { DEFAULT_SEQ, expectSeq } from './helpers';

test('changes survive a reload and the library keeps several compositions', async ({ page }) => {
  await page.goto('/');
  await expectSeq(page, DEFAULT_SEQ);
  await page.getByTestId('piece-2').click();
  await expectSeq(page, '(2) 3 3 2 │ 2 3 (1) 3 2 4');
  await page.waitForTimeout(700); // autosave debounce
  await page.reload();
  await expectSeq(page, '(2) 3 3 2 │ 2 3 (1) 3 2 4');

  // New composition, rename it, then reopen the first one
  await page.getByRole('button', { name: 'First phrase' }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expectSeq(page, '· │ ·');
  await page.getByRole('button', { name: 'Untitled' }).click();
  await page.getByLabel('Name of this composition').fill('Second idea');
  await page.getByRole('button', { name: 'Rename' }).click();
  await page
    .getByRole('list', { name: 'Saved compositions' })
    .getByRole('button', { name: /^First phrase/ })
    .click();
  await expectSeq(page, '(2) 3 3 2 │ 2 3 (1) 3 2 4');
  await page.reload();
  await expectSeq(page, '(2) 3 3 2 │ 2 3 (1) 3 2 4');
  await page.getByRole('button', { name: 'First phrase' }).click();
  await expect(
    page
      .getByRole('list', { name: 'Saved compositions' })
      .getByRole('button', { name: /^Second idea/ }),
  ).toBeVisible();
});

test('a share link opens the composition on another device', async ({ page }) => {
  const doc = docFrom(makeMeter(5, 1, 2), [3, '|', [2], 4]);
  const code = await encodeShare(toSaved(doc, 'Riff', { tray: [2, 3, 4], tempo: 90 }));
  await page.goto(`/#s=${code}`);
  await expectSeq(page, '3 │ (2) 4');
  await expect(page.getByRole('button', { name: 'Riff (shared)' })).toBeVisible();
  await expect(page.getByTestId('toast')).toContainText('shared composition');
});
