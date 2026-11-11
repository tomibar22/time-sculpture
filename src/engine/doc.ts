import { formErrors } from './form';
import {
  buildGrid,
  EPS,
  nearestPulse,
  MAX_BEATS,
  MAX_CYCLES,
  MAX_SUBDIVISION,
  MIN_BEATS,
  MIN_CYCLES,
  MIN_SUBDIVISION,
} from './grid';
import type { Doc, Group, GroupKind, Item, ItemId, Meter, Space } from './types';
import { barMap } from './sections';
import { SPACE_ID } from './types';

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function makeMeter(
  beatsPerCycle: number,
  cycles: number,
  subdivision: number | readonly number[] = 4,
): Meter {
  const nb = beatsPerCycle * cycles;
  const sd =
    typeof subdivision === 'number' ? Array<number>(nb).fill(subdivision) : [...subdivision];
  return { beatsPerCycle, cycles, subdivision: sd };
}

/**
 * A meter with these line breaks: snapped to the nearest pulse, inside the piece, ascending and
 * without duplicates. No `breaks` field when there are none.
 */
function withTimes(
  meter: Meter,
  key: 'breaks',
  times: readonly number[],
  allowZero: boolean,
): Meter {
  const { [key]: _old, ...rest } = meter;
  void _old;
  const base: Meter = rest;
  const grid = buildGrid(base);
  const out: number[] = [];
  for (const b of [...times].sort((x, y) => x - y)) {
    const k = nearestPulse(grid, b);
    if (k < (allowZero ? 0 : 1) || k >= grid.TS) continue;
    const t = grid.times[k]!;
    if (!out.length || t - out[out.length - 1]! > EPS) out.push(t);
  }
  return out.length ? { ...base, [key]: out } : base;
}

/**
 * A meter with these line breaks: snapped to the nearest pulse, inside the piece (not at its very
 * start or end), ascending and without duplicates. No `breaks` field when there are none.
 */
export const withBreaks = (meter: Meter, breaks: readonly number[]) =>
  withTimes(meter, 'breaks', breaks, false);

/**
 * The same for phrase marks (a mark at the very start is allowed). `names` go with `marks` index
 * by index (default: the meter's own names, when `marks` are its own marks moved); a mark that
 * is dropped takes its name with it, and of two that land on one pulse the first named one wins.
 * A time that is not finite (NaN: its moment was cut) is dropped.
 */
export function withMarks(
  meter: Meter,
  marks: readonly number[],
  names: readonly string[] = meter.markNames ?? [],
): Meter {
  const { marks: _m, markNames: _n, ...rest } = meter;
  void _m;
  void _n;
  const base: Meter = rest;
  const grid = buildGrid(base);
  const pairs = marks
    .map((t, i) => ({ t, name: (names[i] ?? '').trim() }))
    .filter((p) => Number.isFinite(p.t))
    .sort((x, y) => x.t - y.t);
  const out: number[] = [];
  const outNames: string[] = [];
  for (const p of pairs) {
    const k = nearestPulse(grid, p.t);
    if (k < 0 || k >= grid.TS) continue;
    const t = grid.times[k]!;
    if (out.length && t - out[out.length - 1]! <= EPS) {
      if (!outNames[outNames.length - 1]) outNames[outNames.length - 1] = p.name;
      continue;
    }
    out.push(t);
    outNames.push(p.name);
  }
  if (!out.length) return base;
  return { ...base, marks: out, ...(outNames.some(Boolean) ? { markNames: outNames } : {}) };
}

export const isSpace = (x: Item): x is Space => x.kind === 'space';
export const isGroup = (x: Item): x is Group => x.kind !== 'space';

export function spaceIndex(items: readonly Item[]): number {
  return items.findIndex(isSpace);
}

export function groupSum(items: readonly Item[]): number {
  let s = 0;
  for (const x of items) if (!isSpace(x)) s += x.n;
  return s;
}

/** Open pulses: total minus the groups. May be negative before normalisation (meter shrink). */
export function freePulses(doc: Doc): number {
  return buildGrid(doc.meter).TS - groupSum(doc.items);
}

export function spaceSize(doc: Doc): number {
  const i = spaceIndex(doc.items);
  return i < 0 ? 0 : doc.items[i]!.n;
}

/** Pulse index where item i starts. */
export function startOf(items: readonly Item[], i: number): number {
  let a = 0;
  for (let j = 0; j < i; j++) a += items[j]!.n;
  return a;
}

export function indexOfId(items: readonly Item[], id: ItemId): number {
  return items.findIndex((x) => x.id === id);
}

export function findItem(doc: Doc, id: ItemId): Item | undefined {
  return doc.items.find((x) => x.id === id);
}

/** Recompute the space's size so the items sum to the total. Shares the array if nothing changed. */
export function syncSpace(items: readonly Item[], TS: number): readonly Item[] {
  const si = spaceIndex(items);
  const n = Math.max(0, TS - groupSum(items));
  if (si < 0) return [...items, { id: SPACE_ID, kind: 'space', n }];
  if (items[si]!.n === n) return items;
  const out = items.slice();
  out[si] = { id: SPACE_ID, kind: 'space', n };
  return out;
}

export function withItems(doc: Doc, items: readonly Item[], nextId = doc.nextId): Doc {
  return { meter: doc.meter, items: syncSpace(items, buildGrid(doc.meter).TS), nextId };
}

/** Mint `count` fresh ids. Returns the ids and the new counter. */
export function mintIds(doc: Doc, count: number): { ids: ItemId[]; nextId: number } {
  const ids: ItemId[] = [];
  for (let i = 0; i < count; i++) ids.push(`g${doc.nextId + i}`);
  return { ids, nextId: doc.nextId + count };
}

export function group(id: ItemId, n: number, kind: GroupKind = 'sound'): Group {
  return { id, kind, n };
}

export function emptyDoc(meter: Meter = makeMeter(4, 2, 4)): Doc {
  return { meter, items: [{ id: SPACE_ID, kind: 'space', n: buildGrid(meter).TS }], nextId: 1 };
}

/**
 * Build a document from a compact list: numbers are sounds, [n] (one-element arrays) are rests,
 * the string '|' is the space. Handy for tests and the default composition.
 */
export function docFrom(meter: Meter, spec: readonly (number | readonly [number] | '|')[]): Doc {
  let next = 1;
  const items: Item[] = spec.map((s) => {
    if (s === '|') return { id: SPACE_ID, kind: 'space', n: 0 };
    if (typeof s === 'number') return group(`g${next++}`, s, 'sound');
    return group(`g${next++}`, s[0], 'rest');
  });
  return { meter, items: syncSpace(items, buildGrid(meter).TS), nextId: next };
}

/** The phrase as written: start │ ending. Sounds as "3", rests as "(3)". */
export function describeItem(x: Item): string {
  if (isSpace(x)) return `open ${x.n}`;
  return x.kind === 'rest' ? `(${x.n})` : `${x.n}`;
}

export function sequence(doc: Doc): { start: string[]; ending: string[] } {
  const si = spaceIndex(doc.items);
  return {
    start: doc.items.slice(0, si).map(describeItem),
    ending: doc.items.slice(si + 1).map(describeItem),
  };
}

/** Returns a list of violated invariants (empty = valid). */
export function checkInvariants(doc: Doc): string[] {
  const errs: string[] = [];
  const { meter } = doc;
  if (
    !Number.isInteger(meter.beatsPerCycle) ||
    meter.beatsPerCycle < MIN_BEATS ||
    meter.beatsPerCycle > MAX_BEATS
  )
    errs.push(`beatsPerCycle out of range: ${meter.beatsPerCycle}`);
  const maxBars = meter.sections?.length ? MAX_CYCLES * 2 : MAX_CYCLES;
  if (!Number.isInteger(meter.cycles) || meter.cycles < MIN_CYCLES || meter.cycles > maxBars)
    errs.push(`cycles out of range: ${meter.cycles}`);
  const NBm = meter.subdivision.length;
  if (!meter.sections?.length) {
    if (NBm !== meter.beatsPerCycle * meter.cycles)
      errs.push(`subdivision length ${NBm} != ${meter.beatsPerCycle * meter.cycles}`);
  } else {
    let prevAt = 0;
    for (const sec of meter.sections) {
      if (!Number.isInteger(sec.at) || sec.at <= prevAt || sec.at >= NBm)
        errs.push(`bad section start ${sec.at}`);
      if (![sec.from, sec.to].every((v) => Number.isInteger(v) && v >= 1 && v <= MAX_SUBDIVISION))
        errs.push(`bad modulation ${sec.from}:1 = ${sec.to}:1`);
      if (!Number.isInteger(sec.beatsPerBar) || sec.beatsPerBar < 1 || sec.beatsPerBar > MAX_BEATS)
        errs.push(`bad bar size ${sec.beatsPerBar}`);
      prevAt = sec.at;
    }
    const bars = barMap(meter).barStarts.length;
    if (meter.cycles !== bars) errs.push(`cycles ${meter.cycles} != ${bars} bars`);
  }
  meter.subdivision.forEach((d, b) => {
    if (!Number.isInteger(d) || d < MIN_SUBDIVISION || d > MAX_SUBDIVISION)
      errs.push(`beat ${b} subdivision ${d}`);
  });
  for (const [key, label, min] of [
    ['breaks', 'line break', EPS],
    ['marks', 'phrase mark', -EPS],
  ] as const) {
    const list = meter[key];
    if (!list) continue;
    const g = buildGrid(meter);
    let prev = min - 1;
    for (const b of list) {
      const k = nearestPulse(g, b);
      if (!(b > prev + EPS) || b < min || b >= g.NB - EPS || Math.abs(g.times[k]! - b) > EPS)
        errs.push(`bad ${label} ${b}`);
      prev = b;
    }
  }
  if (meter.markNames && meter.markNames.length !== (meter.marks ?? []).length)
    errs.push('phrase mark names do not match the marks');
  errs.push(...formErrors(meter));
  const spaces = doc.items.filter(isSpace).length;
  if (spaces !== 1) errs.push(`expected exactly one space, found ${spaces}`);
  const ids = new Set<string>();
  for (const x of doc.items) {
    if (ids.has(x.id)) errs.push(`duplicate id ${x.id}`);
    ids.add(x.id);
    if (!Number.isInteger(x.n)) errs.push(`non-integer size on ${x.id}`);
    if (isSpace(x) ? x.n < 0 : x.n < 1) errs.push(`bad size ${x.n} on ${x.id}`);
  }
  const TS = buildGrid(meter).TS;
  const total = doc.items.reduce((a, x) => a + x.n, 0);
  if (total !== TS) errs.push(`sum ${total} != total pulses ${TS}`);
  return errs;
}

export function assertValid(doc: Doc): Doc {
  const errs = checkInvariants(doc);
  if (errs.length) throw new Error(`Invalid document: ${errs.join('; ')}`);
  return doc;
}

/**
 * Silences side by side read as one stretch of empty time: join them (the first keeps its id).
 * Returns the same doc when there is nothing to join.
 */
export function joinRests(doc: Doc): Doc {
  const items = doc.items;
  if (!items.some((x, i) => x.kind === 'rest' && items[i + 1]?.kind === 'rest')) return doc;
  const out: Item[] = [];
  for (const x of items) {
    const last = out[out.length - 1];
    if (x.kind === 'rest' && last?.kind === 'rest')
      out[out.length - 1] = { ...last, n: last.n + x.n };
    else out.push(x);
  }
  return { ...doc, items: out };
}
