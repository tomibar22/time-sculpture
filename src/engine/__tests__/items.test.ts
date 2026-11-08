import { describe, expect, it } from 'vitest';
import { docFrom, emptyDoc, sequence } from '../doc';
import {
  add,
  clear,
  duplicate,
  fillWithPieces,
  fillWithSilence,
  merge,
  remove,
  split,
  toggleKind,
  toggledKind,
} from '../ops/items';
import { m44, sample, show, valid } from './helpers';

describe('add', () => {
  it('adds at the end of the start or the start of the ending', () => {
    const d0 = emptyDoc(m44);
    const a = add(d0, 3, 'sound', 'start');
    const b = add(a.doc, 4, 'rest', 'end');
    expect(show(b.doc)).toBe('3 open 25 (4)');
    expect(a.report.created).toEqual(['g1']);
    valid(b.doc);
  });

  it('adds at an index', () => {
    const r = add(sample(), 1, 'sound', { index: 0 });
    expect(show(r.doc)).toBe('1 (2) 3 3 2 open 2 3 (1) 3 2 4');
  });

  it('refuses when the space is too small', () => {
    const d = sample(); // open 3
    const r = add(d, 4, 'sound', 'end');
    expect(r.report.ok).toBe(false);
    expect(r.report.reason).toBe('no-room');
    expect(r.doc).toBe(d);
    expect(add(d, 0, 'sound', 'end').report.reason).toBe('too-small');
  });
});

describe('split / merge', () => {
  it('splits into ceil and floor halves, keeping the first id', () => {
    const d = docFrom(m44, [5, '|']);
    const r = split(d, ['g1']);
    expect(show(r.doc)).toBe('3 2 open 27');
    expect(r.doc.items[0]!.id).toBe('g1');
    expect(r.report.created).toEqual(['g2']);
    valid(r.doc);
  });

  it('ignores groups of 1', () => {
    const d = docFrom(m44, [1, '|']);
    expect(split(d, ['g1']).report.reason).toBe('too-small');
  });

  it('merges a contiguous selection; rest only if all rests', () => {
    const d = sample();
    const r = merge(d, ['g1', 'g2']);
    expect(show(r.doc)).toBe('5 3 2 open 3 3 (1) 3 2 4');
    const rr = merge(docFrom(m44, [[2], [3], '|']), ['g1', 'g2']);
    expect(show(rr.doc)).toBe('(5) open 27');
    expect(r.report.removed).toEqual(['g2']);
  });

  it('refuses non-contiguous merges', () => {
    expect(merge(sample(), ['g1', 'g3']).report.reason).toBe('not-contiguous');
    expect(merge(sample(), ['g1']).report.reason).toBe('nothing-selected');
  });

  it('cannot merge across the space', () => {
    // g4 is before the space, g5 after: not contiguous in the item list
    expect(merge(sample(), ['g4', 'g5']).report.reason).toBe('not-contiguous');
  });
});

describe('duplicate / remove / toggle', () => {
  it('duplicates after the last selected group when there is room', () => {
    const r = duplicate(sample(), ['g2']);
    expect(show(r.doc)).toBe('(2) 3 3 3 2 open 0 3 (1) 3 2 4');
    valid(r.doc);
    expect(duplicate(sample(), ['g2', 'g3']).report.reason).toBe('no-room');
  });

  it('removes and grows the space', () => {
    const r = remove(sample(), ['g1', 'g9']);
    expect(show(r.doc)).toBe('3 3 2 open 9 3 (1) 3 2');
    expect(remove(sample(), []).report.ok).toBe(false);
  });

  it('toggles: any sound → all rest, else all sound', () => {
    const d = sample();
    expect(toggledKind(d, ['g1', 'g2'])).toBe('rest');
    const r = toggleKind(d, ['g1', 'g2']);
    expect(show(r.doc)).toBe('(2) (3) 3 2 open 3 3 (1) 3 2 4');
    expect(show(toggleKind(r.doc, ['g1', 'g2']).doc)).toBe('2 3 3 2 open 3 3 (1) 3 2 4');
  });
});

describe('fills and clear', () => {
  it('fills the space with tray pieces at the end of the start', () => {
    const d = docFrom(m44, [4, '|', 4]);
    const r = fillWithPieces(d, [3, 5], () => 0.3);
    valid(r.doc);
    expect(r.doc.items.find((x) => x.kind === 'space')!.n).toBe(0);
    const { start } = sequence(r.doc);
    expect(start[0]).toBe('4');
    expect(r.report.created.length).toBe(start.length - 1);
  });

  it('reports when the tray cannot fill', () => {
    const d = docFrom(m44, [31, '|']);
    expect(fillWithPieces(d, [2, 3]).report.reason).toBe('cannot-fill');
    expect(fillWithPieces(docFrom(m44, [32, '|']), [2]).report.reason).toBe('no-room');
  });

  it('fills with one silence', () => {
    const r = fillWithSilence(sample());
    expect(show(r.doc)).toBe('(2) 3 3 2 (3) open 0 3 (1) 3 2 4');
    expect(fillWithSilence(r.doc).report.ok).toBe(false);
  });

  it('clears', () => {
    const r = clear(sample());
    expect(show(r.doc)).toBe('open 26');
    expect(clear(r.doc).report.reason).toBe('no-change');
  });
});
