/**
 * Landing a pattern: a phrase of tiles said again and again so that it ends exactly where a
 * stretch of R pulses ends (a calculator for tihais and for patterns that cross the beat).
 * Everything is counted back from the end: the answer is where to begin.
 */
export type LandingKind = 'repeat' | 'tihai' | 'gapped' | 'shape';

export interface PatternLanding {
  kind: LandingKind;
  /** The tiles written, in order. */
  sizes: number[];
  /** Pulses left before it begins (0 = it fills the stretch exactly). */
  lead: number;
  /** How many times the pattern is said. */
  times: number;
  /** Said with a tile of this many pulses between the times (a tihai when said three times). */
  gap?: number;
  /** Which of `sizes` are those gap tiles. */
  gaps?: number[];
  /** A shaped way: its name and a few words on what happens. */
  name?: string;
  note?: string;
  /**
   * The last tile is not written: it begins exactly where the stretch ends (on the 1, as the
   * last stroke of a tihai does). Its size.
   */
  on1?: number;
  key: string;
}

export interface LandOptions {
  /** The last tile falls on the end of the stretch (the 1) instead of ending there. */
  on1?: boolean;
  /** At most this many of each kind. */
  limit?: number;
}

const sum = (a: readonly number[]) => a.reduce((x, n) => x + n, 0);

/**
 * Every way `pattern` lands on the end of R pulses:
 * - said k times, for every k that fits (the most first);
 * - as a tihai: three times with a gap tile between (its own tile, so "2 3" with a gap of 1 is
 *   2 3 1 2 3 1 2 3), for every gap that fits;
 * - any other number of times with a gap;
 * - shaped: worn away from the front or built up to the whole, broad then as written, as written
 *   then twice as fast, and running through (entering mid-pattern so the stretch is full).
 * With `on1` the last tile is left out of what is written and begins where the stretch ends.
 */
export function patternLandings(
  R: number,
  pattern: readonly number[],
  opts: LandOptions = {},
): PatternLanding[] {
  const limit = opts.limit ?? 16;
  if (!pattern.length || pattern.some((n) => !Number.isInteger(n) || n < 1)) return [];
  const p = sum(pattern);
  const out: PatternLanding[] = [];
  const seen = new Set<string>();
  /** Take a way if it fits; false when it is too long. */
  const take = (full: number[], more: Omit<PatternLanding, 'sizes' | 'lead' | 'on1'>): boolean => {
    const sizes = opts.on1 ? full.slice(0, -1) : full;
    const len = sum(sizes);
    if (len > R) return false;
    if (!sizes.length) return true;
    const id = `${R - len}:${sizes.join(' ')}`;
    if (seen.has(id)) return true;
    seen.add(id);
    const l: PatternLanding = { ...more, sizes, lead: R - len };
    if (l.gaps) l.gaps = l.gaps.filter((i) => i < sizes.length);
    if (opts.on1) l.on1 = full[full.length - 1]!;
    out.push(l);
    return true;
  };
  /** The pattern k times, with a tile of g pulses between (g = 0: none). */
  const said = (k: number, g: number) => {
    const sizes: number[] = [];
    const gaps: number[] = [];
    for (let i = 0; i < k; i++) {
      sizes.push(...pattern);
      if (g && i < k - 1) {
        gaps.push(sizes.length);
        sizes.push(g);
      }
    }
    return { sizes, gaps };
  };

  // so many times: the most first
  for (let k = 1; k <= 4 * limit; k++)
    if (!take(said(k, 0).sizes, { kind: 'repeat', times: k, key: `x${k}` })) break;
  const reps = out.splice(0).reverse().slice(0, limit);
  out.push(...reps);

  // tihais: three times, a gap tile between
  for (let g = 1, n = 0; n < limit; g++) {
    const s = said(3, g);
    const before = out.length;
    if (!take(s.sizes, { kind: 'tihai', times: 3, gap: g, gaps: s.gaps, key: `t${g}` })) break;
    n += out.length - before;
  }

  // any other number of times with a gap: those that begin soonest first
  const gapped: PatternLanding[] = [];
  for (const k of [2, 4, 5, 6, 7, 8]) {
    for (let g = 1; g <= 16; g++) {
      const s = said(k, g);
      const before = out.length;
      const ok = take(s.sizes, {
        kind: 'gapped',
        times: k,
        gap: g,
        gaps: s.gaps,
        key: `g${k}.${g}`,
      });
      if (out.length > before) gapped.push(out.pop()!);
      if (!ok) break;
    }
  }
  gapped.sort((x, y) => x.lead - y.lead || x.times - y.times);
  out.push(...gapped.slice(0, limit));

  // shaped
  const L = pattern.length;
  if (L >= 2) {
    const tails = pattern.map((_, i) => pattern.slice(i));
    take(tails.flat(), {
      kind: 'shape',
      times: L,
      name: 'Wearing away',
      note: 'loses its first tile each time',
      key: 'wear',
    });
    take(tails.reverse().flat(), {
      kind: 'shape',
      times: L,
      name: 'Building up',
      note: 'from its last tile to the whole',
      key: 'build',
    });
  }
  take([...pattern.map((n) => n * 2), ...pattern], {
    kind: 'shape',
    times: 2,
    name: 'Broad, then as written',
    note: 'twice as slow the first time',
    key: 'broad',
  });
  if (pattern.every((n) => n % 2 === 0)) {
    const half = pattern.map((n) => n / 2);
    take([...pattern, ...half, ...half], {
      kind: 'shape',
      times: 3,
      name: 'As written, then twice as fast',
      note: 'the fast one twice',
      key: 'fast',
    });
  }
  // running through: as many times as fit, and the tail of the pattern before them
  const last = opts.on1 ? pattern[L - 1]! : 0;
  const K = Math.floor((R + last) / p);
  let rem = R + last - K * p;
  if (K >= 1 && rem > 0) {
    const head: number[] = [];
    for (let i = L - 1; i >= 0 && rem > 0; i--) {
      const n = Math.min(pattern[i]!, rem);
      head.unshift(n);
      rem -= n;
    }
    take([...head, ...said(K, 0).sizes], {
      kind: 'shape',
      times: K,
      name: 'Running through',
      note: 'enters in the middle of the pattern',
      key: 'run',
    });
  }
  return out;
}
