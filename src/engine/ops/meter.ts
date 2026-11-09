import { formOf, refitForm, withForm } from '../form';
import {
  buildGrid,
  EPS,
  MAX_BEATS,
  MAX_CYCLES,
  MAX_SUBDIVISION,
  MIN_BEATS,
  MIN_CYCLES,
  MIN_SUBDIVISION,
  nearestPulse,
} from '../grid';
import { barMap } from '../sections';
import { resizeBeats, setMainBarSize } from './sections';
import { groupSum, isSpace, spaceIndex, syncSpace, withBreaks, withMarks } from '../doc';
import { fail, report } from '../report';
import type { Doc, Item, ItemId, Meter, OpResult } from '../types';

/** Time (beats) of every item boundary: [0, end of item 0, end of item 1, ..., NB]. */
export function boundaryTimes(doc: Doc): number[] {
  const { times } = buildGrid(doc.meter);
  const out = [0];
  let a = 0;
  for (const x of doc.items) {
    a += x.n;
    out.push(times[a]!);
  }
  return out;
}

/**
 * Change the subdivision of the given beats to d. Every item boundary keeps its moment in time
 * and snaps to the nearest pulse of the new grid (order preserved). Groups squeezed to zero are absorbed.
 */
export function setSubdivision(doc: Doc, beats: Iterable<number>, d: number): OpResult {
  if (!Number.isInteger(d) || d < MIN_SUBDIVISION || d > MAX_SUBDIVISION)
    return { doc, report: fail('out-of-range') };
  const NB = doc.meter.subdivision.length;
  const todo = [...new Set(beats)].filter(
    (b) => b >= 0 && b < NB && doc.meter.subdivision[b] !== d,
  );
  if (!todo.length) return { doc, report: fail('no-change') };

  const bt = boundaryTimes(doc);
  const subdivision = doc.meter.subdivision.slice();
  for (const b of todo) subdivision[b] = d;
  const meter0: Meter = { ...doc.meter, subdivision };
  // line breaks keep their moment too, snapped to the nearest pulse of the new grid
  const meter: Meter = refitForm(
    withMarks(withBreaks(meter0, doc.meter.breaks ?? []), doc.meter.marks ?? []),
  );
  const grid = buildGrid(meter);

  const idx = bt.map((t) => nearestPulse(grid, t));
  idx[0] = 0;
  idx[idx.length - 1] = grid.TS;
  for (let i = 1; i < idx.length; i++) if (idx[i]! < idx[i - 1]!) idx[i] = idx[i - 1]!;

  const moved: ItemId[] = [];
  const removed: ItemId[] = [];
  let startsMoved = 0;
  const items: Item[] = [];
  doc.items.forEach((x, i) => {
    const n = idx[i + 1]! - idx[i]!;
    const shifted = Math.abs(grid.times[idx[i]!]! - bt[i]!) > EPS;
    if (n <= 0 && !isSpace(x)) {
      removed.push(x.id);
      return;
    }
    if (shifted && i > 0 && !isSpace(x)) {
      startsMoved++;
      moved.push(x.id);
    }
    items.push(n === x.n ? x : { ...x, n });
  });

  return {
    doc: { meter, items: syncSpace(items, grid.TS), nextId: doc.nextId },
    report: report({ moved, removed, startsMoved, absorbed: removed.length }),
  };
}

/**
 * Change beats per cycle and/or cycles. Subdivisions near the start and near the end stay aligned
 * (the first half of the new piece copies the old start, the rest copies the old end; any new
 * beats in between get `fill`). Item sizes are kept and the space absorbs the difference. If the
 * piece becomes too short, groups next to the space are removed (start side first).
 */
export function resizeMeter(
  doc: Doc,
  beatsPerCycle: number,
  cycles: number,
  fill: number,
): OpResult {
  if (
    beatsPerCycle < MIN_BEATS ||
    beatsPerCycle > MAX_BEATS ||
    cycles < MIN_CYCLES ||
    cycles > MAX_CYCLES ||
    !Number.isInteger(beatsPerCycle) ||
    !Number.isInteger(cycles)
  )
    return { doc, report: fail('out-of-range') };
  const { meter } = doc;
  if (beatsPerCycle === meter.beatsPerCycle && cycles === meter.cycles)
    return { doc, report: fail('no-change') };
  // with modulations: beats regroup the main section; bars are added or cut at the end
  if (meter.sections?.length) {
    if (beatsPerCycle !== meter.beatsPerCycle) return setMainBarSize(doc, beatsPerCycle);
    const map = barMap(meter);
    const lastBar = map.sections[map.sections.length - 1]!.beatsPerBar;
    return resizeBeats(doc, (cycles - meter.cycles) * lastBar, fill);
  }

  const old = meter.subdivision;
  const oNB = old.length;
  const nNB = beatsPerCycle * cycles;
  const headLen = Math.ceil(nNB / 2);
  const subdivision: number[] = [];
  for (let i = 0; i < nNB; i++) {
    const fromEnd = nNB - 1 - i;
    if (i < headLen && i < oNB) subdivision.push(old[i]!);
    else if (fromEnd < oNB) subdivision.push(old[oNB - 1 - fromEnd]!);
    else subdivision.push(fill);
  }
  // line breaks that still fall inside the piece are kept (on the nearest pulse)
  // repeat signs and endings keep their times too, but one at the very end stays at the end
  const atEnd = (t: number) => (Math.abs(t - oNB) < EPS ? nNB : t);
  const nm: Meter = withForm(
    withMarks(
      withBreaks({ beatsPerCycle, cycles, subdivision }, meter.breaks ?? []),
      meter.marks ?? [],
    ),
    formOf(meter),
    atEnd,
  );
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

/**
 * Add a line break at pulse k (a new score row starts there), or remove it if there is one.
 * Breaks at the very start or end are meaningless and refused.
 */
export function toggleBreak(doc: Doc, k: number): OpResult {
  const grid = buildGrid(doc.meter);
  if (!Number.isInteger(k) || k <= 0 || k >= grid.TS) return { doc, report: fail('out-of-range') };
  const t = grid.times[k]!;
  const cur = doc.meter.breaks ?? [];
  const has = cur.some((b) => Math.abs(b - t) < EPS);
  const next = has ? cur.filter((b) => Math.abs(b - t) >= EPS) : [...cur, t];
  return { doc: { ...doc, meter: withBreaks({ ...doc.meter }, next) }, report: report() };
}

export function hasBreakAt(doc: Doc, k: number): boolean {
  const t = buildGrid(doc.meter).times[k];
  return t !== undefined && (doc.meter.breaks ?? []).some((b) => Math.abs(b - t) < EPS);
}

/** Add a phrase mark at pulse k (0 = the very start), or remove the one that is there. */
export function toggleMark(doc: Doc, k: number): OpResult {
  const grid = buildGrid(doc.meter);
  if (!Number.isInteger(k) || k < 0 || k >= grid.TS) return { doc, report: fail('out-of-range') };
  const t = grid.times[k]!;
  const cur = doc.meter.marks ?? [];
  const has = cur.some((b) => Math.abs(b - t) < EPS);
  const next = has ? cur.filter((b) => Math.abs(b - t) >= EPS) : [...cur, t];
  return { doc: { ...doc, meter: withMarks({ ...doc.meter }, next) }, report: report() };
}

export function hasMarkAt(doc: Doc, k: number): boolean {
  const t = buildGrid(doc.meter).times[k];
  return t !== undefined && (doc.meter.marks ?? []).some((b) => Math.abs(b - t) < EPS);
}
