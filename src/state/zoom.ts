import { ui as sfx } from '../audio/voices';
import * as E from '../engine';
import { zoomLabel, zoomLevels } from '../score/rows';
import { anchorAtPoint, anchorAtTime, anchorAtTop, view } from '../score/view';
import type { Anchor } from '../score/view';
import { announce } from './actions';
import { useDocStore, useUiStore } from './store';

/**
 * Zoom: how much time a score row holds (`ui.perRow`, bars per row; below 1 a share of a bar).
 * Rows reflow like text, so tiles never blur or change height, and every change keeps a point of
 * the music where it was on the screen. The overview (`ui.overview`) fits the whole piece above
 * the dock for a moment; it is not saved and the PDF keeps the zoom.
 */

const ui = () => useUiStore.getState();
const barLen = () => useDocStore.getState().doc.meter.beatsPerCycle;
const levels = () => zoomLevels(barLen(), useDocStore.getState().doc.meter.cycles);

/** Stop a smooth scroll that is still running (keep-in-view), so it cannot fight the anchor. */
const stopScroll = () => window.scrollTo({ top: window.scrollY, behavior: 'instant' });

/** Where to keep things steady: the caret, range or selection, else the row at the top. */
function focusAnchor(): Anchor | null {
  stopScroll();
  const s = ui();
  const d = useDocStore.getState().doc;
  const grid = E.buildGrid(d.meter);
  const span = s.range ?? E.spanOf(d, s.selection);
  const k = span ? span.a : s.caret;
  const box = view.canvas?.getBoundingClientRect();
  if (k !== null && box) {
    const a = anchorAtTime(grid.times[Math.min(k, grid.TS)]!);
    // only when it is on the screen; otherwise keep what is at the top
    if (a && a.y > 0 && a.y < window.innerHeight) return a;
  }
  return anchorAtTop();
}

function hud(text: string) {
  useUiStore.getState().set({ zoomHud: { text, at: performance.now() } });
  announce(text);
}

/** Show this many bars per row, keeping the anchor (or the focus) in place. */
export function setZoom(per: number, anchor: Anchor | null = focusAnchor()): void {
  view.anchor = anchor;
  ui().set({ perRow: per, overview: false });
  hud(`${zoomLabel(barLen(), per)} per row`);
}

/** One step in (+1: fewer beats per row) or out (−1). Out of the overview, in goes back. */
export function zoomStep(dir: 1 | -1, anchor?: Anchor | null): void {
  const s = ui();
  if (s.overview) {
    if (dir > 0) return exitOverview(anchor ?? focusAnchor());
    return void sfx.nope();
  }
  const ls = levels();
  // the nearest level to the current zoom (older pieces may have saved another number)
  let i = ls.findIndex((z) => z >= s.perRow - 1e-9);
  if (i < 0) i = ls.length - 1;
  if (ls[i]! > s.perRow + 1e-9 && dir < 0) i--;
  const j = i - dir;
  if (j < 0 || j >= ls.length) {
    sfx.nope();
    if (dir < 0) announce('This is the widest zoom. ⤢ shows everything.');
    return;
  }
  sfx.snap();
  setZoom(ls[j]!, anchor === undefined ? focusAnchor() : anchor);
}

/** The overview: everything on the screen at once (the score scrolls to its top). */
export function toggleOverview(): void {
  if (ui().overview) return exitOverview(focusAnchor());
  sfx.snap();
  view.anchor = { t: 0, dy: 0, y: 0, top: true };
  ui().set({ overview: true });
  hud('Everything · tap a place to zoom in there');
}

/** Back to the zoom from before the overview, keeping this point where it is. */
export function exitOverview(anchor: Anchor | null): void {
  if (!ui().overview) return;
  sfx.snap();
  view.anchor = anchor;
  ui().set({ overview: false });
  hud(`${zoomLabel(barLen(), ui().perRow)} per row`);
}

/** A tap in the overview: zoom back in around that point. */
export function diveAt(clientX: number, clientY: number): void {
  stopScroll();
  exitOverview(anchorAtPoint(clientX, clientY));
}
