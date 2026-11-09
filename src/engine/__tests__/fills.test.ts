import { describe, expect, it } from 'vitest';
import { makeMeter } from '../doc';
import { fillOptions, sortFills } from '../fills';

const meter = makeMeter(4, 1, 4); // 16 pulses, beats at 0 4 8 12

describe('fill options', () => {
  it('lists every tiling when there are few', () => {
    const { options, total } = fillOptions(meter, 0, 8, [2, 3]);
    expect(total).toBe(4n); // 2222, 233, 323, 332
    expect(options.map((o) => o.key).sort()).toEqual(['2 2 2 2', '2 3 3', '3 2 3', '3 3 2']);
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
