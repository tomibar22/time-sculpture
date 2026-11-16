import { describe, expect, it } from 'vitest';
import { CLICK_PATTERN, cleanClickPattern, clickHeard, withClickBars } from '../click';

const at = (beatInBar: number, j: number, d: number, bar = 0) => ({ beatInBar, j, d, bar });

describe('the click as a rhythm of its own', () => {
  it('off: everything is as usual', () => {
    const p = { ...CLICK_PATTERN, off: [0, 1], sub: { 4: [] } };
    expect(clickHeard(p, at(0, 0, 4))).toBe('usual');
    expect(clickHeard(p, at(1, 2, 4))).toBe('usual');
  });
  it('only some beats of the bar', () => {
    const p = { ...CLICK_PATTERN, on: true, off: [0, 2] };
    expect([0, 1, 2, 3].map((b) => clickHeard(p, at(b, 0, 4)))).toEqual([
      null,
      'usual',
      null,
      'usual',
    ]);
    // ticks nobody chose stay as they were
    expect(clickHeard(p, at(0, 1, 4))).toBe('usual');
  });
  it('a weak pulse: the second triplet, the fourth sixteenth, each ratio on its own', () => {
    const p = { ...CLICK_PATTERN, on: true, off: [0, 1, 2, 3], sub: { 3: [1], 4: [3] } };
    expect([0, 1, 2].map((j) => clickHeard(p, at(1, j, 3)))).toEqual([null, 'picked', null]);
    expect([0, 1, 2, 3].map((j) => clickHeard(p, at(1, j, 4)))).toEqual([
      null,
      null,
      null,
      'picked',
    ]);
    // a ratio never chosen (a beat of 5 after a change of subdivision) sounds as always
    expect(clickHeard(p, at(4, 2, 5))).toBe('usual');
    // all of a ratio's inner pulses chosen is the usual soft ticking; none is silence
    expect(clickHeard({ ...p, sub: { 3: [1, 2] } }, at(0, 2, 3))).toBe('usual');
    expect(clickHeard({ ...p, sub: { 3: [] } }, at(0, 2, 3))).toBe(null);
  });
  it('one bar in four, counted as heard', () => {
    const p = { ...CLICK_PATTERN, on: true, every: 4, bars: [0] };
    expect([0, 1, 2, 3, 4, 5].map((bar) => clickHeard(p, at(0, 0, 4, bar)))).toEqual([
      'usual',
      null,
      null,
      null,
      'usual',
      null,
    ]);
    expect(clickHeard(p, at(2, 1, 4, 1))).toBe(null);
  });
  it('stored patterns are made safe; a shorter cycle keeps a bar', () => {
    expect(cleanClickPattern(null)).toEqual(CLICK_PATTERN);
    expect(
      cleanClickPattern({
        on: true,
        off: [1, 1, -2, 'x'],
        sub: { 3: [1, 7], 9: [1] },
        every: 99,
        bars: [5],
      }),
    ).toEqual({ on: true, off: [1], sub: { 3: [1] }, every: 1, bars: [0] });
    expect(withClickBars({ ...CLICK_PATTERN, every: 4, bars: [3] }, 2)).toMatchObject({
      every: 2,
      bars: [0],
    });
  });
});
