import { L, rowOf, rowTop } from './geometry';
import type { Geo } from './geometry';

/**
 * What the score currently shows, so zooming can keep a point of the music where it is on the
 * screen: before a zoom an anchor is taken (a time and its screen y); after the new layout the
 * score scrolls the page so that time is back at that y. Nothing jumps.
 */
export interface Anchor {
  /** Time in beats. */
  t: number;
  /** Distance from the top of its row (px) and where that point was on the screen (client y). */
  dy: number;
  y: number;
  /** Instead: put the top of the score near the top of the screen (entering the overview). */
  top?: boolean;
}

export const view: {
  geo: Geo | null;
  canvas: HTMLCanvasElement | null;
  anchor: Anchor | null;
  /** Bars per row the overview is showing (set by the score while it is on). */
  overviewPer: number | null;
} = { geo: null, canvas: null, anchor: null, overviewPer: null };

/** An anchor at time t (its row's top + dy). With no dy: the middle of its tiles. */
export function anchorAtTime(t: number, dy = 50): Anchor | null {
  const { geo: g, canvas } = view;
  if (!g || !canvas) return null;
  const top = canvas.getBoundingClientRect().top + rowTop(g, rowOf(g, t));
  return { t, dy, y: top + dy };
}

/** An anchor at a point on the screen (a pinch centre, a tap). */
export function anchorAtPoint(clientX: number, clientY: number): Anchor | null {
  const { geo: g, canvas } = view;
  if (!g || !canvas) return null;
  const box = canvas.getBoundingClientRect();
  const y = clientY - box.top;
  const r = Math.max(
    0,
    Math.min(g.R - 1, Math.floor((y - rowTop(g, 0) + g.stride / 2) / g.stride)),
  );
  const row = g.rows[r]!;
  const x = Math.max(0, Math.min(row.nb, (clientX - box.left - L.margin) / row.bw));
  return { t: row.b0 + x, dy: y - rowTop(g, r), y: clientY };
}

/** The row at the top of what is visible (below the top edge of the screen). */
export function anchorAtTop(): Anchor | null {
  const { geo: g, canvas } = view;
  if (!g || !canvas) return null;
  const box = canvas.getBoundingClientRect();
  for (let r = 0; r < g.R; r++) {
    const top = box.top + rowTop(g, r);
    if (top >= 0) return { t: g.rows[r]!.b0, dy: 0, y: top };
  }
  return { t: g.rows[g.R - 1]!.b0, dy: 0, y: box.top + rowTop(g, g.R - 1) };
}

/** After a new layout: scroll so the anchor's time is back where it was. */
export function restoreAnchor(g: Geo, canvas: HTMLCanvasElement): void {
  const a = view.anchor;
  view.anchor = null;
  if (!a) return;
  if (a.top) {
    const dy = canvas.getBoundingClientRect().top - 12;
    if (Math.abs(dy) >= 1) window.scrollBy({ top: dy, behavior: 'instant' });
    return;
  }
  const now = canvas.getBoundingClientRect().top + rowTop(g, rowOf(g, a.t)) + a.dy;
  const dy = now - a.y;
  if (Math.abs(dy) >= 1) window.scrollBy({ top: dy, behavior: 'instant' });
}
