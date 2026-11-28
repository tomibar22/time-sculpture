import { describe, expect, it } from 'vitest';
import { makeMeter } from '../doc';
import { fillOptions, sortFills } from '../fills';
import { countWays, countWaysOf, sampleTilingOf, tileCounts } from '../count';

const meter = makeMeter(4, 1, 4); // 16 pulses, beats at 0 4 8 12

describe('fill options', () => {
  it('lists every tiling when there are few', () => {
    const { options, total } = fillOptions(meter, 0, 8, [2, 3]);
    expect(total).toBe(4n); // 2222, 233, 323, 332
    expect(options.map((o) => o.key).sort()).toEqual(['2 2 2 2', '2 3 3', '3 2 3', '3 3 2']);
    expect(options.some((o) => o.rests)).toBe(false);
  });
  it('samples distinct ones when there are many', () => {
    const { options, total } = fillOptions(meter, 0, 16, [1, 2, 3], 50);
    expect(total > 50n).toBe(true);
    expect(options.filter((o) => !o.shape).length).toBeLessThanOrEqual(50);
    expect(options.length).toBeGreaterThanOrEqual(50);
    expect(new Set(options.map((o) => o.key)).size).toBe(options.length);
    for (const o of options) expect(o.sizes.reduce((a, b) => a + b, 0)).toBe(16);
  });
  it('measures onsets against the beat and sorts', () => {
    const { options } = fillOptions(meter, 0, 8, [2, 3]);
    const by = (k: string) => options.find((o) => o.key === k)!;
    expect(by('2 2 2 2')).toMatchObject({ onBeat: 2, offBeat: 2, variety: 1, spread: 0 });
    expect(by('3 3 2')).toMatchObject({ onBeat: 1, offBeat: 2 });
    expect(sortFills(options, 'onbeat')[0]!.key).toBe('2 2 2 2');
    expect(sortFills(options, 'fewest')[0]!.tiles).toBe(3);
    expect(
      sortFills(options, 'syncopated')[0]!.offBeat / sortFills(options, 'syncopated')[0]!.tiles,
    ).toBeCloseTo(2 / 3);
    expect(sortFills(options, 'even')[0]!.key).toBe('2 2 2 2');
  });
  it('returns nothing when the sizes cannot fill', () => {
    expect(fillOptions(meter, 0, 5, [2, 4]).options).toEqual([]);
  });
});

describe('fills with a set number of tiles', () => {
  const meter = makeMeter(4, 2, 4);
  it('counts them, and lists exactly those when there are few', () => {
    // 8 pulses from 2s and 3s: 2 2 2 2 (4 tiles) or 3 3 2 in any order (3 tiles)
    expect(tileCounts(8, [2, 3])).toEqual([3, 4]);
    expect(countWaysOf(8, [2, 3], 3)).toBe(3n);
    const { options, total } = fillOptions(meter, 0, 8, [2, 3], 400, Math.random, 3);
    expect(total).toBe(3n);
    expect(options.map((o) => o.key).sort()).toEqual(['2 3 3', '3 2 3', '3 3 2']);
  });
  it('samples only fills of that many tiles when there are many', () => {
    const { options, total } = fillOptions(meter, 0, 32, [1, 2, 3, 4, 5], 60, Math.random, 9);
    expect(total).toBe(countWaysOf(32, [1, 2, 3, 4, 5], 9));
    expect(options.length).toBeGreaterThan(40);
    for (const o of options) {
      expect(o.sizes).toHaveLength(9);
      expect(o.sizes.reduce((a, n) => a + n, 0)).toBe(32);
    }
  });
  it('the counts by tiles add up to all the ways', () => {
    const sizes = [1, 2, 3, 5];
    const sum = tileCounts(20, sizes).reduce((a, k) => a + countWaysOf(20, sizes, k), 0n);
    expect(sum).toBe(countWays(20, sizes));
    expect(sampleTilingOf(20, sizes, 1)).toBeNull();
    expect(sampleTilingOf(20, sizes, 4)).toEqual([5, 5, 5, 5]);
  });
});

describe('fewer tiles than the chosen sizes allow (user request)', () => {
  it('sizesForTiles adds the fewest larger sizes', async () => {
    const { sizesForTiles, tileCounts } = await import('../count');
    expect(tileCounts(32, [2, 3, 4, 5, 7])[0]).toBe(5);
    expect(sizesForTiles(32, [2, 3, 4, 5, 7], 5)).toEqual([2, 3, 4, 5, 7]);
    const s = sizesForTiles(32, [2, 3, 4, 5, 7], 3)!;
    expect(tileCounts(32, s)).toContain(3);
    expect(s.slice(0, 5)).toEqual([2, 3, 4, 5, 7]);
    expect(sizesForTiles(32, [2, 3], 1)).toBeNull(); // nothing of 1–16 makes 32 in one
    expect(tileCounts(9, sizesForTiles(9, [2, 4], 9)!)).toContain(9); // more: adds 1
  });
});
