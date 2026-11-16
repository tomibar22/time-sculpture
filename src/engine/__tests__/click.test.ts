import { describe, expect, it } from 'vitest';
import {
  CLICK_PATTERN,
  cleanClickPattern,
  clickBar,
  clickHeard,
  subKey,
  toggleClickBeat,
  toggleClickPulse,
  withClickBars,
} from '../click';
import type { ClickBar, ClickPattern } from '../click';

const at = (beatInBar: number, j: number, d: number, bar = 0) => ({ beatInBar, j, d, bar });
const pat = (...bars: ClickBar[]): ClickPattern => ({ on: true, bars });
/** What a whole bar of `beats` beats of ratio d gets, pulse by pulse. */
const heard = (p: ClickPattern, beats: number, d: number, bar = 0) =>
  Array.from({ length: beats }, (_, b) =>
    Array.from({ length: d }, (_, j) => clickHeard(p, at(b, j, d, bar))?.[0] ?? '.').join(''),
  ).join(' ');

describe('the click as a rhythm of its own', () => {
  it('off: everything is as usual, whatever the pattern holds', () => {
    const p = { ...pat(clickBar(false)), on: false };
    expect(heard(p, 2, 4)).toBe('uuuu uuuu');
  });
  it('only some beats of the bar; ticks nobody set stay as they were', () => {
    const bar = toggleClickBeat(toggleClickBeat(clickBar(true), 0), 2);
    expect(heard(pat(bar), 4, 2)).toBe('.u uu .u uu');
  });
  it('one pulse in the whole bar: the second sixteenth of beat 1', () => {
    const bar = toggleClickPulse(clickBar(false), 0, 4, 1);
    expect(heard(pat(bar), 4, 4)).toBe('.p.. .... .... ....');
    // the same beat as a triplet in another bar was never set: silent, as the bar's base says
    expect(heard(pat(bar), 2, 3)).toBe('... ...');
  });
  it('a different pulse in every beat; and one tap for every beat of that ratio', () => {
    let bar = clickBar(false);
    bar = toggleClickPulse(bar, 0, 4, 3);
    bar = toggleClickPulse(bar, 1, 4, 1);
    expect(heard(pat(bar), 3, 4)).toBe('...p .p.. ....');
    const all = toggleClickPulse(clickBar(false), 1, 3, 1, [0, 1, 2, 3]);
    expect(heard(pat(all), 4, 3)).toBe('.p. .p. .p. .p.');
    // tapped again it goes everywhere, also where it was set by hand before
    expect(heard(pat(toggleClickPulse(all, 2, 3, 1, [0, 1, 2, 3])), 4, 3)).toBe('... ... ... ...');
  });
  it('all the inner pulses of a beat are the usual soft ticks', () => {
    const bar = toggleClickPulse(toggleClickPulse(clickBar(false), 0, 3, 1), 0, 3, 2);
    expect(heard(pat(bar), 1, 3)).toBe('.uu');
    // from a full bar, one taken away leaves the others as picked clicks
    expect(heard(pat(toggleClickPulse(clickBar(true), 0, 4, 2)), 1, 4)).toBe('up.p');
  });
  it('a cycle of bars, each with its own pattern, counted as heard', () => {
    const one = toggleClickBeat(clickBar(false), 0);
    const p = withClickBars(pat(one), 4);
    expect([0, 1, 2, 3, 4].map((bar) => heard(p, 2, 1, bar))).toEqual([
      'u .',
      '. .',
      '. .',
      '. .',
      'u .',
    ]);
    expect(withClickBars(p, 1).bars).toEqual([one]);
    expect(withClickBars(p, 99).bars).toHaveLength(8);
  });
  it('stored patterns are made safe, and the first shape still loads', () => {
    expect(cleanClickPattern(null)).toEqual(CLICK_PATTERN);
    expect(
      cleanClickPattern({
        on: true,
        bars: [
          { base: false, beats: [1, 1, -2, 'x'], sub: { '0:4': [1, 9], 'x:4': [1], '0:9': [] } },
        ],
      }),
    ).toEqual({ on: true, bars: [{ base: false, beats: [1], sub: { [subKey(0, 4)]: [1] } }] });
    const old = cleanClickPattern({ on: true, off: [0], sub: { 4: [3] }, every: 2, bars: [0] });
    expect(heard(old, 2, 4, 0)).toBe('...p u..p');
    expect(heard(old, 2, 4, 1)).toBe('.... ....');
  });
});
