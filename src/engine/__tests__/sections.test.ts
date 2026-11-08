import { describe, expect, it } from 'vitest';
import { checkInvariants, docFrom, makeMeter } from '../doc';
import { buildGrid } from '../grid';
import { resizeMeter, toggleBreak } from '../ops/meter';
import {
  addSection,
  removeSection,
  resizeBeats,
  setMainBarSize,
  updateSection,
} from '../ops/sections';
import { barMap, fromMain, landing, sectionAt, sectionTempo, toMain } from '../sections';
import { nextPulse } from '../playback';

// 4/4 × 2 bars at 2:1 (16 pulses); the phrase 3 | 4
const base = () => docFrom(makeMeter(4, 2, 2), [3, '|', 4]);

describe('metric modulation', () => {
  it('2:1 = 3:1 makes a beat 1½ times longer (♩=72 → 48)', () => {
    const r = addSection(base(), 4, { from: 2, to: 3, beatsPerBar: 4 });
    expect(r.report.ok).toBe(true);
    const m = r.doc.meter;
    const map = barMap(m);
    expect(map.sections.map((s) => s.scale)).toEqual([1, 1.5]);
    expect(map.totalMain).toBe(4 + 4 * 1.5);
    expect(sectionTempo(m, 1, 72)).toBe(48);
    expect(toMain(m, 6)).toBe(4 + 2 * 1.5);
    expect(fromMain(m, 7)).toBe(6);
    expect(sectionAt(m, 3.9)).toBe(0);
    expect(sectionAt(m, 4)).toBe(1);
    expect(checkInvariants(r.doc)).toEqual([]);
  });

  it('may start mid-bar, with its own bar size; bars restart there', () => {
    const r = addSection(base(), 3, { from: 1, to: 1, beatsPerBar: 3 });
    const map = barMap(r.doc.meter);
    expect(map.barStarts).toEqual([0, 3, 6]); // main bar cut short at 3 beats, then 3/4 bars
    expect(r.doc.meter.cycles).toBe(3);
    expect(map.beatInBar).toEqual([0, 1, 2, 0, 1, 2, 0, 1]);
    expect(checkInvariants(r.doc)).toEqual([]);
  });

  it('checks whether the piece ends on a main beat 1 and suggests whole beats to fix it', () => {
    const r = addSection(base(), 4, { from: 2, to: 3, beatsPerBar: 4 }); // 4 + 6 = 10 main beats
    const l = landing(r.doc.meter);
    expect(l.lands).toBe(false);
    expect(l.late).toBeCloseTo(2);
    // +2 main beats = 4/3 local (not whole); −2 main = −4/3 (not whole) → no whole-beat fix
    expect(l.fixes).toEqual([]);
    const r2 = addSection(base(), 4, { from: 2, to: 1, beatsPerBar: 4 }); // new beat = ½: 4 + 2 = 6
    // cutting 4 would remove the whole last section, so only adding is offered
    expect(landing(r2.doc.meter)).toMatchObject({ lands: false, fixes: [4] });
    const fixed = resizeBeats(r2.doc, 4, 2).doc;
    expect(landing(fixed.meter).lands).toBe(true);
    expect(checkInvariants(fixed)).toEqual([]);
  });

  it('pieces without modulation always land', () => {
    expect(landing(base().meter).lands).toBe(true);
  });

  it('edits and removes modulations', () => {
    const r = addSection(base(), 4, { from: 2, to: 3, beatsPerBar: 4 });
    const u = updateSection(r.doc, 0, { from: 3, to: 2, beatsPerBar: 2 });
    expect(u.doc.meter.sections).toEqual([{ at: 4, from: 3, to: 2, beatsPerBar: 2 }]);
    expect(u.doc.meter.cycles).toBe(3);
    const x = removeSection(u.doc, 0);
    expect(x.doc.meter.sections).toBeUndefined();
    expect(checkInvariants(x.doc)).toEqual([]);
    expect(addSection(base(), 0, { from: 1, to: 1, beatsPerBar: 4 }).report.ok).toBe(false);
    expect(addSection(base(), 4, { from: 9, to: 1, beatsPerBar: 4 }).report.ok).toBe(false);
  });

  it('adds and cuts bars at the end; the ending keeps its subdivisions', () => {
    const r = addSection(base(), 4, { from: 2, to: 3, beatsPerBar: 3 });
    const longer = resizeMeter(r.doc, 4, r.doc.meter.cycles + 1, 4).doc; // + one 3-beat bar
    expect(longer.meter.subdivision.length).toBe(11);
    expect(longer.meter.sections![0]!.at).toBe(4);
    expect(checkInvariants(longer)).toEqual([]);
    const regroup = resizeMeter(r.doc, 3, r.doc.meter.cycles, 4).doc; // main bars of 3
    expect(regroup.meter.subdivision.length).toBe(8);
    expect(barMap(regroup.meter).barStarts).toEqual([0, 3, 4, 7]);
    expect(setMainBarSize(r.doc, 4).report.reason).toBe('no-change');
  });

  it('later sections, breaks and marks move with the beats after the cut', () => {
    const r = addSection(toggleBreak(base(), 14).doc, 5, { from: 1, to: 1, beatsPerBar: 4 }); // break at 7 beats
    const longer = resizeBeats(r.doc, 2, 2).doc; // inserted at max(5, 4) = 5
    expect(longer.meter.sections![0]!.at).toBe(5);
    expect(longer.meter.breaks).toEqual([9]);
    expect(checkInvariants(longer)).toEqual([]);
  });

  it('the downbeat click follows each section’s bars', () => {
    const r = addSection(base(), 3, { from: 1, to: 1, beatsPerBar: 3 });
    expect(nextPulse(r.doc, 3).click).toBe('downbeat');
    expect(nextPulse(r.doc, 4).click).toBe('beat');
    expect(buildGrid(r.doc.meter).NB).toBe(8);
  });

  it('cutting more than half the piece still ends at the end (3×3 → 3×1)', () => {
    const d = docFrom(makeMeter(3, 3, 1), ['|']);
    const r = resizeBeats(d, -6, 3);
    expect(r.report.ok).toBe(true);
    expect(r.doc.meter.subdivision).toHaveLength(3);
    expect(r.doc.meter.cycles).toBe(1);
    expect(checkInvariants(r.doc)).toEqual([]);
  });

  it('removing the last modulation completes the last bar, the space takes the new pulses', () => {
    // 4/4 × 2 at 2:1, a modulation at beat 4, then one beat more in it: 9 beats
    const withMod = addSection(base(), 4, { from: 2, to: 3, beatsPerBar: 4 }).doc;
    const nine = resizeBeats(withMod, 1, 2).doc;
    expect(nine.meter.subdivision).toHaveLength(9);
    const r = removeSection(nine, 0);
    expect(r.doc.meter.subdivision).toHaveLength(12);
    expect(r.doc.meter.cycles).toBe(3);
    expect(checkInvariants(r.doc)).toEqual([]);
  });
});
