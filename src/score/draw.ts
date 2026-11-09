import {
  barMap,
  commonSubdivision,
  fromMain,
  sectionAt,
  toMain,
  isSpace,
  passesLabel,
  startOf,
} from '../engine';
import type { Doc, ItemId } from '../engine';
import { inkFor, sizeColor } from './colors';
import type { Palette } from './colors';
import {
  boundaries,
  L,
  bandY,
  rowEndX,
  rowOf,
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
  /** Beats being painted and the brush. */
  painting: { beats: ReadonlySet<number>; d: number } | null;
  activeBoundary: string | null;
  hoverBoundary: string | null;
  showHandles: boolean;
  /** Text caret (a pulse), drawn when nothing is selected. */
  cursor: number | null;
  /** Selected pulse range. */
  range?: { a: number; b: number } | null;
  playhead: number | null;
  flash: { ids: ReadonlySet<ItemId>; alpha: number };
  focusedId: ItemId | null;
  /** Single selected group that shows trim grips on its edges, and the grip being dragged. */
  grips: ItemId | null;
  /** Main tempo (for the tempo shown on modulation markers). */
  mainTempo?: number;
  activeGrip: 'start' | 'end' | null;
  /** Printing: draw onto an existing page instead of clearing the canvas. */
  noClear?: boolean;
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, Math.abs(w) / 2, h / 2));
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, Math.max(0, w), h, rad);
  else c.rect(x, y, Math.max(0, w), h);
}

const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const BODY = '"Atkinson Hyperlegible", system-ui, sans-serif';

const EPS_D = 1e-9;

/** A length in beats as a musician reads it: "3", "1¾", "2⅓", or "5/8" when small. */
export function beatsLabel(beats: number): string {
  const den = 840; // lcm of 1..8: every pulse length is a whole number of these
  let num = Math.round(beats * den);
  let d = den;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = gcd(num, d);
  num /= g;
  d /= g;
  const whole = Math.floor(num / d);
  const rest = num - whole * d;
  const FR: Record<string, string> = {
    '1/2': '½',
    '1/3': '⅓',
    '2/3': '⅔',
    '1/4': '¼',
    '3/4': '¾',
    '1/8': '⅛',
    '3/8': '⅜',
    '5/8': '⅝',
    '7/8': '⅞',
    '1/5': '⅕',
    '2/5': '⅖',
    '3/5': '⅗',
    '4/5': '⅘',
    '1/6': '⅙',
    '5/6': '⅚',
  };
  if (!rest) return `${whole}`;
  const f = FR[`${rest}/${d}`] ?? `${rest}/${d}`;
  return whole ? `${whole}${f.length > 1 ? ' ' : ''}${f}` : f;
}
const E_clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function drawScore(c: CanvasRenderingContext2D, g: Geo, s: DrawState, P: Palette): void {
  const { doc } = s;
  const sd = doc.meter.subdivision;
  const common = commonSubdivision(doc.meter);
  if (!s.noClear) c.clearRect(0, 0, g.w, g.h);

  /* ---------------- rows: beat numbers, tile bed with guides, subdivision band */
  // Rows may start and end anywhere (manual line breaks), so everything is drawn from pulse and
  // beat *times* clipped to the row, not from whole beats.
  // bars come from the bar map (each section has its own bar size and starts a new bar)
  const bm = barMap(doc.meter);
  const inBar = (b: number) => (b >= bm.NB ? 0 : (bm.beatInBar[b] ?? 0));
  const isDown = (b: number) => inBar(b) === 0;
  const { times, pre } = g.grid;
  for (let r = 0; r < g.R; r++) {
    const row = g.rows[r]!;
    const top = rowTop(g, r);
    const ty = tileY(g, r);
    const by = bandY(g, r);
    const bw = row.bw;
    const showNumbers = bw >= 15;
    const xAt = (t: number) => L.margin + (t - row.b0) * bw;
    const rowW = row.nb * bw;
    const bFirst = Math.floor(row.b0 + EPS_D);
    const bLast = Math.ceil(row.b0 + row.nb - EPS_D) - 1;

    // beat numbers, centred on the beat's tick (only beats that begin in this row)
    for (let gb = bFirst; gb <= bLast; gb++) {
      if (gb < row.b0 - EPS_D) continue;
      const inCycle = inBar(gb);
      if (inCycle !== 0 && !showNumbers) continue;
      c.textBaseline = 'alphabetic';
      c.textAlign = 'center';
      c.fillStyle = inCycle === 0 ? P.land : P.muted;
      c.font = `${inCycle === 0 ? 700 : 500} ${bw >= 24 ? 13 : 11}px ${MONO}`;
      c.fillText(String(inCycle + 1), Math.max(xAt(gb), 5), top + 14);
    }
    // a row that starts at a manual break, in the middle of a beat, says where it is
    if (row.manual && Math.abs(row.b0 - Math.round(row.b0)) > EPS_D) {
      const b = Math.floor(row.b0 + EPS_D);
      const j = row.k0 - pre[b]!;
      const d = pre[b + 1]! - pre[b]!;
      c.textAlign = 'left';
      c.fillStyle = P.muted;
      c.font = `500 10px ${MONO}`;
      c.fillText(`${inBar(b) + 1}+${j}/${d}`, L.margin + 1, top + 14);
    }

    // tile bed: faint pulse guides, stronger beat guides, red at bar lines
    c.fillStyle = P.soft;
    rr(c, L.margin, ty, rowW, L.tileH, 12);
    c.fill();
    for (let k = row.k0 + 1; k < row.k1; k++) {
      const t = times[k]!;
      const x = xAt(t);
      const onBeat = Math.abs(t - Math.round(t)) < EPS_D;
      if (!onBeat) {
        // zoomed far out, a guide for every pulse is only noise
        const b = Math.floor(t);
        if (bw / (pre[b + 1]! - pre[b]!) < 3) continue;
        c.fillStyle = P.line;
        c.fillRect(x - 0.5, ty + 8, 1, L.tileH - 16);
        continue;
      }
      const down = isDown(Math.round(t));
      c.fillStyle = down ? P.land : P.faint;
      c.globalAlpha = down ? 0.55 : 0.6;
      c.fillRect(x - (down ? 0.9 : 0.6), ty + 3, down ? 1.8 : 1.2, L.tileH - 6);
      c.globalAlpha = 1;
    }

    // subdivision band: a tick where every pulse begins; beats taller, bar lines red;
    // beats whose ratio differs are tinted, and a run of them is named once, where it starts,
    // in the lower half of the band (pulse ticks only use the upper half)
    c.fillStyle = P.soft;
    rr(c, L.margin, by, rowW, L.bandH, 7);
    c.fill();
    const ratioAt = (b: number) =>
      s.painting && s.painting.beats.has(b) ? s.painting.d : (sd[b] ?? 0);
    const labels: { x: number; text: string }[] = [];
    for (let gb = bFirst; gb <= bLast; gb++) {
      const painting = !!s.painting && s.painting.beats.has(gb);
      const d = ratioAt(gb);
      const odd = d !== common;
      if (odd || painting) {
        const x0 = xAt(Math.max(gb, row.b0));
        const x1 = xAt(Math.min(gb + 1, row.b0 + row.nb));
        c.fillStyle = P.accent;
        c.globalAlpha = painting ? 0.3 : 0.13;
        rr(c, x0 + 1, by, Math.max(0, x1 - x0 - 2), L.bandH, 6);
        c.fill();
        c.globalAlpha = 1;
        const startsRun = gb === 0 || ratioAt(gb - 1) !== d;
        if (startsRun && bw >= 26 && gb >= row.b0 - EPS_D)
          labels.push({ x: xAt(gb) + 4, text: `${d}:1` });
      }
      const kEnd = Math.min(pre[gb + 1]!, row.k1);
      const dense = bw / (pre[gb + 1]! - pre[gb]!) < 3;
      for (let k = Math.max(pre[gb]!, row.k0); k < kEnd; k++) {
        const t = times[k]!;
        const x = xAt(t);
        if (dense && k !== pre[gb]) continue;
        if (k === pre[gb]) {
          const down = isDown(gb);
          c.fillStyle = down ? P.land : P.fg;
          c.globalAlpha = down ? 1 : 0.55;
          c.fillRect(x - (down ? 1 : 0.75), by, down ? 2 : 1.5, L.bandH);
        } else {
          c.fillStyle = odd || painting ? P.fg : P.muted;
          c.globalAlpha = odd || painting ? 0.7 : 0.6;
          c.fillRect(x - 0.6, by, 1.2, L.bandH * 0.5);
        }
        c.globalAlpha = 1;
      }
    }
    c.fillStyle = P.accent;
    c.font = `700 10px ${MONO}`;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    for (const l of labels) c.fillText(l.text, l.x, by + L.bandH - 3);
    // closing tick at the end of the row (red on a bar line, a short pulse tick mid-beat)
    {
      const tEnd = row.b0 + row.nb;
      const onBeat = Math.abs(tEnd - Math.round(tEnd)) < EPS_D;
      const down = onBeat && isDown(Math.round(tEnd));
      c.fillStyle = down ? P.land : P.fg;
      c.globalAlpha = down ? 1 : 0.55;
      c.fillRect(
        xAt(tEnd) - (down ? 1 : 0.75),
        by,
        down ? 2 : 1.5,
        onBeat ? L.bandH : L.bandH * 0.5,
      );
      c.globalAlpha = 1;
    }
    // a manual break is marked at the left of its row, in the accent colour
    if (row.manual) {
      c.fillStyle = P.accent;
      c.fillRect(L.margin - 3, ty + 6, 2.5, L.tileH - 12);
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
        const p1x = L.margin + (seg.t1 - g.rows[seg.r]!.b0) * g.rows[seg.r]!.bw;
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
          // a start-repeat sign over the tile's beginning pushes the number past its dots
          const signHere = (doc.meter.repeatStarts ?? []).some(
            (t) => Math.abs(t - seg.t0) < EPS_D,
          );
          const lx = X + (W > 26 ? 8 : 4) + (signHere ? 15 : 0);
          c.fillText(seg.first ? String(x.n) : `…${x.n}`, lx, ty + L.tileH / 2);
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
        if (!on && g.rows[p.r]!.bw / maxD < 9) continue;
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

  /* ---------------- range, caret and playhead */
  const TSp = g.grid.TS;
  /** x and row of a pulse; at a row boundary the end of a range belongs to the row above. */
  const pulseAt = (k: number, attachLeft: boolean) => {
    const t = g.grid.times[E_clamp(k, 0, TSp)]!;
    const startsRow = rowStartingAt(g, t);
    if (attachLeft && startsRow > 0) return { x: rowEndX(g, startsRow - 1), r: startsRow - 1 };
    if (t >= g.grid.NB) return { x: rowEndX(g, g.R - 1), r: g.R - 1 };
    return xOf(g, t);
  };
  if (s.range) {
    // a translucent band over the selected pulses, row by row, with clear edges
    for (const seg of segments(g, s.range.a, s.range.b - s.range.a)) {
      const x0 = xOf(g, seg.t0).x;
      const x1 = L.margin + (seg.t1 - g.rows[seg.r]!.b0) * g.rows[seg.r]!.bw;
      const ty = tileY(g, seg.r);
      c.fillStyle = P.sel;
      c.globalAlpha = 0.16;
      c.fillRect(x0, ty - 4, x1 - x0, L.tileH + 8);
      c.globalAlpha = 1;
      if (seg.first) c.fillRect(x0 - 1, ty - 6, 2, L.tileH + 12);
      if (seg.last) c.fillRect(x1 - 1, ty - 6, 2, L.tileH + 12);
    }
  } else if (s.cursor !== null && s.selection.size === 0) {
    const k = s.cursor;
    const p = pulseAt(k, k >= TSp);
    const ty = tileY(g, p.r);
    c.fillStyle = P.sel;
    c.fillRect(p.x - 1.5, ty - 6, 3, L.tileH + 12);
    // small caps top and bottom, like a text caret
    c.fillRect(p.x - 4.5, ty - 7, 9, 2.5);
    c.fillRect(p.x - 4.5, ty + L.tileH + 4.5, 9, 2.5);
  }
  /* ---------------- metric modulation: section markers and the main tempo's ghost grid */
  const mainBar = doc.meter.beatsPerCycle;
  bm.sections.forEach((sec, si) => {
    if (si === 0) return;
    const p = xOf(g, sec.at);
    const top = rowTop(g, p.r);
    const tempo = s.mainTempo ? ` · ♩=${Math.round((s.mainTempo / sec.scale) * 10) / 10}` : '';
    const label = `${sec.from}:1 = ${sec.to}:1${tempo}`;
    c.font = `700 11px ${MONO}`;
    const w = c.measureText(label).width + 12;
    const fx = p.x + 12; // after the bar's "1"
    c.fillStyle = P.warn;
    rr(c, fx, top + 2, w, 15, 4);
    c.fill();
    c.fillStyle = P.card;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(label, fx + 6, top + 10);
  });
  if (bm.sections.length > 1) {
    // inside a modulated section, show where the main tempo's beats fall: bar lines as a dashed
    // red line through the tiles, other beats as small ticks under the band
    for (let r = 0; r < g.R; r++) {
      const row = g.rows[r]!;
      if (sectionAt(doc.meter, row.b0) === 0) continue;
      const m0 = toMain(doc.meter, row.b0);
      const m1 = toMain(doc.meter, row.b0 + row.nb);
      const ty = tileY(g, r);
      const by = ty + L.tileH + L.bandGap;
      for (let M = Math.ceil(m0 - 1e-9); M <= m1 + 1e-9; M++) {
        const t = fromMain(doc.meter, M);
        if (t < row.b0 - 1e-9 || t > row.b0 + row.nb + 1e-9) continue;
        const x = L.margin + (t - row.b0) * row.bw;
        const down = M % mainBar === 0;
        c.fillStyle = down ? P.land : P.muted;
        c.globalAlpha = down ? 0.75 : 0.6;
        if (down) {
          for (let y = ty - 2; y < ty + L.tileH + 2; y += 6) c.fillRect(x - 0.75, y, 1.5, 3);
          c.beginPath();
          c.moveTo(x - 4, by + L.bandH + 6);
          c.lineTo(x + 4, by + L.bandH + 6);
          c.lineTo(x, by + L.bandH);
          c.closePath();
          c.fill();
        } else c.fillRect(x - 0.6, by + L.bandH + 1, 1.2, 5);
        c.globalAlpha = 1;
      }
    }
  }

  /* ---------------- phrase marks: a flag and a line where a phrase starts */
  const marks = doc.meter.marks ?? [];
  marks.forEach((t, i) => {
    const p = xOf(g, Math.min(t, g.grid.NB - 1e-6));
    const top = rowTop(g, p.r);
    const ty = tileY(g, p.r);
    c.fillStyle = P.accent;
    const onBeatLine = Math.abs(t - Math.round(t)) < EPS_D;
    // on a beat the line starts under the beat number, so the number stays readable
    const lineTop = onBeatLine ? top + 17 : top + 2;
    c.fillRect(p.x - 1.25, lineTop, 2.5, ty - lineTop + L.tileH + 2);
    // the flag carries how far this phrase starts from the previous one; on a beat it starts
    // after the beat's number so the number stays readable
    const label = i === 0 ? '' : beatsLabel(t - marks[i - 1]!);
    const onBeat = Math.abs(t - Math.round(t)) < EPS_D;
    const fx = p.x + (onBeat ? 10 : 0);
    if (!label) {
      c.beginPath();
      c.moveTo(fx, top + 3);
      c.lineTo(fx + 9, top + 8);
      c.lineTo(fx, top + 13);
      c.closePath();
      c.fill();
      return;
    }
    c.font = `700 11px ${MONO}`;
    const w = c.measureText(label).width + 12;
    rr(c, fx, top + 2, w, 15, 4);
    c.fill();
    c.fillStyle = P.accentInk;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(label, fx + 6, top + 10);
  });

  drawForm(c, g, doc, P);

  if (s.playhead !== null) {
    const p = xOf(g, s.playhead);
    const ty = tileY(g, p.r);
    c.fillStyle = P.fg;
    c.fillRect(p.x - 1, ty - 4, 2, L.tileH + 8);
  }
}

/** Where an end-type sign at time t sits: at the end of the row before when t starts a row. */
export function endPoint(g: Geo, t: number): { x: number; r: number } {
  const r = rowOf(g, t - 1e-6);
  const row = g.rows[r]!;
  return { x: L.margin + (t - row.b0) * row.bw, r };
}

/**
 * Repeat signs through the tiles (thick and thin bar with two dots, drawn over a card-coloured
 * halo so they read on any tile), "×3" counts and ending brackets in the lane above the rows.
 */
function drawForm(c: CanvasRenderingContext2D, g: Geo, doc: Doc, P: Palette): void {
  const { repeatStarts = [], repeatEnds = [], voltas = [] } = doc.meter;
  const sign = (x: number, r: number, dir: 1 | -1) => {
    const ty = tileY(g, r);
    const y0 = ty - 3;
    const h = L.tileH + 6;
    const bars: [number, number][] = [
      [0, 3.5],
      [6, 1.5],
    ];
    const dots = [ty + L.tileH * 0.36, ty + L.tileH * 0.64];
    for (const [colour, grow] of [
      [P.card, 1.5],
      [P.fg, 0],
    ] as const) {
      c.fillStyle = colour;
      for (const [off, w] of bars) {
        const x0 = dir === 1 ? x + off : x - off - w;
        c.fillRect(x0 - grow, y0 - grow, w + 2 * grow, h + 2 * grow);
      }
      for (const dy of dots) {
        c.beginPath();
        c.arc(x + dir * 12.5, dy, 2.4 + grow, 0, Math.PI * 2);
        c.fill();
      }
    }
  };
  for (const t of repeatStarts) {
    const p = xOf(g, t);
    sign(p.x, p.r, 1);
  }
  for (const e of repeatEnds) {
    const p = endPoint(g, e.at);
    sign(p.x, p.r, -1);
    if (e.times > 2 && g.lane) {
      c.font = `700 12px ${MONO}`;
      c.fillStyle = P.fg;
      c.textAlign = 'right';
      c.textBaseline = 'middle';
      // just left of the sign, under a closing ending bracket's line and clear of its hook
      c.fillText(`×${e.times}`, p.x - 7, rowTop(g, p.r) - g.lane + 11);
    }
  }
  if (!g.lane) return;
  const closes = (b: number) => repeatEnds.some((e) => Math.abs(e.at - b) < EPS_D);
  for (const v of voltas) {
    const ra = rowOf(g, v.a);
    const rb = rowOf(g, v.b - 1e-6);
    for (let r = ra; r <= rb; r++) {
      const row = g.rows[r]!;
      const t0 = Math.max(v.a, row.b0);
      const t1 = Math.min(v.b, row.b0 + row.nb);
      const x0 = L.margin + (t0 - row.b0) * row.bw + (r === ra ? 2 : 0);
      const x1 = L.margin + (t1 - row.b0) * row.bw - (r === rb ? 2 : 0);
      const top = rowTop(g, r) - g.lane + 2;
      const bottom = rowTop(g, r) - 1;
      c.fillStyle = P.fg;
      c.fillRect(x0, top, x1 - x0, 1.5);
      if (r === ra) {
        c.fillRect(x0, top, 1.5, bottom - top);
        c.font = `700 11px ${BODY}`;
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(passesLabel(v.passes), x0 + 5, top + 8.5);
      }
      // a first ending closes where its repeat sign is; the last one stays open
      if (r === rb && closes(v.b)) c.fillRect(x1 - 1.5, top, 1.5, bottom - top);
    }
  }
}
