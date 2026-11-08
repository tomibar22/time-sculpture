import { useCallback, useEffect, useRef } from 'react';
import * as E from '../engine';
import type { Doc, ItemId, OpResult } from '../engine';
import { ui as sfx } from '../audio/voices';
import {
  announce,
  flash,
  paintSubdivision,
  reportSlide,
  run,
  select,
  splitSelection,
  toast,
} from '../state/actions';
import { setCaret, setRange } from '../state/editing';
import { useDocStore, useUiStore } from '../state/store';
import { readPalette } from './colors';
import type { Palette } from './colors';
import { drawScore } from './draw';
import { geometry, hit, hitBoundary, hitTrimGrip, itemAt, slotAt } from './geometry';
import type { Boundary, Geo } from './geometry';
import { normalizeRows } from './rows';

const LONG_PRESS_MS = 450;
const DOUBLE_TAP_MS = 330;
const DRAG_THRESHOLD = 8;

type Gesture =
  | { kind: 'lane'; beats: Set<number> }
  | { kind: 'boundary'; b: Boundary; base: Doc; result: OpResult | null }
  | {
      kind: 'trim';
      base: Doc;
      id: ItemId;
      side: 'start' | 'end';
      edge: number;
      result: OpResult | null;
      delta: number;
    }
  | {
      kind: 'press';
      id: ItemId;
      x0: number;
      y0: number;
      mods: { shift: boolean; toggle: boolean };
      long: boolean;
      timer: number;
    }
  | {
      kind: 'slide';
      base: Doc;
      ids: ItemId[];
      s0: number;
      offT: number;
      delta: number;
      result: OpResult | null;
    }
  | { kind: 'place'; base: Doc; ids: ItemId[]; result: OpResult | null }
  | { kind: 'empty'; slot: number | null };

const ui = () => useUiStore.getState();
const setUi = (p: Parameters<ReturnType<typeof useUiStore.getState>['set']>[0]) => ui().set(p);
const activeDoc = () => ui().preview ?? useDocStore.getState().doc;

export function Score() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const hover = useRef<string | null>(null);
  const palette = useRef<Palette | null>(null);
  const geo = useRef<Geo | null>(null);
  const width = useRef(0);
  const frame = useRef(0);
  const lastTap = useRef<{ id: ItemId | null; t: number }>({ id: null, t: 0 });

  const draw = useCallback(() => {
    frame.current = 0;
    const cv = canvasRef.current;
    if (!cv || !width.current) return;
    const s = ui();
    const doc = activeDoc();
    const g = geometry(width.current, doc, normalizeRows(s.rows, doc.meter.cycles, s.perRow));
    geo.current = g;
    const dpr = window.devicePixelRatio || 1;
    if (cv.style.height !== `${g.h}px`) cv.style.height = `${g.h}px`;
    const W = Math.round(g.w * dpr);
    const H = Math.round(g.h * dpr);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    const c = cv.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    palette.current ??= readPalette();
    const now = performance.now();
    const flashAlpha = s.flash.until > now ? (s.flash.until - now) / 1600 : 0;
    const gs = gesture.current;
    drawScore(
      c,
      g,
      {
        doc,
        selection: new Set(s.selection),
        lifted: new Set(s.lifted),
        painting: gs?.kind === 'lane' ? { beats: gs.beats, d: s.brush } : null,
        activeBoundary: gs?.kind === 'boundary' ? gs.b.key : null,
        hoverBoundary: hover.current,
        showHandles: gs?.kind !== 'slide' && gs?.kind !== 'place',
        cursor: s.caret,
        range: s.range,
        playhead: s.playhead,
        flash: { ids: new Set(s.flash.ids), alpha: flashAlpha },
        focusedId: s.focusedId,
        grips:
          s.selection.length === 1 && gs?.kind !== 'slide' && gs?.kind !== 'place'
            ? s.selection[0]!
            : null,
        activeGrip: gs?.kind === 'trim' ? gs.side : null,
      },
      palette.current,
    );
    if (flashAlpha > 0) request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const request = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  }, [draw]);

  /* redraw on any store change, resize, theme change, fonts */
  useEffect(() => {
    const unsubs = [useDocStore.subscribe(request), useUiStore.subscribe(request)];
    const cv = canvasRef.current!;
    const ro = new ResizeObserver((entries) => {
      width.current = entries[0]!.contentRect.width;
      request();
    });
    ro.observe(cv.parentElement!);
    const retheme = () => {
      palette.current = null;
      request();
    };
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', retheme);
    const mo = new MutationObserver(retheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    void document.fonts?.ready.then(request);
    return () => {
      unsubs.forEach((u) => u());
      ro.disconnect();
      mq.removeEventListener('change', retheme);
      mo.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [request]);

  const point = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  /* ---------------------------------------------------------------- pointer down */
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const g = geo.current;
    if (!g) return;
    const [x, y] = point(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    const doc = useDocStore.getState().doc;
    const h = hit(g, x, y);
    // Shift-click with a caret or range (and no tiles selected) selects a pulse range, like text;
    // ⌥-click puts the caret on any pulse, even inside a tile
    const st = ui();
    if (h.zone === 'tiles' && !h.outside && !st.selection.length) {
      if (e.shiftKey && (st.caret !== null || st.range)) {
        setRange(st.rangeAnchor ?? st.caret ?? 0, E.clamp(slotAt(g, x, y), 0, g.grid.TS));
        return;
      }
      if (e.altKey) {
        sfx.snap();
        setCaret(slotAt(g, x, y));
        return;
      }
    }
    if (h.zone === 'lane') {
      gesture.current = { kind: 'lane', beats: new Set([h.beat]) };
      request();
      return;
    }
    const touch = e.pointerType === 'touch';
    // a single selected group shows trim grips on its edges; they win over the line handles
    const sel = E.selectedIndices(doc.items, ui().selection);
    if (sel.length === 1) {
      const si = sel[0]!;
      const side = hitTrimGrip(g, doc.items, si, x, y, touch);
      if (side) {
        const s0 = E.startOf(doc.items, si);
        gesture.current = {
          kind: 'trim',
          base: doc,
          id: doc.items[si]!.id,
          side,
          edge: side === 'end' ? s0 + doc.items[si]!.n : s0,
          result: null,
          delta: 0,
        };
        sfx.lift();
        request();
        return;
      }
    }
    const b = hitBoundary(g, doc.items, x, y, touch);
    if (b) {
      gesture.current = { kind: 'boundary', b, base: doc, result: null };
      request();
      return;
    }
    const i = itemAt(g, doc.items, x, y);
    const item = doc.items[i];
    if (!item || E.isSpace(item)) {
      gesture.current = { kind: 'empty', slot: item ? slotAt(g, x, y) : null };
      return;
    }
    const mods = { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey };
    const timer = window.setTimeout(() => {
      const gs = gesture.current;
      if (gs?.kind !== 'press' || gs.id !== item.id) return;
      gs.long = true;
      const sel = ui().selection;
      setUi({
        multi: true,
        selection: sel.includes(item.id) ? sel : [...sel, item.id],
        anchor: item.id,
      });
      sfx.lift();
      announce('Selecting several. Tap more groups.');
    }, LONG_PRESS_MS);
    gesture.current = { kind: 'press', id: item.id, x0: x, y0: y, mods, long: false, timer };
  };

  /* ---------------------------------------------------------------- pointer move */
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = geo.current;
    if (!g) return;
    const [x, y] = point(e);
    const gs = gesture.current;
    const cv = e.currentTarget;

    if (!gs) {
      const doc = useDocStore.getState().doc;
      const h = hit(g, x, y);
      const sel = E.selectedIndices(doc.items, ui().selection);
      const grip =
        h.zone === 'tiles' && sel.length === 1 ? hitTrimGrip(g, doc.items, sel[0]!, x, y) : null;
      const b = h.zone === 'tiles' && !grip ? hitBoundary(g, doc.items, x, y) : null;
      const i = itemAt(g, doc.items, x, y);
      cv.style.cursor =
        h.zone === 'lane'
          ? 'cell'
          : b || grip
            ? 'ew-resize'
            : i >= 0 && !E.isSpace(doc.items[i]!)
              ? 'grab'
              : 'default';
      const key = b?.key ?? null;
      if (key !== hover.current) {
        hover.current = key;
        request();
      }
      return;
    }

    if (gs.kind === 'lane') {
      const beat = hit(g, x, y).beat;
      if (!gs.beats.has(beat)) {
        gs.beats.add(beat);
        request();
      }
      return;
    }

    if (gs.kind === 'boundary') {
      const { base, b } = gs;
      const k = slotAt(g, x, y);
      const s0 = E.startOf(base.items, b.i);
      const item = base.items[b.i]!;
      let result: OpResult;
      if (b.kind === 'line') {
        const total = item.n + base.items[b.i + 1]!.n;
        result = E.reshapeLine(base, item.id, E.clamp(k - s0, 1, total - 1));
      } else {
        result = E.stretchEdge(base, item.id, b.kind === 'edgeR' ? k - s0 : s0 + item.n - k);
      }
      const prev = gs.result?.report.ok ? gs.result.doc : base;
      const nextDoc = result.report.ok ? result.doc : base;
      if (nextDoc !== prev) {
        gs.result = result.report.ok ? result : null;
        setUi({ preview: nextDoc });
        sfx.snap();
        const it = nextDoc.items[b.i];
        if (b.kind === 'line' && it) announce(`${it.n} and ${nextDoc.items[b.i + 1]!.n}`);
        else if (it) announce(`${it.n}, ${E.freePulses(nextDoc)} open`);
      }
      return;
    }

    if (gs.kind === 'press') {
      if (Math.hypot(x - gs.x0, y - gs.y0) <= DRAG_THRESHOLD) return;
      clearTimeout(gs.timer);
      if (gs.long) return; // long-press then move: stay in selection mode, no drag
      const base = useDocStore.getState().doc;
      let sel = ui().selection;
      if (!sel.includes(gs.id)) {
        sel = [gs.id];
        setUi({ selection: sel, anchor: gs.id });
      }
      const idx = E.selectedIndices(base.items, sel);
      const ids = idx.map((i) => base.items[i]!.id);
      const mode = ui().moveMode;
      sfx.lift();
      cv.style.cursor = 'grabbing';
      if (mode !== 'place' && E.isContiguous(idx)) {
        const s0 = E.startOf(base.items, idx[0]!);
        gesture.current = {
          kind: 'slide',
          base,
          ids,
          s0,
          offT: hit(g, gs.x0, gs.y0).t - g.grid.times[s0]!,
          delta: 0,
          result: null,
        };
      } else {
        if (mode !== 'place')
          toast('Moving on the grid needs neighbouring groups, so this drag reorders instead.');
        gesture.current = { kind: 'place', base, ids, result: null };
      }
      setUi({ lifted: ids, preview: base });
      return onPointerMove(e);
    }

    if (gs.kind === 'trim') {
      const { base, id, side, edge } = gs;
      const gridB = E.buildGrid(base.meter);
      const t = hit(g, x, y).t;
      // Beat mode moves the edge from beat line to beat line
      const k =
        ui().moveMode === 'beat'
          ? gridB.pre[E.clamp(Math.round(t), 0, gridB.NB)]!
          : E.nearestPulse(gridB, E.clamp(t, 0, gridB.NB));
      const delta = side === 'end' ? k - edge : edge - k;
      if (delta === gs.delta) return;
      gs.delta = delta;
      const r = E.trimEdge(base, id, side, delta);
      gs.result = r.report.ok ? r : null;
      setUi({ preview: gs.result?.doc ?? base });
      sfx.snap();
      const it = (gs.result?.doc ?? base).items.find((z) => z.id === id);
      if (it) announce(`${it.n} pulses`);
      return;
    }

    if (gs.kind === 'slide') {
      const { base, ids, s0 } = gs;
      const t = hit(g, x, y).t - gs.offT;
      const gridB = E.buildGrid(base.meter);
      const target =
        ui().moveMode === 'beat'
          ? gridB.pre[E.clamp(Math.round(t), 0, gridB.NB)]!
          : E.nearestPulse(gridB, E.clamp(t, 0, gridB.NB));
      const d = E.clampSlide(base, ids, target - s0);
      if (d === gs.delta) return;
      gs.delta = d;
      gs.result = d ? E.slide(base, ids, d) : null;
      setUi({ preview: gs.result?.doc ?? base });
      sfx.snap();
      announce(`${d > 0 ? '+' : ''}${plural(d)}`);
      return;
    }

    if (gs.kind === 'place') {
      const { base, ids } = gs;
      const r = E.reorderAtPulse(base, ids, slotAt(g, x, y));
      const nextDoc = r.report.ok ? r.doc : base;
      if (
        nextDoc.items.map((z) => z.id).join() !==
        activeDoc()
          .items.map((z) => z.id)
          .join()
      ) {
        gs.result = r.report.ok ? r : null;
        setUi({ preview: nextDoc });
        sfx.snap();
      }
    }
  };

  /* ---------------------------------------------------------------- pointer up */
  const end = (cancelled: boolean) => {
    const gs = gesture.current;
    gesture.current = null;
    if (!gs) return;
    const clearDrag = () => setUi({ preview: null, lifted: [] });

    if (gs.kind === 'lane') {
      request();
      if (!cancelled) paintSubdivision([...gs.beats]);
      return;
    }
    if (gs.kind === 'boundary') {
      clearDrag();
      if (cancelled) return;
      if (!gs.result) {
        // a tap on a line or an edge places the text caret there
        sfx.snap();
        setCaret(gs.b.slot);
        return;
      }
      const it = gs.result.doc.items[gs.b.i];
      run(gs.result, {
        label: gs.b.kind === 'line' ? 'reshape' : `stretch ${it ? E.describeItem(it) : ''}`,
        select: 'keep',
      });
      return;
    }
    if (gs.kind === 'trim') {
      clearDrag();
      if (cancelled) return;
      if (!gs.result) {
        // a tap on a grip without dragging behaves like a tap on the tile
        select(gs.id);
        return;
      }
      if (run(gs.result, { label: `trim ${gs.side}`, select: [gs.id], sound: sfx.drop })) {
        const r = gs.result.report;
        flash(r.shortened);
        const parts: string[] = [];
        if (r.shortened.length) parts.push(`${plural(r.shortened.length, 'group')} shortened`);
        if (r.covered.length) parts.push(`${plural(r.covered.length, 'group')} covered`);
        if (parts.length) toast(`Trimmed. ${parts.join(', ')}.`, { undo: true });
      }
      return;
    }
    if (gs.kind === 'slide') {
      clearDrag();
      if (cancelled || !gs.result) return;
      if (
        run(gs.result, {
          label: `slide ${gs.delta > 0 ? '+' : ''}${gs.delta}`,
          select: gs.ids,
          sound: sfx.drop,
        })
      )
        reportSlide(gs.result.report, gs.delta);
      return;
    }
    if (gs.kind === 'place') {
      clearDrag();
      if (cancelled || !gs.result) return;
      const desc = gs.ids
        .map((id) => E.findItem(gs.base, id))
        .filter((z): z is E.Item => !!z)
        .map(E.describeItem)
        .join(' ');
      if (run(gs.result, { label: `move ${desc}`, select: gs.ids, sound: sfx.drop })) {
        announce(`Moved ${plural(gs.ids.length, 'group')}`);
        if (new Set(gs.base.meter.subdivision).size > 1)
          toast(
            'Moved. Lengths are kept in pulses, so a group can take more or less time under another subdivision.',
          );
      }
      return;
    }
    if (gs.kind === 'press') {
      clearTimeout(gs.timer);
      if (cancelled || gs.long) return;
      const now = performance.now();
      const { multi } = ui();
      if (
        lastTap.current.id === gs.id &&
        now - lastTap.current.t < DOUBLE_TAP_MS &&
        !gs.mods.shift &&
        !gs.mods.toggle &&
        !multi
      ) {
        lastTap.current = { id: null, t: 0 };
        setUi({ selection: [gs.id], anchor: gs.id });
        splitSelection();
        return;
      }
      lastTap.current = { id: gs.id, t: now };
      select(gs.id, gs.mods);
      return;
    }
    if (gs.kind === 'empty' && !cancelled && !ui().multi) {
      if (gs.slot === null) return setUi({ selection: [], anchor: null });
      // a tap in the open space puts the caret on that pulse
      sfx.snap();
      setCaret(gs.slot);
    }
  };

  return (
    <div className="score-wrap">
      <canvas
        ref={canvasRef}
        className="score"
        data-testid="score"
        tabIndex={0}
        aria-label="Score. Drag a group to move it, drag a line to reshape, tap to select, shift-click to select several, drag the grips of a selected group to trim it, paint the dotted band under a row to change subdivision. Use the group list after this for keyboard and screen reader access."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => end(false)}
        onPointerCancel={() => end(true)}
        onPointerLeave={() => {
          if (!gesture.current && hover.current) {
            hover.current = null;
            request();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}

function plural(d: number, word = 'pulse') {
  const n = Math.abs(d);
  return `${d} ${n === 1 ? word : `${word}s`}`;
}
