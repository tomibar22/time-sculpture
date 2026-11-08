import { describe, expect, it } from 'vitest';
import { checkInvariants, docFrom, makeMeter } from '../doc';
import { hasMarkAt, resizeMeter, setSubdivision, toggleMark } from '../ops/meter';

const base = () => docFrom(makeMeter(4, 2, 4), [3, '|', 4]); // pulse k at k/4 beats

describe('phrase marks', () => {
  it('toggle at any pulse, including the very start', () => {
    let d = toggleMark(base(), 0).doc;
    d = toggleMark(d, 7).doc; // 1.75 beats
    expect(d.meter.marks).toEqual([0, 1.75]);
    expect(hasMarkAt(d, 7)).toBe(true);
    expect(checkInvariants(d)).toEqual([]);
    expect(toggleMark(d, 7).doc.meter.marks).toEqual([0]);
    expect(toggleMark(base(), 32).report.ok).toBe(false);
  });
  it('keep their moment through subdivision changes and meter shrinks', () => {
    const d = toggleMark(toggleMark(base(), 7).doc, 28).doc; // 1.75 and 7
    expect(setSubdivision(d, [1], 2).doc.meter.marks).toEqual([1.5, 7]);
    expect(resizeMeter(d, 3, 2, 4).doc.meter.marks).toEqual([1.75]);
  });
  it('live alongside line breaks', () => {
    const d = toggleMark(base(), 7).doc;
    expect(d.meter.breaks).toBeUndefined();
    expect(checkInvariants({ ...d, meter: { ...d.meter, marks: [1.8] } }).join()).toMatch(
      /phrase mark/,
    );
  });
});
