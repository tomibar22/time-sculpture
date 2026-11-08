import * as E from '../engine';
import type { Doc } from '../engine';
import { PRINT_PALETTE } from '../score/colors';
import { drawScore } from '../score/draw';
import { geometry, L, rowTop } from '../score/geometry';
import { buildPdf, canvasRgb } from './pdfWriter';

/**
 * A printed score sheet: title, meter and tempo, the phrase in words, the score rows in a quiet
 * print palette (no handles, caret or selection), a small legend, and page numbers. A4 portrait.
 */

const PAGE = { w: 595.28, h: 841.89 }; // points
const PX_PER_PT = 3; // ≈ 216 dpi: crisp on paper, light enough for phones
const M = { x: 50, top: 56, bottom: 50 };
/** Logical width the score is laid out at before it is scaled onto the page. */
const SCORE_W = 720;

const FONT = {
  title: '700 26px "Bricolage Grotesque", "Avenir Next", system-ui, sans-serif',
  body: '400 10.5px "Atkinson Hyperlegible", system-ui, sans-serif',
  bodyBold: '700 10.5px "Atkinson Hyperlegible", system-ui, sans-serif',
  small: '400 8.5px "Atkinson Hyperlegible", system-ui, sans-serif',
  mono: '500 11px "IBM Plex Mono", ui-monospace, monospace',
};

export interface SheetInput {
  doc: Doc;
  title: string;
  tempo: number;
  perRow: number;
}

function newPage(): { canvas: HTMLCanvasElement; c: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE.w * PX_PER_PT);
  canvas.height = Math.round(PAGE.h * PX_PER_PT);
  const c = canvas.getContext('2d')!;
  c.setTransform(PX_PER_PT, 0, 0, PX_PER_PT, 0, 0);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, PAGE.w, PAGE.h);
  return { canvas, c };
}

/** Wrap text into lines that fit `width` (breaking at spaces). */
function wrap(c: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (c.measureText(next).width > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Render the sheet as page canvases. */
export async function renderSheet(input: SheetInput): Promise<HTMLCanvasElement[]> {
  await Promise.all([
    document.fonts?.load(FONT.title),
    document.fonts?.load(FONT.body),
    document.fonts?.load(FONT.bodyBold),
    document.fonts?.load(FONT.mono),
  ]);
  const { doc, title } = input;
  const P = PRINT_PALETTE;
  const contentW = PAGE.w - 2 * M.x;
  const scale = contentW / SCORE_W;
  const g = geometry(SCORE_W, doc, input.perRow);
  const rowH = g.stride * scale;
  const footerY = PAGE.h - M.bottom + 22;

  const pages: HTMLCanvasElement[] = [];
  let { canvas, c } = newPage();

  /* ---------------- header (first page) */
  let y = M.top;
  c.fillStyle = P.fg;
  c.font = FONT.title;
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  for (const line of wrap(c, title || 'Untitled', contentW)) {
    y += 26;
    c.fillText(line, M.x, y);
  }
  y += 18;
  const grid = E.buildGrid(doc.meter);
  const mix = [...new Set(doc.meter.subdivision)].sort((a, b) => a - b);
  const meta = [
    `${doc.meter.beatsPerCycle} beats × ${doc.meter.cycles} bar${doc.meter.cycles === 1 ? '' : 's'}`,
    mix.map((d) => `${d}:1`).join(' '),
    `${grid.TS} pulses`,
  ].join('   ·   ');
  c.font = FONT.body;
  c.fillStyle = P.muted;
  c.fillText(meta, M.x, y);

  y += 14;
  c.fillStyle = P.line;
  c.fillRect(M.x, y, contentW, 0.75);
  y += 18;

  /* ---------------- score rows, as many per page as fit */
  const finishPage = (n: number) => {
    c.font = FONT.small;
    c.fillStyle = P.faint;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.fillText(`${title || 'Untitled'} · Time Sculpture`, M.x, footerY);
    c.textAlign = 'right';
    c.fillText(`${n}`, PAGE.w - M.x, footerY);
    pages.push(canvas);
  };

  const state = {
    doc,
    selection: new Set<string>(),
    lifted: new Set<string>(),
    painting: null,
    activeBoundary: null,
    hoverBoundary: null,
    showHandles: false,
    cursor: null,
    playhead: null,
    flash: { ids: new Set<string>(), alpha: 0 },
    focusedId: null,
    grips: null,
    activeGrip: null,
    noClear: true,
  };

  let r = 0;
  while (r < g.R) {
    const fit = Math.max(1, Math.floor((PAGE.h - M.bottom - y + L.gapR * scale) / rowH));
    const last = Math.min(g.R, r + fit);
    c.save();
    c.translate(M.x, y);
    c.scale(scale, scale);
    c.translate(0, -rowTop(g, r) + L.top);
    c.beginPath();
    c.rect(-4, rowTop(g, r) - L.top, g.w + 8, (last - r) * g.stride);
    c.clip();
    drawScore(c, g, state, P);
    c.restore();
    y += (last - r) * rowH;
    r = last;
    if (r < g.R) {
      finishPage(pages.length + 1);
      ({ canvas, c } = newPage());
      y = M.top;
    }
  }

  finishPage(pages.length + 1);
  return pages;
}

/** The sheet as a PDF file. */
export async function sheetPdf(input: SheetInput): Promise<Blob> {
  const canvases = await renderSheet(input);
  const pdf = await buildPdf(canvases.map(canvasRgb), { title: input.title || 'Untitled' });
  return new Blob([pdf as BlobPart], { type: 'application/pdf' });
}
