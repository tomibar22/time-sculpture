import { buildGrid, EPS, MAX_BEATS, MAX_CYCLES, MAX_SUBDIVISION, MIN_SUBDIVISION } from '../grid';
import { formOf, withForm } from '../form';
import { groupSum, spaceIndex, syncSpace, withBreaks, withMarks } from '../doc';
import { fail, report } from '../report';
import { barMap } from '../sections';
import type { Doc, ItemId, Meter, OpResult, Section } from '../types';

/** Highest number of beats a piece may have. */
export const MAX_TOTAL_BEATS = MAX_BEATS * MAX_CYCLES;

const okRatio = (n: number) => Number.isInteger(n) && n >= MIN_SUBDIVISION && n <= MAX_SUBDIVISION;
const okBar = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_BEATS;

/** A meter with these sections, its bar count (`cycles`) recomputed. */
function withSections(meter: Meter, sections: readonly Section[]): Meter {
  const { sections: _old, ...rest } = meter;
  void _old;
  let base: Meter = sections.length ? { ...rest, sections: [...sections] } : rest;
  // back to plain bars: the piece must be whole bars again, so complete the last one by
  // repeating the last beat's subdivision (the open space takes the new pulses)
  const over = sections.length ? 0 : base.subdivision.length % base.beatsPerCycle;
  if (over) {
    const pad = base.beatsPerCycle - over;
    base = {
      ...base,
      subdivision: [...base.subdivision, ...Array<number>(pad).fill(base.subdivision.at(-1)!)],
    };
  }
  return { ...base, cycles: barMap(base).barStarts.length };
}

/** A meter change that may change the number of pulses: the open space absorbs the difference. */
const withMeter = (doc: Doc, meter: Meter): Doc => ({
  ...doc,
  meter,
  items: syncSpace(doc.items, buildGrid(meter).TS),
});

export interface SectionSpec {
  from: number;
  to: number;
  beatsPerBar: number;
}

/** Start a modulation at local beat `at` (inside the piece, not where one already starts). */
export function addSection(doc: Doc, at: number, spec: SectionSpec): OpResult {
  const NB = doc.meter.subdivision.length;
  if (!Number.isInteger(at) || at <= 0 || at >= NB) return { doc, report: fail('out-of-range') };
  if (!okRatio(spec.from) || !okRatio(spec.to) || !okBar(spec.beatsPerBar))
    return { doc, report: fail('out-of-range') };
  const cur = doc.meter.sections ?? [];
  if (cur.some((s) => s.at === at)) return { doc, report: fail('no-change') };
  const next = [...cur, { at, ...spec }].sort((a, b) => a.at - b.at);
  const meter = withSections(doc.meter, next);
  if (meter.cycles > MAX_CYCLES * 2) return { doc, report: fail('out-of-range') };
  return { doc: { ...doc, meter }, report: report() };
}

/** Change a modulation (index into meter.sections). */
export function updateSection(doc: Doc, index: number, spec: SectionSpec): OpResult {
  const cur = doc.meter.sections ?? [];
  const s = cur[index];
  if (!s) return { doc, report: fail('nothing-selected') };
  if (!okRatio(spec.from) || !okRatio(spec.to) || !okBar(spec.beatsPerBar))
    return { doc, report: fail('out-of-range') };
  if (s.from === spec.from && s.to === spec.to && s.beatsPerBar === spec.beatsPerBar)
    return { doc, report: fail('no-change') };
  const next = cur.map((x, i) => (i === index ? { at: x.at, ...spec } : x));
  return { doc: { ...doc, meter: withSections(doc.meter, next) }, report: report() };
}

export function removeSection(doc: Doc, index: number): OpResult {
  const cur = doc.meter.sections ?? [];
  if (!cur[index]) return { doc, report: fail('nothing-selected') };
  return {
    doc: withMeter(
      doc,
      withSections(
        doc.meter,
        cur.filter((_, i) => i !== index),
      ),
    ),
    report: report(),
  };
}

/** Regroup the main section's beats into bars of `beatsPerBar` (the length does not change). */
export function setMainBarSize(doc: Doc, beatsPerBar: number): OpResult {
  if (!Number.isInteger(beatsPerBar) || beatsPerBar < 3 || beatsPerBar > MAX_BEATS)
    return { doc, report: fail('out-of-range') };
  if (beatsPerBar === doc.meter.beatsPerCycle) return { doc, report: fail('no-change') };
  const meter = withSections(
    { ...doc.meter, beatsPerCycle: beatsPerBar },
    doc.meter.sections ?? [],
  );
  return { doc: withMeter(doc, meter), report: report() };
}

/**
 * Lengthen (delta > 0) or shorten the piece by whole local beats at the end of its last section.
 * New beats are inserted where the last section starts or at the middle of the piece, whichever is
 * later, so the ending (anchored to the end) keeps its subdivisions; they take the `fill`
 * subdivision. Later sections, line breaks and phrase marks move with the beats after the cut.
 * Item sizes are kept and the open space absorbs the difference; if the piece gets too short,
 * groups next to the space are removed.
 */
export function resizeBeats(doc: Doc, delta: number, fill: number): OpResult {
  const { meter } = doc;
  const NB = meter.subdivision.length;
  const map = barMap(meter);
  const last = map.sections[map.sections.length - 1]!;
  if (!Number.isInteger(delta) || delta === 0) return { doc, report: fail('no-change') };
  // without modulations the piece stays whole bars
  if (!meter.sections?.length && delta % meter.beatsPerCycle !== 0)
    return { doc, report: fail('out-of-range') };
  const nNB = NB + delta;
  if (nNB < 1 || nNB > MAX_TOTAL_BEATS) return { doc, report: fail('out-of-range') };
  // the last section must keep at least one beat
  if (delta < 0 && last.end - last.at + delta < 1) return { doc, report: fail('out-of-range') };

  // insert or cut in the middle (inside the last section); a cut must also end by the end
  const at = Math.max(last.at, Math.min(NB, Math.ceil(NB / 2), delta < 0 ? NB + delta : NB));
  const subdivision =
    delta > 0
      ? [
          ...meter.subdivision.slice(0, at),
          ...Array<number>(delta).fill(fill),
          ...meter.subdivision.slice(at),
        ]
      : [...meter.subdivision.slice(0, at), ...meter.subdivision.slice(at - delta)];
  // beats after the cut point move by delta; times inside a removed stretch disappear
  const shift = (t: number) => (t <= at + EPS ? t : t + delta < at - EPS ? NaN : t + delta);
  const shiftTimes = (ts: readonly number[] | undefined) =>
    (ts ?? []).map(shift).filter((t) => Number.isFinite(t) && t < nNB - EPS);
  const sections = (meter.sections ?? [])
    .map((s) => ({ ...s, at: s.at <= at ? s.at : s.at + delta }))
    .filter((s) => s.at > 0 && s.at < nNB);
  const base: Meter = { beatsPerCycle: meter.beatsPerCycle, cycles: meter.cycles, subdivision };
  // repeat signs inside a cut disappear; endings shrink with it (and go when nothing is left)
  const squeeze = (t: number) =>
    t <= at + EPS ? t : delta > 0 ? t + delta : Math.max(at, t + delta);
  const nm = withForm(
    withMarks(
      withBreaks(withSections(base, sections), shiftTimes(meter.breaks)),
      // NaN (cut) and out-of-range marks are dropped there, each with its name
      (meter.marks ?? []).map(shift),
      meter.markNames,
    ),
    formOf(meter),
    shift,
    squeeze,
  );
  if (nm.cycles > MAX_CYCLES * 2) return { doc, report: fail('out-of-range') };

  const TS = buildGrid(nm).TS;
  const items = doc.items.slice();
  const removed: ItemId[] = [];
  while (TS - groupSum(items) < 0) {
    const si = spaceIndex(items);
    const k = si > 0 ? si - 1 : si + 1 < items.length ? si + 1 : -1;
    if (k < 0) break;
    removed.push(items[k]!.id);
    items.splice(k, 1);
  }
  return {
    doc: { meter: nm, items: syncSpace(items, TS), nextId: doc.nextId },
    report: report({ removed }),
  };
}
