import { EPS } from './grid';
import type { Meter, Section } from './types';

export type { Section };

/**
 * Metric modulation. A piece is a sequence of *local* beats (each with its own subdivision). From
 * a section's first beat on, the tempo changes by a pulse equation with the section before it,
 * "from:1 = to:1": a pulse of `from` per beat before equals a pulse of `to` per beat after, so a
 * new beat lasts `to/from` of the old one. Each section has its own bar size and starts a new bar.
 * The main section (index 0) is the start of the piece, with `meter.beatsPerCycle` beats per bar.
 *
 * On screen every local beat has the same width (the user reads the new tempo as beats); the
 * engine maps local time to *main* time (beats of the main tempo) for playback and for checking
 * that the piece ends on beat 1 of a main bar.
 */

export interface SectionInfo {
  /** Start beat (local), its bar size, and how long one of its beats lasts in main beats. */
  at: number;
  end: number;
  beatsPerBar: number;
  scale: number;
  /** Main time at its start. */
  mainAt: number;
  from: number;
  to: number;
  /** Its bar sizes, going round (one entry when every bar is alike). */
  pattern: readonly number[];
}

export interface BarMap {
  NB: number;
  sections: SectionInfo[];
  /** Per local beat: its section, its bar (global index) and its place in that bar. */
  sectionOf: number[];
  barOf: number[];
  beatInBar: number[];
  /** Local beat where each bar starts. */
  barStarts: number[];
  /** Total length in main beats. */
  totalMain: number;
}

const cache = new WeakMap<Meter, BarMap>();

const patternOf = (bars: readonly number[] | undefined, size: number): readonly number[] => {
  const ok = (bars ?? []).filter((n) => Number.isInteger(n) && n >= 1);
  return ok.length ? ok : [Math.max(1, size)];
};

/**
 * Is the piece free of the plain "beats × bars" shape? True with modulations, metre changes or a
 * pattern of bars: then its length is its subdivision's and `cycles` counts its bars.
 */
export const isFree = (meter: Meter) => !!(meter.sections?.length || meter.bars?.length);

/** Does the tempo ever change (a real modulation, not only a change of metre)? */
export const hasTempoChange = (meter: Meter) => (meter.sections ?? []).some((s) => s.from !== s.to);

/** "5+5+4" or "7": a section's bars as a time signature would say them. */
export const patternLabel = (pattern: readonly number[]) => pattern.join('+');

export function barMap(meter: Meter): BarMap {
  const hit = cache.get(meter);
  if (hit) return hit;
  const NB = meter.subdivision.length;
  const list = meter.sections ?? [];
  const sections: SectionInfo[] = [];
  let scale = 1;
  let mainAt = 0;
  const starts = [0, ...list.map((s) => s.at)];
  for (let i = 0; i < starts.length; i++) {
    const at = starts[i]!;
    const end = starts[i + 1] ?? NB;
    const s = i === 0 ? null : list[i - 1]!;
    if (s) scale *= s.to / s.from;
    sections.push({
      at,
      end,
      beatsPerBar: s ? s.beatsPerBar : meter.beatsPerCycle,
      scale,
      mainAt,
      from: s?.from ?? 1,
      to: s?.to ?? 1,
      pattern: patternOf(s ? s.bars : meter.bars, s ? s.beatsPerBar : meter.beatsPerCycle),
    });
    mainAt += (end - at) * scale;
  }
  const sectionOf: number[] = [];
  const barOf: number[] = [];
  const beatInBar: number[] = [];
  const barStarts: number[] = [];
  sections.forEach((sec, si) => {
    let j = 0;
    let pi = 0;
    for (let b = sec.at; b < sec.end; b++) {
      if (j >= sec.pattern[pi % sec.pattern.length]!) {
        j = 0;
        pi++;
      }
      if (j === 0) barStarts.push(b);
      sectionOf.push(si);
      barOf.push(barStarts.length - 1);
      beatInBar.push(j);
      j++;
    }
  });
  const map: BarMap = { NB, sections, sectionOf, barOf, beatInBar, barStarts, totalMain: mainAt };
  cache.set(meter, map);
  return map;
}

/** Index of the section that contains local time t. */
export function sectionAt(meter: Meter, t: number): number {
  const { sections } = barMap(meter);
  let i = 0;
  while (i + 1 < sections.length && sections[i + 1]!.at <= t + EPS) i++;
  return i;
}

/** Local time (beats) → main time (beats of the main tempo). */
export function toMain(meter: Meter, t: number): number {
  const s = barMap(meter).sections[sectionAt(meter, t)]!;
  return s.mainAt + (t - s.at) * s.scale;
}

/** Main time → local time (the inverse of `toMain`). */
export function fromMain(meter: Meter, m: number): number {
  const { sections } = barMap(meter);
  let i = 0;
  while (i + 1 < sections.length && sections[i + 1]!.mainAt <= m + EPS) i++;
  const s = sections[i]!;
  return s.at + (m - s.mainAt) / s.scale;
}

/** Tempo of a section, from the main tempo. */
export const sectionTempo = (meter: Meter, i: number, mainTempo: number) =>
  mainTempo / barMap(meter).sections[i]!.scale;

export interface Landing {
  /** The end falls on beat 1 of a main bar. */
  lands: boolean;
  /** How far past the last main beat 1 the piece ends, in main beats (0 ≤ late < bar). */
  late: number;
  /** Whole beats of the last section that would make it land (positive = add, negative = cut). */
  fixes: number[];
}

/** Does the whole piece end on beat 1 of the main tempo? (Only meaningful with modulations.) */
export function landing(meter: Meter): Landing {
  const map = barMap(meter);
  if (!hasTempoChange(meter)) {
    // one tempo throughout: it lands when its last bar is whole
    const lastSec = map.sections[map.sections.length - 1]!;
    const start = map.barStarts[map.barStarts.length - 1] ?? 0;
    const have = map.NB - start;
    const pi = map.barStarts.filter((b) => b >= lastSec.at).length - 1;
    const want = lastSec.pattern[pi % lastSec.pattern.length]!;
    if (have >= want) return { lands: true, late: 0, fixes: [] };
    return {
      lands: false,
      late: have,
      fixes: [want - have, ...(start > lastSec.at ? [-have] : [])],
    };
  }
  const bar = meter.bars?.length ? meter.bars.reduce((a, n) => a + n, 0) : meter.beatsPerCycle;
  let late = map.totalMain % bar;
  if (late < 1e-7 || bar - late < 1e-7) late = 0;
  const last = map.sections[map.sections.length - 1]!;
  const fixes: number[] = [];
  if (late > 0) {
    // add (bar − late) or cut `late` main beats, in whole local beats of the last section
    const add = (bar - late) / last.scale;
    const cut = late / last.scale;
    for (const [v, sign] of [
      [add, 1],
      [cut, -1],
    ] as const) {
      const n = Math.round(v);
      if (Math.abs(v - n) < 1e-7 && n > 0 && (sign > 0 || n < last.end - last.at))
        fixes.push(sign * n);
    }
  }
  return { lands: late === 0, late, fixes };
}

/** "Bar 3, beat 2" for a local beat (1-based), counting bars across all sections. */
export function barBeat(meter: Meter, beat: number): { bar: number; beat: number } {
  const map = barMap(meter);
  const b = Math.max(0, Math.min(map.NB - 1, beat));
  return { bar: (map.barOf[b] ?? 0) + 1, beat: (map.beatInBar[b] ?? 0) + 1 };
}

/** The piece's shape in a few words: "7 beats × 6 bars", "9 bars · 5+5+4", "5 bars · 2 tempi". */
export function meterSummary(meter: Meter, short = false): string {
  if (!isFree(meter))
    return short
      ? `${meter.beatsPerCycle}×${meter.cycles}`
      : `${meter.beatsPerCycle} beats × ${meter.cycles} bar${meter.cycles === 1 ? '' : 's'}`;
  const map = barMap(meter);
  const bars = `${meter.cycles} bar${meter.cycles === 1 ? '' : 's'}`;
  const tempi = new Set(map.sections.map((x) => Math.round(x.scale * 1e6))).size;
  if (tempi > 1) return short ? bars : `${bars} · ${tempi} tempi`;
  const labels = [...new Set(map.sections.map((x) => patternLabel(x.pattern)))];
  return `${bars} · ${labels.slice(0, 2).join(', ')}${labels.length > 2 ? '…' : ''}`;
}
