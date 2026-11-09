import { pitchForSize } from '../engine';
import type { ClickKind } from '../engine';
import { audioNow, ensureAudio, tone } from './context';

/** Musical voices used by the player. */
export function playClick(t: number, kind: ClickKind, ticks: boolean, beats = true): void {
  switch (kind) {
    case 'landing':
      // the 1: a soft low drum, always heard (it is what the phrase lands on)
      tone(t, 'sine', 150, 0.5, 0.45, 52);
      if (beats) woodblock(t, 1900, 0.11);
      break;
    case 'downbeat':
      if (beats) woodblock(t, 1900, 0.11);
      break;
    case 'beat':
      if (beats) woodblock(t, 1350, 0.07);
      break;
    case 'tick':
      if (ticks) tone(t, 'sine', 2600, 0.014, 0.02);
  }
}

/** A dry, woody click: a sine that drops a little, with a breath of its octave on top. */
function woodblock(t: number, f: number, gain: number): void {
  tone(t, 'sine', f, gain, 0.035, f * 0.82);
  tone(t, 'triangle', f * 2.02, gain * 0.25, 0.012);
}

/**
 * A sounding group: a mallet note (fundamental, a quick bright partial like a marimba bar, and a
 * touch of attack). `seconds` is how long the group lasts: long groups ring a little longer, so
 * the ear hears the size as well as the pitch.
 */
export function playGroup(t: number, n: number, seconds = 0.3): void {
  const f = pitchForSize(n);
  const ring = Math.min(0.9, Math.max(0.2, seconds * 0.85));
  tone(t, 'sine', f, 0.2, ring);
  tone(t, 'triangle', f, 0.07, ring * 0.6);
  tone(t, 'sine', f * 4, 0.035, Math.min(0.12, ring * 0.4));
  tone(t, 'sine', f * 2, 0.03, ring * 0.45);
}

/** Quiet interface sounds. */
const now = () => (ensureAudio() ? audioNow() : -1);
export const ui = {
  snap() {
    const t = now();
    if (t >= 0) tone(t, 'sine', 2200, 0.03, 0.025);
  },
  add(n: number) {
    const t = now();
    if (t >= 0) tone(t, 'triangle', pitchForSize(n), 0.11, 0.18);
  },
  lift() {
    const t = now();
    if (t >= 0) tone(t, 'sine', 520, 0.06, 0.1, 700);
  },
  drop() {
    const t = now();
    if (t >= 0) tone(t, 'sine', 700, 0.07, 0.12, 440);
  },
  remove() {
    const t = now();
    if (t >= 0) tone(t, 'sine', 420, 0.07, 0.12, 260);
  },
  nope() {
    const t = now();
    if (t >= 0) tone(t, 'square', 140, 0.045, 0.12);
  },
  done() {
    const t = now();
    if (t < 0) return;
    [0, 4, 7, 12].forEach((s, i) => tone(t + i * 0.07, 'triangle', 392 * 2 ** (s / 12), 0.09, 0.3));
  },
};
