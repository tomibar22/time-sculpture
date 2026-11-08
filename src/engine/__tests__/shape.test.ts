import { describe, expect, it } from 'vitest';
import { docFrom } from '../doc';
import { reshapeLine, snapPair, snapSize, stretchEdge } from '../ops/shape';
import { m44, sample, show, valid } from './helpers';

describe('reshapeLine', () => {
  it('moves the line, keeping the pair total', () => {
    const r = reshapeLine(sample(), 'g2', 4);
    expect(show(r.doc)).toBe('(2) 4 2 2 open 3 3 (1) 3 2 4');
    valid(r.doc);
  });

  it('clamps each side to at least 1', () => {
    expect(show(reshapeLine(sample(), 'g2', 99).doc)).toBe('(2) 5 1 2 open 3 3 (1) 3 2 4');
    expect(show(reshapeLine(sample(), 'g2', -4).doc)).toBe('(2) 1 5 2 open 3 3 (1) 3 2 4');
  });

  it('refuses lines next to the space and no-ops', () => {
    expect(reshapeLine(sample(), 'g4', 1).report.reason).toBe('not-adjacent');
    expect(reshapeLine(sample(), 'g2', 3).report.reason).toBe('no-change');
    expect(reshapeLine(sample(), 'nope', 3).report.reason).toBe('not-adjacent');
  });
});

describe('stretchEdge', () => {
  it('grows into the space and shrinks back', () => {
    const d = sample(); // g4=2 before space(3), g5=3 after
    expect(show(stretchEdge(d, 'g4', 5).doc)).toBe('(2) 3 3 5 open 0 3 (1) 3 2 4');
    expect(show(stretchEdge(d, 'g4', 9).doc)).toBe('(2) 3 3 5 open 0 3 (1) 3 2 4');
    expect(show(stretchEdge(d, 'g5', 1).doc)).toBe('(2) 3 3 2 open 5 1 (1) 3 2 4');
    valid(stretchEdge(d, 'g5', 1).doc);
  });

  it('only works for groups touching the space', () => {
    expect(stretchEdge(sample(), 'g1', 3).report.reason).toBe('not-adjacent');
    expect(stretchEdge(sample(), 'space', 3).report.reason).toBe('not-adjacent');
    expect(stretchEdge(sample(), 'g4', 2).report.reason).toBe('no-change');
  });

  it('works when the space is empty (shrink only)', () => {
    const d = docFrom(m44, [16, '|', 16]);
    expect(show(stretchEdge(d, 'g1', 20).doc)).toBe('16 open 0 16');
    expect(show(stretchEdge(d, 'g1', 10).doc)).toBe('10 open 6 16');
  });
});

describe('snapping helpers', () => {
  it('snaps a pair to tray sizes', () => {
    expect(snapPair(7, 1, [2, 3, 4, 5])).toBe(2);
    expect(snapPair(7, 6, [2, 3, 4, 5])).toBe(5);
    expect(snapPair(3, 1, [2, 3])).toBeNull();
  });
  it('snaps a size to the nearest allowed tray size', () => {
    expect(snapSize(6, 10, [2, 3, 5, 7])).toBe(5);
    expect(snapSize(6, 4, [5, 7])).toBeNull();
  });
});
