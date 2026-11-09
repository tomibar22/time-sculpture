/** Identifier of an item. Stable across edits. The space always has the id `SPACE_ID`. */
export type ItemId = string;

export type GroupKind = 'sound' | 'rest';

/** A group of pulses that sounds or rests. */
export interface Group {
  readonly id: ItemId;
  readonly kind: GroupKind;
  /** Length in pulses, always >= 1. */
  readonly n: number;
}

/** The single open space. Its size is derived: total pulses minus the sum of the groups. */
export interface Space {
  readonly id: typeof SPACE_ID;
  readonly kind: 'space';
  /** Derived length in pulses, >= 0. Recomputed by `normalize`. */
  readonly n: number;
}

export type Item = Group | Space;

export const SPACE_ID = 'space' as const;

export interface Meter {
  /** 3..13 beats per cycle (no denominator). */
  readonly beatsPerCycle: number;
  /** 1..32 cycles. */
  readonly cycles: number;
  /**
   * Pulses per beat for every beat of the piece, each 1..8. Without modulations its length is
   * beatsPerCycle × cycles; `cycles` is always the number of bars.
   */
  readonly subdivision: readonly number[];
  /**
   * Manual line breaks of the score, as times in beats where a new row starts (0 < t < total
   * beats, ascending, each on a pulse). Part of the document so they undo and save with it.
   */
  readonly breaks?: readonly number[];
  /**
   * Phrase marks: times in beats where a phrase starts (0 ≤ t < total beats, ascending, each on a
   * pulse). Drawn as flags, so a phrase that does not start on a beat is easy to see.
   */
  readonly marks?: readonly number[];
  /**
   * Metric modulations, in order: from each `at` (a local beat) the tempo changes by the pulse
   * equation `from`:1 = `to`:1 and bars have `beatsPerBar` beats. See engine/sections.ts.
   */
  readonly sections?: readonly Section[];
  /**
   * Repeat structure (see engine/form.ts). Start signs `|:` (0 ≤ t < total), end signs `:|`
   * (0 < t ≤ total) with how many times the passage is played, and endings ("voltas") that are
   * played only on some passes. All times in beats, on pulses, ascending.
   */
  readonly repeatStarts?: readonly number[];
  readonly repeatEnds?: readonly RepeatEnd[];
  readonly voltas?: readonly Volta[];
}

export interface RepeatEnd {
  readonly at: number;
  /** Times the passage is played in all (2 = once more). */
  readonly times: number;
}

/** An ending bracket over [a, b), played on these passes of its repeat (1-based). */
export interface Volta {
  readonly a: number;
  readonly b: number;
  readonly passes: readonly number[];
}

export interface Section {
  /** Local beat where the section starts (> 0, ascending). */
  readonly at: number;
  /** Pulse equation with the previous section: `from`:1 before = `to`:1 after (each 1..8). */
  readonly from: number;
  readonly to: number;
  /** Beats per bar in this section (1..13). */
  readonly beatsPerBar: number;
}

/** The undoable document. Immutable: operations return new objects and share unchanged ones. */
export interface Doc {
  readonly meter: Meter;
  readonly items: readonly Item[];
  /** Counter used to mint fresh item ids, so operations stay pure and deterministic. */
  readonly nextId: number;
}

export type FailReason =
  | 'no-room'
  | 'not-contiguous'
  | 'nothing-selected'
  | 'too-small'
  | 'not-adjacent'
  | 'no-change'
  | 'cannot-fill'
  | 'out-of-range';

/** What an operation did, for user feedback (toasts, flashes, announcements). */
export interface Report {
  readonly ok: boolean;
  readonly reason?: FailReason;
  /** Items whose start time changed because of a conflict resolution. */
  readonly moved: readonly ItemId[];
  /** Sounding groups that lost pulses because something ran into them. */
  readonly shortened: readonly ItemId[];
  /** Groups used up completely and removed by a slide. */
  readonly covered: readonly ItemId[];
  /** Newly created items (split halves, copies, silences left behind, fills). */
  readonly created: readonly ItemId[];
  /** Items removed by the operation itself (remove, merge, meter shrink, absorption). */
  readonly removed: readonly ItemId[];
  /** setSubdivision: how many group starts snapped to a different moment. */
  readonly startsMoved: number;
  /** setSubdivision: how many groups were squeezed to zero and absorbed. */
  readonly absorbed: number;
}

export interface OpResult {
  readonly doc: Doc;
  readonly report: Report;
}

/** Where `add` puts a new group. `start` = end of the start (just before the space), `end` = beginning of the ending (just after the space). */
export type AddAt = 'start' | 'end' | { readonly index: number };

export type MoveUnit = 'pulse' | 'beat';

export type TrayState = 'fits' | 'dead' | 'big';
