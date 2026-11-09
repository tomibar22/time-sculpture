import { describe, expect, it } from 'vitest';
import { checkInvariants, docFrom, makeMeter } from '../doc';
import { toggleTotal, totalIndex, totalLevels } from '../form';
import { markNameAt, nameMark, resizeMeter, setSubdivision, toggleMark } from '../ops/meter';
import { prependBars } from '../ops/meter';

// 4 beats × 2 bars at 4:1 = 32 pulses
const base = () => docFrom(makeMeter(4, 2, 4), [3, 3, 2, '|', 4]);

describe('totals', () => {
  it('toggle a bracket over pulses and back', () => {
    const d = toggleTotal(base(), 0, 8).doc;
    expect(d.meter.totals).toEqual([{ a: 0, b: 2 }]);
    expect(totalIndex(d, 0, 8)).toBe(0);
    expect(checkInvariants(d)).toEqual([]);
    expect(toggleTotal(d, 0, 8).doc.meter.totals).toBeUndefined();
    expect(toggleTotal(base(), 4, 4).report.ok).toBe(false);
    expect(toggleTotal(base(), 0, 33).report.ok).toBe(false);
  });

  it('keep their moments when the subdivision changes, and move with bars added before', () => {
    const d = toggleTotal(base(), 0, 6).doc; // 0 – 1.5 beats
    expect(setSubdivision(d, [0, 1], 2).doc.meter.totals).toEqual([{ a: 0, b: 1.5 }]);
    expect(prependBars(d, 1).doc.meter.totals).toEqual([{ a: 4, b: 5.5 }]);
    expect(resizeMeter(d, 4, 1, 4).doc.meter.totals).toEqual([{ a: 0, b: 1.5 }]);
  });

  it('stack: a total sits below the ones it holds; overlapping ones never share a level', () => {
    const levels = totalLevels([
      { a: 0, b: 2 }, // holds the next two
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 1.5, b: 3 }, // overlaps the first
    ]);
    expect(levels).toEqual([2, 0, 0, 1]);
  });
});

describe('phrase mark names', () => {
  it('name, rename, unname; removing the mark removes its name', () => {
    let d = toggleMark(base(), 4).doc;
    d = toggleMark(d, 12).doc;
    expect(d.meter.markNames).toBeUndefined();
    d = nameMark(d, 12, '  B ').doc;
    expect(d.meter.markNames).toEqual(['', 'B']);
    expect(markNameAt(d, 12)).toBe('B');
    expect(markNameAt(d, 4)).toBe('');
    expect(markNameAt(d, 5)).toBeNull();
    expect(checkInvariants(d)).toEqual([]);
    // a mark added in front keeps names lined up
    d = nameMark(d, 0, 'A').doc;
    expect(d.meter.marks).toEqual([0, 1, 3]);
    expect(d.meter.markNames).toEqual(['A', '', 'B']);
    d = toggleMark(d, 4).doc;
    expect(d.meter.markNames).toEqual(['A', 'B']);
    d = nameMark(nameMark(d, 0, '').doc, 12, '').doc;
    expect(d.meter.markNames).toBeUndefined();
    expect(d.meter.marks).toEqual([0, 3]);
  });

  it('names travel with their marks through meter changes', () => {
    const d = nameMark(nameMark(base(), 4, 'x').doc, 28, 'y').doc; // beats 1 and 7
    expect(prependBars(d, 1).doc.meter.markNames).toEqual(['x', 'y']);
    const short = resizeMeter(d, 4, 1, 4).doc; // beat 7 is gone
    expect(short.meter.marks).toEqual([1]);
    expect(short.meter.markNames).toEqual(['x']);
    expect(setSubdivision(d, [1], 3).doc.meter.markNames).toEqual(['x', 'y']);
  });
});
