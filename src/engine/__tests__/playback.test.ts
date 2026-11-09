import { describe, expect, it } from 'vitest';
import { docFrom, makeMeter } from '../doc';
import { nextPulse, pitchForSize } from '../playback';
import { sample } from './helpers';

describe('playback helpers', () => {
  it('pitches groups by size on a pentatonic scale', () => {
    // longer groups sound lower
    expect(pitchForSize(1)).toBeCloseTo(784);
    expect(pitchForSize(6)).toBeCloseTo(392);
    expect(pitchForSize(11)).toBeCloseTo(196);
    expect(pitchForSize(3)).toBeCloseTo(784 * 2 ** (-5 / 12));
    expect(pitchForSize(16)).toBeCloseTo(98);
    expect(pitchForSize(40)).toBeCloseTo(98);
    for (let n = 1; n < 16; n++) expect(pitchForSize(n + 1)).toBeLessThan(pitchForSize(n));
  });

  it('walks beat-time', () => {
    const d = sample();
    const p0 = nextPulse(d, 0);
    expect(p0).toMatchObject({ k: 0, click: 'landing', onset: null });
    expect(nextPulse(d, 0.5)).toMatchObject({ k: 1, click: 'tick' });
    const p2 = nextPulse(d, 0.75);
    expect(p2.k).toBe(2);
    expect(p2.click).toBe('beat');
    expect(p2.onset?.id).toBe('g2');
    expect(nextPulse(d, 13).k).toBe(0); // wraps
    expect(nextPulse(d, 12.9).k).toBe(0);
  });

  it('marks cycle downbeats', () => {
    const d = docFrom(makeMeter(4, 2, 1), ['|']);
    expect(nextPulse(d, 4).click).toBe('downbeat');
    expect(nextPulse(d, 5).click).toBe('beat');
  });

  it('follows subdivision changes without jumping back', () => {
    const d = docFrom(makeMeter(4, 1, [3, 3, 3, 3]), ['|']);
    // Playhead at t = 0.5 inside beat 0 (3:1): the next pulse is at 2/3
    expect(nextPulse(d, 0.5).t0).toBeCloseTo(2 / 3);
  });
});
