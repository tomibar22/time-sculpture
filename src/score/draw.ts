import { commonSubdivision, isSpace, startOf } from '../engine';
import type { Doc, ItemId } from '../engine';
import { inkFor, sizeColor } from './colors';
import type { Palette } from './colors';
import { boundaries, L, laneY, rowTop, segments, tileY, xOf } from './geometry';
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

  /* ---------------- rows: numbers, subdivision lane, tile bed, guides, ruler */
  for (let r = 0; r < g.C; r++) {
    const top = rowTop(g, r);
    const ly = laneY(g, r);
    const ty = tileY(g, r);
    for (let b = 0; b < g.B; b++) {
      const gb = r * g.B + b;
      const x = L.margin + b * g.bw;
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left';
      c.fillStyle = b === 0 ? P.land : P.muted;
      c.font = `${b === 0 ? 700 : 500} 13px ${MONO}`;
      c.fillText(String(b + 1), x + 4, top + 14);
      if (b === 0 && g.C > 1) {
        c.fillStyle = P.muted;
        c.font = `500 12px ${MONO}`;
        c.textAlign = 'right';
        c.fillText(`cycle ${r + 1}`, g.w - L.margin, top + 14);
      }
      const painting = !!s.painting && s.painting.beats.has(gb);
      const d = painting ? s.painting!.d : sd[gb]!;
      const odd = d !== common;
      c.fillStyle = painting || odd ? P.accent : P.soft;
      c.globalAlpha = painting ? 0.35 : odd ? 0.14 : 1;
      rr(c, x + 2, ly, g.bw - 4, L.laneH, 8);
      c.fill();
      c.globalAlpha = 1;
      const dotR = Math.min(2.4, g.bw / d / 4 + 0.6);
      for (let j = 0; j < d; j++) {
        c.fillStyle = odd || painting ? P.fg : P.faint;
        c.globalAlpha = odd || painting ? 0.7 : 1;
        c.beginPath();
        c.arc(x + ((j + 0.5) * g.bw) / d, ly + L.laneH / 2, dotR, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      if ((odd || painting) && g.bw >= 36) {
        c.fillStyle = P.card;
        rr(c, x + g.bw / 2 - 16, ly + 3, 32, L.laneH - 6, 6);
        c.fill();
        c.fillStyle = P.fg;
        c.font = `700 11px ${MONO}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(`${d}:1`, x + g.bw / 2, ly + L.laneH / 2 + 0.5);
      }
    }
    c.fillStyle = P.soft;
    rr(c, L.margin, ty, g.B * g.bw, L.tileH, 12);
    c.fill();
    for (let b = 0; b < g.B; b++) {
      const d = sd[r * g.B + b]!;
      const x = L.margin + b * g.bw;
      c.fillStyle = P.line;
      for (let j = 1; j < d; j++) c.fillRect(x + (j * g.bw) / d - 0.5, ty + 8, 1, L.tileH - 16);
      if (b > 0) {
        c.fillStyle = P.faint;
        c.globalAlpha = 0.6;
        c.fillRect(x - 0.6, ty + 3, 1.2, L.tileH - 6);
        c.globalAlpha = 1;
      }
    }
    const ry = ty + L.tileH + 4;
    for (let b = 0; b <= g.B; b++) {
      const x = L.margin + b * g.bw;
      const down = b % g.B === 0;
      c.fillStyle = down ? P.land : P.muted;
      c.fillRect(x - (down ? 1 : 0.7), ry, down ? 2 : 1.4, down ? 10 : 7);
      if (b < g.B) {
        const d = sd[r * g.B + b]!;
        c.fillStyle = P.faint;
        for (let j = 1; j < d; j++) c.fillRect(x + (j * g.bw) / d - 0.5, ry, 1, 4);
      }
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
        const p1x = L.margin + (seg.t1 - seg.r * g.B) * g.bw;
        const ty = tileY(g, seg.r) + dy;
        const X = p0.x + (seg.first ? 2 : 0);
        const W = p1x - p0.x - (seg.first ? 2 : 0) - (seg.last ? 2 : 0);
        if (lifted) {
          c.save();
          c.shadowColor = 'rgba(0,0,0,.28)';
          c.shadowBlur = 14;
          c.shadowOffsetY = 6;
          c.fillStyle = isSpace(x) || x.kind === 'rest' ? P.card : sizeColor(x.n);
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
          c.save();
          rr(c, X, ty + 3, W, L.tileH - 6, 9);
          c.fillStyle = P.card;
          c.fill();
          c.clip();
          c.strokeStyle = P.faint;
          c.lineWidth = 1.2;
          for (let k = -L.tileH; k < W; k += 7) {
            c.beginPath();
            c.moveTo(X + k, ty + L.tileH);
            c.lineTo(X + k + L.tileH, ty);
            c.stroke();
          }
          c.restore();
          c.strokeStyle = P.faint;
          c.lineWidth = 1.5;
          rr(c, X, ty + 3, W, L.tileH - 6, 9);
          c.stroke();
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
        if (W > 15) {
          c.fillStyle = x.kind === 'rest' ? P.fg : inkFor(sizeColor(x.n));
          c.globalAlpha = seg.first ? 1 : 0.6;
          c.font = `600 ${W > 26 ? 16 : 12}px ${MONO}`;
          c.textAlign = 'left';
          c.textBaseline = 'middle';
          c.fillText(seg.first ? String(x.n) : `…${x.n}`, X + (W > 26 ? 8 : 4), ty + L.tileH / 2);
          c.globalAlpha = 1;
        }
      }
    }
    a += x.n;
  }

  /* ---------------- handles */
  if (s.showHandles) {
    const maxD = Math.max(...sd);
    for (const b of boundaries(doc.items)) {
      if (b.slot <= 0 || b.slot >= g.grid.TS) continue;
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
    const onRowEdge = t > 0 && t < g.grid.NB && Math.abs(t / g.B - Math.round(t / g.B)) < 1e-9;
    if (attachLeft && onRowEdge) return { x: L.margin + g.B * g.bw, r: Math.round(t / g.B) - 1 };
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
