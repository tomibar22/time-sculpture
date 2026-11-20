import { expect, test } from '@playwright/test';
import { clearAll, DEFAULT_SEQ, expectSeq, fillFold, openSetup, ready } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('vary a passage: the same time said another way', async ({ page }) => {
  // select the start's 3 3 2 with the keyboard: select all, then vary
  await page.keyboard.press('Shift+KeyA');
  await page.keyboard.press('Shift+KeyV');
  const list = page.getByRole('list', { name: 'Variations' });
  await expect(list).toBeVisible();
  await list.getByRole('button', { name: /Backwards/ }).click();
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  // the whole written phrase backwards; the open space became silence inside the range
  const seq = page.getByTestId('sequence');
  await expect(seq).toContainText('4 2 3 (1) 3');
  // "As it was" brings the passage back
  await list.getByRole('button', { name: /As it was/ }).click();
  await expect(seq).toContainText('(2) 3 3 2');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(list).toBeHidden();
});

test('a tihai fills the open space and lands on 1', async ({ page }) => {
  await page.getByRole('button', { name: 'Fill it…' }).click();
  // 9 open pulses: 3 × phrase + 2 × gap = 9 → 1 3 1 3 1, once size 1 is allowed
  await fillFold(page, 'Sizes');
  await page.getByTestId('fill-1').click();
  await fillFold(page, 'Shape');
  await page.getByRole('button', { name: /^Tihai/ }).click();
  const list = page.getByRole('list', { name: 'Ways to fill' });
  // a second tap on the fill on trial writes it
  await list.getByRole('button').first().dblclick();
  await expect(page.getByTestId('status')).toContainText('Complete · lands on 1');
  // phrase, gap, phrase, gap, phrase: all sounding tiles
  await expect(page.getByTestId('sequence')).toContainText('1 3 1 3 1');
});

test('loop the selection, and set the tempo by tapping', async ({ page }) => {
  await page.keyboard.press('Shift+KeyA');
  await page.getByRole('button', { name: /Loop/ }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^Tempo/ }).click();
  await page.getByRole('button', { name: '5 faster' }).click();
  await expect(page.getByTestId('tempo-value')).toHaveValue('77');
  const tap = page.getByRole('button', { name: /Tap the beat/ });
  for (let i = 0; i < 4; i++) {
    await tap.dispatchEvent('pointerdown');
    await page.waitForTimeout(300);
  }
  // four taps 0.3 s apart ≈ ♩200 (timers are not exact)
  const bpm = Number(await page.getByTestId('tempo-value').inputValue());
  expect(bpm).toBeGreaterThan(150);
  expect(bpm).toBeLessThanOrEqual(215);
});

test('the caret stays inside the piece when it gets shorter', async ({ page }) => {
  await page.keyboard.press('End');
  await expect(page.getByTestId('caretname')).toContainText('the very end');
  // make the piece one bar: the caret follows the new end
  await openSetup(page);
  await page.getByRole('button', { name: 'Fewer bars' }).click();
  await expect(page.getByTestId('caretname')).toContainText('the very end');
  await page.keyboard.press('Home');
  await expect(page.getByTestId('caretname')).toContainText('bar 1, beat 1');
});

test('with a selection, Play loops the selection until Stop', async ({ page }) => {
  // the last beat of the piece as a range: 4 pulses, under a second at ♩72
  await page.keyboard.press('End');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft');
  await expect(page.getByTestId('caretname')).toContainText('4 pulses');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const stop = page.getByRole('button', { name: 'Stop', exact: true });
  await expect(stop).toBeVisible();
  // well past one pass (under a second) it is still going round
  await page.waitForTimeout(2500);
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  // the selection is still there, ready to play again
  await expect(page.getByTestId('caretname')).toContainText('4 pulses');
});

test('practice: the count-in is set beside Play; the page goes soft and counts, then plays', async ({
  page,
}) => {
  const btn = page.getByTestId('practice');
  const pop = page.getByRole('dialog', { name: 'Practice' });
  await btn.click();
  await pop.getByRole('button', { name: '1 bar' }).click();
  await page.keyboard.press('Escape');
  await expect(pop).toHaveCount(0);
  await expect(btn).toContainText('count-in 1 bar');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const overlay = page.getByTestId('count-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.count-in-dots i')).toHaveCount(4);
  // one bar of 4 at ♩72 is about 3.3 s: then it plays on without the overlay
  await expect(overlay).toHaveCount(0, { timeout: 6000 });
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  // a tap on the count stops before anything plays
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(overlay).toBeVisible();
  await overlay.click();
  await expect(overlay).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  // remembered on this device
  await page.reload();
  await ready(page);
  await expect(btn).toContainText('count-in 1 bar');
});

test('practice: the tiles silent, or heard and silent in turn; the score greys when they are', async ({
  page,
}) => {
  const btn = page.getByTestId('practice');
  const pop = page.getByRole('dialog', { name: 'Practice' });
  await btn.click();
  await pop.getByRole('button', { name: 'In turn' }).click();
  await pop.getByRole('button', { name: 'Silent: one time more' }).click();
  await expect(pop.getByTestId('turns-silent')).toHaveText('×2');
  await expect(pop).toContainText('Once round with the tiles, then twice with the click alone.');
  await pop.getByRole('button', { name: 'Silent', exact: true }).click();
  await expect(pop).toContainText('Only the click sounds');
  // a tap elsewhere puts the popover away
  await page.getByLabel('Name of the composition').click();
  await expect(pop).toHaveCount(0);
  await expect(btn).toContainText('tiles silent');
  await page.getByTestId('score').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('canvas.score.hushed')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('canvas.score.hushed')).toHaveCount(0);
});

test('Space is Play even with a button in focus, and Play starts at the caret', async ({
  page,
}) => {
  // a button has the focus: Space plays and does not press it
  const btn = page.getByTestId('practice');
  await btn.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Practice' })).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  // a caret at the start of bar 2: playing begins there, not at the top
  await page.getByTestId('score').focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 16; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('caretname')).toContainText('bar 2, beat 1');
  await page.keyboard.press('Space');
  await expect(page.locator('.now')).toContainText('bar 2', { timeout: 1500 });
  await page.keyboard.press('Space');
});

test('practice: the tempo is typed, the count-in can tick the subdivision, and a mixer', async ({
  page,
}) => {
  const btn = page.getByTestId('practice');
  const pop = page.getByRole('dialog', { name: 'Practice' });
  await btn.click();
  // typed tempo: Enter sets it, out-of-range values are brought in
  const bpm = pop.getByTestId('practice-tempo');
  await bpm.fill('96');
  await bpm.press('Enter');
  await expect(bpm).toHaveValue('96');
  await bpm.fill('999');
  await bpm.press('Enter');
  await expect(bpm).toHaveValue('240');
  await pop.getByRole('button', { name: '1 slower' }).click();
  await expect(bpm).toHaveValue('239');
  // the subdivision switch belongs to the count-in
  await expect(pop.getByTestId('count-sub')).toHaveCount(0);
  await pop.getByRole('button', { name: '1 bar' }).click();
  await pop.getByTestId('count-sub').click();
  await expect(pop.getByTestId('count-sub')).toHaveAttribute('aria-checked', 'true');
  // what is typed counts at once, so tapping away never loses it
  await bpm.fill('84');
  await page.getByLabel('Name of the composition').click();
  await btn.click();
  await expect(bpm).toHaveValue('84');
  // the mixer has its own page: a fader at nothing turns its voice off; Reset brings all back
  await pop.getByRole('tab', { name: 'Mix' }).click();
  await pop.getByTestId('mix-drum').fill('40');
  await pop.getByTestId('mix-beat').fill('0');
  await expect(pop.locator('.mixer-row.off')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.reload();
  await ready(page);
  await btn.click();
  await expect(pop.getByTestId('count-sub')).toHaveAttribute('aria-checked', 'true');
  await pop.getByRole('tab', { name: 'Mix' }).click();
  await expect(pop.getByTestId('mix-drum')).toHaveValue('40');
  await expect(pop.getByTestId('mix-beat')).toHaveValue('0');
  await pop.getByRole('button', { name: 'Reset' }).click();
  await expect(pop.getByTestId('mix-drum')).toHaveValue('70');
  await expect(pop.getByTestId('mix-beat')).toHaveValue('70');
  // it plays with all of it on
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByTestId('count-overlay')).toBeVisible();
  await page.getByTestId('count-overlay').click();
});

test('practice: a click pattern is a small sequencer of the bar, and of a cycle of bars', async ({
  page,
}) => {
  const btn = page.getByTestId('practice');
  const pop = page.getByRole('dialog', { name: 'Practice' });
  const said = pop.getByTestId('click-said');
  await btn.click();
  await pop.getByRole('tab', { name: 'Click' }).click();
  // off by default: nothing to set, the click is the plain one
  await expect(pop.getByRole('button', { name: 'Beat 1', exact: true })).toHaveCount(0);
  await pop.getByTestId('click-pattern').click();
  await expect(said).toHaveText('Every beat.');
  // beats 2 and 4 only
  await pop.getByRole('button', { name: 'Beat 1', exact: true }).click();
  await pop.getByRole('button', { name: 'Beat 3', exact: true }).click();
  await expect(said).toHaveText('Beats 2 and 4.');
  // one pulse in the whole bar: the second sixteenth of beat 3
  await pop.getByRole('button', { name: 'Clear the bar' }).click();
  await expect(said).toHaveText('silent.');
  await pop.getByRole('button', { name: 'Beat 3, the 2nd of 4' }).click();
  await expect(said).toHaveText('No beat · the 2nd of 4 in beat 3.');
  await expect(pop.locator('.pat-cell.dot[aria-pressed="true"]')).toHaveCount(1);
  // the same pulse in every beat with one tap
  await pop.getByRole('button', { name: 'Every beat', exact: true }).click();
  await pop.getByRole('button', { name: 'Beat 1, the 4th of 4' }).click();
  await expect(pop.locator('.pat-cell.dot[aria-pressed="true"]')).toHaveCount(5);
  // a cycle of bars: the new bars are silent, each has a pattern of its own
  await pop.getByRole('button', { name: 'Every click' }).click();
  await pop.getByRole('button', { name: 'One bar more in the cycle' }).click();
  await pop.getByRole('button', { name: 'One bar more in the cycle' }).click();
  await expect(pop).toContainText('A cycle of 3 bars');
  await expect(said).toHaveText('Bar 3: silent.');
  await pop.getByRole('button', { name: 'Beat 1', exact: true }).click();
  await expect(said).toHaveText('Bar 3: beat 1.');
  await expect(pop.getByRole('button', { name: 'Bar 2 of 3, silent' })).toBeVisible();
  await pop.getByRole('button', { name: 'Bar 1 of 3' }).click();
  await expect(said).toHaveText('Bar 1: every beat.');
  // Play does not put the popover away: what is set is heard, and the bar that sounds is marked
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(pop.locator('.pat-tab.pat-now')).toHaveCount(1);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(pop).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(btn).toContainText('click pattern');
  // it plays, and it is remembered on this device
  await page.getByTestId('score').focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await page.reload();
  await ready(page);
  await btn.click();
  await pop.getByRole('tab', { name: 'Click' }).click();
  await pop.getByRole('button', { name: 'Bar 3 of 3' }).click();
  await expect(said).toHaveText('Bar 3: beat 1.');
  await pop.getByRole('button', { name: 'Like bar 1' }).click();
  await expect(said).toHaveText('Bar 3: every beat.');
});

test('practice: a pattern to start from shows in the score; speed up climbs and Stop goes back', async ({
  page,
}) => {
  const btn = page.getByTestId('practice');
  const pop = page.getByRole('dialog', { name: 'Practice' });
  await btn.click();
  await pop.getByRole('tab', { name: 'Click' }).click();
  await pop.getByTestId('click-pattern').click();
  await pop.getByRole('button', { name: '2 and 4' }).click();
  await expect(pop.getByTestId('click-said')).toHaveText('Beats 2 and 4.');
  await pop.getByRole('button', { name: 'The 1, once in 4 bars' }).click();
  await expect(pop).toContainText('A cycle of 4 bars');
  await expect(pop.getByTestId('click-said')).toHaveText('Bar 1: beat 1.');
  await pop.getByRole('button', { name: 'Off-beats' }).click();
  await expect(pop.getByTestId('click-said')).toHaveText('No beat · the 3rd of 4 in every beat.');
  await pop.getByTestId('click-pattern').click();
  // speed up: 10 faster every time round, from 200 up to 230; the piece's tempo is not touched
  await pop.getByRole('tab', { name: 'Practice' }).click();
  await pop.getByTestId('practice-tempo').fill('200');
  await pop.getByTestId('speed-up').click();
  await pop.getByLabel(/Faster by/).selectOption('10');
  await pop.getByLabel(/^every/).selectOption('1');
  await pop.getByTestId('speed-to').fill('230');
  await expect(pop.getByTestId('speed-said')).toContainText('From 200 to 230 in 3 steps');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  // two bars of four at 200 come round in 2.4 s
  await expect(page.locator('.tempo-up')).toHaveText('210', { timeout: 6000 });
  await expect(pop.getByTestId('speed-said')).toContainText('Now at 210');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('.tempo-up')).toHaveCount(0);
  await expect(pop.getByTestId('practice-tempo')).toHaveValue('200');
  await page.keyboard.press('Escape');
  await expect(btn).toContainText('speeding up');
});

test('vary, balanced: a plain tihai shares out its main size again, the landing kept', async ({
  page,
}) => {
  // an empty piece of 32 pulses, then the tihai 3 2 3 · 4 · 3 2 3 · 4 · 3 2 3 (lands on 1)
  await clearAll(page);
  for (const d of '32343234323') await page.keyboard.press(d);
  await expect(page.getByTestId('status')).toContainText('Complete · lands on 1');
  await page.keyboard.press('Shift+KeyA');
  await page.keyboard.press('Shift+KeyV');
  const list = page.getByRole('list', { name: 'Variations' });
  await expect(list).toContainText('Balanced');
  // 2 + 3 + 4 = 3 × 3: the cell widening, in the same time
  await list.getByRole('button', { name: /Widening 2 → 3 → 4/ }).click();
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  await expect(page.getByTestId('sequence')).toContainText('2 2 2 4 3 2 3 4 4 2 4');
  await expect(page.getByTestId('status')).toContainText('Complete · lands on 1');
});

test('browse: yatis are a kind of their own, named by how they share out', async ({ page }) => {
  await clearAll(page);
  await page.getByRole('button', { name: 'Fill it…' }).click();
  await fillFold(page, 'Shape');
  await page.getByRole('button', { name: /^Yati/ }).click();
  const list = page.getByRole('list', { name: 'Ways to fill' });
  await expect(list.locator('.fill-main').first()).toContainText(
    /Widening|Narrowing|Swelling|Pinched/,
  );
  await list.locator('.fill-main').first().click();
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('Complete · lands on 1');
});

test('vary, balanced: the gaps give to the cells, the runs inside a cell turn round', async ({
  page,
}) => {
  await clearAll(page);
  // the tihai 3 2 3 · 4 · 3 2 3 · 4 · 3 2 3: the gaps give 6 pulses to the cells (3 → 4)
  for (const d of '32343234323') await page.keyboard.press(d);
  await page.keyboard.press('Shift+KeyA');
  await page.keyboard.press('Shift+KeyV');
  const list = page.getByRole('list', { name: 'Variations' });
  await list.getByRole('button', { name: /Gaps give 6: 4 → 1, cells 4 → 4 → 4/ }).click();
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  await expect(page.getByTestId('sequence')).toContainText('4 2 4 1 4 2 4 1 4 2 4');
  await expect(page.getByTestId('status')).toContainText('Complete · lands on 1');
  await page.getByRole('button', { name: 'Close' }).first().click();
  // a phrase of its own: 3 1 3 3 1 3 3 3 is X | XX | XXX; turned round inside, the same length
  await clearAll(page);
  for (const d of '31331333') await page.keyboard.press(d);
  await expect(page.getByTestId('sequence')).toContainText('3 1 3 3 1 3 3 3 │');
  await page.keyboard.press('Shift+KeyA');
  await page.keyboard.press('Shift+KeyV');
  await list.getByRole('button', { name: /Inside: narrowing 3 → 2 → 1/ }).click();
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  await expect(page.getByTestId('sequence')).toContainText('3 3 3 1 3 3 1 3');
});
