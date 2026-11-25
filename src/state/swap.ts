import * as E from '../engine';
import { announce, plural, run, toast } from './actions';
import { describePulse, selectedRegion, setRange } from './editing';
import { useDocStore, useUiStore } from './store';

/**
 * Swapping two stretches of the piece, in two steps like "cut here, paste there": select a
 * stretch and choose Swap (X): it is marked "A" and stays in sight; then select the other
 * stretch (a tile, several, or a range) and choose Swap again (X, Enter, or the button). What
 * lies between them moves along when they differ in length; everything else keeps its time.
 */

const ui = () => useUiStore.getState();

/** Mark the selected stretch as the first of the two, or swap when one is already marked. */
export function swapStep(): void {
  if (ui().swapA) return void swapNow();
  const region = selectedRegion();
  if (!region) return void toast('Select a stretch first, then Swap: then the other one');
  ui().set({
    swapA: region,
    selection: [],
    anchor: null,
    multi: false,
    range: null,
    rangeAnchor: null,
    caret: null,
    menu: null,
  });
  announce(
    `Marked ${plural(region.b - region.a, 'pulse')} from ${describePulse(region.a)}. Now select the stretch to swap it with.`,
  );
}

/** The other stretch is selected: swap the two. */
export function swapNow(): boolean {
  const A = ui().swapA;
  const B = selectedRegion();
  if (!A) return false;
  if (!B) {
    toast('Now select the other stretch: tap a tile or drag across a range');
    return false;
  }
  const before = useDocStore.getState().doc;
  const [p, q] = A.a < B.a ? [A, B] : [B, A];
  const r0 = E.swapRanges(before, A, B);
  // the chords go with their stretches (written again from the first start on)
  const passage = [
    ...E.sliceRange(before, q.a, q.b),
    ...E.sliceRange(before, p.b, q.a),
    ...E.sliceRange(before, p.a, p.b),
  ];
  const r = r0.report.ok ? { ...r0, doc: E.placeChords(r0.doc, p.a, passage, before) } : r0;
  if (!run(r, { label: 'Swap', select: 'none' })) return false;
  // the first stretch, at its new place, is selected: where it went
  const lenA = A.b - A.a;
  const at = A === p ? q.b - lenA : p.a;
  ui().set({ swapA: null, menu: null });
  setRange(at, at + lenA);
  const moved = q.b - q.a - (p.b - p.a);
  toast(
    moved && q.a > p.b
      ? `Swapped. What was between moved ${plural(Math.abs(moved), 'pulse')} ${moved > 0 ? 'later' : 'earlier'}.`
      : 'Swapped',
    { undo: true },
  );
  return true;
}

export function cancelSwap(): void {
  if (!ui().swapA) return;
  ui().set({ swapA: null });
  announce('Swap cancelled');
}
