import { expect, test } from '@playwright/test';
import { clearAll, DEFAULT_SEQ, expectSeq, ready } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('land: a tihai of tihais, where its inner tihais land, and the outline of it', async ({
  page,
}) => {
  await clearAll(page);
  await page.getByRole('button', { name: 'Land…' }).first().click();
  await page.getByTestId('land-2').click();
  const list = page.getByRole('list', { name: 'Ways it lands' });
  const way = list.locator('.fill-main', { hasText: 'Tihai of tihais · 1 inside, 4 between' });
  await expect(way).toContainText('lands on beat 3 · on beat 2 · on 1');
  await way.click();
  await way.click();
  await expect(page.getByTestId('sequence')).toContainText('2 1 2 1 2 4 2 1 2 1 2 4 2 1 2 1 2');
  await page.getByRole('button', { name: 'Close' }).first().click();
  // the outline hangs brackets under the score: it grows taller
  const h0 = (await page.getByTestId('score').boundingBox())!.height;
  await page.getByTestId('outline').click();
  await expect(page.getByTestId('outline')).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => (await page.getByTestId('score').boundingBox())!.height)
    .toBeGreaterThan(h0);
  // O toggles it too
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('o');
  await expect(page.getByTestId('outline')).toHaveAttribute('aria-pressed', 'false');
});

test('land: a korvai, a chain of tihais; landing a beat early leaves air', async ({ page }) => {
  await clearAll(page);
  await page.getByRole('button', { name: 'Land…' }).first().click();
  await page.getByTestId('land-3').click();
  const list = page.getByRole('list', { name: 'Ways it lands' });
  await expect(list).toContainText('Korvai');
  await expect(list).toContainText('Chain of tihais');
  // a beat early: 4 pulses of air after it
  await page.getByRole('button', { name: 'A beat earlier' }).click();
  await expect(page.getByTestId('land-shift')).toHaveText('1 beat early');
  await expect(page.locator('.land-hint')).toContainText('4 pulses of air after it');
  const first = list.locator('.fill-main').first();
  await first.click();
  await first.click();
  // 28 pulses of threes from bar 1, beat 1 +1/4, then the air
  await expect(page.getByTestId('sequence')).toContainText('3 3 3 3 3 3 3 3 3');
  await page.getByTestId('land-shift').click();
  await expect(page.getByTestId('land-shift')).toHaveText('on the end');
});

test('land: the same strokes at three speeds of the beat (gati)', async ({ page }) => {
  await clearAll(page);
  await page.getByRole('button', { name: 'Land…' }).first().click();
  for (let i = 0; i < 6; i++) await page.getByTestId('land-1').click();
  const list = page.getByRole('list', { name: 'Ways it lands' });
  const way = list.locator('.fill-main', { hasText: 'Gati 2 → 3 → 6' }).first();
  await expect(way).toContainText('3 + 2 + 1 beats');
  await way.click();
  await way.click();
  // the beats took their speeds: six strokes, a beat at three, six, a beat at six, six
  await expect(page.getByTestId('sequence')).toContainText(
    '1 1 1 1 1 1 3 1 1 1 1 1 1 6 1 1 1 1 1 1',
  );
  await page.keyboard.press('z');
  await expect(page.getByTestId('sequence')).not.toContainText('1 1 1 1 1 1 3');
});

test('practice: a hidden beat and a silent 1, remembered', async ({ page }) => {
  const btn = page.locator('.practice > button').first();
  await btn.click();
  const pop = page.locator('.practice-pop');
  await pop.getByTestId('silent-one').click();
  await expect(pop.getByTestId('silent-one')).toHaveAttribute('aria-checked', 'true');
  await pop.getByRole('tab', { name: /Click/ }).click();
  await pop.getByTestId('hidden-beat').click();
  await expect(pop.getByTestId('hidden-every')).toHaveText('every 3');
  await pop.getByRole('button', { name: 'One pulse more' }).click();
  await expect(pop.getByTestId('hidden-every')).toHaveText('every 4');
  await page.keyboard.press('Escape');
  await page.reload();
  await ready(page);
  await btn.click();
  await expect(pop.getByTestId('silent-one')).toHaveAttribute('aria-checked', 'true');
  await pop.getByRole('tab', { name: /Click/ }).click();
  await expect(pop.getByTestId('hidden-every')).toHaveText('every 4');
  await page.keyboard.press('Escape');
  // it plays with them on
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
});

test('vary: keep the ending, so every variation rhymes', async ({ page }) => {
  await page.keyboard.press('Shift+KeyA');
  await page.keyboard.press('Shift+KeyV');
  const keep = page.getByTestId('vary-rhyme');
  await keep.click();
  await expect(keep).toHaveAttribute('aria-pressed', 'true');
  await expect(keep).toHaveText('Ending kept');
  const locks = page.locator('.vary-base button[aria-pressed="true"]');
  await expect(locks).not.toHaveCount(0);
  // the last group is among them
  await expect(page.locator('.vary-base button').last()).toHaveAttribute('aria-pressed', 'true');
  await keep.click();
  await expect(locks).toHaveCount(0);
});
