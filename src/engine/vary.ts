import type { GroupSpec } from './ops/edit';
import { formatGroups } from './ops/edit';

/**
 * Variations of a passage: the same stretch of time said another way. Every variation has
 * exactly the passage's length in pulses, so it can replace it in place and everything around it
 * (and the landing on 1) stays where it is.
 *
 * Groups can be locked: a locked group keeps its place in time and its size, and the variation
 * works on the free stretches between the locks (each one varied the same way).
 */
export interface Variation {
  groups: GroupSpec[];
  /** "3 (2) 4", also the key. */
  key: string;
  label: string;
  kind: VariationKind;
}

export type VariationKind = 'order' | 'weight' | 'nudge' | 'shuffle';

export const VARIATION_KINDS: { id: VariationKind; label: string }[] = [
  { id: 'nudge', label: 'Nearby' },
  { id: 'order', label: 'Reordered' },
  { id: 'weight', label: 'Broader / denser' },
  { id: 'shuffle', label: 'Shuffled' },
];

const total = (gs: readonly GroupSpec[]) => gs.reduce((a, g) => a + g.n, 0);
const sound = (n: number): GroupSpec => ({ n, kind: 'sound' });

/**
 * Sizes scaled to add up to exactly `target`, by error diffusion (every size ≥ 1), or null when
 * there is not room for that many groups.
 */
export function scaleTo(sizes: readonly number[], target: number): number[] | null {
  const T = sizes.reduce((a, b) => a + b, 0);
  if (!T || target < sizes.length) return null;
  const out: number[] = [];
  let acc = 0;
  let prev = 0;
  for (const n of sizes) {
    acc += (n * target) / T;
    const edge = Math.round(acc);
    out.push(edge - prev);
    prev = edge;
  }
  // a size rounded to 0 borrows from its larger neighbour
  for (let i = 0; i < out.length; i++) {
    if (out[i]! >= 1) continue;
    const j = out.reduce((m, v, k) => (v > out[m]! ? k : m), 0);
    if (out[j]! < 2) return null;
    out[j]!--;
    out[i]!++;
  }
  return out;
}

type Transform = {
  label: string;
  kind: VariationKind;
  f: (seg: GroupSpec[], rng: () => number) => GroupSpec[] | null;
};

/** The first T pulses of `gs` cycled (the last group cut to land exactly). */
function cycleTo(gs: GroupSpec[], T: number): GroupSpec[] {
  const out: GroupSpec[] = [];
  let left = T;
  for (let i = 0; left > 0 && gs.length; i++) {
    const g = gs[i % gs.length]!;
    out.push({ n: Math.min(g.n, left), kind: g.kind });
    left -= g.n;
  }
  return out;
}

const TRANSFORMS: Transform[] = [
  { label: 'Backwards', kind: 'order', f: (s) => [...s].reverse() },
  { label: 'Growing', kind: 'order', f: (s) => [...s].sort((a, b) => a.n - b.n) },
  { label: 'Shrinking', kind: 'order', f: (s) => [...s].sort((a, b) => b.n - a.n) },
  {
    // question and answer change places
    label: 'Halves swapped',
    kind: 'order',
    f: (s) => {
      const h = Math.ceil(s.length / 2);
      return [...s.slice(h), ...s.slice(0, h)];
    },
  },
  {
    // 3 2 4 1 → 2 3 1 4
    label: 'Pairs turned round',
    kind: 'order',
    f: (s) => {
      const out: GroupSpec[] = [];
      for (let i = 0; i < s.length; i += 2) out.push(...(s[i + 1] ? [s[i + 1]!, s[i]!] : [s[i]!]));
      return out;
    },
  },
  {
    label: 'Joined in pairs',
    kind: 'weight',
    f: (s) => {
      const out: GroupSpec[] = [];
      for (let i = 0; i < s.length; i += 2) {
        const a = s[i]!;
        const b = s[i + 1];
        if (b && a.kind === b.kind) out.push({ n: a.n + b.n, kind: a.kind });
        else out.push(a, ...(b ? [b] : []));
      }
      return out;
    },
  },
  {
    label: 'Every group halved',
    kind: 'weight',
    f: (s) =>
      s.flatMap((g) =>
        g.n >= 2 && g.kind === 'sound'
          ? [sound(Math.ceil(g.n / 2)), sound(Math.floor(g.n / 2))]
          : [g],
      ),
  },
  {
    // augmentation: the opening, twice as broad, fills the passage
    label: 'Twice as broad',
    kind: 'weight',
    f: (s) =>
      cycleTo(
        s.map((g) => ({ n: g.n * 2, kind: g.kind })),
        total(s),
      ),
  },
  {
    // diminution: the whole passage in half the time, said twice
    label: 'In half the time, twice',
    kind: 'weight',
    f: (s) => {
      const T = total(s);
      if (T % 2) return null;
      const half = scaleTo(
        s.map((g) => g.n),
        T / 2,
      );
      return half ? [...half, ...half].map(sound) : null;
    },
  },
  {
    label: 'In a third of the time, three times',
    kind: 'weight',
    f: (s) => {
      const T = total(s);
      if (T % 3) return null;
      const third = scaleTo(
        s.map((g) => g.n),
        T / 3,
      );
      return third ? [...third, ...third, ...third].map(sound) : null;
    },
  },
];

/** Split into free stretches and the locked groups between them. */
function segments(base: GroupSpec[], locked: ReadonlySet<number>) {
  const parts: { free: boolean; gs: GroupSpec[] }[] = [];
  base.forEach((g, i) => {
    const free = !locked.has(i);
    const last = parts[parts.length - 1];
    if (last && last.free && free) last.gs.push(g);
    else parts.push({ free, gs: [g] });
  });
  return parts;
}

/**
 * Ways to vary `groups` (at most `limit`), without the passage itself and without duplicates:
 * small nudges first (one line moved by a pulse, neighbours swapped), then reorderings (every
 * rotation, backwards, sorted, halves swapped), broader / denser versions, and a few shuffles.
 * Groups whose index is in `locked` stay exactly where they are.
 */
export function variations(
  groups: readonly GroupSpec[],
  limit = 80,
  rng: () => number = Math.random,
  locked: readonly number[] = [],
): Variation[] {
  const base = groups.map((g) => ({ n: g.n, kind: g.kind }));
  const N = base.length;
  const T = total(base);
  const lock = new Set(locked.filter((i) => i >= 0 && i < N));
  const out: Variation[] = [];
  const seen = new Set([formatGroups(base)]);
  const put = (gs: GroupSpec[] | null, label: string, kind: VariationKind) => {
    if (!gs?.length || total(gs) !== T || gs.some((g) => g.n < 1 || !Number.isInteger(g.n))) return;
    const key = formatGroups(gs);
    if (seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push({ groups: gs, key, label, kind });
  };
  if (!N) return out;
  const parts = segments(base, lock);
  const each = (f: (seg: GroupSpec[]) => GroupSpec[] | null): GroupSpec[] | null => {
    const res: GroupSpec[] = [];
    for (const p of parts) {
      if (!p.free) res.push(...p.gs);
      else {
        const v = f(p.gs);
        if (!v || total(v) !== total(p.gs)) return null;
        res.push(...v);
      }
    }
    return res;
  };

  for (const v of nudges(base, lock)) put(v.groups, v.label, 'nudge');
  for (const t of TRANSFORMS.filter((t) => t.kind === 'order'))
    put(
      each((s) => t.f(s, rng)),
      t.label,
      t.kind,
    );
  // rotations: start the same cycle from another group
  const longest = Math.max(...parts.filter((p) => p.free).map((p) => p.gs.length), 0);
  for (let k = 1; k < longest; k++)
    put(
      each((s) => {
        const r = k % s.length;
        return [...s.slice(r), ...s.slice(0, r)];
      }),
      lock.size ? `Rotated by ${k}` : `Start from group ${k + 1}`,
      'order',
    );
  for (const t of TRANSFORMS.filter((t) => t.kind === 'weight'))
    put(
      each((s) => t.f(s, rng)),
      t.label,
      t.kind,
    );
  if (N > 2) {
    for (let tries = 0; tries < 60 && out.length < limit; tries++)
      put(
        each((s) => {
          const p = [...s];
          for (let i = p.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [p[i], p[j]] = [p[j]!, p[i]!];
          }
          return p;
        }),
        'Shuffled',
        'shuffle',
      );
  }
  return out;
}

/**
 * The nearest neighbours of a passage: the line between two free neighbouring groups moved by
 * one pulse (4 3 → 3 4 is a swap; 4 3 → 5 2 a nudge). A walk through these is a walk through
 * the space of fills, one small step at a time.
 */
export function nudges(groups: readonly GroupSpec[], locked: ReadonlySet<number> = new Set()) {
  const out: { groups: GroupSpec[]; label: string }[] = [];
  for (let i = 0; i + 1 < groups.length; i++) {
    const a = groups[i]!;
    const b = groups[i + 1]!;
    if (locked.has(i) || locked.has(i + 1) || a.kind !== 'sound' || b.kind !== 'sound') continue;
    const at = (x: number, y: number) => {
      const gs = groups.map((g) => ({ ...g }));
      gs[i] = sound(x);
      gs[i + 1] = sound(y);
      return gs;
    };
    if (a.n !== b.n) out.push({ groups: at(b.n, a.n), label: `Swap ${a.n} ${b.n}` });
    if (b.n > 1)
      out.push({ groups: at(a.n + 1, b.n - 1), label: `${a.n} ${b.n} → ${a.n + 1} ${b.n - 1}` });
    if (a.n > 1)
      out.push({ groups: at(a.n - 1, b.n + 1), label: `${a.n} ${b.n} → ${a.n - 1} ${b.n + 1}` });
  }
  return out;
}

/* ------------------------------------------------------------------ onsets */

/** Onsets of a tiling (0 and every inner line), as pulses from its start. */
export function onsetsOf(sizes: readonly number[]): number[] {
  const out: number[] = [];
  let k = 0;
  for (const n of sizes) {
    out.push(k);
    k += n;
  }
  return out;
}

/** A tiling of R from its onsets (0 is always an onset). */
export function fromOnsets(onsets: Iterable<number>, R: number): number[] {
  const s = [...new Set([0, ...onsets])].filter((k) => k >= 0 && k < R).sort((a, b) => a - b);
  return s.map((k, i) => (s[i + 1] ?? R) - k);
}

/**
 * The way from one fill to another of the same length: onsets that only A has go, onsets that
 * only B has come, one at a time in time order, alternating. At most `steps` stages strictly
 * between A and B (evenly spaced along the way).
 */
export function between(a: readonly number[], b: readonly number[], steps = 6): number[][] {
  const R = a.reduce((x, y) => x + y, 0);
  if (R !== b.reduce((x, y) => x + y, 0)) return [];
  const A = new Set(onsetsOf(a));
  const B = new Set(onsetsOf(b));
  const gone = [...A].filter((k) => !B.has(k));
  const come = [...B].filter((k) => !A.has(k));
  const moves: number[] = [];
  for (let i = 0; i < Math.max(gone.length, come.length); i++) {
    if (come[i] !== undefined) moves.push(come[i]!);
    if (gone[i] !== undefined) moves.push(gone[i]!);
  }
  const m = moves.length;
  if (m < 2) return [];
  const picks = new Set<number>();
  const n = Math.min(steps, m - 1);
  for (let i = 1; i <= n; i++) picks.add(Math.round((i * m) / (n + 1)));
  const out: number[][] = [];
  const seen = new Set([a.join(' '), b.join(' ')]);
  for (const p of [...picks].sort((x, y) => x - y)) {
    if (p <= 0 || p >= m) continue;
    const cur = new Set(A);
    for (const k of moves.slice(0, p)) {
      if (cur.has(k)) cur.delete(k);
      else cur.add(k);
    }
    const t = fromOnsets(cur, R);
    const key = t.join(' ');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ breeding */

export interface Child {
  sizes: number[];
  /** How it came about: "A × B", "nudged A", … */
  how: string;
}

/**
 * The next generation from fills you liked (all of length R): crossings at the moments two
 * parents share an onset (the start of one, the rest of the other), their shared onsets only
 * (broader), all their onsets (denser), and small nudges of each. Only sizes in `allowed`
 * (plus the parents' own sizes); never a parent again. Shuffled, at most `count`.
 */
export function breed(
  parents: readonly number[][],
  allowed: readonly number[],
  count = 24,
  rng: () => number = Math.random,
): Child[] {
  const ps = parents.filter((p) => p.length);
  if (!ps.length) return [];
  const R = ps[0]!.reduce((a, b) => a + b, 0);
  const fit = ps.filter((p) => p.reduce((a, b) => a + b, 0) === R);
  const ok = new Set([...allowed, ...fit.flat()]);
  const seen = new Set(fit.map((p) => p.join(' ')));
  const kids: Child[] = [];
  const put = (t: number[], how: string) => {
    const k = t.join(' ');
    if (t.length < 1 || seen.has(k) || !t.every((v) => ok.has(v))) return;
    seen.add(k);
    kids.push({ sizes: t, how });
  };
  const name = (i: number) => String.fromCharCode(65 + (i % 26));
  for (let i = 0; i < fit.length; i++)
    for (let j = 0; j < fit.length; j++) {
      if (i === j) continue;
      const A = onsetsOf(fit[i]!);
      const B = new Set(onsetsOf(fit[j]!));
      for (const cut of A.filter((k) => k > 0 && B.has(k)))
        put(
          fromOnsets([...A.filter((k) => k < cut), ...[...B].filter((k) => k >= cut)], R),
          `${name(i)} then ${name(j)}`,
        );
      if (i < j) {
        put(
          fromOnsets(
            A.filter((k) => B.has(k)),
            R,
          ),
          `${name(i)} ∩ ${name(j)}`,
        );
        put(fromOnsets([...A, ...B], R), `${name(i)} ∪ ${name(j)}`);
      }
    }
  fit.forEach((p, i) => {
    for (const v of nudges(p.map(sound)))
      put(
        v.groups.map((g) => g.n),
        `${name(i)} nudged`,
      );
  });
  for (let i = kids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [kids[i], kids[j]] = [kids[j]!, kids[i]!];
  }
  // crossings first: they are the new ideas; nudges keep a parent's character
  kids.sort((a, b) => Number(a.how.includes('nudged')) - Number(b.how.includes('nudged')));
  return kids.slice(0, count);
}

/**
 * A motif (a fill you saved) fitted to R pulses: as it is when it fits, otherwise cycled until
 * R and the last group cut so it lands exactly. Null when it would not keep its character
 * (the cut leaves less than half its own length).
 */
export function fitMotif(motif: readonly number[], R: number): number[] | null {
  const L = motif.reduce((a, b) => a + b, 0);
  if (!L || R < 1) return null;
  if (L === R) return [...motif];
  if (R < L / 2) return null;
  return cycleTo(motif.map(sound), R).map((g) => g.n);
}
