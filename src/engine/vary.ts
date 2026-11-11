import type { GroupSpec } from './ops/edit';
import { formatGroups } from './ops/edit';

/**
 * Variations of a passage: the same stretch of time said another way. Every variation has
 * exactly the passage's length in pulses, so it can replace it in place and everything around it
 * (and the landing on 1) stays where it is.
 */
export interface Variation {
  groups: GroupSpec[];
  /** "3 (2) 4", also the key. */
  key: string;
  label: string;
  kind: 'order' | 'weight' | 'shuffle';
}

const total = (gs: readonly GroupSpec[]) => gs.reduce((a, g) => a + g.n, 0);

/**
 * Ways to vary `groups` (at most `limit`), without the passage itself and without duplicates:
 * backwards, every rotation, sorted both ways, mirrored halves, neighbours joined in pairs, every
 * group halved, and a few shuffles.
 */
export function variations(
  groups: readonly GroupSpec[],
  limit = 40,
  rng: () => number = Math.random,
): Variation[] {
  const base = groups.map((g) => ({ n: g.n, kind: g.kind }));
  const N = base.length;
  const T = total(base);
  const out: Variation[] = [];
  const seen = new Set([formatGroups(base)]);
  const put = (gs: GroupSpec[], label: string, kind: Variation['kind']) => {
    if (!gs.length || total(gs) !== T || gs.some((g) => g.n < 1)) return;
    const key = formatGroups(gs);
    if (seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push({ groups: gs, key, label, kind });
  };
  if (!N) return out;

  if (N > 1) {
    put([...base].reverse(), 'Backwards', 'order');
    // rotations: start the same cycle from another group
    for (let k = 1; k < N; k++)
      put([...base.slice(k), ...base.slice(0, k)], `Start from group ${k + 1}`, 'order');
    put(
      [...base].sort((a, b) => a.n - b.n),
      'Growing',
      'order',
    );
    put(
      [...base].sort((a, b) => b.n - a.n),
      'Shrinking',
      'order',
    );
    // swap the two halves (question and answer change places)
    const h = Math.ceil(N / 2);
    put([...base.slice(h), ...base.slice(0, h)], 'Halves swapped', 'order');
    // each neighbouring pair turned round: 3 2 4 1 → 2 3 1 4
    const pairs: GroupSpec[] = [];
    for (let i = 0; i < N; i += 2)
      pairs.push(...(base[i + 1] ? [base[i + 1]!, base[i]!] : [base[i]!]));
    put(pairs, 'Pairs turned round', 'order');
  }

  // weight: fewer, longer groups or more, shorter ones
  if (N > 1) {
    const joined: GroupSpec[] = [];
    for (let i = 0; i < N; i += 2) {
      const a = base[i]!;
      const b = base[i + 1];
      if (b && a.kind === b.kind) joined.push({ n: a.n + b.n, kind: a.kind });
      else joined.push(a, ...(b ? [b] : []));
    }
    put(joined, 'Joined in pairs', 'weight');
  }
  const halved = base.flatMap((g) =>
    g.n >= 2 && g.kind === 'sound'
      ? [
          { n: Math.ceil(g.n / 2), kind: g.kind },
          { n: Math.floor(g.n / 2), kind: g.kind },
        ]
      : [g],
  );
  put(halved, 'Every group halved', 'weight');

  // shuffles of the same groups
  if (N > 2) {
    for (let tries = 0; tries < 60 && out.length < limit; tries++) {
      const p = [...base];
      for (let i = p.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [p[i], p[j]] = [p[j]!, p[i]!];
      }
      put(p, 'Shuffled', 'shuffle');
    }
  }
  return out;
}
