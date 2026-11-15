import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  assertValid,
  barMap,
  buildGrid,
  checkInvariants,
  docFrom,
  insertBars,
  landing,
  makeMeter,
  parsePattern,
  patternFit,
  removeBars,
  rowSizeAt,
  setBars,
  setRowSize,
  slideRuns,
  toggleBreak,
  toggleMark,
} from '..';

const seq = (d: { items: readonly { kind: string; n: number }[] }) =>
  d.items
    .map((x) => (x.kind === 'space' ? `_${x.n}` : x.kind === 'rest' ? `(${x.n})` : `${x.n}`))
    .join(' ');

describe('setBars: the metre without a modulation', () => {
  it('regroups 42 beats of 7 as 5 5 4, three times, with the same pulses', () => {
    const d = docFrom(makeMeter(7, 6, 2), [3, 3, 2, '|']);
    const r = setBars(d, 0, [5, 5, 4]);
    expect(r.report.ok).toBe(true);
    assertValid(r.doc);
    const m = barMap(r.doc.meter);
    expect(m.barStarts).toEqual([0, 5, 10, 14, 19, 24, 28, 33, 38]);
    expect(r.doc.meter.cycles).toBe(9);
    expect(r.doc.meter.subdivision).toEqual(d.meter.subdivision);
    expect(r.doc.items).toEqual(d.items);
    expect(landing(r.doc.meter).lands).toBe(true);
  });
  it('changes the metre from a beat on, keeping the tempo', () => {
    const d = docFrom(makeMeter(4, 4, 4), ['|']);
    const r = setBars(d, 8, [3, 3, 2]);
    assertValid(r.doc);
    expect(r.doc.meter.sections).toEqual([
      { at: 8, from: 1, to: 1, beatsPerBar: 3, bars: [3, 3, 2] },
    ]);
    expect(barMap(r.doc.meter).barStarts).toEqual([0, 4, 8, 11, 14]);
    expect(barMap(r.doc.meter).totalMain).toBe(16);
    // saying the bars before it again removes the change
    const back = setBars(r.doc, 8, [4]);
    assertValid(back.doc);
    expect(back.doc.meter.sections).toBeUndefined();
    expect(back.doc.meter.cycles).toBe(4);
  });
  it('a single size for the whole piece is the plain metre again', () => {
    const d = setBars(docFrom(makeMeter(7, 6, 2), ['|']), 0, [5, 5, 4]).doc;
    const r = setBars(d, 0, [6]);
    assertValid(r.doc);
    expect(r.doc.meter.bars).toBeUndefined();
    expect(r.doc.meter.beatsPerCycle).toBe(6);
    expect(r.doc.meter.cycles).toBe(7);
  });
  it('reads patterns', () => {
    expect(parsePattern('5 5 4')).toEqual([5, 5, 4]);
    expect(parsePattern('5+5+4')).toEqual([5, 5, 4]);
    expect(parsePattern('14')).toBeNull();
    expect(parsePattern('')).toBeNull();
    expect(patternFit(42, [5, 5, 4])).toEqual({ rounds: 3, bars: 9, left: 0 });
    expect(patternFit(16, [5, 5, 4])).toEqual({ rounds: 1, bars: 3, left: 2 });
  });
});

describe('insertBars / removeBars', () => {
  const base = () => docFrom(makeMeter(4, 3, 2), [4, 4, 6, 2, '|', 8]);
  it('adds bars in the middle: later music moves, the gap is silence', () => {
    const r = insertBars(base(), 1, 2);
    assertValid(r.doc);
    expect(r.doc.meter.cycles).toBe(5);
    expect(seq(r.doc)).toBe('4 4 (16) 6 2 _0 8');
  });
  it('splits a group the bar line cuts through', () => {
    const r = insertBars(base(), 2, 1);
    assertValid(r.doc);
    expect(seq(r.doc)).toBe('4 4 6 2 _8 8');
    const r2 = insertBars(docFrom(makeMeter(4, 2, 2), [6, 10, '|']), 1, 1);
    assertValid(r2.doc);
    expect(seq(r2.doc)).toBe('6 2 (8) 8 _0');
  });
  it('adds at the very start and the very end', () => {
    const a = insertBars(base(), 0, 1);
    assertValid(a.doc);
    expect(seq(a.doc)).toBe('(8) 4 4 6 2 _0 8');
    const z = insertBars(base(), 3, 1);
    assertValid(z.doc);
    expect(seq(z.doc)).toBe('4 4 6 2 _0 8 (8)');
  });
  it('marks and breaks move with the music', () => {
    let d = toggleMark(base(), 8).doc;
    d = toggleBreak(d, 16).doc;
    const r = insertBars(d, 1, 1);
    assertValid(r.doc);
    expect(r.doc.meter.marks).toEqual([8]);
    expect(r.doc.meter.breaks).toEqual([12]);
  });
  it('removes bars with what is in them', () => {
    const r = removeBars(base(), 1, 1);
    assertValid(r.doc);
    expect(r.doc.meter.cycles).toBe(2);
    // 4 4 | 6 2 | _ 8 → the 6 began in the cut and is gone with the 2
    expect(seq(r.doc)).toBe('4 4 _0 8');
    const r2 = removeBars(docFrom(makeMeter(4, 3, 2), [6, 6, 12, '|']), 1, 1);
    assertValid(r2.doc);
    // the second 6 began before the cut and keeps its 2; the 12 began inside it: silence is left
    expect(seq(r2.doc)).toBe('6 2 (8) _0');
    expect(checkInvariants(r2.doc)).toEqual([]);
  });
  it('never removes the last bar', () => {
    expect(removeBars(docFrom(makeMeter(4, 1, 2), ['|']), 0, 1).report.ok).toBe(false);
  });
  it('stays valid for any insert and removal (also with a pattern and a modulation)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 12 }),
        fc.integer({ min: 1, max: 3 }),
        fc.boolean(),
        fc.boolean(),
        fc.array(fc.integer({ min: 1, max: 7 }), { maxLength: 12 }),
        (bar, n, pattern, add, sizes) => {
          let d = docFrom(makeMeter(4, 6, 3), ['|']);
          let room = buildGrid(d.meter).TS;
          const items: (number | '|')[] = [];
          for (const s of sizes)
            if (s <= room) {
              items.push(s);
              room -= s;
            }
          d = docFrom(d.meter, [...items, '|']);
          if (pattern) d = setBars(d, 8, [3, 2]).doc;
          d = toggleMark(d, 9).doc;
          const bars = barMap(d.meter).barStarts.length;
          const r = add ? insertBars(d, bar % (bars + 1), n) : removeBars(d, bar % bars, n);
          if (!r.report.ok) return r.doc === d;
          return checkInvariants(r.doc).length === 0;
        },
      ),
    );
  });
});

describe('row sizes', () => {
  it('one row, or from a place on', () => {
    const d = docFrom(makeMeter(4, 8, 2), ['|']);
    const on = setRowSize(d, 8, 3);
    assertValid(on.doc);
    expect(rowSizeAt(on.doc.meter, 0)).toBe(0);
    expect(rowSizeAt(on.doc.meter, 20)).toBe(3);
    const one = setRowSize(d, 8, 3, 20);
    assertValid(one.doc);
    expect(one.doc.meter.rowSizes).toEqual([
      { at: 8, per: 3 },
      { at: 20, per: 0 },
    ]);
  });
});

describe('slideRuns', () => {
  it('moves groups that are not neighbours together', () => {
    const d = docFrom(makeMeter(4, 2, 4), [3, 2, 3, '|']);
    const r = slideRuns(d, ['g1', 'g3'], 2);
    assertValid(r.doc);
    expect(seq(r.doc)).toBe('(2) 3 (2) 3 _22');
    const starts: Record<string, number> = {};
    let s = 0;
    for (const x of r.doc.items) {
      starts[x.id] = s;
      s += x.n;
    }
    expect(starts.g1).toBe(2);
    expect(starts.g3).toBe(7);
  });
});
