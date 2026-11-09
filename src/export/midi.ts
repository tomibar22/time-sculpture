import { barMap, buildGrid, EPS, isSpace, pitchForSize, playOrder, sectionAt } from '../engine';
import type { Doc } from '../engine';

/**
 * The piece as a Standard MIDI File (format 0), as it is heard: repeats and endings played out,
 * every sounding group one note from its onset to its end, pitched by its size like the app's own
 * tones. Time is written in the piece's own beats (quarter notes), so every subdivision from 1:1
 * to 8:1 is exact, and a metric modulation is a tempo change (with its bar size as the time
 * signature). Opens in any DAW or notation program.
 */

/** Ticks per beat: divisible by every subdivision 1–8. */
export const MIDI_PPQ = 840;

const vlq = (n: number): number[] => {
  const out = [n & 0x7f];
  for (n >>= 7; n > 0; n >>= 7) out.unshift((n & 0x7f) | 0x80);
  return out;
};
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0) & 0x7f);

/** MIDI note number of a frequency (A4 = 440 Hz = 69). */
const noteOf = (f: number) => Math.round(69 + 12 * Math.log2(f / 440));

interface Ev {
  tick: number;
  /** Order at the same tick: metas, then note-offs, then note-ons. */
  rank: number;
  bytes: number[];
}

export function midiFile(doc: Doc, title: string, tempo: number): Uint8Array {
  const grid = buildGrid(doc.meter);
  const bm = barMap(doc.meter);
  const tick = (beats: number) => Math.round(beats * MIDI_PPQ);
  const evs: Ev[] = [];
  const name = new TextEncoder().encode(title || 'Untitled');
  evs.push({ tick: 0, rank: 0, bytes: [0xff, 0x03, ...vlq(name.length), ...name] });

  const sectionMeta = (at: number, si: number) => {
    const sec = bm.sections[si]!;
    const usPerBeat = Math.round((60_000_000 / tempo) * sec.scale);
    evs.push({
      tick: at,
      rank: 0,
      bytes: [0xff, 0x51, 3, (usPerBeat >> 16) & 255, (usPerBeat >> 8) & 255, usPerBeat & 255],
    });
    evs.push({ tick: at, rank: 0, bytes: [0xff, 0x58, 4, sec.beatsPerBar, 2, 24, 8] });
  };

  // the sounding groups in written time
  const sounds: { t0: number; t1: number; n: number }[] = [];
  let k = 0;
  for (const x of doc.items) {
    if (!isSpace(x) && x.kind === 'sound')
      sounds.push({ t0: grid.times[k]!, t1: grid.times[k + x.n]!, n: x.n });
    k += x.n;
  }

  let out = 0; // beats written so far
  let section = -1;
  for (const span of playOrder(doc.meter)) {
    // tempo and bar size wherever a section begins (or the music jumps into another one)
    for (let si = sectionAt(doc.meter, span.a); si < bm.sections.length; si++) {
      const sec = bm.sections[si]!;
      const at = Math.max(sec.at, span.a);
      if (at >= span.b - EPS) break;
      if (si !== section) sectionMeta(tick(out + at - span.a), si);
      section = si;
    }
    for (const s of sounds) {
      // a group sounds when its onset is played (as in the app)
      if (s.t0 < span.a - EPS || s.t0 >= span.b - EPS) continue;
      const on = tick(out + s.t0 - span.a);
      const off = Math.max(on + 1, tick(out + Math.min(s.t1, span.b) - span.a) - 8);
      const note = noteOf(pitchForSize(s.n));
      evs.push({ tick: on, rank: 2, bytes: [0x90, note, 96] });
      evs.push({ tick: off, rank: 1, bytes: [0x80, note, 0] });
    }
    out += span.b - span.a;
  }
  evs.push({ tick: tick(out), rank: 3, bytes: [0xff, 0x2f, 0] });
  evs.sort((a, b) => a.tick - b.tick || a.rank - b.rank);

  const track: number[] = [];
  let last = 0;
  for (const e of evs) {
    track.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  return new Uint8Array([
    ...ascii('MThd'),
    ...u32(6),
    0,
    0,
    0,
    1,
    (MIDI_PPQ >> 8) & 255,
    MIDI_PPQ & 255,
    ...ascii('MTrk'),
    ...u32(track.length),
    ...track,
  ]);
}
