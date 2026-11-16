/**
 * PatternLanding a pattern: a phrase of tiles said again and again so that its last tile ends exactly
 * where a stretch of R pulses ends (a calculator for tihais and for patterns that cross the
 * beat). Everything is counted back from the end: the answer is where to begin.
 */
export interface PatternLanding {
  /** The tiles written, in order. */
  sizes: number[];
  /** Pulses left before it begins (0 = it fills the stretch exactly). */
  lead: number;
  /** How many times the pattern is said. */
  times: number;
  /** A tihai: three times, with this many pulses added to the last tile of the first two. */
  gap?: number;
  key: string;
}

/**
 * Every way `pattern` lands on the end of R pulses: said k times for every k that fits (the most
 * first), then as a tihai (three times, the first two followed by a gap of g pulses, heard as a
 * longer last tile) for every gap that fits.
 */
export function patternLandings(R: number, pattern: readonly number[], limit = 32): PatternLanding[] {
  const p = pattern.reduce((a, n) => a + n, 0);
  if (!pattern.length || pattern.some((n) => !Number.isInteger(n) || n < 1) || p > R) return [];
  const out: PatternLanding[] = [];
  const K = Math.floor(R / p);
  for (let k = K; k >= 1 && out.length < limit; k--) {
    const sizes = Array.from({ length: k }, () => pattern).flat();
    out.push({ sizes, lead: R - k * p, times: k, key: `x${k}` });
  }
  const held = (g: number) => [...pattern.slice(0, -1), pattern[pattern.length - 1]! + g];
  for (let g = 1; 3 * p + 2 * g <= R && out.length < limit * 2; g++)
    out.push({
      sizes: [...held(g), ...held(g), ...pattern],
      lead: R - 3 * p - 2 * g,
      times: 3,
      gap: g,
      key: `t${g}`,
    });
  return out;
}
