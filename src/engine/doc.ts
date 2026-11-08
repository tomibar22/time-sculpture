import {
  buildGrid,
  MAX_BEATS,
  MAX_CYCLES,
  MAX_SUBDIVISION,
  MIN_BEATS,
  MIN_CYCLES,
  MIN_SUBDIVISION,
} from './grid';
import type { Doc, Group, GroupKind, Item, ItemId, Meter, Space } from './types';
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
  if (!Number.isInteger(meter.cycles) || meter.cycles < MIN_CYCLES || meter.cycles > MAX_CYCLES)
    errs.push(`cycles out of range: ${meter.cycles}`);
  if (meter.subdivision.length !== meter.beatsPerCycle * meter.cycles)
    errs.push(
      `subdivision length ${meter.subdivision.length} != ${meter.beatsPerCycle * meter.cycles}`,
    );
  meter.subdivision.forEach((d, b) => {
    if (!Number.isInteger(d) || d < MIN_SUBDIVISION || d > MAX_SUBDIVISION)
      errs.push(`beat ${b} subdivision ${d}`);
  });
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
