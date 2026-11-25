/**
 * Long forms of South Indian and North Indian drumming, as ways to land a pattern (Land):
 *
 * - korvai: a yati of strokes (6 5 4 3 2 1, the "cow's tail") drawn into a mora (the pattern
 *   three times, a gap between); once, or the whole korvai three times, so that only the third
 *   time lands;
 * - tail: the pattern's phrases worn away from the front, abcd ×3, bcd ×2, cd, c (a korvai by
 *   Palani Subramania Pillai, after David Nelson), each phrase stretched or shortened so that
 *   3a + 5b + 7c + 6d is the stretch;
 * - halving (kuraippu): the pattern, then its last half, its last quarter… each with its own
 *   start (eduppu) halving too, as when drummers trade 8, 4, 2, 1;
 * - chain: three tihais back to back, the statements shrinking while the gaps grow (or the other
 *   way), so a statement still begins every so many pulses: a hidden beat under a drying sound;
 * - nested: a tihai of tihais (nine statements, the nauhakka): the inner tihais land too, near
 *   the 1, before the real landing.
 *
 * Every way is given as the tiles in full (`full`), the last one possibly falling on the 1 and so
 * not written (engine/land.ts decides that). A gap is a sounding tile, as everywhere in Land.
 * `ends` lists [end, last tile] of the parts that land on their own, so the panel can say where.
 */
import { realize, templateOf } from './yati';
import { buildGrid } from './grid';
import { setSubdivision } from './ops/meter';
import { fillRange } from './ops/range';
import { fail } from './report';
import type { Doc, OpResult } from './types';

export type LongKind = 'korvai' | 'tail' | 'halving' | 'chain' | 'nested';

export interface LongWay {
  kind: LongKind;
  full: number[];
  times: number;
  name: string;
  note: string;
  key: string;
  /** Indices into `full` of the gap tiles. */
  gaps?: number[];
  /** [end, size of the last tile] of each part that lands by itself (pulses from the start). */
  ends?: [number, number][];
  /** Nested: for each inner tihai, the [start, end] of its three statements. */
  inner?: [number, number][][];
}

const sum = (a: readonly number[]) => a.reduce((x, n) => x + n, 0);
const LETTERS = 'abcdefgh';

/** The pattern k times with a tile of g between (g = 0: none); where the gaps are. */
export function saidWith(pattern: readonly number[], k: number, g: number) {
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
}

/** What is written of `full` (its last tile left out with `on1`). */
const written = (full: readonly number[], on1: boolean) =>
  sum(full) - (on1 ? (full[full.length - 1] ?? 0) : 0);

interface Ranked extends LongWay {
  lead: number;
  order: number[];
}

/** Best first: the smallest lead, then the order given; at most `limit`, each `id` once. */
function best(ways: Ranked[], limit: number, id: (w: Ranked) => string): LongWay[] {
  ways.sort((a, b) => {
    if (a.lead !== b.lead) return a.lead - b.lead;
    for (let i = 0; i < Math.max(a.order.length, b.order.length); i++) {
      const d = (a.order[i] ?? 0) - (b.order[i] ?? 0);
      if (d) return d;
    }
    return 0;
  });
  const seen = new Set<string>();
  const out: LongWay[] = [];
  for (const w of ways) {
    const k = id(w);
    if (seen.has(k)) continue;
    seen.add(k);
    const way: LongWay & Partial<Ranked> = { ...w };
    delete way.lead;
    delete way.order;
    out.push(way);
    if (out.length >= limit) break;
  }
  return out;
}

/* ------------------------------------------------------------------ korvai */

interface Prefix {
  sizes: number[];
  name: string;
  id: string;
  order: number;
}

/** Yatis of strokes to lead into the mora: narrowing runs, widening runs, the pattern worn away. */
function prefixes(pattern: readonly number[]): Prefix[] {
  const out: Prefix[] = [];
  for (const step of [1, 2])
    for (let top = 3; top <= 16; top++)
      for (let bottom = 1; bottom <= top - 2 * step; bottom++) {
        if ((top - bottom) % step) continue;
        const down: number[] = [];
        for (let v = top; v >= bottom; v -= step) down.push(v);
        out.push({ sizes: down, name: 'narrowing', id: `d${top}.${bottom}.${step}`, order: step });
        out.push({
          sizes: [...down].reverse(),
          name: 'widening',
          id: `u${top}.${bottom}.${step}`,
          order: step + 1,
        });
      }
  if (pattern.length >= 2) {
    const tails = pattern.map((_, i) => pattern.slice(i));
    out.push({ sizes: tails.flat(), name: 'the pattern worn away', id: 'wear', order: 0 });
    out.push({
      sizes: [...tails].reverse().flat(),
      name: 'the pattern built up',
      id: 'build',
      order: 1,
    });
  }
  return out;
}

/**
 * Korvai: a yati leading into a mora (the pattern three times with a gap tile of g between).
 * Once (any lead), or the whole korvai three times filling the stretch exactly (only the third
 * time lands on the 1; the first two land somewhere else, `ends`).
 */
export function korvaiWays(
  R: number,
  pattern: readonly number[],
  on1 = false,
  limit = 12,
): LongWay[] {
  if (!pattern.length) return [];
  const last = pattern[pattern.length - 1]!;
  const ways: Ranked[] = [];
  const pre = prefixes(pattern);
  const cellText = pattern.length === 1 ? `${pattern[0]}` : `(${pattern.join(' ')})`;
  for (const times of [1, 3])
    for (let g = 0; g <= 8; g++) {
      const mora = saidWith(pattern, 3, g);
      const m = sum(mora.sizes);
      for (const p of pre) {
        const K = sum(p.sizes) + m;
        const len = times * K - (on1 ? last : 0);
        if (len > R || (times === 3 && len !== R)) continue;
        const full: number[] = [];
        const gaps: number[] = [];
        const ends: [number, number][] = [];
        for (let t = 0; t < times; t++) {
          full.push(...p.sizes);
          gaps.push(...mora.gaps.map((i) => i + full.length));
          full.push(...mora.sizes);
          ends.push([full.reduce((a, n) => a + n, 0), last]);
        }
        const gapWords = g ? `, ${g} between` : ', back to back';
        ways.push({
          kind: 'korvai',
          full,
          times,
          gaps: gaps.length ? gaps : undefined,
          ends: times > 1 ? ends : undefined,
          lead: R - len,
          // a mora with a gap first, then the classic narrowing, the longest yati
          order: [times === 3 ? 0 : 1, g ? 0 : 1, p.order, g, -p.sizes.length],
          name: `${times === 3 ? 'Korvai ×3' : 'Korvai'} · ${p.sizes.join(' ')} → ${cellText} ×3`,
          note: `${p.name}, then the mora${gapWords}${times === 3 ? '; said three times, only the third lands' : ''}`,
          key: `k${times}.${p.id}.${g}`,
        });
      }
    }
  return best(ways, limit, (w) => `${w.times}.${w.key.split('.').slice(1, -1).join('.')}`);
}

/* ------------------------------------------------------------------ tail (abcd ×3 … c) */

/** abcd ×3, bcd ×2, cd, c: the tiles' indices in order. */
function tailOrder(n: number): number[] {
  const all = Array.from({ length: n }, (_, i) => i);
  const out = [...all, ...all, ...all, ...all.slice(1), ...all.slice(1)];
  for (let s = 2; s <= n - 2; s++) out.push(...all.slice(s));
  out.push(n - 2);
  return out;
}

/** "abcd ×3, bcd ×2, cd, c". */
function tailWords(n: number): string {
  const w = (s: number) => LETTERS.slice(s, n);
  const parts = [`${w(0)} ×3`, `${w(1)} ×2`];
  for (let s = 2; s <= n - 2; s++) parts.push(w(s));
  parts.push(LETTERS[n - 2]!);
  return parts.join(', ');
}

/**
 * The pattern's phrases (3–5 tiles) worn away from the front: abcd ×3, bcd ×2, cd, c. As written
 * when it fits, and every way to stretch or shorten the phrases (by up to 3 each) so that it
 * fills the stretch exactly, the fewest changes first ("a+2 b+2": Nelson's 96 → 112).
 */
export function tailWays(R: number, pattern: readonly number[], on1 = false, limit = 8): LongWay[] {
  const n = pattern.length;
  if (n < 3 || n > 5) return [];
  const order = tailOrder(n);
  const coef = pattern.map((_, i) => order.filter((j) => j === i).length);
  const formula = coef.map((c, i) => `${c}${LETTERS[i]}`).join('+');
  const ways: Ranked[] = [];
  const deltas = Array<number>(n).fill(0);
  const go = (i: number) => {
    if (i === n) {
      const s = pattern.map((v, j) => v + deltas[j]!);
      const full = order.map((j) => s[j]!);
      const len = written(full, on1);
      const changed = deltas.filter((d) => d).length;
      if (len > R || (changed && len !== R)) return;
      const what = changed
        ? deltas
            .map((d, j) => (d ? `${LETTERS[j]}${d > 0 ? '+' : '−'}${Math.abs(d)}` : ''))
            .filter(Boolean)
            .join(' ')
        : 'as written';
      ways.push({
        kind: 'tail',
        full,
        times: 3,
        lead: R - len,
        order: [deltas.reduce((a, d) => a + Math.abs(d), 0), changed],
        name: `Tail · ${what}${changed ? ` (${s.join(' ')})` : ''}`,
        note: `${tailWords(n)} · ${formula} = ${sum(full)}`,
        key: `tl${s.join('.')}`,
      });
      return;
    }
    for (let d = -3; d <= 3; d++) {
      const v = pattern[i]! + d;
      if (v < 1 || v > 16) continue;
      deltas[i] = d;
      go(i + 1);
    }
    deltas[i] = 0;
  };
  go(0);
  return best(ways, limit, (w) => w.key);
}

/* ------------------------------------------------------------------ halving (kuraippu) */

/** The pattern, then its last half, its last quarter… (cut at tile edges), while they exist. */
export function halvings(pattern: readonly number[]): number[][] {
  const out: number[][] = [[...pattern]];
  for (;;) {
    const cur = out[out.length - 1]!;
    const s = sum(cur);
    if (s % 2 || cur.length < 2) break;
    let acc = 0;
    let i = cur.length;
    while (i > 0 && acc < s / 2) acc += cur[--i]!;
    if (acc !== s / 2 || i === 0) break;
    out.push(cur.slice(i));
  }
  return out;
}

/**
 * Kuraippu: each stage is the last half of the one before, and the start before it (eduppu)
 * halves too, so every stage takes half the time of the one before (64 → 32 → 16 → 8). Once each,
 * or as when two drummers trade: twice each, the last four times. The eduppu before each later
 * stage rings on from the stroke before it (a silence after a stroke sounds like a longer one);
 * the first is the lead. Needs three stages at least.
 */
export function halvingWays(R: number, pattern: readonly number[], on1 = false): LongWay[] {
  const stages = halvings(pattern);
  const N = stages.length;
  if (N < 3) return [];
  const p = sum(pattern);
  const D = 2 ** (N - 1);
  const lens = stages.map(sum);
  const ways: Ranked[] = [];
  for (const trading of [false, true]) {
    const reps = stages.map((_, i) => (trading ? (i === N - 1 ? 4 : 2) : 1));
    const S = reps.reduce((a, r, i) => a + r * 2 ** (N - 1 - i), 0);
    const lastTile = stages[N - 1]![stages[N - 1]!.length - 1]!;
    const exact = ((R + (on1 ? lastTile : 0)) * D) / S - p;
    const e0s = [0];
    if (Number.isInteger(exact) && exact > 0 && exact % D === 0) e0s.push(exact);
    for (const e0 of e0s) {
      const full: number[] = [];
      const ends: [number, number][] = [];
      stages.forEach((st, i) => {
        const e = e0 / 2 ** i;
        for (let r = 0; r < reps[i]!; r++) {
          if (e && full.length) full[full.length - 1]! += e;
          full.push(...st);
          ends.push([sum(full), st[st.length - 1]!]);
        }
      });
      const len = written(full, on1);
      if (len > R) continue;
      const es = stages.map((_, i) => e0 / 2 ** i);
      ways.push({
        kind: 'halving',
        full,
        times: reps.reduce((a, r) => a + r, 0),
        ends,
        lead: R - len,
        order: [e0 ? 0 : 1, trading ? 1 : 0],
        name: `Halving ${lens.join(' → ')}${trading ? ' · traded' : ''}`,
        note: `kuraippu: each time its last half${e0 ? `, starting ${es.join(' → ')} in` : ''}${trading ? '; twice each, the last four times' : ''}`,
        key: `h${trading ? 't' : 'o'}${e0}`,
      });
    }
  }
  return best(ways, 4, (w) => w.key);
}

/* ------------------------------------------------------------------ chain of tihais */

/**
 * Three tihais back to back, the cell's main size shrinking by d each time while the gaps grow by
 * as much (or the other way round): a statement still begins every so many pulses, a steady
 * hidden beat under a sound that dries out (5 (1) ×3, 4 (2) ×3, 3 (3) ×3: one every 6).
 */
export function chainWays(R: number, cell: readonly number[], on1 = false, limit = 8): LongWay[] {
  const t = templateOf(cell);
  if (!t) return [];
  const ways: Ranked[] = [];
  for (const dir of [-1, 1])
    for (let d = 1; d <= 3; d++)
      for (let x0 = 1; x0 <= 16; x0++) {
        const xs = [0, 1, 2].map((j) => x0 + dir * j * d);
        if (xs.some((x) => x < 1 || x > 16)) continue;
        const cells = xs.map((x) => realize(cell, x));
        const lens = cells.map(sum);
        for (let g0 = 0; g0 <= 16; g0++) {
          const gs = lens.map((l) => g0 + lens[0]! - l);
          if (gs.some((g) => g < 0)) continue;
          const full: number[] = [];
          const gaps: number[] = [];
          const ends: [number, number][] = [];
          cells.forEach((c, j) => {
            const s = saidWith(c, 3, gs[j]!);
            gaps.push(...s.gaps.map((i) => i + full.length));
            full.push(...s.sizes);
            ends.push([sum(full), c[c.length - 1]!]);
          });
          const len = written(full, on1);
          if (len > R) break;
          ways.push({
            kind: 'chain',
            full,
            times: 9,
            gaps: gaps.length ? gaps : undefined,
            ends,
            lead: R - len,
            order: [Math.abs(x0 - t.x), d, dir < 0 ? 0 : 1, g0],
            name: `Chain ${xs.join(' → ')} · gaps ${gs.join(' → ')}`,
            note: `three tihais, the statements ${dir < 0 ? 'shrinking, the gaps growing' : 'growing, the gaps shrinking'}: one begins every ${lens[0]! + g0} pulses`,
            key: `c${dir}.${d}.${x0}.${g0}`,
          });
        }
      }
  return best(ways, limit, (w) => w.key.split('.').slice(0, 3).join('.'));
}

/* ------------------------------------------------------------------ tihai of tihais */

/**
 * A tihai of tihais (nauhakka: nine statements): the pattern three times with g between, that
 * three times with G between. The inner tihais land on their own (`ends`), often just before a 1
 * (2 before, 1 before, then on it); `inner` lets the panel find the farmaishi kind, whose inner
 * landings fall on the 1 one after another along the diagonal.
 */
export function nestedWays(
  R: number,
  pattern: readonly number[],
  on1 = false,
  limit = 12,
): LongWay[] {
  if (!pattern.length) return [];
  const p = sum(pattern);
  const last = pattern[pattern.length - 1]!;
  const ways: Ranked[] = [];
  for (let g = 0; g <= 6; g++) {
    const inner = saidWith(pattern, 3, g);
    for (let G = 0; G <= 16; G++) {
      const full: number[] = [];
      const gaps: number[] = [];
      const ends: [number, number][] = [];
      const st: [number, number][][] = [];
      for (let j = 0; j < 3; j++) {
        if (j && G) {
          gaps.push(full.length);
          full.push(G);
        }
        const at = sum(full);
        gaps.push(...inner.gaps.map((i) => i + full.length));
        full.push(...inner.sizes);
        ends.push([sum(full), last]);
        st.push([0, 1, 2].map((i) => [at + i * (p + g), at + i * (p + g) + p]));
      }
      const len = written(full, on1);
      if (len > R) break;
      ways.push({
        kind: 'nested',
        full,
        times: 9,
        gaps: gaps.length ? gaps : undefined,
        ends,
        inner: st,
        lead: R - len,
        order: [g ? 0 : 1, g, G],
        name: `Tihai of tihais · ${g || 'none'} inside, ${G || 'none'} between`,
        note: 'nine statements (nauhakka)',
        key: `n${g}.${G}`,
      });
    }
  }
  return best(ways, limit, (w) => w.key);
}

/* ------------------------------------------------------------------ gati: the speed by the beat */

export interface GatiWay {
  /** Pulses a beat for each statement (the gati / nadai). */
  ds: number[];
  /** Whole beats of the gap before the second and third statements (a tile of their gati). */
  gapBeats: number;
  /** Beats each statement takes (the last without its last tile with `on1`). */
  beats: number[];
  /** Whole beats left before it. */
  leadBeats: number;
  /** The tiles written, in pulses of their own beats. */
  sizes: number[];
  gaps: number[];
  /** The tiles in a common unit (1/L of a beat), the lead first when there is one: for a strip. */
  strip: number[];
  stripGaps: number[];
  on1?: number;
  name: string;
  note: string;
  key: string;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/**
 * The same statement at three speeds of the beat (a gati tihai: "three-fold mukthay"): the
 * pattern's strokes are pulses, and each statement gets beats of its own subdivision d (2, 3, 6:
 * 3 beats, 2 beats, 1 beat for 6 strokes), so it is heard faster and faster (or slower). Every
 * statement fills whole beats; the gaps (if any) are whole beats at the next statement's speed;
 * what is left before it is whole beats that keep their subdivision. `B` = beats in the stretch.
 */
export function gatiWays(
  B: number,
  pattern: readonly number[],
  on1 = false,
  limit = 12,
): GatiWay[] {
  if (!pattern.length || B < 1) return [];
  const p = sum(pattern);
  const last = pattern[pattern.length - 1]!;
  const ds = [1, 2, 3, 4, 5, 6, 7, 8].filter((d) => p % d === 0);
  const triples: number[][] = [];
  for (const a of ds)
    for (const b of ds)
      for (const c of [1, 2, 3, 4, 5, 6, 7, 8]) {
        if (!((a < b && b < c) || (a > b && b > c))) continue;
        const lastLen = on1 ? p - last : p;
        if (lastLen % c || lastLen <= 0) continue;
        if (!on1 && p % c) continue;
        triples.push([a, b, c]);
      }
  const out: (GatiWay & { order: number[] })[] = [];
  for (const t of triples)
    for (let gb = 0; gb <= 3; gb++) {
      const beats = t.map((d, i) => (i === 2 && on1 ? (p - last) / d : p / d));
      const total = beats.reduce((a, n) => a + n, 0) + 2 * gb;
      if (total > B) continue;
      const leadBeats = B - total;
      const sizes: number[] = [];
      const gaps: number[] = [];
      t.forEach((d, i) => {
        if (i && gb) {
          gaps.push(sizes.length);
          sizes.push(gb * d);
        }
        sizes.push(...(i === 2 && on1 ? pattern.slice(0, -1) : pattern));
      });
      // in a common unit: L pulses a beat
      const L = t.reduce(lcm, 1);
      const strip: number[] = leadBeats ? [leadBeats * L] : [];
      const off = strip.length;
      let k = 0;
      t.forEach((d, i) => {
        const n = (i && gb ? 1 : 0) + (i === 2 && on1 ? pattern.length - 1 : pattern.length);
        for (let j = 0; j < n; j++) strip.push((sizes[k++]! * L) / d);
      });
      const faster = t[0]! < t[2]!;
      out.push({
        ds: t,
        gapBeats: gb,
        beats,
        leadBeats,
        sizes,
        gaps,
        strip,
        stripGaps: gaps.map((i) => i + off),
        on1: on1 ? last : undefined,
        name: `Gati ${t.join(' → ')}`,
        note: `${pattern.join(' ')} at ${t.join(', ')} pulses a beat (${beats.join(' + ')} beats), ${faster ? 'faster and faster' : 'slower and slower'}${gb ? `, ${gb} beat${gb > 1 ? 's' : ''} between` : ''}`,
        key: `ga${t.join('.')}g${gb}`,
        order: [leadBeats, faster ? 0 : 1, gb, t[0]!],
      });
    }
  out.sort((a, b) => {
    for (let i = 0; i < a.order.length; i++)
      if (a.order[i] !== b.order[i]) return a.order[i]! - b.order[i]!;
    return 0;
  });
  return out.slice(0, limit).map((w) => {
    const way: GatiWay & { order?: number[] } = { ...w };
    delete way.order;
    return way;
  });
}

/**
 * Write a gati way from beat `from`: its beats get their subdivisions, then its tiles are written
 * over them (one undo step for the caller). Fails when the beats are not in the piece.
 */
export function writeGati(doc: Doc, from: number, w: GatiWay): OpResult {
  const total = w.beats.reduce((a, n) => a + n, 0) + 2 * w.gapBeats;
  if (from < 0 || from + total > doc.meter.subdivision.length)
    return { doc, report: fail('out-of-range') };
  const byD = new Map<number, number[]>();
  let b = from;
  w.ds.forEach((d, i) => {
    const n = (i ? w.gapBeats : 0) + w.beats[i]!;
    const list = byD.get(d) ?? [];
    for (let j = 0; j < n; j++) list.push(b + j);
    byD.set(d, list);
    b += n;
  });
  let cur = doc;
  for (const [d, beats] of byD) {
    const r = setSubdivision(cur, beats, d);
    if (r.report.ok) cur = r.doc;
    else if (r.report.reason !== 'no-change') return { doc, report: r.report };
  }
  const grid = buildGrid(cur.meter);
  const r = fillRange(
    cur,
    grid.pre[from]!,
    grid.pre[from + total]!,
    w.sizes.map((n) => ({ n, kind: 'sound' as const })),
  );
  return r.report.ok ? r : { doc, report: r.report };
}
