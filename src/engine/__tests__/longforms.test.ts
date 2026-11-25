import { describe, expect, it } from 'vitest';
import { patternLandings } from '../land';
import {
  chainWays,
  gatiWays,
  halvings,
  halvingWays,
  korvaiWays,
  nestedWays,
  tailWays,
  writeGati,
} from '../longforms';
import { buildGrid } from '../grid';
import { checkInvariants, emptyDoc } from '../doc';

const sum = (a: readonly number[]) => a.reduce((x, n) => x + n, 0);

describe('long forms', () => {
  it('korvai: 6 5 4 3 2 1 into (3) [1] (3) [1] (3), 32 pulses exactly (T7)', () => {
    const ks = korvaiWays(32, [3]);
    const k = ks.find((w) => w.full.join(' ') === '6 5 4 3 2 1 3 1 3 1 3');
    expect(k).toBeTruthy();
    expect(k!.gaps).toEqual([7, 9]);
    for (const w of ks) expect(sum(w.full)).toBeLessThanOrEqual(32);
  });
  it('korvai ×3 fills the stretch exactly, the first two landing elsewhere (T8)', () => {
    // 5 4 3 2 + (4)[1](4)[1](4) = 28, three times = 84
    const ks = korvaiWays(84, [4]).filter((w) => w.times === 3);
    const k = ks.find((w) => w.full.slice(0, 9).join(' ') === '5 4 3 2 4 1 4 1 4');
    expect(k).toBeTruthy();
    expect(sum(k!.full)).toBe(84);
    expect(k!.ends!.map((e) => e[0])).toEqual([28, 56, 84]);
  });
  it('tail: abcd ×3, bcd ×2, cd, c = 3a+5b+7c+6d; a+2 b+2 gives 112 (T9)', () => {
    const as = tailWays(96, [10, 4, 4, 3]);
    expect(as[0]!.full).toEqual([
      10, 4, 4, 3, 10, 4, 4, 3, 10, 4, 4, 3, 4, 4, 3, 4, 4, 3, 4, 3, 4,
    ]);
    expect(as[0]!.note).toContain('3a+5b+7c+6d = 96');
    const more = tailWays(112, [10, 4, 4, 3]);
    expect(more.some((w) => w.name.includes('a+2 b+2'))).toBe(true);
    for (const w of more) expect(sum(w.full)).toBe(112);
  });
  it('halving: 56 → 28 → 14 → 7, the eduppu 8 → 4 → 2 → 1, traded = 256 (T19)', () => {
    const p = [3, 3, 3, 5, 3, 3, 3, 5, 3, 3, 3, 5, 7, 7];
    expect(halvings(p).map(sum)).toEqual([56, 28, 14, 7]);
    const once = halvingWays(120, p).find((w) => w.key === 'ho8')!;
    // 8 + 56 + 4 + 28 + 2 + 14 + 1 + 7 = 120: the eduppus ring on from the stroke before
    expect(sum(once.full)).toBe(112);
    expect(once.full.slice(12, 15)).toEqual([7, 11, 3]);
    const traded = halvingWays(256, p).find((w) => w.key === 'ht8')!;
    expect(sum(traded.full) + 8).toBe(256);
  });
  it('chain: 5 (1) ×3, 4 (2) ×3, 3 (3) ×3 = 48, a statement every 6 (T14)', () => {
    const w = chainWays(48, [5]).find((c) => c.full.join(' ') === '5 1 5 1 5 4 2 4 2 4 3 3 3 3 3');
    expect(w).toBeTruthy();
    expect(w!.ends!.map((e) => e[0])).toEqual([17, 33, 48]);
  });
  it('tihai of tihais: 4 (1) 4 (1) 4 [3] … = 48, inner landings at 14, 31, 48 (T13)', () => {
    const w = nestedWays(48, [4]).find((n) => n.key === 'n1.3')!;
    expect(sum(w.full)).toBe(48);
    expect(w.ends!.map((e) => e[0])).toEqual([14, 31, 48]);
    expect(w.inner![1]![0]).toEqual([17, 21]);
  });
  it('Land lists them, with where the inner parts land', () => {
    const ls = patternLandings(48, [4]);
    const n = ls.find((l) => l.key === 'n1.3')!;
    expect(n.kind).toBe('nested');
    expect(n.landings).toEqual([14, 31, 48]);
    expect(n).not.toHaveProperty('full');
    const on1 = patternLandings(48, [4], { on1: true }).find((l) => l.kind === 'nested')!;
    expect(on1.landings![2]).toBe(sum(on1.sizes));
    const kinds = new Set(patternLandings(32, [3]).map((l) => l.kind));
    expect(kinds.has('korvai')).toBe(true);
    for (const l of patternLandings(40, [3, 2, 2]))
      expect(l.lead + sum(l.sizes)).toBe(40);
  });
  it('gati: 6 strokes at 2, 3 and 6 a beat = 3 + 2 + 1 beats (T17)', () => {
    const gs = gatiWays(8, [1, 1, 1, 1, 1, 1]);
    const g = gs.find((w) => w.key === 'ga2.3.6g1')!;
    expect(g.beats).toEqual([3, 2, 1]);
    expect(g.leadBeats).toBe(0);
    expect(g.sizes).toEqual([1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 6, 1, 1, 1, 1, 1, 1]);
    // written: the beats get their speeds, the tiles fill them, and it lands on the end
    const doc = emptyDoc();
    const r = writeGati(doc, 0, g);
    expect(r.report.ok).toBe(true);
    expect(r.doc.meter.subdivision).toEqual([2, 2, 2, 3, 3, 3, 6, 6]);
    expect(checkInvariants(r.doc)).toEqual([]);
    expect(buildGrid(r.doc.meter).TS).toBe(6 + 9 + 12);
  });
});
