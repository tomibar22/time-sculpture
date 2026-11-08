import { commonSubdivision, isSpace, startOf } from '../engine';
import type { Doc, ItemId } from '../engine';
import { inkFor, sizeColor } from './colors';
import type { Palette } from './colors';
import {
  boundaries,
  L,
  bandY,
  rowEndX,
  rowStartingAt,
  rowTop,
  segments,
  tileY,
  xOf,
} from './geometry';
import type { Geo } from './geometry';

export interface DrawState {
  doc: Doc;
  selection: ReadonlySet<ItemId>;
  lifted: ReadonlySet<ItemId>;
  tray: ReadonlySet<number>;
  /** Beats being painted and the brush. */
  painting: { beats: ReadonlySet<number>; d: number } | null;
  activeBoundary: string | null;
  hoverBoundary: string | null;
  showHandles: boolean;
  dropCaret: number | null;
  /** Text caret (item index), drawn when nothing is selected. */
  cursor: number | null;
  playhead: number | null;
  flash: { ids: ReadonlySet<ItemId>; alpha: number };
  focusedId: ItemId | null;
  /** Single selected group that shows trim grips on its edges, and the grip being dragged. */
  grips: ItemId | null;
  activeGrip: 'start' | 'end' | null;
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, Math.abs(w) / 2, h / 2));
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, Math.max(0, w), h, rad);
  else c.rect(x, y, Math.max(0, w), h);
}

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const BODY = '"Atkinson Hyperlegible", system-ui, sans-serif';

export function drawScore(c: CanvasRenderingContext2D, g: Geo, s: DrawState, P: Palette): void {
  const { doc } = s;
  const sd = doc.meter.subdivision;
  const common = commonSubdivision(doc.meter);
  c.clearRect(0, 0, g.w, g.h);

  /* ---------------- rows: beat numbers, tile bed with guides, subdivision band */
  const B = g.B;
  const showNumbers = g.bw >= 15;
  for (let r = 0; r < g.R; r++) {
    const row = g.rows[r]!;
    const top = rowTop(g, r);
    const ty = tileY(g, r);
    const by = bandY(g, r);

    // beat numbers (cycle downbeats in red)
    for (let lb = 0; lb < row.nb; lb++) {
      const inCycle = (row.b0 + lb) % B;
      if (inCycle !== 0 && !showNumbers) continue;
      const x = L.margin + lb * g.bw;
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left';
      c.fillStyle = inCycle === 0 ? P.land : P.muted;
      c.font = `${inCycle === 0 ? 700 : 500} ${g.bw >= 24 ? 13 : 11}px ${MONO}`;
      c.fillText(String(inCycle + 1), x + (g.bw >= 24 ? 4 : 2), top + 14);
    }

    // tile bed: faint pulse guides, stronger beat guides, red at cycle downbeats
    c.fillStyle = P.soft;
    rr(c, L.margin, ty, row.nb * g.bw, L.tileH, 12);
    c.fill();
    for (let lb = 0; lb < row.nb; lb++) {
      const gb = row.b0 + lb;
      const d = sd[gb]!;
      const x = L.margin + lb * g.bw;
      c.fillStyle = P.line;
      for (let j = 1; j < d; j++) c.fillRect(x + (j * g.bw) / d - 0.5, ty + 8, 1, L.tileH - 16);
      if (lb > 0) {
        const down = gb % B === 0;
        c.fillStyle = down ? P.land : P.faint;
        c.globalAlpha = down ? 0.55 : 0.6;
        c.fillRect(x - (down ? 0.9 : 0.6), ty + 3, down ? 1.8 : 1.2, L.tileH - 6);
        c.globalAlpha = 1;
      }
    }

    // subdivision band: one pill per beat, a dot per pulse; ratio badge where it differs
    for (let lb = 0; lb < row.nb; lb++) {
      const gb = row.b0 + lb;
      const x = L.margin + lb * g.bw;
      const painting = !!s.painting && s.painting.beats.has(gb);
      const d = painting ? s.painting!.d : sd[gb]!;
      const odd = d !== common;
      const pad = Math.min(2, g.bw * 0.06);
      c.fillStyle = painting || odd ? P.accent : P.soft;
      c.globalAlpha = painting ? 0.32 : odd ? 0.15 : 1;
      rr(c, x + pad, by, g.bw - 2 * pad, L.bandH, Math.min(8, g.bw / 4));
      c.fill();
      c.globalAlpha = 1;
      const dotR = Math.min(2.4, g.bw / d / 4 + 0.6);
      c.fillStyle = odd || painting ? P.fg : P.muted;
      c.globalAlpha = odd || painting ? 0.75 : 0.55;
      for (let j = 0; j < d; j++) {
        c.beginPath();
        c.arc(x + ((j + 0.5) * g.bw) / d, by + L.bandH / 2, dotR, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      // the ratio of beats that differ is named in the number row above, so no dot is covered
      if ((odd || painting) && g.bw >= 40) {
        c.fillStyle = P.accent;
        c.font = `700 11px ${MONO}`;
        c.textAlign = 'right';
        c.textBaseline = 'alphabetic';
        c.fillText(`${d}:1`, x + g.bw - 4, rowTop(g, r) + 14);
      }
    }
    // cycle marks: a red tick at every downbeat and at the row's end
    for (let lb = 0; lb <= row.nb; lb++) {
      const gb = row.b0 + lb;
      if (gb % B !== 0) continue;
      const x = L.margin + lb * g.bw;
      c.fillStyle = P.land;
      c.fillRect(x - 1, by - 2, 2, L.bandH + 4);
    }
  }

  /* ---------------- tiles */
  let a = 0;
  for (const x of doc.items) {
    if (x.n > 0) {
      const lifted = s.lifted.has(x.id);
      const selected = s.selection.has(x.id);
      const dy = lifted ? -5 : 0;
      for (const seg of segments(g, a, x.n)) {
        const p0 = xOf(g, seg.t0);
        const p1x = L.margin + (seg.t1 - g.rows[seg.r]!.b0) * g.bw;
        const ty = tileY(g, seg.r) + dy;
        const X = p0.x + (seg.first ? 2 : 0);
        const W = p1x - p0.x - (seg.first ? 2 : 0) - (seg.last ? 2 : 0);
        if (lifted && x.kind !== 'rest') {
          c.save();
          c.shadowColor = 'rgba(0,0,0,.28)';
          c.shadowBlur = 14;
          c.shadowOffsetY = 6;
          c.fillStyle = isSpace(x) ? P.card : sizeColor(x.n);
          rr(c, X, ty + 2, W, L.tileH - 4, 9);
          c.fill();
          c.restore();
        }
        if (isSpace(x)) {
          c.setLineDash([4, 5]);
          c.strokeStyle = P.faint;
          c.lineWidth = 1.5;
          rr(c, X + 1, ty + 5, W - 2, L.tileH - 10, 9);
          c.stroke();
          c.setLineDash([]);
          if (seg.first && W > 70) {
            c.fillStyle = P.muted;
            c.font = `14px ${BODY}`;
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(`open ${x.n}`, X + W / 2, ty + L.tileH / 2);
          }
          continue;
        }
        if (x.kind === 'rest') {
          // Silence is simply empty time: nothing is drawn unless it is being handled.
          if (selected || lifted || s.focusedId === x.id) {
            c.fillStyle = P.sel;
            c.globalAlpha = 0.08;
            rr(c, X, ty + 3, W, L.tileH - 6, 9);
            c.fill();
            c.globalAlpha = 1;
          }
        } else {
          const col = sizeColor(x.n);
          c.fillStyle = col;
          rr(c, X, ty + 2, W, L.tileH - 4, 9);
          c.fill();
          if (!s.tray.has(x.n)) {
            c.setLineDash([3, 3]);
            c.strokeStyle =
              inkFor(col) === '#ffffff' ? 'rgba(255,255,255,.85)' : 'rgba(22,25,30,.7)';
            c.lineWidth = 1.5;
            rr(c, X + 3, ty + 5, W - 6, L.tileH - 10, 7);
            c.stroke();
            c.setLineDash([]);
          }
        }
        if (selected) {
          c.strokeStyle = P.sel;
          c.lineWidth = 3;
          rr(c, X - 1.5, ty + 0.5, W + 3, L.tileH - 1, 10);
          c.stroke();
        }
        if (s.focusedId === x.id && !selected) {
          c.setLineDash([2, 3]);
          c.strokeStyle = P.sel;
          c.lineWidth = 2;
          rr(c, X - 1.5, ty + 0.5, W + 3, L.tileH - 1, 10);
          c.stroke();
          c.setLineDash([]);
        }
        if (s.flash.alpha > 0 && s.flash.ids.has(x.id)) {
          c.strokeStyle = P.warn;
          c.lineWidth = 3;
          c.globalAlpha = s.flash.alpha;
          rr(c, X - 1, ty + 1, W + 2, L.tileH - 2, 10);
          c.stroke();
          c.globalAlpha = 1;
        }
        const showRestNumber = selected || lifted || s.focusedId === x.id;
        if (W > 15 && (x.kind !== 'rest' || showRestNumber)) {
          c.fillStyle = x.kind === 'rest' ? P.muted : inkFor(sizeColor(x.n));
          c.globalAlpha = seg.first ? 1 : 0.6;
          c.font = `600 ${W > 26 ? 16 : 12}px ${MONO}`;
          c.textAlign = 'left';
          c.textBaseline = 'middle';
          c.fillText(seg.first ? String(x.n) : `…${x.n}`, X + (W > 26 ? 8 : 4), ty + L.tileH / 2);
          c.globalAlpha = 1;
        }
        if (s.grips === x.id) {
          const drawGrip = (gx: number, on: boolean) => {
            c.fillStyle = P.sel;
            rr(c, gx - 3, ty + L.tileH / 2 - 14, 6, 28, 3);
            c.fill();
            c.strokeStyle = P.card;
            c.lineWidth = on ? 2 : 1.5;
            c.stroke();
          };
          if (seg.first) drawGrip(X + 1, s.activeGrip === 'start');
          if (seg.last) drawGrip(X + W - 1, s.activeGrip === 'end');
        }
      }
    }
    a += x.n;
  }

  /* ---------------- handles */
  if (s.showHandles) {
    const maxD = Math.max(...sd);
    // the selected group's grips replace the handles on its own edges
    const gi = s.grips ? doc.items.findIndex((y) => y.id === s.grips) : -1;
    const gs0 = gi >= 0 ? startOf(doc.items, gi) : -1;
    const ge0 = gi >= 0 ? gs0 + doc.items[gi]!.n : -1;
    for (const b of boundaries(doc.items)) {
      if (b.slot <= 0 || b.slot >= g.grid.TS) continue;
      if (b.slot === gs0 || b.slot === ge0) continue;
      const p = xOf(g, g.grid.times[b.slot]!);
      const ty = tileY(g, p.r);
      const on = s.activeBoundary === b.key || s.hoverBoundary === b.key;
      if (b.kind === 'line') {
        if (!on && g.bw / maxD < 9) continue;
        c.fillStyle = on ? P.fg : P.card;
        rr(c, p.x - 3.5, ty + L.tileH / 2 - 12, 7, 24, 3.5);
        c.fill();
        c.strokeStyle = on ? P.fg : P.muted;
        c.lineWidth = 1;
        c.stroke();
      } else {
        c.fillStyle = P.accent;
        c.globalAlpha = on ? 1 : 0.9;
        rr(c, p.x - 5, ty + L.tileH / 2 - 15, 10, 30, 5);
        c.fill();
        c.globalAlpha = 1;
        c.fillStyle = P.accentInk;
        c.font = `bold 11px ${BODY}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(b.kind === 'edgeR' ? '›' : '‹', p.x, ty + L.tileH / 2);
      }
    }
  }

  /* ---------------- drop caret, text caret and playhead */
  /** Where a caret at item index sits. Attached left = it follows an item (shown at the end of a
   * row rather than the start of the next one when it falls on a row boundary). */
  const caretAt = (index: number, attachLeft: boolean) => {
    const t =
      g.grid.times[Math.min(startOf(doc.items, Math.min(index, doc.items.length)), g.grid.TS)]!;
    const startsRow = rowStartingAt(g, t);
    if (attachLeft && startsRow > 0) return { x: rowEndX(g, startsRow - 1), r: startsRow - 1 };
    return xOf(g, Math.min(t, g.grid.NB - 1e-6));
  };
  if (s.dropCaret !== null) {
    const p = caretAt(s.dropCaret, false);
    const ty = tileY(g, p.r);
    c.fillStyle = P.accent;
    rr(c, p.x - 2, ty - 4, 4, L.tileH + 8, 2);
    c.fill();
  }
  if (s.cursor !== null && s.selection.size === 0) {
    const index = s.cursor;
    const si = doc.items.findIndex(isSpace);
    const dir = index === 0 || index === si + 1 ? 1 : -1;
    const p = caretAt(index, dir < 0);
    const ty = tileY(g, p.r);
    c.fillStyle = P.sel;
    c.fillRect(p.x - 1.5, ty - 6, 3, L.tileH + 12);
    c.beginPath();
    c.moveTo(p.x, ty - 6);
    c.lineTo(p.x + dir * 7, ty - 6);
    c.lineTo(p.x, ty + 1);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(p.x, ty + L.tileH + 6);
    c.lineTo(p.x + dir * 7, ty + L.tileH + 6);
    c.lineTo(p.x, ty + L.tileH - 1);
    c.closePath();
    c.fill();
  }
  if (s.playhead !== null) {
    const p = xOf(g, s.playhead);
    const ty = tileY(g, p.r);
    c.fillStyle = P.fg;
    c.fillRect(p.x - 1, ty - 4, 2, L.tileH + 8);
  }
}
