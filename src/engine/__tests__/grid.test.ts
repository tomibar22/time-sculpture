import { describe, expect, it } from 'vitest';
import {
  beatOfPulse,
  buildGrid,
  ceilPulse,
  commonSubdivision,
  floorPulse,
  isOnBeat,
  nearestPulse,
} from '../grid';
import { makeMeter } from '../doc';

describe('grid', () => {
  const meter = makeMeter(3, 1, [2, 3, 1]);
  const g = buildGrid(meter);

  it('derives totals and pulse times in beats', () => {
    expect(g.NB).toBe(3);
    expect(g.TS).toBe(6);
    expect(g.pre).toEqual([0, 2, 5, 6]);
    expect(g.times.map((t) => +t.toFixed(4))).toEqual([0, 0.5, 1, 1.3333, 1.6667, 2, 3]);
  });

  it('caches by meter identity', () => {
    expect(buildGrid(meter)).toBe(g);
  });

  it('finds beats of pulses', () => {
    expect([0, 1, 2, 3, 4, 5].map((k) => beatOfPulse(g, k))).toEqual([0, 0, 1, 1, 1, 2]);
  });

  it('rounds times to pulses', () => {
    expect(nearestPulse(g, 0.24)).toBe(0);
    expect(nearestPulse(g, 0.25)).toBe(0); // tie → earlier
    expect(nearestPulse(g, 0.26)).toBe(1);
    expect(nearestPulse(g, -1)).toBe(0);
    expect(nearestPulse(g, 9)).toBe(6);
    expect(floorPulse(g, 1.5)).toBe(3);
    expect(floorPulse(g, 1 + 1 / 3)).toBe(3);
    expect(ceilPulse(g, 1.5)).toBe(4);
    expect(ceilPulse(g, 2)).toBe(5);
    expect(floorPulse(g, 10)).toBe(6);
  });

  it('knows on-beat pulses and the common ratio', () => {
    expect([0, 1, 2, 3, 5].map((k) => isOnBeat(g, k))).toEqual([true, false, true, false, true]);
    expect(commonSubdivision(makeMeter(4, 1, [3, 4, 4, 3]))).toBe(3);
    expect(commonSubdivision(makeMeter(4, 1, [3, 4, 4, 5]))).toBe(4);
  });
});
