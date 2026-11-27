import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ready } from './helpers';

/** The library kept in order: folders in folders, sorting, filtering, moving several. */

const list = (page: Page) => page.getByRole('list', { name: 'Saved compositions' });
const library = (page: Page) => page.getByRole('button', { name: 'Library', exact: true }).click();

async function newFolder(page: Page, name: string) {
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByLabel('Name of the folder').fill(name);
  await page.getByLabel('Name of the folder').press('Enter');
}

async function moveTo(page: Page, piece: string, folder: string | null) {
  await page.getByRole('button', { name: `More for ${piece}` }).click();
  await page.getByRole('button', { name: 'Move to…' }).click();
  const d = page.getByRole('dialog', { name: /^Move/ });
  await d.getByRole('button', { name: folder ?? 'The top of the library' }).click();
}

test('folders in folders: make, move into, go in and out, delete keeps what is inside', async ({
  page,
}) => {
  await page.goto('/');
  await ready(page);
  await library(page);
  await page.getByRole('button', { name: /Surprise me/ }).click();
  await library(page);

  await newFolder(page, 'Etudes');
  const etudes = list(page).getByRole('button', { name: /^Etudes/ });
  await expect(etudes).toContainText('empty');
  await moveTo(page, 'First phrase', 'Etudes');
  await expect(page.getByRole('status').filter({ hasText: 'Moved' })).toContainText('Etudes');
  await expect(etudes).toContainText('1');
  // one folder and the surprise at the top
  await expect(list(page).getByRole('listitem')).toHaveCount(2);

  // inside: a folder inside it, and a new piece made here stays here
  await etudes.click();
  await expect(page.getByRole('navigation', { name: 'Folders' })).toContainText('Etudes');
  await expect(list(page).getByRole('listitem')).toHaveCount(1);
  await newFolder(page, 'Tihais');
  await page.getByRole('button', { name: 'Blank', exact: true }).click();
  await library(page);
  await expect(list(page).getByRole('button', { name: /^Untitled/ })).toBeVisible();

  // a folder cannot go into itself
  await page.getByRole('button', { name: 'More for the folder Tihais' }).click();
  await page.getByRole('button', { name: 'Move to…' }).click();
  const d = page.getByRole('dialog', { name: /^Move/ });
  await expect(d.getByRole('button', { name: 'Tihais' })).toBeDisabled();
  await page.keyboard.press('Escape');

  // back to the top by the path; delete Etudes: its pieces and folder come up
  await page
    .getByRole('navigation', { name: 'Folders' })
    .getByRole('button', { name: 'All' })
    .click();
  await page.getByRole('button', { name: 'More for the folder Etudes' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete the folder' }).click();
  await expect(list(page).getByRole('button', { name: /^Tihais/ })).toBeVisible();
  await expect(list(page).getByRole('button', { name: /^First phrase/ })).toBeVisible();
  await expect(list(page).getByRole('button', { name: /^Untitled/ })).toBeVisible();

  // and it is all still so after a reload
  await page.keyboard.press('Escape');
  await page.reload();
  await ready(page);
  await library(page);
  await expect(list(page).getByRole('listitem')).toHaveCount(4);
});

test('sort and filter by what the pieces are; select several and move them', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await library(page);
  await page.getByRole('button', { name: 'Blank', exact: true }).click();
  await page.getByLabel('Name of the composition').fill('Alpha');
  await page.getByLabel('Name of the composition').press('Enter');
  await page.waitForTimeout(600);
  await library(page);

  await page.getByLabel('Sort by').selectOption('name');
  const names = list(page).locator('.lib-open .t');
  await expect(names).toHaveText(['Alpha', 'First phrase']);
  await page.getByRole('button', { name: 'The other way round' }).click();
  await expect(names).toHaveText(['First phrase', 'Alpha']);

  // filter: First phrase has something written but is not finished, Alpha is empty
  await page.getByRole('button', { name: 'Filter' }).click();
  await expect(page.getByRole('group', { name: 'Number of tiles' })).toHaveCount(0);
  const chip = page.getByRole('button', { name: /^Up to 4 bars/ });
  await expect(chip).toHaveCount(0); // both are 2 bars: nothing to tell apart
  await page.getByRole('button', { name: 'Filter' }).click();

  // select both, move them into a new folder made from the Move dialog
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page
    .getByRole('toolbar', { name: 'Selected compositions' })
    .getByRole('button', { name: 'All' })
    .click();
  await page
    .getByRole('toolbar', { name: 'Selected compositions' })
    .getByRole('button', { name: 'Move to…' })
    .click();
  await page.getByLabel('Name of a new folder').fill('Sketches');
  await page.getByRole('button', { name: 'Move there' }).click();
  await expect(list(page).getByRole('listitem')).toHaveCount(1);
  await expect(list(page).getByRole('button', { name: /^Sketches/ })).toContainText('2');

  // a search looks inside folders and says where a piece is
  await page.getByLabel('Search compositions').fill('alp');
  await expect(list(page).getByRole('button', { name: /^Alpha/ })).toContainText('Sketches');
  await expect(page.getByText('1 of 2')).toBeVisible();
});
