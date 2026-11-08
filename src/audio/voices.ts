import { pitchForSize } from '../engine';
import type { ClickKind } from '../engine';
import { audioNow, ensureAudio, tone } from './context';

/** Musical voices used by the player. */
export function playClick(t: number, kind: ClickKind, ticks: boolean): void {
  switch (kind) {
    case 'landing':
      tone(t, 'sine', 150, 0.5, 0.45, 52);
      tone(t, 'square', 1700, 0.05, 0.03);
      break;
    case 'downbeat':
      tone(t, 'square', 1700, 0.05, 0.03);
      break;
    case 'beat':
      tone(t, 'square', 1250, 0.028, 0.03);
      break;
    case 'tick':
      if (ticks) tone(t, 'sine', 2600, 0.014, 0.02);
  }
}

export function playGroup(t: number, n: number): void {
  const f = pitchForSize(n);
  tone(t, 'triangle', f, 0.2, 0.26);
  tone(t, 'sine', f * 2, 0.03, 0.12);
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
