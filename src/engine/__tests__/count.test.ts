import { describe, expect, it } from 'vitest';
import { countWays, sampleTiling, trayStates } from '../count';

describe('counting', () => {
  it('counts compositions', () => {
    expect(countWays(0, [2, 3])).toBe(1n);
    expect(countWays(1, [2, 3])).toBe(0n);
    expect(countWays(5, [2, 3])).toBe(2n); // 2+3, 3+2
    expect(countWays(4, [1, 2])).toBe(5n); // fibonacci
    expect(countWays(-1, [1])).toBe(0n);
  });

  it('handles very large spaces with BigInt', () => {
    const big = countWays(1000, [1, 2]);
    expect(big > 10n ** 200n).toBe(true);
  });

  it('classifies tray pieces', () => {
    const s = trayStates(5, [2, 3, 4, 7]);
    expect(s.get(2)).toBe('fits');
    expect(s.get(3)).toBe('fits');
    expect(s.get(4)).toBe('dead'); // leaves 1
    expect(s.get(7)).toBe('big');
  });

  it('samples valid tilings', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 50; i++) {
      const t = sampleTiling(17, [2, 3, 5], rng)!;
      expect(t.reduce((a, b) => a + b, 0)).toBe(17);
      expect(t.every((x) => [2, 3, 5].includes(x))).toBe(true);
    }
    expect(sampleTiling(1, [2, 3])).toBeNull();
    expect(sampleTiling(0, [2, 3])).toBeNull();
  });

  it('samples roughly uniformly', () => {
    // 4 with [1,2,3]: 7 tilings. Each should appear.
    const seen = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      const k = sampleTiling(4, [1, 2, 3])!.join(',');
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    expect(seen.size).toBe(7);
    for (const c of seen.values()) expect(c).toBeGreaterThan(300);
  });
});
