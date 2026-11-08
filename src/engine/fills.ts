import { countWays, sampleTiling } from './count';
import { buildGrid, isOnBeat } from './grid';
import type { Meter } from './types';

/** A way to fill a region, with measures to sort by. */
export interface FillOption {
  sizes: number[];
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
 * are at most `limit`, otherwise `limit` different random ones (uniform over all tilings).
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
  const grid = buildGrid(meter);
  const options = tilings.map((t) => {
    let k = start;
    let onBeat = 0;
    for (const n of t) {
      if (isOnBeat(grid, k)) onBeat++;
      k += n;
    }
    const mean = R / t.length;
    const spread = Math.sqrt(t.reduce((a, n) => a + (n - mean) ** 2, 0) / t.length);
    return {
      sizes: t,
      key: t.join(' '),
      tiles: t.length,
      onBeat,
      offBeat: t.length - onBeat,
      variety: new Set(t).size,
      spread,
    };
  });
  return { options, total };
}

export function sortFills(options: FillOption[], by: FillSort): FillOption[] {
  const cmp: Record<FillSort, (a: FillOption, b: FillOption) => number> = {
    fewest: (a, b) => a.tiles - b.tiles,
    most: (a, b) => b.tiles - a.tiles,
    onbeat: (a, b) => b.onBeat / b.tiles - a.onBeat / a.tiles || b.onBeat - a.onBeat,
    syncopated: (a, b) => b.offBeat / b.tiles - a.offBeat / a.tiles || b.offBeat - a.offBeat,
    varied: (a, b) => b.variety - a.variety || b.spread - a.spread,
    even: (a, b) => a.spread - b.spread || a.variety - b.variety,
  };
  return [...options].sort((a, b) => cmp[by](a, b) || a.key.localeCompare(b.key));
}
