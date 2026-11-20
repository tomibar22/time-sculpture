import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import study from '../../../docs/studies/speeds-3-2-1.timesculpture.json';
import { ladderOf, runsAll, speedBalances, speedFills, speedsLabel, withLadder } from '../speeds';
import { statementsOf } from '../yati';
import { patternLandings } from '../land';
import { shapeOf, shapeFills } from '../shapes';
import { variations } from '../vary';
import { measureFill } from '../fills';
import { makeMeter } from '../doc';

/** Study 2 (docs/studies/speeds-3-2-1.md): 9 bars of 4 at 3 pulses a beat, the last 3 on the 1. */
const PIECE = study.start.map((g) => g.pulses);
const sum = (a: readonly number[]) => a.reduce((x, n) => x + n, 0);

describe('speeds: one phrase at several speeds', () => {
  it('reads the piece: three statements of 5 strokes at 3, 2, 1 and a closing 3', () => {
    expect(sum(PIECE)).toBe(99);
    const st = statementsOf(PIECE)!;
    expect(st.k).toBe(3);
    expect(st.cell).toEqual([3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 3]);
    expect(ladderOf(st.cell)).toEqual({ at: 0, n: 5, sizes: [3, 2, 1] });
    expect(runsAll([3, 3, 2, 1, 1])).toEqual([
      { n: 2, size: 3 },
      { n: 1, size: 2 },
      { n: 2, size: 1 },
    ]);
  });
  it('names it', () => {
    expect(speedsLabel(PIECE)).toBe('Speeds 3 → 2 → 1 (faster and faster), 5 each, 3 closing · ×3');
    expect(shapeOf(PIECE)?.family).toBe('speeds');
    // the 8 bars alone (the last 3 is the 1 after them): the closing 3s read as the gap between
    expect(speedsLabel(PIECE.slice(0, -1))).toBe(
      'Speeds 3 → 2 → 1 (faster and faster), 5 each · ×3, 3 between',
    );
  });
  it('Land gives it back from 3 3 3 3 3, three times, the last 3 on the 1', () => {
    const ls = patternLandings(96, [3, 3, 3, 3, 3], { on1: true, beat: 3 });
    const w = ls.find(
      (l) => l.kind === 'speeds' && l.sizes.join(' ') === PIECE.slice(0, -1).join(' '),
    )!;
    expect(w).toMatchObject({ lead: 0, on1: 3, times: 3 });
    expect(w.name).toBe('Speeds 3 → 2 → 1 (faster and faster) · three times');
    for (const l of ls.filter((x) => x.kind === 'speeds')) expect(l.lead + sum(l.sizes)).toBe(96);
  });
  it('Vary shares out the speeds again: the same strokes, the same landing', () => {
    const vs = variations(PIECE.map((n) => ({ n, kind: 'sound' as const })));
    const slow = vs.find(
      (v) => v.label === 'Speeds 1 → 2 → 3 (slower and slower), 5 strokes each',
    )!;
    expect(slow.kind).toBe('balance');
    expect(slow.groups.slice(0, 16).map((g) => g.n)).toEqual([
      1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3,
    ]);
    for (const r of speedBalances(PIECE)) expect(sum(r.sizes)).toBe(99);
    expect(speedBalances(PIECE).map((r) => r.label)).toContain(
      'Speeds 2 → 2 → 2 (one speed), 5 strokes each',
    );
  });
  it('Browse builds it from the sizes 1 2 3, and the seams sit on beats', () => {
    expect(speedFills(96, [1, 2, 3]).map((t) => t.join(' '))).toContain(
      PIECE.slice(0, -1).join(' '),
    );
    expect(shapeFills(99, [1, 2, 3]).some((f) => f.shape.family === 'speeds')).toBe(true);
    expect(measureFill(makeMeter(4, 9, 3), 0, PIECE).seams).toBe(1);
  });
  it('every built and every rebalanced fill keeps its length (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 12, max: 120 }), (R) => {
        for (const t of speedFills(R, [1, 2, 3, 4, 6], 10)) {
          expect(sum(t)).toBe(R);
          for (const r of speedBalances(t)) expect(sum(r.sizes)).toBe(R);
        }
      }),
      { numRuns: 60 },
    );
    expect(withLadder([3, 3, 2, 2, 5], { at: 0, n: 2, sizes: [3, 2] }, [2, 3])).toEqual([
      2, 2, 3, 3, 5,
    ]);
  });
});
