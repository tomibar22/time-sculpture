import { describe, expect, it } from 'vitest';
import { checkInvariants, docFrom, makeMeter, sequence } from '../doc';
import {
  defaultPasses,
  playedBeats,
  playOrder,
  removeVolta,
  repeatEndAt,
  repeatsOf,
  setRepeatTimes,
  setVolta,
  toggleRepeatEnd,
  toggleRepeatStart,
} from '../form';
import { prependBars, resizeMeter, setSubdivision, toggleMark } from '../ops/meter';
import { addSection, resizeBeats } from '../ops/sections';
import type { Doc } from '../types';

// 4 beats × 4 bars at 1:1, so pulse k is beat k
const piece = () => docFrom(makeMeter(4, 4, 1), ['|']);
const order = (d: Doc) => playOrder(d.meter).map((s) => [s.a, s.b]);
const ok = (r: { doc: Doc; report: { ok: boolean } }) => {
  expect(r.report.ok).toBe(true);
  expect(checkInvariants(r.doc)).toEqual([]);
  return r.doc;
};

describe('repeats and endings', () => {
  it('without signs the piece plays once', () => {
    expect(order(piece())).toEqual([[0, 16]]);
  });

  it('an end sign without a start repeats from the top', () => {
    const d = ok(toggleRepeatEnd(piece(), 8));
    expect(order(d)).toEqual([
      [0, 8],
      [0, 8],
      [8, 16],
    ]);
    expect(playedBeats(d.meter)).toBe(24);
  });

  it('|: … :| repeats the passage between the signs, ×3 plays it three times', () => {
    let d = ok(toggleRepeatStart(piece(), 4));
    d = ok(toggleRepeatEnd(d, 8));
    d = ok(setRepeatTimes(d, 8, 3));
    expect(repeatEndAt(d, 8)?.times).toBe(3);
    expect(order(d)).toEqual([
      [0, 4],
      [4, 8],
      [4, 8],
      [4, 8],
      [8, 16],
    ]);
  });

  it('1st and 2nd endings: |: A [1. B :| [2. C ] D → A B A C D', () => {
    let d = ok(toggleRepeatEnd(piece(), 8)); // A = 0–4, B = 4–8
    expect(defaultPasses(d.meter, 4, 8)).toEqual([1]);
    d = ok(setVolta(d, 4, 8, [1]));
    expect(defaultPasses(d.meter, 8, 12)).toEqual([2]);
    d = ok(setVolta(d, 8, 12, [2])); // C = 8–12, D = 12–16
    expect(order(d)).toEqual([
      [0, 8],
      [0, 4],
      [8, 16],
    ]);
  });

  it('×3 with "1. 2." and "3.": A B A B A C', () => {
    let d = ok(toggleRepeatEnd(piece(), 8, 3));
    expect(defaultPasses(d.meter, 4, 8)).toEqual([1, 2]);
    d = ok(setVolta(d, 4, 8, [1, 2]));
    d = ok(setVolta(d, 8, 12, [3]));
    expect(order(d)).toEqual([
      [0, 8],
      [0, 8],
      [0, 4],
      [8, 16],
    ]);
  });

  it('two repeats in a row: the second starts at the first end sign', () => {
    let d = ok(toggleRepeatEnd(piece(), 4));
    d = ok(toggleRepeatEnd(d, 12));
    expect(repeatsOf(d.meter).map((r) => [r.s, r.e])).toEqual([
      [0, 4],
      [4, 12],
    ]);
  });

  it('signs toggle, at any pulse, and refuse impossible places', () => {
    const d = ok(toggleRepeatStart(piece(), 4));
    expect(toggleRepeatStart(d, 4).doc.meter.repeatStarts).toBeUndefined();
    expect(toggleRepeatStart(piece(), 16).report.ok).toBe(false); // nothing after the end
    expect(toggleRepeatEnd(piece(), 0).report.ok).toBe(false); // nothing before the start
    expect(ok(toggleRepeatEnd(piece(), 16)).meter.repeatEnds).toEqual([{ at: 16, times: 2 }]);
    expect(setRepeatTimes(piece(), 8, 3).report.ok).toBe(false); // no sign there
    expect(setRepeatTimes(ok(toggleRepeatEnd(piece(), 8)), 8, 13).report.ok).toBe(false);
  });

  it('a new ending replaces the ones it overlaps; no passes removes them', () => {
    let d = ok(setVolta(piece(), 4, 8, [1]));
    d = ok(setVolta(d, 6, 10, [2]));
    expect(d.meter.voltas).toEqual([{ a: 6, b: 10, passes: [2] }]);
    d = ok(setVolta(d, 0, 16, []));
    expect(d.meter.voltas).toBeUndefined();
    d = ok(removeVolta(ok(setVolta(piece(), 4, 8, [1])), 0));
    expect(d.meter.voltas).toBeUndefined();
  });

  it('signs keep their moment when the subdivision changes', () => {
    let d = ok(toggleRepeatEnd(piece(), 8));
    d = ok(setVolta(d, 4, 8, [1]));
    d = ok(setSubdivision(d, [0, 1, 2, 3, 4, 5, 6, 7], 3));
    expect(d.meter.repeatEnds).toEqual([{ at: 8, times: 2 }]);
    expect(d.meter.voltas).toEqual([{ a: 4, b: 8, passes: [1] }]);
  });

  it('a final end sign stays at the end when bars change; other signs past a cut go', () => {
    let d = ok(toggleRepeatEnd(piece(), 16));
    d = ok(toggleRepeatStart(d, 12));
    const longer = ok(resizeMeter(d, 4, 6, 1));
    expect(longer.meter.repeatEnds).toEqual([{ at: 24, times: 2 }]);
    const shorter = ok(resizeMeter(d, 4, 2, 1));
    expect(shorter.meter.repeatEnds).toEqual([{ at: 8, times: 2 }]);
    expect(shorter.meter.repeatStarts).toBeUndefined();
  });

  it('with modulations, signs after the cut move with their beats', () => {
    let d = ok(addSection(piece(), 4, { from: 1, to: 1, beatsPerBar: 4 }));
    d = ok(toggleRepeatEnd(d, 14));
    d = ok(setVolta(d, 10, 14, [1]));
    d = ok(resizeBeats(d, 2, 1)); // inserted at beat 8
    expect(d.meter.repeatEnds).toEqual([{ at: 16, times: 2 }]);
    expect(d.meter.voltas).toEqual([{ a: 12, b: 16, passes: [1] }]);
  });
});

describe('bars before the beginning', () => {
  it('become open space at the start; what was written moves to the ending and still lands', () => {
    // 4 × 2 at 1:1: 3 2 | 3 (open 0)
    let d = docFrom(makeMeter(4, 2, [1, 1, 1, 1, 2, 2, 2, 2]), [3, 2, '|', 3]);
    d = ok(toggleRepeatEnd(d, 4)); // :| at beat 4
    const r = prependBars(d, 1);
    const n = ok(r);
    expect(n.meter.cycles).toBe(3);
    // the new bar copies the first bar's subdivision
    expect(n.meter.subdivision).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2]);
    expect(sequence(n)).toEqual({ start: [], ending: ['3', '2', '(4)', '3'] });
    expect(r.report.created).toHaveLength(1); // the old open space became silence
    expect(n.items[0]).toMatchObject({ kind: 'space', n: 4 });
    expect(n.meter.repeatEnds).toEqual([{ at: 8, times: 2 }]); // moved with the music
  });

  it('a complete piece just gets open bars in front; too many bars are refused', () => {
    const d = docFrom(makeMeter(4, 1, 1), [4, '|']);
    const n = ok(prependBars(d, 2));
    expect(sequence(n)).toEqual({ start: [], ending: ['4'] });
    expect(n.items[0]).toMatchObject({ kind: 'space', n: 8 });
    expect(prependBars(d, 32).report.ok).toBe(false);
  });

  it('modulations, breaks and marks move with the music', () => {
    let d = ok(addSection(piece(), 4, { from: 2, to: 3, beatsPerBar: 3 }));
    d = ok(toggleMark(d, 2));
    const n = ok(prependBars(d, 1));
    expect(n.meter.sections?.[0]?.at).toBe(8);
    expect(n.meter.marks).toEqual([6]);
  });
});
