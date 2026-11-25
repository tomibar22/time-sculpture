import { describe, expect, it } from 'vitest';
import shrinivas from '../../../docs/studies/mora-shrinivas.timesculpture.json';
import pillai from '../../../docs/studies/tail-pillai.timesculpture.json';
import viswanathan from '../../../docs/studies/kuraippu-viswanathan.timesculpture.json';
import compound from '../../../docs/studies/compound-mora.timesculpture.json';
import { patternLandings } from '../land';
import { halvings } from '../longforms';
import { outlineOf } from '../outline';

/** Studies 3–6 (docs/studies/): long forms from the literature, given back by the app. */
const sizes = (p: { start: { pulses: number }[]; ending: { pulses: number }[] }) => [
  ...p.start.map((g) => g.pulses),
  ...p.ending.map((g) => g.pulses),
];
const sum = (a: readonly number[]) => a.reduce((x, n) => x + n, 0);
const find = (R: number, pattern: number[], kind: string, written: number[]) =>
  patternLandings(R, pattern).find(
    (l) => l.kind === kind && l.sizes.join(' ') === written.join(' '),
  );

describe('study 3: a mora with eduppu (U. Shrinivas, after Field)', () => {
  const t = sizes(shrinivas);
  it('(3) [7] (3) [7] (3) from the second pulse of two rupaka cycles', () => {
    expect(t).toEqual([3, 7, 3, 7, 3]);
    expect(find(24, [3], 'tihai', t)).toMatchObject({ lead: 1, gap: 7 });
    expect(outlineOf(t).map((s) => [s.a, s.b])).toEqual([
      [0, 3],
      [10, 13],
      [20, 23],
    ]);
  });
});

describe('study 4: the tail korvai (Palani Subramania Pillai, after Nelson)', () => {
  const t = sizes(pillai);
  it('abcd ×3, bcd ×2, cd, c = 3a+5b+7c+6d = 96', () => {
    expect(sum(t)).toBe(96);
    const l = find(96, [10, 4, 4, 3], 'tail', t)!;
    expect(l.lead).toBe(0);
    expect(l.note).toContain('3a+5b+7c+6d = 96');
    // Nelson: 2 more in a and b gives 112, a misra cycle's worth
    expect(patternLandings(112, [10, 4, 4, 3]).some((w) => w.name?.includes('a+2 b+2'))).toBe(true);
  });
});

describe('study 5: kuraippu, 8 4 2 1 (T. Viswanathan, after Nelson)', () => {
  const t = sizes(viswanathan);
  it('56 → 28 → 14 → 7, the eduppu halving with them, traded: 8 cycles', () => {
    const p = [3, 3, 3, 5, 3, 3, 3, 5, 3, 3, 3, 5, 7, 7];
    expect(halvings(p).map(sum)).toEqual([56, 28, 14, 7]);
    const l = find(256, p, 'halving', t)!;
    expect(l.lead).toBe(8);
    expect(viswanathan.start.length).toBe(0);
  });
});

describe('study 6: a compound mora (after Nelson)', () => {
  const t = sizes(compound);
  it('the cell three times, then a mora of moras with 3 inside and 7 between', () => {
    expect(sum(t)).toBe(128);
    const mm = t.slice(27);
    expect(find(68, [4], 'nested', mm)?.landings).toEqual([18, 43, 68]);
    const o = outlineOf(mm);
    expect(o.filter((s) => s.depth === 0)).toHaveLength(3);
    expect(o.filter((s) => s.depth === 1)).toHaveLength(9);
  });
});
