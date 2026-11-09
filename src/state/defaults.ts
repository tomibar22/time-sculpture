import {
  docFrom,
  emptyDoc,
  fillGroups,
  fillOptions,
  fillRange,
  makeMeter,
  sampleTiling,
} from '../engine';
import type { Doc } from '../engine';

export const DEFAULT_TEMPO = 72;
export const MIN_TEMPO = 30;
export const MAX_TEMPO = 240;

/** The composition a new user sees: a phrase planned from both ends with some open space. */
export function defaultDoc(): Doc {
  return docFrom(makeMeter(4, 2, 4), [[2], 3, 3, 2, '|', 3, [1], 3, 2, 4]);
}

export function blankDoc(): Doc {
  return docFrom(makeMeter(4, 2, 4), ['|']);
}

/** The same grid as `doc` (meter, subdivisions, modulations), with nothing written in it. */
export function sameGridDoc(doc: Doc): Doc {
  const { beatsPerCycle, cycles, subdivision, sections } = doc.meter;
  return emptyDoc({ beatsPerCycle, cycles, subdivision, ...(sections ? { sections } : {}) });
}

const pick = <T>(xs: readonly T[], rng: () => number): T => xs[Math.floor(rng() * xs.length)]!;

/**
 * A piece to start from when you want to be surprised: a meter, a subdivision, and a phrase with
 * a shape (a tihai, a pyramid, a refrain…) that already lands on 1. Something to answer, bend or
 * throw away.
 */
export function surpriseDoc(rng: () => number = Math.random): { doc: Doc; name: string } {
  const beats = pick([3, 4, 4, 5, 5, 6, 7, 7, 9], rng);
  const bars = pick(beats >= 7 ? [1, 2] : [2, 2, 4], rng);
  const sub = pick(beats >= 7 ? [2, 3, 4] : [2, 3, 4, 4, 5], rng);
  const meter = makeMeter(beats, bars, sub);
  const empty = emptyDoc(meter);
  const TS = beats * bars * sub;
  const sizes = pick(
    [
      [2, 3],
      [2, 3, 4],
      [3, 4, 5],
      [2, 3, 5],
      [3, 5, 7],
      [2, 3, 4, 5, 7],
    ],
    rng,
  );
  const shaped = fillOptions(meter, 0, TS, sizes, 60, rng).options.filter(
    (o) => o.shape && o.tiles >= 3 && o.tiles <= 14,
  );
  const o = shaped.length ? pick(shaped, rng) : null;
  const groups = o
    ? fillGroups(o)
    : fillGroups({ sizes: sampleTiling(TS, [1, ...sizes], rng) ?? [TS] });
  const r = fillRange(empty, 0, TS, groups);
  return {
    doc: r.report.ok ? r.doc : empty,
    name: `${o?.shape?.label ? `${o.shape.label}` : 'Surprise'} · ${beats}×${bars}`,
  };
}
