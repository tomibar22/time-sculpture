import { describe, expect, it } from 'vitest';
import { docFrom, makeMeter } from '../doc';
import { clampSlide, reorderAtPulse, reorderStep, reorderTo, slide, stepDelta } from '../ops/move';
import { sample, show, valid } from './helpers';

// sample: (2) 3 3 2 | 3 (1) 3 2 4  (ids g1..g9), 26 pulses of 13 beats × 2:1, open 3

describe('slide', () => {
  it('shortens a sound ahead and widens a rest behind', () => {
    const r = slide(sample(), ['g2'], 1);
    expect(show(r.doc)).toBe('(3) 3 2 2 open 3 3 (1) 3 2 4');
    expect(r.report.shortened).toEqual(['g3']);
    expect(r.report.created).toEqual([]);
    valid(r.doc);
  });

  it('eats the space, then sounds; leaves a new rest behind a sound', () => {
    const r = slide(sample(), ['g3', 'g4'], 4);
    expect(show(r.doc)).toBe('(2) 3 (4) 3 2 open 0 2 (1) 3 2 4');
    expect(r.report.shortened).toEqual(['g5']);
    expect(r.report.created).toEqual(['g10']);
    valid(r.doc);
  });

  it('covers groups that are used up', () => {
    const r = slide(sample(), ['g2'], 5);
    expect(show(r.doc)).toBe('(7) 3 open 3 3 (1) 3 2 4');
    expect(r.report.covered).toEqual(['g3', 'g4']);
    valid(r.doc);
  });

  it('moves left out of the ending: the space shrinks, the rest behind grows', () => {
    const r = slide(sample(), ['g5'], -1);
    expect(show(r.doc)).toBe('(2) 3 3 2 open 2 3 (2) 3 2 4');
    valid(r.doc);
  });

  it('joins the space when it leaves room next to it', () => {
    const r = slide(sample(), ['g9'], -2);
    expect(show(r.doc)).toBe('(2) 3 3 2 open 3 3 (1) 3 4 (2)');
    const r2 = slide(sample(), ['g4'], -1);
    expect(show(r2.doc)).toBe('(2) 3 2 2 open 4 3 (1) 3 2 4');
    expect(r2.report.shortened).toEqual(['g3']);
  });

  it('a block at the very start leaves a rest at the start', () => {
    const d = docFrom(makeMeter(4, 1, 2), [2, 2, '|']);
    expect(show(slide(d, ['g1'], 1).doc)).toBe('(1) 2 1 open 4');
  });

  it('clamps to the piece and refuses bad selections', () => {
    expect(slide(sample(), ['g9'], 1).report.reason).toBe('out-of-range');
    expect(slide(sample(), ['g1', 'g3'], 1).report.reason).toBe('not-contiguous');
    expect(slide(sample(), [], 1).report.reason).toBe('nothing-selected');
    expect(clampSlide(sample(), ['g1'], -5)).toBe(0);
    expect(clampSlide(sample(), ['g1'], 99)).toBe(24);
    expect(show(slide(sample(), ['g1'], 99).doc)).toBe('(24) (2) open 0');
  });

  it('keeps the block intact and its ids', () => {
    const r = slide(sample(), ['g2', 'g3'], 2);
    const ids = r.doc.items.map((x) => x.id);
    expect(ids.indexOf('g3')).toBe(ids.indexOf('g2') + 1);
    expect(r.doc.items.find((x) => x.id === 'g2')!.n).toBe(3);
    expect(r.doc.items.find((x) => x.id === 'g3')!.n).toBe(3);
  });

  it('computes steps by pulse and by beat', () => {
    const d = sample();
    expect(stepDelta(d, ['g2'], 1, 'pulse')).toBe(1);
    expect(stepDelta(d, ['g2'], 1, 'beat')).toBe(2);
    expect(stepDelta(d, ['g2'], -1, 'beat')).toBe(-2);
    expect(stepDelta(d, ['g3'], -1, 'beat')).toBe(-1); // g3 starts mid-beat: back to its beat line
    expect(stepDelta(d, ['g3'], 1, 'beat')).toBe(1);
    expect(stepDelta(d, ['g1', 'g3'], 1, 'beat')).toBe(0);
  });
});

describe('reorder (Place)', () => {
  it('hops over the space with a step', () => {
    const r = reorderStep(sample(), ['g4'], 1);
    expect(show(r.doc)).toBe('(2) 3 3 open 3 2 3 (1) 3 2 4');
    valid(r.doc);
    expect(reorderStep(sample(), ['g1'], -1).report.reason).toBe('out-of-range');
  });

  it('drops at a pulse; the rest closes up', () => {
    const r = reorderAtPulse(sample(), ['g1'], 25);
    expect(show(r.doc)).toBe('3 3 2 open 3 3 (1) 3 2 4 (2)');
    valid(r.doc);
  });

  it('dropping inside the space attaches to the nearer side', () => {
    // with g9 lifted: (2) 3 3 2 [open 7 at 10..17] 3 (1) 3 2
    expect(show(reorderAtPulse(sample(), ['g9'], 11).doc)).toBe('(2) 3 3 2 4 open 3 3 (1) 3 2');
    expect(show(reorderAtPulse(sample(), ['g9'], 15).doc)).toBe('(2) 3 3 2 open 3 4 3 (1) 3 2');
  });

  it('gathers a non-contiguous selection into one block', () => {
    const r = reorderTo(sample(), ['g1', 'g3'], 0);
    expect(r.doc.items.slice(0, 3).map((x) => x.id)).toEqual(['g1', 'g3', 'g2']);
    expect(reorderTo(sample(), ['g1', 'g2'], 0).report.reason).toBe('no-change');
    const r2 = reorderTo(sample(), ['g1', 'g3'], 2);
    expect(show(r2.doc)).toBe('3 2 (2) 3 open 3 3 (1) 3 2 4');
  });
});
