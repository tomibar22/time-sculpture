import { describe, expect, it } from 'vitest';
import { makeMeter, withBreaks } from '../engine';
import { rowLayout, rowsToBreaks } from './rows';

const spans = (m: Parameters<typeof rowLayout>[0], per: number) =>
  rowLayout(m, per).map((r) => [r.t0, r.t1, r.manual]);

describe('row layout', () => {
  it('wraps every perRow bars', () => {
    const m = makeMeter(4, 3, 2);
    expect(spans(m, 1)).toEqual([
      [0, 4, false],
      [4, 8, false],
      [8, 12, false],
    ]);
    expect(spans(m, 2)).toEqual([
      [0, 8, false],
      [8, 12, false],
    ]);
  });
  it('a manual break restarts the wrapping, so later rows keep its offset', () => {
    const m = withBreaks(makeMeter(4, 3, 2), [1.5]);
    expect(spans(m, 1)).toEqual([
      [0, 1.5, false],
      [1.5, 5.5, true],
      [5.5, 9.5, false],
      [9.5, 12, false],
    ]);
  });
  it('a second break on a bar line realigns', () => {
    const m = withBreaks(makeMeter(4, 3, 2), [1.5, 4]);
    expect(spans(m, 1)).toEqual([
      [0, 1.5, false],
      [1.5, 4, true],
      [4, 8, true],
      [8, 12, false],
    ]);
  });
  it('rows end on pulses even when a wrap falls inside a beat of another ratio', () => {
    const m = withBreaks(makeMeter(3, 2, [2, 3, 2, 2, 2, 2]), [0.5]);
    const rows = rowLayout(m, 1); // wrap at 3.5 falls in a 2:1 beat: fine
    expect(rows.map((r) => r.t1)).toEqual([0.5, 3.5, 6]);
    for (const r of rows) expect(r.k1).toBeGreaterThan(r.k0);
  });
  it('converts old per-row bar counts', () => {
    expect(rowsToBreaks([1, 2, 1], 4, 4)).toEqual([4, 12]);
  });
});
