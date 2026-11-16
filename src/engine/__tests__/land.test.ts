import { describe, expect, it } from 'vitest';
import { patternLandings } from '../land';

describe('landing a pattern on the end of a stretch', () => {
  it('fives in 32 pulses: up to six times, beginning 2 pulses in', () => {
    const ls = patternLandings(32, [5]);
    expect(ls[0]).toMatchObject({ times: 6, lead: 2 });
    expect(ls.filter((l) => l.gap === undefined).map((l) => l.times)).toEqual([6, 5, 4, 3, 2, 1]);
    for (const l of ls) expect(l.lead + l.sizes.reduce((a, n) => a + n, 0)).toBe(32);
  });
  it('a phrase that fills the stretch exactly has no lead', () => {
    expect(patternLandings(16, [3, 3, 2])[0]).toMatchObject({ times: 2, lead: 0 });
  });
  it('tihais: three times with a gap held on the last tile of the first two', () => {
    const t = patternLandings(16, [2, 2]).find((l) => l.gap === 2)!;
    expect(t.sizes).toEqual([2, 4, 2, 4, 2, 2]);
    expect(t.lead).toBe(0);
  });
  it('a pattern longer than the stretch does not land', () => {
    expect(patternLandings(4, [3, 2])).toEqual([]);
    expect(patternLandings(8, [])).toEqual([]);
  });
});
