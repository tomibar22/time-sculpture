import { expect, test } from '@playwright/test';
import {
  at,
  clearAll,
  DEFAULT_SEQ,
  expectSeq,
  fillFold,
  P,
  ready,
  score,
  tap,
  landOptions,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('fill the open space randomly with chosen sizes', async ({ page }) => {
  await page.getByRole('button', { name: 'Fill it…' }).click();
  // only 3s: 9 open pulses → exactly 3 3 3, which Surprise writes
  await fillFold(page, 'Sizes');
  for (const n of [2, 4, 5, 7]) await page.getByTestId(`fill-${n}`).click();
  await page.getByRole('button', { name: 'Surprise' }).click();
  await expectSeq(page, '(2) 3 3 2 3 3 3 │ 3 (1) 3 2 4');
  await expect(page.getByTestId('status')).toContainText('Complete');
});

test('sizes that cannot fill the space are refused', async ({ page }) => {
  await page.getByRole('button', { name: 'Fill it…' }).click();
  await fillFold(page, 'Sizes');
  for (const n of [2, 3, 5, 7]) await page.getByTestId(`fill-${n}`).click(); // only 4 left
  await expect(page.locator('.fillpanel')).toContainText("can't fill 9");
  await expect(page.getByRole('button', { name: 'Surprise' })).toHaveCount(0);
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
  await page.getByRole('button', { name: 'Fill…' }).click();
  await fillFold(page, 'Sizes');
  for (const n of [4, 5, 7]) await page.getByTestId(`fill-${n}`).click(); // 2 and 3 left
  const list = page.getByRole('list', { name: 'Ways to fill' });
  await expect(list.locator('.fill-main')).toHaveCount(2); // 6 pulses: 2 2 2 or 3 3
  await expect(list.locator('.fill-group')).toHaveText(['Repeat']); // under the name of their kind
  await expect(list.locator('.fill-main').first()).toContainText('3 ×2'); // shapes first
  await fillFold(page, 'Shape');
  await page.getByRole('button', { name: 'Anything' }).click();
  await page.locator('#fill-sort').selectOption('most');
  // a tap tries it (shown, not written); Use writes it
  await list.getByRole('button').first().click();
  await expectSeq(page, DEFAULT_SEQ);
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  await expectSeq(page, '(2) 2 2 2 2 │ 3 (1) 3 2 4');
});

test('fills by kind: a known rhythm by its name, and what the piece already says', async ({
  page,
}) => {
  // the second bar (pulses 16–32), after the written start
  await page.getByTestId('score').focus();
  await page.keyboard.press('End');
  for (let i = 0; i < 16; i++) await page.keyboard.press('Shift+ArrowLeft');
  await expect(page.getByTestId('caretname')).toContainText('16 pulses');
  await page.locator('.selbar-actions').getByRole('button', { name: 'Fill…' }).click();
  const list = page.getByRole('list', { name: 'Ways to fill' });
  // every kind has its name in the list, and the piece's own material comes first
  await expect(list.locator('.fill-group').first()).toContainText('From the piece');
  await expect(list.locator('.fill-group', { hasText: 'Known rhythms' })).toBeVisible();
  await fillFold(page, 'Shape');
  await page.getByRole('button', { name: /^Known rhythms/ }).click();
  // the sizes are read out too, not only the name
  await expect(list.locator('.fill-main', { hasText: 'Tresillo ×2' })).toContainText('3 3 2 3 3 2');
});

test('vary a fill straight from the list: try it, Vary, pick a variation, Use', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Fill it…' }).click();
  const list = page.getByRole('list', { name: 'Ways to fill' });
  // any fill of the 9 open pulses, on trial
  const first = list.locator('.fill-main').first();
  await first.click();
  const key = (await first.locator('.sr-only').first().innerText()).replace(/\.\s*$/, '').trim();
  await page.getByRole('button', { name: 'Variations', exact: true }).click();
  // the list is now that fill and its variations; nothing is written yet
  const around = page.getByRole('group', { name: 'Variations' });
  await expect(around).toContainText(`Variations of ${key}`);
  await expect(list.locator('.fill-main').first()).toContainText('As it is');
  await expectSeq(page, DEFAULT_SEQ);
  // a variation: tried, then used; it still fills exactly the 9 pulses
  const v = list.locator('.fill-main').nth(1);
  const vKey = (await v.locator('.sr-only').first().innerText()).replace(/\.\s*$/, '').trim();
  expect(vKey).not.toBe(key);
  await v.click();
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  await expectSeq(page, `(2) 3 3 2 ${vKey} │ 3 (1) 3 2 4`);
  // Back returns to all the fills
  await around.getByRole('button', { name: '‹ Back' }).click();
  await expect(around).toHaveCount(0);
});

test('browse only the fills with a set number of tiles', async ({ page }) => {
  await page.getByRole('button', { name: 'Fill it…' }).click();
  await fillFold(page, 'Shape');
  await page.getByRole('button', { name: 'Anything' }).click();
  const list = page.getByRole('list', { name: 'Ways to fill' });
  // 9 open pulses in exactly 2 tiles: every fill listed has two
  await page.getByTestId('fill-tiles').selectOption('2');
  await expect(list.locator('.fill-main').nth(1)).toBeVisible();
  const keys = await list
    .locator('.fill-main')
    .evaluateAll((rows) => rows.map((r) => r.querySelector('.sr-only')?.textContent ?? ''));
  expect(keys.length).toBeGreaterThan(1);
  for (const k of keys)
    expect(
      k
        .replace(/\.\s*$/, '')
        .trim()
        .split(' '),
    ).toHaveLength(2);
  await page.getByTestId('fill-tiles').selectOption('');
  await expect(list.locator('.fill-main').nth(8)).toBeVisible();
});

test('land a pattern: how many times it goes in, and from where, to end on the end', async ({
  page,
}) => {
  // the open space: 9 pulses up to bar 2, beat 1 +3/4
  await page.getByRole('button', { name: 'Land…' }).first().click();
  await page.getByTestId('land-2').click();
  const list = page.getByRole('list', { name: 'Ways it lands' });
  await expect(page.locator('.land')).toContainText('2 goes in 4 times, with 1 left before it');
  // ×4 first, down to ×1, then the tihais (three times with a gap)
  await expect(list.locator('.fill-main').first()).toContainText('×4');
  await expect(list).toContainText('Tihai · gap 1');
  // a tap tries it (nothing written), a second tap writes it: one pulse stays open before it
  await list.locator('.fill-main').first().click();
  await expectSeq(page, DEFAULT_SEQ);
  await list.locator('.fill-main').first().click();
  await expect(page.getByTestId('sequence')).toContainText('2 2 2 2');
  // a longer pattern: 3 2 lands once in what is the same stretch
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByTestId('land-3').click();
  await page.getByTestId('land-2').click();
  await expect(page.getByTestId('land-pattern')).toHaveText('32');
  await expect(list.locator('.fill-main').first()).toContainText('×1');
  await expect(list).toContainText('Running through');
  // only the ways that begin on a beat
  const all = await list.locator('.fill-main').count();
  await landOptions(page);
  await page.getByRole('button', { name: 'On a beat' }).click();
  await expect(list.locator('.fill-main')).not.toHaveCount(all);
  await expect(list.locator('.fill-main').filter({ hasNotText: /on the beat|on 1/ })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Anywhere' }).click();
  await expect(list.locator('.fill-main')).toHaveCount(all);
});

test('land: a tihai shows its gap as a tile; the last tile can fall on the 1', async ({ page }) => {
  await page.getByRole('button', { name: 'Land…' }).first().click();
  const list = page.getByRole('list', { name: 'Ways it lands' });
  // an empty pattern offers the strokes written just before the open space
  await page.getByRole('button', { name: 'Before it 3 3 2' }).click();
  await expect(page.getByTestId('land-pattern')).toHaveText('332');
  await expect(list.locator('.fill-main').first()).toContainText('×1');
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByTestId('land-2').click();
  await page.getByTestId('land-1').click();
  // 9 pulses, 2 1 with the last tile on the 1: 2 1 2 1 2 [1] takes 8, one pulse stays before it
  await landOptions(page);
  await page.getByTestId('land-on1').click();
  await expect(page.locator('.land')).toContainText('The last tile (1) falls after the stretch');
  const first = list.locator('.fill-main').first();
  await expect(first).toContainText('×3');
  await expect(first).toContainText('then 1 after it');
  await first.click();
  await first.click();
  await expect(page.getByTestId('sequence')).toContainText('2 1 2 1 2 3');
  await page.keyboard.press('z');
  // without it, in a pattern of 1: the tihai's gaps are tiles of their own (1 2 1 2 1)
  await page.getByTestId('land-on1').click();
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByTestId('land-1').click();
  const tihai = list.locator('.fill-main', { hasText: 'Tihai · gap 2' });
  await expect(tihai.locator('.strip-gap')).toHaveCount(2);
  await expect(tihai.locator('.strip-gap').first()).toHaveText('2');
});

test('land: a yati says the cell three times, its main size growing, and lands', async ({
  page,
}) => {
  // an empty piece: 32 pulses, 4 a beat. The cell 3 2 3 (X 2 X): 2 → 3 → 4 lands where 3 3 3 would
  await clearAll(page);
  await page.getByRole('button', { name: 'Land…' }).first().click();
  for (const n of [3, 2, 3]) await page.getByTestId(`land-${n}`).click();
  const list = page.getByRole('list', { name: 'Ways it lands' });
  await expect(list).toContainText('Yati');
  const way = list.locator('.fill-main', { hasText: 'Widening 2 → 3 → 4' });
  await expect(way).toContainText('X 2 X · 4 between');
  await expect(way).toContainText('fills it exactly');
  await way.click();
  await way.click();
  await expect(page.getByTestId('sequence')).toContainText('2 2 2 4 3 2 3 4 4 2 4');
});

test('land: speeds say the pattern again with shorter strokes, and land', async ({ page }) => {
  // an empty piece of 32 pulses; 4 4 4 at 4 → 2 → 1 with a closing 4 = 25 pulses, 7 before it
  await clearAll(page);
  await page.getByRole('button', { name: 'Land…' }).first().click();
  for (let i = 0; i < 3; i++) await page.getByTestId('land-4').click();
  const list = page.getByRole('list', { name: 'Ways it lands' });
  await expect(list).toContainText('Speeds');
  // a kind shows a few ways; "all N" opens it in full
  await list.getByRole('button', { name: /^all \d+ of Speeds$/ }).click();
  const way = list
    .locator('.fill-main', { hasText: 'Speeds 4 → 2 → 1 (faster and faster)' })
    .filter({ hasText: '4 4 4 at 3 speeds, 4 closing' })
    .first();
  await way.click();
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  // seven pulses stay open before it; it ends on the end
  await expect(page.getByTestId('sequence')).toContainText('· │ 4 4 4 2 2 2 1 1 1 4');
});

test('land: speeds that turn round from one time to the next, the landing kept', async ({
  page,
}) => {
  // a stroke of 3 at 3 → 2 → 1, then one speed, then 1 → 2 → 3, a closing 3 each: 27 pulses
  await clearAll(page);
  await page.getByRole('button', { name: 'Land…' }).first().click();
  await page.getByTestId('land-3').click();
  const list = page.getByRole('list', { name: 'Ways it lands' });
  const way = list
    .locator('.fill-main', { hasText: 'Speeds 3 2 1 | 2 2 2 | 1 2 3 (turning round)' })
    .filter({ hasText: '3 closing' })
    .first();
  await way.click();
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  await expect(page.getByTestId('sequence')).toContainText('3 2 1 3 2 2 2 3 1 2 3 3');
});
