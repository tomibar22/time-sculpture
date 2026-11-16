import type { ClickKind } from '../engine';
import { mixGain, useUiStore } from '../state/store';
import type { MixChannel } from '../state/store';
import { audioNow, ensureAudio, noise, tone } from './context';

/** The mixer: how loud a voice is now (1 = as it was made). */
const vol = (ch: MixChannel) => mixGain(useUiStore.getState().mix, ch);

/**
 * Musical voices used by the player. The mixer has four faders, each on its own: the 1 (the
 * landing and every bar's downbeat; not switched off with the beats), the other beats (`beats`
 * = they are on), the subdivision ticks (`ticks`), and the drum (the tiles). `level` lifts a
 * voice for one stroke (the count-in's ticks are meant to be heard).
 */
export function playClick(
  t: number,
  kind: ClickKind,
  ticks: boolean,
  beats = true,
  level = 1,
): void {
  switch (kind) {
    case 'landing': {
      // the 1 of the piece: a soft low drum under the bar's click (it is what the phrase lands on)
      const g = vol('one');
      if (g <= 0) break;
      tone(t, 'sine', 150, 0.5 * g, 0.45, 52);
      woodblock(t, 1900, 0.11 * g);
      break;
    }
    case 'downbeat':
      // the 1 of every bar has its own fader, whatever the other beats do
      woodblock(t, 1900, 0.11 * vol('one') * level);
      break;
    case 'beat':
      if (beats) woodblock(t, 1350, 0.07 * vol('beat') * level);
      break;
    case 'tick':
      if (ticks) {
        const g = 0.014 * vol('sub') * level;
        if (g > 0) tone(t, 'sine', 2600, g, 0.02);
      }
  }
}

/**
 * A pulse inside a beat that was picked by hand (the click pattern): a clear click, a little
 * lighter than a beat's, on the Subdivision fader (which reaches less far up here: these are
 * already loud).
 */
export function playPicked(t: number): void {
  woodblock(t, 1120, 0.07 * Math.sqrt(vol('sub')));
}

/** A dry, woody click: a sine that drops a little, with a breath of its octave on top. */
function woodblock(t: number, f: number, gain: number): void {
  if (gain <= 0) return;
  tone(t, 'sine', f, gain, 0.035, f * 0.82);
  tone(t, 'triangle', f * 2.02, gain * 0.25, 0.012);
}

/**
 * A sounding group: a stroke on a frame drum, not a note. Long groups are deep, open strokes
 * ("dum"), short ones are bright and dry, near the rim ("tek"), with every size in between, so
 * the ear still hears long = low and short = high, but no pitch to hum: the skin's tone falls
 * while it sounds, its overtones are those of a membrane (not a harmonic series), and much of
 * the stroke is the breath of the skin (noise). `seconds` is how long the group lasts: long
 * groups ring a little longer.
 */
export function playGroup(t: number, n: number, seconds = 0.3, level = 1): void {
  level *= vol('drum');
  if (level <= 0) return;
  // 0 for a group of 1 … 1 for 16 and longer; the small sizes (the common ones) are spread widest
  const x = Math.log(Math.min(16, Math.max(1, n))) / Math.log(16);
  const f = 290 * Math.pow(78 / 290, x);
  const ring = Math.min(0.5, Math.max(0.09, seconds * 0.6)) * (0.45 + 0.75 * x);
  // the skin: a tone that drops as it sounds, with two membrane overtones that die quickly
  tone(t, 'sine', f * 1.55, (0.2 + 0.2 * x) * level, ring, f * 0.8);
  tone(t, 'sine', f * 2.47, 0.07 * level, ring * 0.45, f * 1.45);
  tone(t, 'sine', f * 3.6, 0.035 * level, ring * 0.28, f * 2.2);
  // the stroke itself: bright and short near the rim, soft and dark in the middle
  noise(t, 3400 - 2400 * x, 0.9, (0.34 - 0.2 * x) * level, 0.03 + 0.04 * x);
  // a little air around the skin on the deeper strokes
  if (x > 0.3) noise(t, 420 - 180 * x, 1.4, 0.1 * x * level, ring * 0.7);
}

/**
 * Quiet interface sounds. Dragging, stretching, trimming, selecting and moving the caret are
 * silent on purpose (user request): `snap`, `lift` and `drop` stay as no-ops so call sites read
 * the same. Typing a size, removing, undo, a refused action and completing a piece still sound.
 */
const now = () => (ensureAudio() ? audioNow() : -1);
export const ui = {
  snap() {},
  add(n: number) {
    const t = now();
    // writing a group plays its stroke, a little softer than in playback
    if (t >= 0) playGroup(t, n, 0.3, 0.6);
  },
  lift() {},
  drop() {},
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
