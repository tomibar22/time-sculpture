import { describe, expect, it } from 'vitest';
import { patternLandings } from '../land';

describe('landing a pattern on the end of a stretch', () => {
  it('fives in 32 pulses: up to six times, beginning 2 pulses in', () => {
    const ls = patternLandings(32, [5]);
    expect(ls[0]).toMatchObject({ times: 6, lead: 2 });
    expect(ls.filter((l) => l.kind === 'repeat').map((l) => l.times)).toEqual([6, 5, 4, 3, 2, 1]);
    for (const l of ls) expect(l.lead + l.sizes.reduce((a, n) => a + n, 0)).toBe(32);
  });
  it('a phrase that fills the stretch exactly has no lead', () => {
    expect(patternLandings(16, [3, 3, 2])[0]).toMatchObject({ times: 2, lead: 0 });
  });
  it('tihais: three times, the gap a tile of its own between them', () => {
    const t = patternLandings(22, [3, 3]).find((l) => l.kind === 'tihai' && l.gap === 2)!;
    expect(t.sizes).toEqual([3, 3, 2, 3, 3, 2, 3, 3]);
    expect(t.gaps).toEqual([2, 5]);
    expect(t.lead).toBe(0);
    const u = patternLandings(18, [2, 3]).find((l) => l.kind === 'tihai' && l.gap === 1)!;
    expect(u.sizes).toEqual([2, 3, 1, 2, 3, 1, 2, 3]);
    expect(u.lead).toBe(1);
  });
  it('any number of times with a gap', () => {
    const g = patternLandings(16, [3]).find(
      (l) => l.kind === 'gapped' && l.times === 4 && l.gap === 1,
    )!;
    expect(g.sizes).toEqual([3, 1, 3, 1, 3, 1, 3]);
    expect(g.lead).toBe(1);
  });
  it('last tile on the 1: it is left out, and begins where the stretch ends', () => {
    const ls = patternLandings(18, [3, 2], { on1: true });
    expect(ls[0]).toMatchObject({ kind: 'repeat', times: 4, lead: 0, on1: 2 });
    expect(ls[0]!.sizes).toEqual([3, 2, 3, 2, 3, 2, 3]);
    // a tihai whose last stroke is the 1: 3 2 (1) 3 2 (1) 3 [2]
    const t = ls.find((l) => l.kind === 'tihai' && l.gap === 1)!;
    expect(t.sizes).toEqual([3, 2, 1, 3, 2, 1, 3]);
    expect(t.lead).toBe(3);
    for (const l of ls) {
      expect(l.on1).toBeGreaterThan(0);
      expect(l.lead + l.sizes.reduce((a, n) => a + n, 0)).toBe(18);
      for (const i of l.gaps ?? []) expect(i).toBeLessThan(l.sizes.length);
    }
    // one tile alone leaves nothing to write the first time
    expect(patternLandings(8, [3], { on1: true }).every((l) => l.sizes.length > 0)).toBe(true);
  });
  it('shaped: worn away, built up, broad first, twice as fast, running through', () => {
    const by = (R: number, p: number[], key: string) =>
      patternLandings(R, p).find((l) => l.key === key)?.sizes;
    expect(by(20, [2, 3, 4], 'wear')).toEqual([2, 3, 4, 3, 4, 4]);
    expect(by(20, [2, 3, 4], 'build')).toEqual([4, 3, 4, 2, 3, 4]);
    expect(by(24, [3, 3, 2], 'broad')).toEqual([6, 6, 4, 3, 3, 2]);
    expect(by(16, [4, 2], 'fast')).toEqual([4, 2, 2, 1, 2, 1]);
    // 5 into 16: three times and one pulse of the pattern's tail before them
    expect(by(16, [2, 3], 'run')).toEqual([1, 2, 3, 2, 3, 2, 3]);
    for (const l of patternLandings(32, [2, 3, 4]))
      expect(l.lead + l.sizes.reduce((a, n) => a + n, 0)).toBe(32);
    const keys = patternLandings(32, [2, 3, 4]).map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('a pattern longer than the stretch does not land', () => {
    expect(patternLandings(4, [3, 2])).toEqual([]);
    expect(patternLandings(8, [])).toEqual([]);
  });
});
