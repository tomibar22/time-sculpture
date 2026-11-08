import { describe, expect, it } from 'vitest';
import { docFrom, makeMeter } from '../doc';
import { boundaryTimes, resizeMeter, setSubdivision } from '../ops/meter';
import { m44, show, valid } from './helpers';

describe('setSubdivision', () => {
  it('keeps moments in time and snaps to the nearest new pulse', () => {
    const d = docFrom(makeMeter(3, 1, 4), [3, 1, '|', 8]);
    expect(boundaryTimes(d)).toEqual([0, 0.75, 1, 1, 3]);
    const r = setSubdivision(d, [0], 2);
    expect(show(r.doc)).toBe('1 1 open 0 8');
    expect(r.report.startsMoved).toBe(1);
    expect(r.report.moved).toEqual(['g2']);
    expect(r.report.absorbed).toBe(0);
    valid(r.doc);
  });

  it('absorbs groups squeezed to zero', () => {
    const d = docFrom(makeMeter(3, 1, 4), [1, 1, 1, 1, '|', 8]);
    const r = setSubdivision(d, [0], 1);
    expect(show(r.doc)).toBe('1 open 0 8');
    expect(r.report.absorbed).toBe(3);
    expect(r.report.removed).toEqual(['g1', 'g2', 'g4']);
    valid(r.doc);
  });

  it('refining never moves anything', () => {
    const d = docFrom(makeMeter(4, 1, 2), [1, 3, '|', 2]);
    const r = setSubdivision(d, [0, 1, 2, 3], 4);
    expect(show(r.doc)).toBe('2 6 open 4 4');
    expect(r.report.startsMoved).toBe(0);
  });

  it('works on beats in the middle of a group (time is kept)', () => {
    const d = docFrom(makeMeter(4, 1, 2), [8, '|']);
    const r = setSubdivision(d, [1], 3);
    expect(show(r.doc)).toBe('9 open 0');
  });

  it('no-ops and rejects bad values', () => {
    const d = docFrom(m44, [4, '|']);
    expect(setSubdivision(d, [0], 4).report.reason).toBe('no-change');
    expect(setSubdivision(d, [0], 9).report.reason).toBe('out-of-range');
    expect(setSubdivision(d, [99], 3).report.reason).toBe('no-change');
  });
});

describe('resizeMeter', () => {
  it('keeps item sizes; the space absorbs the difference', () => {
    const d = docFrom(m44, [4, '|', 4]);
    const r = resizeMeter(d, 5, 2, 4);
    expect(show(r.doc)).toBe('4 open 32 4');
    valid(r.doc);
  });

  it('keeps subdivisions near the start and the end aligned', () => {
    const d = docFrom(makeMeter(4, 2, [1, 2, 3, 4, 5, 6, 7, 8]), ['|']);
    expect(resizeMeter(d, 3, 2, 4).doc.meter.subdivision).toEqual([1, 2, 3, 6, 7, 8]);
    expect(resizeMeter(d, 5, 2, 4).doc.meter.subdivision).toEqual([1, 2, 3, 4, 5, 4, 5, 6, 7, 8]);
    const small = docFrom(makeMeter(3, 1, [1, 2, 3]), ['|']);
    expect(resizeMeter(small, 3, 3, 9 - 5).doc.meter.subdivision).toEqual([
      1, 2, 3, 4, 4, 4, 1, 2, 3,
    ]);
  });

  it('removes groups next to the space when the piece gets too short', () => {
    const d = docFrom(m44, [10, 10, '|', 10]);
    const r = resizeMeter(d, 3, 2, 4);
    expect(show(r.doc)).toBe('10 open 4 10');
    expect(r.report.removed).toEqual(['g2']);
    valid(r.doc);
    const d2 = docFrom(m44, ['|', 10, 10, 10]);
    expect(show(resizeMeter(d2, 3, 2, 4).doc)).toBe('open 4 10 10');
  });

  it('validates ranges', () => {
    const d = docFrom(m44, ['|']);
    expect(resizeMeter(d, 2, 2, 4).report.reason).toBe('out-of-range');
    expect(resizeMeter(d, 4, 33, 4).report.reason).toBe('out-of-range');
    expect(resizeMeter(d, 4, 2, 4).report.reason).toBe('no-change');
  });
});
