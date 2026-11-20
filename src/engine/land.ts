/**
 * Landing a pattern: a phrase of tiles said again and again so that it ends exactly where a
 * stretch of R pulses ends (a calculator for tihais and for patterns that cross the beat).
 * Everything is counted back from the end: the answer is where to begin.
 */
import { speedsName } from './speeds';
import { YATI_SHAPES, realize, templateOf, templateText } from './yati';

/** `even` and `free` are long–short ways (engine/longshort.ts); `yati` see engine/yati.ts. */
export type LandingKind =
  'repeat' | 'tihai' | 'yati' | 'speeds' | 'gapped' | 'shape' | 'even' | 'free';

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
  /**
   * Pulses in a beat, when every beat of the stretch has the same number: yati gaps of whole
   * beats are written as beat strokes (6 6), and ways whose gaps and start sit on beats come first.
   */
  beat?: number;
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

  // yati: the cell three times, its main size changing, the mean (and so the landing) kept
  const yati: PatternLanding[] = [];
  for (const c of yatiWays(R, pattern, opts)) {
    const before = out.length;
    take(c.full, c.more);
    if (out.length > before) yati.push(out.pop()!);
    if (yati.length >= 2 * limit) break;
  }
  out.push(...yati);

  // speeds: the pattern said again with shorter (or longer) strokes, once or three times
  const speeds: PatternLanding[] = [];
  for (const c of speedWays(pattern)) {
    const before = out.length;
    take(c.full, c.more);
    if (out.length > before) speeds.push(out.pop()!);
  }
  speeds.sort((x, y) => x.lead - y.lead || y.times - x.times);
  out.push(...speeds.slice(0, limit));

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

interface YatiWay {
  full: number[];
  more: Omit<PatternLanding, 'sizes' | 'lead' | 'on1'>;
}

/**
 * Yati ways, best first (each shape once, with its best gap): for every mean m (the cell with its main size m), shape and step d
 * (0–3), the gaps that make it land: exactly (written straight after one another, or with the
 * gap before each, as "6 6 | cell | 6 6 | cell | 6 6 | cell" does), and with a beat, gaps of
 * whole beats that leave a lead of whole beats. Exact fits, gaps on beats, and ways around the
 * cell as written (its size is the mean or one of the three) come first; then means near it.
 */
function yatiWays(R: number, cell: readonly number[], opts: LandOptions): YatiWay[] {
  const t = templateOf(cell);
  if (!t) return [];
  const beat = opts.beat && opts.beat > 0 ? opts.beat : 0;
  const words = templateText(cell);
  const ways: (YatiWay & { score: number; order: number[] })[] = [];
  const gapOf = (G: number) =>
    G <= 0 ? [] : beat && G % beat === 0 ? Array<number>(G / beat).fill(beat) : [G];
  for (let m = 1; m <= 16; m++)
    for (const [si, shape] of YATI_SHAPES.entries())
      for (let d = shape.id === 'even' ? 0 : 1; d <= (shape.id === 'even' ? 0 : 3); d++) {
        const xs = shape.steps.map((k) => m + k * d);
        if (xs.some((x) => x < 1 || x > 16)) continue;
        const said = xs.map((x) => realize(cell, x));
        const last = opts.on1 ? said[2]![said[2]!.length - 1]! : 0;
        const left = R + last - said.reduce((a, s) => a + s.reduce((b, n) => b + n, 0), 0);
        if (left < 0) continue;
        /** [gap, before each] pairs to try. */
        const tries: [number, boolean][] = [];
        if (left % 2 === 0) tries.push([left / 2, false]);
        if (left % 3 === 0 && left > 0) tries.push([left / 3, true]);
        if (beat)
          for (let k = 1; k <= 4; k++)
            for (const each of [false, true]) {
              const lead = left - (each ? 3 : 2) * k * beat;
              if (lead > 0 && lead % beat === 0) tries.push([k * beat, each]);
            }
        for (const [G, each] of tries) {
          const gap = gapOf(G);
          const full: number[] = [];
          const gaps: number[] = [];
          said.forEach((s, i) => {
            if (G && (each || i > 0))
              for (const n of gap) {
                gaps.push(full.length);
                full.push(n);
              }
            full.push(...s);
          });
          const lead = left - (each ? 3 : 2) * G;
          const score =
            (lead === 0 ? 8 : 0) +
            (beat && G % beat === 0 ? (G ? 4 : 2) : 0) +
            (beat && lead % beat === 0 ? 1 : 0) -
            Math.min(Math.abs(m - t.x), ...xs.map((x) => Math.abs(x - t.x)));
          const gapWords = !G
            ? 'back to back'
            : `${gap.join(' ')} ${each ? 'before each' : 'between'}`;
          ways.push({
            full,
            score,
            order: [Math.abs(m - t.x), m, G, each ? 1 : 0, si, d],
            more: {
              kind: 'yati',
              times: 3,
              gap: G || undefined,
              gaps: gaps.length ? gaps : undefined,
              name: `${shape.name} ${xs.join(' → ')}`,
              note: `${words} · ${gapWords}${d ? ` · ${xs.join('+')} = 3×${m}` : ''}`,
              key: `y${shape.id}${m}.${d}.${G}${each ? 'e' : 'p'}`,
            },
          });
        }
      }
  ways.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    for (let i = 0; i < a.order.length; i++)
      if (a.order[i] !== b.order[i]) return a.order[i]! - b.order[i]!;
    return 0;
  });
  // each shape once, with its best gap
  const once = new Set<string>();
  return ways.filter((w) => {
    const id = `${w.order[1]}.${w.order[4]}.${w.order[5]}`;
    if (once.has(id)) return false;
    once.add(id);
    return true;
  });
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * The pattern at several speeds (laykari, engine/speeds.ts): its strokes ÷ g (g = their common
 * size, 3 for 3 3 3 3 3) said at multiples g, then smaller ones (3 → 2 → 1, 3 → 1 …) or the other
 * way round, with a closing stroke of the slowest size or none, once or three times (a tihai:
 * with "Last tile on the 1" its last closing stroke is the 1).
 */
function speedWays(pattern: readonly number[]): YatiWay[] {
  const g = pattern.reduce(gcd, 0);
  if (g < 2) return [];
  const unit = pattern.map((n) => n / g);
  const ladders: number[][] = [];
  const go = (cur: number[]) => {
    if (cur.length >= 2) ladders.push([...cur]);
    if (cur.length === 4) return;
    for (let m = cur[cur.length - 1]! - 1; m >= 1; m--) go([...cur, m]);
  };
  go([g]);
  const out: YatiWay[] = [];
  for (const l of [...ladders, ...ladders.map((x) => [...x].reverse())])
    for (const c of [g, 0]) {
      const said = [...l.flatMap((m) => unit.map((u) => u * m)), ...(c ? [c] : [])];
      for (const times of [3, 1]) {
        const full = Array.from({ length: times }, () => said).flat();
        out.push({
          full,
          more: {
            kind: 'speeds',
            times,
            name: `${speedsName(l)}${times === 3 ? ' · three times' : ''}`,
            note: `${pattern.join(' ')} at ${l.length} speeds${c ? `, ${c} closing` : ''}`,
            key: `s${l.join('.')}c${c}x${times}`,
          },
        });
      }
    }
  return out;
}
