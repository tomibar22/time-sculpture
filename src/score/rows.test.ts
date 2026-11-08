import { describe, expect, it } from 'vitest';
import { normalizeRows, rowStarts, setRowCycles } from './rows';

describe('row layout', () => {
  it('lays out cycles perRow at a time', () => {
    expect(normalizeRows([], 5, 2)).toEqual([2, 2, 1]);
    expect(normalizeRows([], 4, 1)).toEqual([1, 1, 1, 1]);
    expect(normalizeRows([], 3, 9)).toEqual([3]);
  });
  it('keeps custom rows that fit and cuts the last one', () => {
    expect(normalizeRows([3, 1], 6, 2)).toEqual([3, 1, 2]);
    expect(normalizeRows([3, 3, 3], 5, 1)).toEqual([3, 2]);
    expect(normalizeRows([0, 2], 3, 1)).toEqual([1, 2]);
  });
  it('changes one row and reflows the rest', () => {
    expect(setRowCycles([1, 1, 1, 1], 1, 2, 4, 1)).toEqual([1, 2, 1]);
    expect(setRowCycles([2, 2], 0, 1, 4, 2)).toEqual([1, 2, 1]);
    expect(setRowCycles([2, 2], 5, 1, 4, 2)).toEqual([2, 2]);
  });
  it('knows where rows start', () => {
    expect(rowStarts([2, 1, 3])).toEqual([0, 2, 3]);
  });
});
