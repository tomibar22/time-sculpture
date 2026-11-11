import { countWays, sampleTiling } from './count';
import { beatOfPulse, buildGrid, isOnBeat } from './grid';
import { barMap } from './sections';
import { shapeFills, shapeOf, tihaiFills, type Shape } from './shapes';
import type { GroupSpec } from './ops/edit';
import type { Meter } from './types';

/** A way to fill a region, with measures to sort by. */
export interface FillOption {
  sizes: number[];
  /** Indices of tiles that are silences (only shapes with a breath in them, such as a tihai). */
  rests?: number[];
  key: string;
  tiles: number;
  /** Onsets that fall on a beat line. */
  onBeat: number;
  /** Onsets off the beat (tiles − onBeat). */
  offBeat: number;
  /** How many different sizes are used. */
  variety: number;
  /** Spread of sizes (standard deviation; 0 = all the same). */
  spread: number;
  /**
   * Syncopation (after Longuet-Higgins & Lee): a stroke on a weak pulse held through a stronger
   * one counts the difference in metric weight. 0 = everything sits on the strong places.
   */
  sync: number;
  /** Share of groups that run across a beat line (0–1): hemiola against the beat. */
  crossing: number;
  /** Drive toward the end (−1…1): the last third shorter than the first = pulls to the landing. */
  drive: number;
  /** How surprising the order is (0–1): different neighbour pairs over all pairs. */
  surprise: number;
  /** Its aesthetic shape (repeat, pyramid, …), if it has one. */
  shape: Shape | null;
}

/** Metric weight of pulse k: 3 on a bar's downbeat, 2 on a beat, 1 half way through, else 0. */
export function pulseWeight(meter: Meter, k: number): number {
  const grid = buildGrid(meter);
  if (k >= grid.TS) return 3;
  const b = beatOfPulse(grid, k);
  const j = k - grid.pre[b]!;
  if (j === 0) return barMap(meter).beatInBar[b] === 0 ? 3 : 2;
  const d = meter.subdivision[b] ?? 1;
  return 2 * j === d ? 1 : 0;
}

/** The measures of `sizes` written from pulse `start` (silent tiles do not count as strokes). */
export function measureFill(
  meter: Meter,
  start: number,
  t: number[],
  rests?: number[],
): Pick<
  FillOption,
  'onBeat' | 'tiles' | 'offBeat' | 'variety' | 'spread' | 'sync' | 'crossing' | 'drive' | 'surprise'
> {
  const grid = buildGrid(meter);
  const silent = new Set(rests);
  let k = start;
  let onBeat = 0;
  let sync = 0;
  let crossing = 0;
  t.forEach((n, i) => {
    if (!silent.has(i)) {
      if (isOnBeat(grid, k)) onBeat++;
      const w = pulseWeight(meter, k);
      let strongest = 0;
      let crosses = false;
      for (let q = k + 1; q < k + n; q++) {
        strongest = Math.max(strongest, pulseWeight(meter, q));
        if (isOnBeat(grid, q)) crosses = true;
      }
      if (strongest > w) sync += strongest - w;
      if (crosses) crossing++;
    }
    k += n;
  });
  const sounds = t.filter((_, i) => !silent.has(i));
  const N = sounds.length || 1;
  const mean = sounds.reduce((a, n) => a + n, 0) / N;
  const spread = Math.sqrt(sounds.reduce((a, n) => a + (n - mean) ** 2, 0) / N);
  const third = Math.max(1, Math.floor(t.length / 3));
  const avg = (x: number[]) => x.reduce((a, b) => a + b, 0) / (x.length || 1);
  const drive =
    t.length < 3 ? 0 : (avg(t.slice(0, third)) - avg(t.slice(-third))) / Math.max(1, mean);
  const pairs = new Set(t.slice(1).map((v, i) => `${t[i]} ${v}`));
  const surprise = t.length < 3 ? 0 : (pairs.size - 1) / Math.max(1, t.length - 2);
  return {
    tiles: sounds.length,
    onBeat,
    offBeat: sounds.length - onBeat,
    variety: new Set(sounds).size,
    spread,
    sync,
    crossing: crossing / N,
    drive: Math.max(-1, Math.min(1, drive)),
    surprise,
  };
}

/** Measures that the map can put on its axes. */
export type FillAxis = 'tiles' | 'sync' | 'crossing' | 'drive' | 'surprise' | 'spread';
export const FILL_AXES: { id: FillAxis; label: string; low: string; high: string }[] = [
  { id: 'tiles', label: 'Density', low: 'sparse', high: 'dense' },
  { id: 'sync', label: 'Syncopation', low: 'on the beat', high: 'syncopated' },
  { id: 'surprise', label: 'Surprise', low: 'predictable', high: 'surprising' },
  { id: 'crossing', label: 'Across the beat', low: 'with the beat', high: 'across it' },
  { id: 'drive', label: 'Drive', low: 'broadens', high: 'pulls to 1' },
  { id: 'spread', label: 'Contrast', low: 'even', high: 'contrasting' },
];

export type FillSort =
  | 'fewest'
  | 'most'
  | 'onbeat'
  | 'syncopated'
  | 'varied'
  | 'even'
  | 'drive'
  | 'surprise'
  | 'predictable'
  | 'crossing';

export const FILL_SORTS: { id: FillSort; label: string }[] = [
  { id: 'onbeat', label: 'Most on the beat' },
  { id: 'syncopated', label: 'Most syncopated' },
  { id: 'crossing', label: 'Most across the beat' },
  { id: 'drive', label: 'Pulls hardest to 1' },
  { id: 'surprise', label: 'Most surprising' },
  { id: 'predictable', label: 'Most predictable' },
  { id: 'fewest', label: 'Fewest tiles' },
  { id: 'most', label: 'Most tiles' },
  { id: 'varied', label: 'Most varied' },
  { id: 'even', label: 'Most even' },
];

/** Every tiling of R with the sizes, in lexicographic order, stopping after `limit`. */
function enumerate(R: number, sizes: number[], limit: number): number[][] {
  const S = [...new Set(sizes)].sort((a, b) => a - b);
  const out: number[][] = [];
  const path: number[] = [];
  const ok = (r: number) => countWays(r, S) > 0n;
  const go = (r: number) => {
    if (out.length >= limit) return;
    if (r === 0) return void out.push(path.slice());
    for (const s of S) {
      if (s > r || !ok(r - s)) continue;
      path.push(s);
      go(r - s);
      path.pop();
      if (out.length >= limit) return;
    }
  };
  go(R);
  return out;
}

/**
 * Options for filling `R` pulses that start at pulse `start` of the meter: all of them when there
 * are at most `limit`, otherwise `limit` different random ones (uniform over all tilings), plus
 * the shaped fills (`shapeFills`) not among them.
 */
/** Measure a ready-made tiling (a bred child, a fitted motif) like any listed fill. */
export function optionOf(
  meter: Meter,
  start: number,
  t: number[],
  shape: Shape | null = shapeOf(t),
): FillOption {
  return { sizes: t, key: t.join(' '), ...measureFill(meter, start, t), shape };
}

export function fillOptions(
  meter: Meter,
  start: number,
  R: number,
  sizes: number[],
  limit = 400,
  rng: () => number = Math.random,
): { options: FillOption[]; total: bigint } {
  const total = countWays(R, sizes);
  if (R <= 0 || total === 0n) return { options: [], total };
  let tilings: number[][];
  if (total <= BigInt(limit)) tilings = enumerate(R, sizes, limit);
  else {
    const seen = new Set<string>();
    tilings = [];
    for (let tries = 0; tilings.length < limit && tries < limit * 4; tries++) {
      const t = sampleTiling(R, sizes, rng)!;
      const k = t.join(' ');
      if (!seen.has(k)) {
        seen.add(k);
        tilings.push(t);
      }
    }
  }
  // shaped fills are built directly: random sampling almost never finds them
  const have = new Set(tilings.map((t) => t.join(' ')));
  for (const s of shapeFills(R, sizes, 40, rng)) {
    const k = s.sizes.join(' ');
    if (!have.has(k)) {
      have.add(k);
      tilings.push(s.sizes);
    }
  }
  const measure = (t: number[], rests: number[] | undefined, shape: Shape | null): FillOption => {
    const silent = new Set(rests);
    return {
      sizes: t,
      ...(rests?.length ? { rests } : {}),
      key: t.map((n, i) => (silent.has(i) ? `(${n})` : `${n}`)).join(' '),
      ...measureFill(meter, start, t, rests),
      shape,
    };
  };
  const options = tilings.map((t) => measure(t, undefined, shapeOf(t)));
  // a tihai is a plain tiling too (its gaps are tiles): name it, or add it when not listed yet
  const byKey = new Map(options.map((o) => [o.key, o]));
  for (const t of tihaiFills(R, sizes)) {
    const o = byKey.get(t.sizes.join(' '));
    if (o) o.shape = t.shape;
    else options.push(measure(t.sizes, undefined, t.shape));
  }
  return { options, total };
}

/** The groups an option writes (its silences as rests). */
export function fillGroups(o: Pick<FillOption, 'sizes' | 'rests'>): GroupSpec[] {
  const silent = new Set(o.rests);
  return o.sizes.map((n, i) => ({
    n,
    kind: silent.has(i) ? ('rest' as const) : ('sound' as const),
  }));
}

/** Every plain tiling, sorted (shapes with silences in them are listed with the shapes only). */
export function sortFills(options: FillOption[], by: FillSort): FillOption[] {
  const cmp: Record<FillSort, (a: FillOption, b: FillOption) => number> = {
    fewest: (a, b) => a.tiles - b.tiles,
    most: (a, b) => b.tiles - a.tiles,
    onbeat: (a, b) => b.onBeat / b.tiles - a.onBeat / a.tiles || b.onBeat - a.onBeat,
    syncopated: (a, b) => b.sync / b.tiles - a.sync / a.tiles || b.offBeat - a.offBeat,
    crossing: (a, b) => b.crossing - a.crossing,
    drive: (a, b) => b.drive - a.drive,
    surprise: (a, b) => b.surprise - a.surprise || b.variety - a.variety,
    predictable: (a, b) => a.surprise - b.surprise || a.variety - b.variety,
    varied: (a, b) => b.variety - a.variety || b.spread - a.spread,
    even: (a, b) => a.spread - b.spread || a.variety - b.variety,
  };
  return options
    .filter((o) => !o.rests)
    .sort((a, b) => cmp[by](a, b) || a.key.localeCompare(b.key));
}
