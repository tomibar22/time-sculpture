/**
 * Long and short: a phrase thought of as a shape of long and short tiles ("L S S") before any
 * sizes are chosen. A realization gives every tile a size so that every long tile is longer than
 * every short one. "Even" realizations use one size for the longs and one for the shorts (a
 * ratio, 3 : 2); "free" ones let the longs (or the shorts) differ among themselves.
 */
import type { PatternLanding } from './land';

export type LS = 'L' | 'S';

export interface LSRealization {
  sizes: number[];
  /** One size for every long and one for every short. */
  even: boolean;
  /** "3 : 2", or "L 3–4 · S 1" when free. */
  label: string;
  key: string;
}

export const MAX_LS_SIZE = 16;

/** "L S S". */
export const lsText = (p: readonly LS[]) => p.join(' ');

/**
 * Read a long–short pattern typed or pasted: L / S (any case), also the words long / short,
 * "—" or "-" for long and "." or "·" for short, and the Hebrew א (ארוך) / ק (קצר).
 */
export function parseLS(text: string): LS[] | null {
  const out: LS[] = [];
  const t = text
    .toLowerCase()
    .replace(/long|ארוך/g, 'L')
    .replace(/short|קצר/g, 'S');
  for (const ch of t) {
    if (ch === 'L' || ch === 'l' || ch === '—' || ch === '-' || ch === 'א') out.push('L');
    else if (ch === 'S' || ch === 's' || ch === '.' || ch === '·' || ch === 'ק') out.push('S');
    else if (!/[\s,|/]/.test(ch)) return null;
  }
  return out.length ? out : null;
}

/**
 * The long–short shape of a passage: its sizes split in two at the widest step between them
 * (by ratio: 2 3 | 6 for 2 3 6). Null when every size is the same (nothing is longer).
 */
export function longShortOf(sizes: readonly number[]): LS[] | null {
  const distinct = [...new Set(sizes)].sort((a, b) => a - b);
  if (distinct.length < 2 || distinct[0]! < 1) return null;
  let cut = distinct[0]!;
  let widest = 0;
  for (let i = 1; i < distinct.length; i++) {
    const step = distinct[i]! / distinct[i - 1]!;
    if (step > widest + 1e-9) {
      widest = step;
      cut = distinct[i - 1]!;
    }
  }
  return sizes.map((n) => (n > cut ? 'L' : 'S'));
}

function describe(p: readonly LS[], sizes: readonly number[]): { even: boolean; label: string } {
  const longs = sizes.filter((_, i) => p[i] === 'L');
  const shorts = sizes.filter((_, i) => p[i] === 'S');
  const span = (xs: number[]) => {
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    return lo === hi ? `${lo}` : `${lo}–${hi}`;
  };
  const even = new Set(longs).size <= 1 && new Set(shorts).size <= 1;
  if (even && longs.length && shorts.length) return { even, label: `${longs[0]} : ${shorts[0]}` };
  const parts = [];
  if (longs.length) parts.push(`L ${span(longs)}`);
  if (shorts.length) parts.push(`S ${span(shorts)}`);
  return { even, label: parts.join(' · ') };
}

export interface RealizeOptions {
  maxSize?: number;
  /** At most this many (after sorting). */
  limit?: number;
  /** Sort by closeness to these sizes (a passage being varied) instead of by evenness. */
  near?: readonly number[];
  /** Only the even ones. */
  evenOnly?: boolean;
}

/**
 * Every way to give the tiles of `p` sizes adding up to exactly `total`, every long longer than
 * every short. Even ones first (the ratio nearest 2 : 1 first), then the free ones, the most
 * even first; or, with `near`, the nearest to those sizes first.
 */
export function realizeLS(
  p: readonly LS[],
  total: number,
  opts: RealizeOptions = {},
): LSRealization[] {
  const max = opts.maxSize ?? MAX_LS_SIZE;
  const m = p.length;
  if (!m || total < m) return [];
  const nL = p.filter((x) => x === 'L').length;
  const found: number[][] = [];
  const NODE_CAP = 200_000;
  const FOUND_CAP = 4000;
  let nodes = 0;

  if (!nL || nL === m) {
    // one kind only: nothing is longer than anything, so the tiles are all alike
    const n = total / m;
    if (Number.isInteger(n) && n <= max) found.push(p.map(() => n));
  } else if (opts.evenOnly) {
    const nS = m - nL;
    for (let sh = 1; sh < max; sh++)
      for (let l = sh + 1; l <= max; l++)
        if (nL * l + nS * sh === total) found.push(p.map((x) => (x === 'L' ? l : sh)));
  } else {
    // free: depth first, keeping the largest short below the smallest long
    const cur: number[] = [];
    const rest = (i: number) => {
      let l = 0;
      for (let j = i; j < m; j++) if (p[j] === 'L') l++;
      return { l, s: m - i - l };
    };
    const tails = Array.from({ length: m + 1 }, (_, i) => rest(i));
    const go = (i: number, sum: number, maxS: number, minL: number) => {
      if (++nodes > NODE_CAP || found.length >= FOUND_CAP) return;
      if (i === m) {
        if (sum === total) found.push([...cur]);
        return;
      }
      const left = total - sum;
      const t = tails[i]!;
      // the least and most the rest can still take
      const lowL = Math.max(maxS + 1, 2);
      const hiS = Math.min(minL - 1, max);
      if (t.l * lowL + t.s * 1 > left || t.l * max + t.s * hiS < left) return;
      if (p[i] === 'L') {
        for (let n = lowL; n <= max; n++) {
          cur.push(n);
          go(i + 1, sum + n, maxS, Math.min(minL, n));
          cur.pop();
        }
      } else {
        for (let n = 1; n <= hiS; n++) {
          cur.push(n);
          go(i + 1, sum + n, Math.max(maxS, n), minL);
          cur.pop();
        }
      }
    };
    go(0, 0, 0, max + 1);
  }

  const out = found.map((sizes) => ({ sizes, ...describe(p, sizes), key: sizes.join(' ') }));
  const spread = (r: LSRealization) => {
    const by = (c: LS) => r.sizes.filter((_, i) => p[i] === c);
    const w = (xs: number[]) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
    return w(by('L')) + w(by('S'));
  };
  const ratio = (r: LSRealization) => {
    const l = r.sizes[p.indexOf('L')] ?? 1;
    const s = r.sizes[p.indexOf('S')] ?? 1;
    return Math.abs(Math.log(l / s / 2));
  };
  const near = opts.near;
  if (near && near.length === m) {
    const dist = (r: LSRealization) => r.sizes.reduce((a, n, i) => a + Math.abs(n - near[i]!), 0);
    out.sort((x, y) => dist(x) - dist(y) || spread(x) - spread(y));
  } else
    out.sort(
      (x, y) =>
        Number(y.even) - Number(x.even) ||
        (x.even ? ratio(x) - ratio(y) : spread(x) - spread(y)) ||
        x.key.localeCompare(y.key),
    );
  return out.slice(0, opts.limit ?? out.length);
}

export interface LSLandOptions {
  /** The last tile is not written: it begins where the stretch ends. */
  on1?: boolean;
  limit?: number;
}

/**
 * Long–short in the Land panel: every way the shape lands on the end of R pulses.
 * - even: one size for the longs and one for the shorts, said as many times as fit (those that
 *   fill the stretch exactly first, then the nearest);
 * - free: said once, filling the stretch exactly, the longs (or shorts) of different sizes.
 */
export function lsLandings(
  R: number,
  p: readonly LS[],
  opts: LSLandOptions = {},
): PatternLanding[] {
  const limit = opts.limit ?? 30;
  const max = MAX_LS_SIZE;
  const m = p.length;
  if (!m || R < 1) return [];
  const nL = p.filter((x) => x === 'L').length;
  const even: (PatternLanding & { r: number })[] = [];
  const pairs: [number, number][] = [];
  if (!nL || nL === m) for (let n = 1; n <= max; n++) pairs.push([n, n]);
  else for (let sh = 1; sh < max; sh++) for (let l = sh + 1; l <= max; l++) pairs.push([l, sh]);
  for (const [l, sh] of pairs) {
    const full = p.map((x) => (x === 'L' ? l : sh));
    const plen = full.reduce((a, n) => a + n, 0);
    const last = opts.on1 ? full[m - 1]! : 0;
    const k = Math.floor((R + last) / plen);
    if (k < 1) continue;
    const sizes: number[] = [];
    for (let i = 0; i < k; i++) sizes.push(...full);
    if (opts.on1) sizes.pop();
    if (!sizes.length) continue;
    const lead = R - sizes.reduce((a, n) => a + n, 0);
    const label = nL && nL < m ? `${l} : ${sh}` : `${l}`;
    even.push({
      kind: 'even',
      sizes,
      lead,
      times: k,
      name: label,
      key: `e${l}.${sh}`,
      r: Math.abs(Math.log(l / sh / 2)),
      ...(opts.on1 ? { on1: last } : {}),
    });
  }
  // filling it first, then the least left before it; among equals the ratio nearest 2 : 1
  even.sort((x, y) => x.lead - y.lead || x.r - y.r || y.times - x.times);
  const out: PatternLanding[] = even.slice(0, limit).map(({ r: _r, ...l }) => l);

  // free: said once, filling the stretch
  const written = opts.on1 ? p.slice(0, -1) : p;
  if (written.length) {
    const seen = new Set(out.filter((l) => !l.lead && l.times === 1).map((l) => l.sizes.join(' ')));
    for (const r of realizeLS(written, R, { limit: limit * 3 })) {
      if (r.even || seen.has(r.key)) continue;
      const lastKind = p[m - 1]!;
      let on1: number | undefined;
      if (opts.on1) {
        on1 = lastTileFor(written, r.sizes, lastKind);
        if (on1 === undefined) continue;
      }
      out.push({
        kind: 'free',
        sizes: r.sizes,
        lead: 0,
        times: 1,
        name: r.label,
        key: `f${r.key}`,
        ...(on1 !== undefined ? { on1 } : {}),
      });
      if (out.filter((l) => l.kind === 'free').length >= limit) break;
    }
  }
  return out;
}

/** A size for the unwritten last tile that keeps every long longer than every short. */
function lastTileFor(p: readonly LS[], sizes: readonly number[], kind: LS): number | undefined {
  const longs = sizes.filter((_, i) => p[i] === 'L');
  const shorts = sizes.filter((_, i) => p[i] === 'S');
  const common = (xs: number[]) => {
    const c = new Map<number, number>();
    for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
  };
  if (kind === 'L') {
    const n = longs.length ? common(longs) : 2 * Math.max(...shorts);
    return n > Math.max(0, ...shorts) && n <= MAX_LS_SIZE ? n : undefined;
  }
  const n = shorts.length ? common(shorts) : Math.max(1, Math.floor(Math.min(...longs) / 2));
  return n < Math.min(Infinity, ...longs) ? n : undefined;
}
