import { countWays, sampleTiling } from './count';
import { buildGrid, isOnBeat } from './grid';
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
  /** Its aesthetic shape (repeat, pyramid, …), if it has one. */
  shape: Shape | null;
}

export type FillSort = 'fewest' | 'most' | 'onbeat' | 'syncopated' | 'varied' | 'even';

export const FILL_SORTS: { id: FillSort; label: string }[] = [
  { id: 'onbeat', label: 'Most on the beat' },
  { id: 'syncopated', label: 'Most syncopated' },
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
  const grid = buildGrid(meter);
  const measure = (t: number[], rests: number[] | undefined, shape: Shape | null): FillOption => {
    const silent = new Set(rests);
    let k = start;
    let onBeat = 0;
    t.forEach((n, i) => {
      if (!silent.has(i) && isOnBeat(grid, k)) onBeat++;
      k += n;
    });
    const sounds = t.filter((_, i) => !silent.has(i));
    const mean = sounds.reduce((a, n) => a + n, 0) / sounds.length;
    const spread = Math.sqrt(sounds.reduce((a, n) => a + (n - mean) ** 2, 0) / sounds.length);
    return {
      sizes: t,
      ...(rests?.length ? { rests } : {}),
      key: t.map((n, i) => (silent.has(i) ? `(${n})` : `${n}`)).join(' '),
      tiles: sounds.length,
      onBeat,
      offBeat: sounds.length - onBeat,
      variety: new Set(sounds).size,
      spread,
      shape,
    };
  };
  const options = tilings.map((t) => measure(t, undefined, shapeOf(t)));
  for (const t of tihaiFills(R, sizes)) options.push(measure(t.sizes, t.rests, t.shape));
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
    syncopated: (a, b) => b.offBeat / b.tiles - a.offBeat / a.tiles || b.offBeat - a.offBeat,
    varied: (a, b) => b.variety - a.variety || b.spread - a.spread,
    even: (a, b) => a.spread - b.spread || a.variety - b.variety,
  };
  return options
    .filter((o) => !o.rests)
    .sort((a, b) => cmp[by](a, b) || a.key.localeCompare(b.key));
}
