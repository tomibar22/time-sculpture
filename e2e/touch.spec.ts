import { expect, test } from '@playwright/test';
import { at, DEFAULT_SEQ, expectSeq, fingers, knobAt, P, ready, score } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expectSeq(page, DEFAULT_SEQ);
});

test('a finger dragged over groups selects a range and moves nothing; a knob carries it on to the next row', async ({
  page,
  hasTouch,
}) => {
  test.skip(!hasTouch, 'touch only');
  const f = await fingers(page);
  let s = await score(page);
  // from inside the first 3 to inside the second 3: neither moves, 4 pulses are selected
  await f.swipe([at(s, P(3)), at(s, P(7))]);
  await expectSeq(page, DEFAULT_SEQ);
  await expect(page.getByTestId('caretname')).toContainText('4 pulses');
  // the knob under the range's end, dragged down to the next row: the selection grows, its
  // start stays, and the page does not scroll away under the finger
  s = await score(page);
  const y0 = await page.evaluate(() => window.scrollY);
  await f.swipe([knobAt(s, P(7)), knobAt(s, P(7.5)), { ...at(s, P(20)), y: at(s, P(20)).y + 30 }]);
  await expect(page.getByTestId('caretname')).toContainText('17 pulses');
  expect(await page.evaluate(() => window.scrollY)).toBe(y0);
  await expectSeq(page, DEFAULT_SEQ);
});

test('select first, then move: a tap selects a group, a drag on it moves it', async ({
  page,
  hasTouch,
}) => {
  test.skip(!hasTouch, 'touch only');
  const f = await fingers(page);
  let s = await score(page);
  await f.tap(at(s, P(3.5)));
  await expect(page.getByTestId('selname')).toContainText('Group 3');
  s = await score(page);
  await f.swipe([at(s, P(3.5)), at(s, P(4.5))]);
  await expectSeq(page, '(3) 3 2 2 │ 3 (1) 3 2 4');
  // a double tap with two fingers undoes, with three it redoes
  s = await score(page);
  await f.doubleTap({ x: s.x + 60, y: s.y + 160 }, 2);
  await expectSeq(page, DEFAULT_SEQ);
  await f.doubleTap({ x: s.x + 60, y: s.y + 160 }, 3);
  await expectSeq(page, '(3) 3 2 2 │ 3 (1) 3 2 4');
});

test('a finger held on a group picks it up: the drag moves it', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'touch only');
  const f = await fingers(page);
  const s = await score(page);
  // the 2 at pulses 8–10, one pulse later into the open space
  await f.swipe([at(s, P(9)), at(s, P(9.3)), at(s, P(10))], 600);
  await expectSeq(page, '(2) 3 3 (1) 2 │ 3 (1) 3 2 4');
});
