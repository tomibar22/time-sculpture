import type { SavedPiece } from './serialize';

/**
 * What the library knows about a piece without opening it: for sorting and filtering the list.
 * Kept in the library's index beside its picture (`stripOf`), worked out again when `v` changes.
 */
export interface PieceFacts {
  v: number;
  bars: number;
  /** Beats in all (written beats, not the main tempo's). */
  beats: number;
  pulses: number;
  /** Sounding groups. */
  tiles: number;
  tempo: number;
  /** Bar sizes the piece uses, smallest first. */
  barSizes: number[];
  /** Subdivisions the piece uses (pulses per beat), smallest first. */
  ratios: number[];
  /** A real change of tempo (a metric modulation), not only a change of metre. */
  modulation: boolean;
  /** More than one bar size. */
  metreChange: boolean;
  /** Nothing left open: it lands on the 1. */
  finished: boolean;
  repeats: boolean;
  chords: boolean;
  /** Named phrase marks. */
  named: boolean;
}

export const FACTS_V = 1;

const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

export function factsOf(piece: SavedPiece): PieceFacts {
  const p = piece as Partial<SavedPiece>;
  const sub = p.subdivision ?? [];
  const pulses = sub.reduce((a, b) => a + b, 0);
  const groups = [...(p.start ?? []), ...(p.ending ?? [])];
  const written = groups.reduce((a, g) => a + g.pulses, 0);
  const mods = p.modulations ?? [];
  const sizes = [
    ...(p.barPattern?.length ? p.barPattern : [p.beatsPerCycle ?? 4]),
    ...mods.flatMap((m) => (m.bars?.length ? m.bars : [m.beatsPerBar])),
  ];
  const barSizes = uniq(sizes.filter((n) => Number.isFinite(n) && n > 0));
  const r = p.repeats;
  return {
    v: FACTS_V,
    bars: p.cycles ?? 0,
    beats: sub.length,
    pulses,
    tiles: groups.filter((g) => !g.rest).length,
    tempo: p.tempo ?? 0,
    barSizes,
    ratios: uniq(sub),
    modulation: mods.some((m) => m.from !== m.to),
    metreChange: barSizes.length > 1,
    finished: pulses > 0 && written >= pulses,
    repeats: !!(r && (r.starts.length || r.ends.length || r.endings.length)),
    chords: groups.some((g) => !!g.chord),
    named: !!p.phraseNames?.some((n) => n),
  };
}

/**
 * When a piece was made. Ids are `c` + the time in base 36 + a random tail (`newId`), so the
 * date is in the id; for any other id the last change is the best guess.
 */
export function createdOf(id: string, updated: number): number {
  const m = /^c([0-9a-z]{8})/.exec(id);
  if (!m) return updated;
  const t = parseInt(m[1]!, 36);
  // 2001 … the piece's last change: anything else was not a date
  return t > 978_307_200_000 && t <= updated + 60_000 ? t : updated;
}

/* ------------------------------------------------------------------ sorting */

export type SortKey = 'edited' | 'created' | 'name' | 'length' | 'tempo' | 'metre' | 'tiles';

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'edited', label: 'Recently edited' },
  { key: 'created', label: 'Recently created' },
  { key: 'name', label: 'Name' },
  { key: 'length', label: 'Length' },
  { key: 'tempo', label: 'Tempo' },
  { key: 'metre', label: 'Beats in a bar' },
  { key: 'tiles', label: 'Number of tiles' },
];

/** What the list sorts and filters: a library entry with its facts. */
export interface Sortable {
  id: string;
  name: string;
  updated: number;
  facts?: PieceFacts;
}

const collator =
  typeof Intl !== 'undefined'
    ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
    : undefined;
export const byName = (a: string, b: string) =>
  collator ? collator.compare(a, b) : a < b ? -1 : a > b ? 1 : 0;

/** The value a sort compares: the natural order is the largest (newest, longest…) first, names A–Z. */
function value(e: Sortable, key: SortKey): number {
  const f = e.facts;
  switch (key) {
    case 'edited':
      return e.updated;
    case 'created':
      return createdOf(e.id, e.updated);
    case 'length':
      return (f?.beats ?? 0) * 1e4 + (f?.pulses ?? 0);
    case 'tempo':
      return f?.tempo ?? 0;
    case 'metre':
      return f?.barSizes[f.barSizes.length - 1] ?? 0;
    case 'tiles':
      return f?.tiles ?? 0;
    default:
      return 0;
  }
}

export function sortEntries<T extends Sortable>(
  es: readonly T[],
  key: SortKey,
  reverse = false,
): T[] {
  const dir = reverse ? -1 : 1;
  return [...es].sort((a, b) => {
    const c = key === 'name' ? byName(a.name, b.name) : value(b, key) - value(a, key);
    // ties: by name, then newest first, whatever the direction
    return c * dir || byName(a.name, b.name) || b.updated - a.updated;
  });
}

/** What a row says beside its picture for a sort (the date for the date sorts). */
export function sortNote(e: Sortable, key: SortKey): string | null {
  const f = e.facts;
  if (!f) return null;
  switch (key) {
    case 'length':
      return `${f.bars} bar${f.bars === 1 ? '' : 's'}`;
    case 'tiles':
      return `${f.tiles} tile${f.tiles === 1 ? '' : 's'}`;
    case 'metre':
      return (
        f.barSizes.join(', ') +
        (f.barSizes.length === 1 && f.barSizes[0] === 1 ? ' beat' : ' beats')
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ filtering */

/**
 * Filters are chips in groups: chips of one group are "or" (a bar of 3 or of 5), groups are
 * "and" (a bar of 5 and finished). Each chip is a key: "state:finished", "bar:5", "ratio:3",
 * "has:modulation", "edited:week", "length:long".
 */
export type FilterKey = string;

export interface FilterChip {
  key: FilterKey;
  label: string;
  /** How many of the entries it would keep (on its own). */
  count: number;
}
export interface FilterGroup {
  id: string;
  label: string;
  chips: FilterChip[];
}

const DAY = 86_400_000;
const AGES: { id: string; label: string; ms: number }[] = [
  { id: 'today', label: 'Today', ms: DAY },
  { id: 'week', label: 'This week', ms: 7 * DAY },
  { id: 'month', label: 'This month', ms: 31 * DAY },
];
const LENGTHS: { id: string; label: string; test: (bars: number) => boolean }[] = [
  { id: 'short', label: 'Up to 4 bars', test: (b) => b <= 4 },
  { id: 'mid', label: '5–16 bars', test: (b) => b > 4 && b <= 16 },
  { id: 'long', label: 'Over 16 bars', test: (b) => b > 16 },
];
const HAS: { id: keyof PieceFacts; label: string }[] = [
  { id: 'modulation', label: 'Modulation' },
  { id: 'metreChange', label: 'Changing metre' },
  { id: 'repeats', label: 'Repeats' },
  { id: 'chords', label: 'Chords' },
  { id: 'named', label: 'Named phrases' },
];

/** Does an entry pass one chip? */
export function passes(e: Sortable, key: FilterKey, now = Date.now()): boolean {
  const [g, v = ''] = key.split(':');
  const f = e.facts;
  switch (g) {
    case 'state':
      return !!f && (v === 'finished' ? f.finished : !f.finished);
    case 'bar':
      return !!f && f.barSizes.includes(Number(v));
    case 'ratio':
      return !!f && (v === 'mixed' ? f.ratios.length > 1 : f.ratios.includes(Number(v)));
    case 'has':
      return !!f && f[v as keyof PieceFacts] === true;
    case 'edited': {
      const age = AGES.find((a) => a.id === v);
      return !!age && now - e.updated <= age.ms;
    }
    case 'length': {
      const l = LENGTHS.find((x) => x.id === v);
      return !!f && !!l && l.test(f.bars);
    }
    default:
      return true;
  }
}

/** Keep the entries that pass the chips: any chip of a group, every group. */
export function filterEntries<T extends Sortable>(
  es: readonly T[],
  keys: readonly FilterKey[],
  now = Date.now(),
): T[] {
  if (!keys.length) return [...es];
  const groups = new Map<string, FilterKey[]>();
  for (const k of keys) {
    const g = k.split(':')[0]!;
    groups.set(g, [...(groups.get(g) ?? []), k]);
  }
  return es.filter((e) => [...groups.values()].every((ks) => ks.some((k) => passes(e, k, now))));
}

/**
 * The chips worth offering for these entries: only values that some piece has, and a group only
 * when it tells pieces apart (two or more chips, or a chip that is already on), so a library of
 * pieces in 4 shows no "Beats in a bar" at all.
 */
export function filterGroups(
  es: readonly Sortable[],
  on: readonly FilterKey[] = [],
  now = Date.now(),
): FilterGroup[] {
  const count = (key: FilterKey) => es.filter((e) => passes(e, key, now)).length;
  const chip = (key: FilterKey, label: string): FilterChip => ({ key, label, count: count(key) });
  const facts = es.flatMap((e) => (e.facts ? [e.facts] : []));
  const bars = uniq(facts.flatMap((f) => f.barSizes));
  const ratios = uniq(facts.flatMap((f) => f.ratios));
  const groups: FilterGroup[] = [
    {
      id: 'state',
      label: 'State',
      chips: [chip('state:finished', 'Lands on the 1'), chip('state:open', 'Still open')],
    },
    {
      id: 'bar',
      label: 'Beats in a bar',
      chips: bars.map((n) => chip(`bar:${n}`, String(n))),
    },
    {
      id: 'ratio',
      label: 'Subdivision',
      chips: [...ratios.map((n) => chip(`ratio:${n}`, `${n}:1`)), chip('ratio:mixed', 'Mixed')],
    },
    { id: 'has', label: 'With', chips: HAS.map((h) => chip(`has:${h.id}`, h.label)) },
    { id: 'length', label: 'Length', chips: LENGTHS.map((l) => chip(`length:${l.id}`, l.label)) },
    { id: 'edited', label: 'Edited', chips: AGES.map((a) => chip(`edited:${a.id}`, a.label)) },
  ];
  return groups
    .map((g) => ({
      ...g,
      // a chip is offered when it keeps some but not all (it tells apart), or when it is on
      chips: g.chips.filter(
        (c) => on.includes(c.key) || (c.count > 0 && (g.id === 'has' || c.count < es.length)),
      ),
    }))
    .filter(
      (g) =>
        g.chips.length > (g.id === 'has' || g.id === 'edited' ? 0 : 1) ||
        g.chips.some((c) => on.includes(c.key)),
    );
}

/** "Lands on the 1, 5, 3:1": the chips that are on, in words. */
export function filterWords(keys: readonly FilterKey[], groups: readonly FilterGroup[]): string {
  const label = new Map(groups.flatMap((g) => g.chips.map((c) => [c.key, c.label] as const)));
  return keys
    .map((k) =>
      k.startsWith('bar:') ? `${k.slice(4)} beats a bar` : (label.get(k) ?? k.split(':')[1]),
    )
    .join(', ');
}
