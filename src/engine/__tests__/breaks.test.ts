import { describe, expect, it } from 'vitest';
import { checkInvariants, docFrom, makeMeter, withBreaks } from '../doc';
import { hasBreakAt, resizeMeter, setSubdivision, toggleBreak } from '../ops/meter';
import { add } from '../ops/items';

const base = () => docFrom(makeMeter(4, 2, 4), [3, '|', 4]); // 32 pulses, pulse k at k/4 beats

describe('line breaks', () => {
  it('toggles a break at any pulse, in beats', () => {
    const d = toggleBreak(base(), 6).doc; // 1.5 beats
    expect(d.meter.breaks).toEqual([1.5]);
    expect(hasBreakAt(d, 6)).toBe(true);
    expect(checkInvariants(d)).toEqual([]);
    const d2 = toggleBreak(d, 6).doc;
    expect(d2.meter.breaks).toBeUndefined();
  });

  it('refuses the very start and end', () => {
    expect(toggleBreak(base(), 0).report.ok).toBe(false);
    expect(toggleBreak(base(), 32).report.ok).toBe(false);
  });

  it('survive other edits and undo with the document', () => {
    const d = toggleBreak(base(), 6).doc;
    expect(add(d, 2, 'sound', 'start').doc.meter.breaks).toEqual([1.5]);
  });

  it('snap to the nearest pulse when the subdivision changes', () => {
    const d = toggleBreak(base(), 5).doc; // 1.25 beats
    const r = setSubdivision(d, [1], 3); // beat 1 now has pulses at 1, 1.333, 1.667
    expect(r.doc.meter.breaks).toEqual([1.3333333333333333]);
    expect(checkInvariants(r.doc)).toEqual([]);
    // two breaks snapping onto the same pulse merge
    const two = toggleBreak(toggleBreak(base(), 5).doc, 6).doc;
    expect(setSubdivision(two, [1], 1).doc.meter.breaks).toEqual([1]);
  });

  it('are dropped when the piece gets shorter than them', () => {
    const d = toggleBreak(toggleBreak(base(), 6).doc, 26).doc; // 1.5 and 6.5 beats
    expect(resizeMeter(d, 3, 2, 4).doc.meter.breaks).toEqual([1.5]);
  });

  it('are validated', () => {
    const bad = { ...base(), meter: { ...base().meter, breaks: [1.3] } };
    expect(checkInvariants(bad).join()).toMatch(/line break/);
    expect(withBreaks(base().meter, [9, 0, 1.5, 1.5]).breaks).toEqual([1.5]);
  });
});
