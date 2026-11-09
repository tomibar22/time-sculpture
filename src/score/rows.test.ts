import { describe, expect, it } from 'vitest';
import { makeMeter, withBreaks } from '../engine';
import { rowLayout, rowsToBreaks, zoomLabel, zoomLevels } from './rows';

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

  it('zoomed in, a row holds part of a bar and rows restart at every bar line', () => {
    const m = makeMeter(5, 2, 1);
    expect(spans(m, 0.5)).toEqual([
      [0, 3, false],
      [3, 5, false],
      [5, 8, false],
      [8, 10, false],
    ]);
    expect(spans(m, 0.25).map((r) => r[1])).toEqual([2, 4, 5, 7, 9, 10]);
    // and from a mid-bar break, up to the next bar line
    expect(spans(withBreaks(makeMeter(4, 2, 2), [1.5]), 0.5).map((r) => r[0])).toEqual([
      0, 1.5, 3.5, 4, 6,
    ]);
  });
  it('the overview can hold many bars in a row', () => {
    expect(spans(makeMeter(4, 16, 1), 16)).toEqual([[0, 64, false]]);
  });
  it('names the zoom levels and drops ones that look the same', () => {
    expect(zoomLevels(4, 2)).toEqual([0.25, 0.5, 1, 2]);
    expect(zoomLevels(3, 8)).toEqual([0.25, 0.5, 1, 2, 3, 4, 6, 8]);
    expect(zoomLevels(2 + 1, 1)).toEqual([0.25, 0.5, 1]);
    expect(zoomLabel(7, 0.5)).toBe('4 beats');
    expect(zoomLabel(4, 1)).toBe('1 bar');
    expect(zoomLabel(4, 3)).toBe('3 bars');
  });
});
