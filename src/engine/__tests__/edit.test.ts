import { describe, expect, it } from 'vitest';
import {
  copyGroups,
  formatGroups,
  insertGroups,
  parseGroups,
  replaceGroups,
  resizeGroup,
  resizeGroups,
  reverseGroups,
  trimEdge,
} from '../ops/edit';
import { sample, show, valid } from './helpers';

// sample: (2) 3 3 2 | 3 (1) 3 2 4  (ids g1..g9), 26 pulses, open 3

describe('insertGroups (typing / pasting at a caret)', () => {
  it('inserts at an index and reports the new ids', () => {
    const r = insertGroups(sample(), 2, [
      { n: 1, kind: 'sound' },
      { n: 2, kind: 'rest' },
    ]);
    expect(show(r.doc)).toBe('(2) 3 1 (2) 3 2 open 0 3 (1) 3 2 4');
    expect(r.report.created).toEqual(['g10', 'g11']);
    valid(r.doc);
  });
  it('needs room in the space', () => {
    expect(insertGroups(sample(), 0, [{ n: 4, kind: 'sound' }]).report.reason).toBe('no-room');
    expect(insertGroups(sample(), 0, []).report.ok).toBe(false);
    expect(insertGroups(sample(), 0, [{ n: 0, kind: 'sound' }]).report.reason).toBe('too-small');
  });
});

describe('replaceGroups (typing / pasting over a selection)', () => {
  it('replaces in place using the selection plus the space', () => {
    const r = replaceGroups(sample(), ['g2', 'g3'], [{ n: 9, kind: 'sound' }]);
    expect(show(r.doc)).toBe('(2) 9 2 open 0 3 (1) 3 2 4');
    expect(r.report.removed).toEqual(['g2', 'g3']);
    valid(r.doc);
    expect(replaceGroups(sample(), ['g2'], [{ n: 7, kind: 'sound' }]).report.reason).toBe(
      'no-room',
    );
    expect(replaceGroups(sample(), ['g1', 'g3'], [{ n: 1, kind: 'sound' }]).report.reason).toBe(
      'not-contiguous',
    );
  });
});

describe('resize and reverse', () => {
  it('resizes against the space', () => {
    expect(show(resizeGroup(sample(), 'g9', 7).doc)).toBe('(2) 3 3 2 open 0 3 (1) 3 2 7');
    expect(resizeGroup(sample(), 'g9', 8).report.reason).toBe('no-room');
    expect(resizeGroup(sample(), 'g9', 0).report.reason).toBe('too-small');
    expect(resizeGroup(sample(), 'g9', 4).report.reason).toBe('no-change');
    expect(show(resizeGroups(sample(), ['g2', 'g3'], 1).doc)).toBe('(2) 4 4 2 open 1 3 (1) 3 2 4');
    expect(resizeGroups(sample(), ['g6'], -1).report.reason).toBe('too-small');
    expect(resizeGroups(sample(), ['g2', 'g3'], 2).report.reason).toBe('no-room');
  });
  it('reverses a contiguous run (retrograde)', () => {
    const r = reverseGroups(sample(), ['g5', 'g6', 'g7', 'g8']);
    expect(show(r.doc)).toBe('(2) 3 3 2 open 3 2 3 (1) 3 4');
    valid(r.doc);
    expect(reverseGroups(sample(), ['g2', 'g3']).report.reason).toBe('no-change');
    expect(reverseGroups(sample(), ['g2']).report.ok).toBe(false);
  });
});

describe('clipboard text', () => {
  it('formats and parses phrases', () => {
    const gs = copyGroups(sample(), ['g5', 'g6', 'g7']);
    expect(formatGroups(gs)).toBe('3 (1) 3');
    expect(parseGroups('3 (1) 3')).toEqual(gs);
    expect(parseGroups(' 3, r1 + 3 ')).toEqual(gs);
    expect(parseGroups('3 · 12')).toEqual([
      { n: 3, kind: 'sound' },
      { n: 12, kind: 'sound' },
    ]);
    expect(parseGroups('hello')).toBeNull();
    expect(parseGroups('3 0')).toBeNull();
    expect(parseGroups('')).toBeNull();
  });
});

describe('trimEdge (drag a tile edge)', () => {
  // sample: (2) 3 3 2 | 3 (1) 3 2 4 — g2 = first 3, open 3
  it('grows the end into the next sound, then covers it', () => {
    const r = trimEdge(sample(), 'g2', 'end', 1);
    expect(show(r.doc)).toBe('(2) 4 2 2 open 3 3 (1) 3 2 4');
    expect(r.report.shortened).toEqual(['g3']);
    const r2 = trimEdge(sample(), 'g2', 'end', 4);
    expect(show(r2.doc)).toBe('(2) 7 1 open 3 3 (1) 3 2 4');
    expect(r2.report.covered).toEqual(['g3']);
    valid(r2.doc);
  });
  it('shrinking the end leaves silence after it', () => {
    const r = trimEdge(sample(), 'g2', 'end', -2);
    expect(show(r.doc)).toBe('(2) 1 (2) 3 2 open 3 3 (1) 3 2 4');
    expect(r.report.created).toEqual(['g10']);
    // next to the space, the freed time joins it
    expect(show(trimEdge(sample(), 'g4', 'end', -1).doc)).toBe('(2) 3 3 1 open 4 3 (1) 3 2 4');
  });
  it('grows the start backwards into a rest, and shrinking it widens that rest', () => {
    expect(show(trimEdge(sample(), 'g2', 'start', 1).doc)).toBe('(1) 4 3 2 open 3 3 (1) 3 2 4');
    expect(show(trimEdge(sample(), 'g2', 'start', -1).doc)).toBe('(3) 2 3 2 open 3 3 (1) 3 2 4');
    expect(show(trimEdge(sample(), 'g5', 'start', 2).doc)).toBe('(2) 3 3 2 open 1 5 (1) 3 2 4');
  });
  it('the first group shrinking from its start leaves a rest at the very start', () => {
    const r = trimEdge(sample(), 'g9', 'end', 1);
    expect(r.report.reason).toBe('out-of-range');
    const d = trimEdge(sample(), 'g1', 'start', 1);
    expect(d.report.reason).toBe('out-of-range');
  });
  it('clamps: a group keeps at least one pulse', () => {
    expect(show(trimEdge(sample(), 'g2', 'end', -9).doc)).toBe('(2) 1 (2) 3 2 open 3 3 (1) 3 2 4');
    expect(trimEdge(sample(), 'g2', 'end', 0).report.reason).toBe('no-change');
    expect(trimEdge(sample(), 'space', 'end', 1).report.ok).toBe(false);
  });
});
