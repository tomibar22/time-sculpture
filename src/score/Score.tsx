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
import { diveAt, zoomStep } from '../state/zoom';
import { OVERVIEW_LEVELS, zoomLevels } from './rows';
import { anchorAtPoint, restoreAnchor, view } from './view';
import { useDocStore, useUiStore } from '../state/store';
import type { BuildDir } from '../state/store';
import { buildReveal } from '../state/stage';
import { readPalette } from './colors';
import type { Palette } from './colors';
import { drawScore } from './draw';
import {
  geometry,
  hit,
  edgeSlot,
  hitBoundary,
  hitTrimGrip,
  itemAt,
  L,
  rowOf,
  rowTop,
  slotAt,
  totalAt,
  xOf,
} from './geometry';
import type { Boundary, Geo } from './geometry';

const LONG_PRESS_MS = 450;
/** How long a group's entrance lasts in a stage build. */
const POP_MS = 650;
const reveal = (doc: Doc, step: number, dir: BuildDir) => {
  const r = buildReveal(doc, dir, step);
  return { a: r.a, b: r.b };
};
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
  | { kind: 'empty'; slot: number | null }
  /** Press and drag to select a pulse range, like selecting text (a tap places the caret). */
  | { kind: 'sweep'; anchor: number; x0: number; y0: number; moved: boolean; tap: () => void };

const ui = () => useUiStore.getState();
const setUi = (p: Parameters<ReturnType<typeof useUiStore.getState>['set']>[0]) => ui().set(p);
const activeDoc = () => ui().preview ?? useDocStore.getState().doc;

/**
 * The overview's bars per row: the closest zoom (never closer than the current one) at which the
 * whole piece fits between the top of the screen and the dock.
 */
function overviewPer(width: number, doc: Doc, perRow: number, fit: boolean): number {
  // on the stage only its title line takes room (its controls fade while playing)
  const below = ui().stage
    ? (document.querySelector<HTMLElement>('.stage-head')?.offsetHeight ?? 0)
    : (document.querySelector<HTMLElement>('.dock')?.offsetHeight ?? 0);
  const room = window.innerHeight - below - 24;
  const ls = zoomLevels(doc.meter.beatsPerCycle, doc.meter.cycles, OVERVIEW_LEVELS).filter(
    (z) => z >= perRow - 1e-9,
  );
  for (const z of ls) if (geometry(width, doc, z, fit).h <= room) return z;
  return ls[ls.length - 1] ?? perRow;
}

export function Score() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const hover = useRef<string | null>(null);
  const palette = useRef<Palette | null>(null);
  const geo = useRef<Geo | null>(null);
  const width = useRef(0);
  const frame = useRef(0);
  const lastTap = useRef<{ id: ItemId | null; t: number }>({ id: null, t: 0 });
  /** Fingers on the score, and a pinch in progress (its last distance). */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number } | null>(null);
  /** Safari's own pinch events (iOS, macOS trackpads) take over from the pointer pinch. */
  const gestureEvents = useRef(false);
  /** A finger lifted: false while a pinch is still winding down (no tap or drag then). */
  const twoFingers = useRef(false);
  const lift = (id: number) => {
    pointers.current.delete(id);
    if (!twoFingers.current) return true;
    if (!pointers.current.size) {
      twoFingers.current = false;
      pinch.current = null;
    }
    return false;
  };

  const draw = useCallback(() => {
    frame.current = 0;
    const cv = canvasRef.current;
    if (!cv || !width.current) return;
    const s = ui();
    const doc = activeDoc();
    // the overview fits everything above the dock; otherwise the zoom (bars per row)
    const per = s.overview ? overviewPer(width.current, doc, s.perRow, s.fitRows) : s.perRow;
    view.overviewPer = s.overview ? per : null;
    const g = geometry(width.current, doc, per, s.fitRows);
    geo.current = g;
    view.geo = g;
    view.canvas = cv;
    const dpr = window.devicePixelRatio || 1;
    if (cv.style.height !== `${g.h}px`) cv.style.height = `${g.h}px`;
    // after a zoom: keep the point that was in focus where it was on the screen
    restoreAnchor(g, cv);
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
    const popAlpha = s.buildPop ? Math.max(0, 1 - (now - s.buildPop.at) / POP_MS) : 0;
    const gs = gesture.current;
    const stage = s.stage;
    drawScore(
      c,
      g,
      {
        doc,
        stage,
        selection: new Set(stage ? [] : s.selection),
        lifted: new Set(s.lifted),
        painting: gs?.kind === 'lane' ? { beats: gs.beats, d: s.brush } : null,
        activeBoundary: gs?.kind === 'boundary' ? gs.b.key : null,
        hoverBoundary: hover.current,
        showHandles: !stage && gs?.kind !== 'slide' && gs?.kind !== 'place',
        mainTempo: s.tempo,
        cursor: stage ? null : s.caret,
        range: stage ? null : s.range,
        playhead: s.playhead,
        flash: { ids: new Set(s.flash.ids), alpha: flashAlpha },
        focusedId: stage ? null : s.focusedId,
        grips:
          !stage && s.selection.length === 1 && gs?.kind !== 'slide' && gs?.kind !== 'place'
            ? s.selection[0]!
            : null,
        activeGrip: gs?.kind === 'trim' ? gs.side : null,
        reveal:
          stage && s.build && !s.playing ? reveal(doc, s.build.step, s.stagePrefs.buildDir) : null,
        pop: stage && s.build && popAlpha > 0 ? { id: s.buildPop!.id, alpha: popAlpha } : null,
      },
      palette.current,
    );
    if (flashAlpha > 0 || popAlpha > 0) request();
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

  /* pinch on a trackpad (⌘/Ctrl + wheel) and Safari's pinch events; resizes refit the overview */
  useEffect(() => {
    const cv = canvasRef.current!;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); // not the browser's page zoom
      acc += e.deltaY;
      if (Math.abs(acc) < 40) return;
      zoomStep(acc < 0 ? 1 : -1, anchorAtPoint(e.clientX, e.clientY));
      acc = 0;
    };
    let scale = 1;
    type GestureEvt = Event & { scale: number; clientX: number; clientY: number };
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureEvents.current = true;
      twoFingers.current = true;
      pinch.current = null;
      scale = 1;
      end(true);
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as GestureEvt;
      const ratio = ge.scale / scale;
      if (ratio > 1.25 || ratio < 0.8) {
        zoomStep(ratio > 1 ? 1 : -1, anchorAtPoint(ge.clientX, ge.clientY));
        scale = ge.scale;
      }
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      pinch.current = null;
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('gesturestart', onGestureStart);
    cv.addEventListener('gesturechange', onGestureChange);
    cv.addEventListener('gestureend', onGestureEnd);
    window.addEventListener('resize', request);
    return () => {
      cv.removeEventListener('wheel', onWheel);
      cv.removeEventListener('gesturestart', onGestureStart);
      cv.removeEventListener('gesturechange', onGestureChange);
      cv.removeEventListener('gestureend', onGestureEnd);
      window.removeEventListener('resize', request);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* keep the caret, range or selection in view above the dock (on phones the dock is tall) */
  useEffect(() => {
    let raf = 0;
    const keepInView = () => {
      const g = geo.current;
      const cv = canvasRef.current;
      if (!g || !cv || gesture.current) return;
      const s = ui();
      const span =
        s.range ??
        (s.caret !== null
          ? { a: s.caret, b: s.caret }
          : E.spanOf(useDocStore.getState().doc, s.selection));
      if (!span) return;
      const t = (k: number) => g.grid.times[E.clamp(k, 0, g.grid.TS)]!;
      const r0 = rowOf(g, t(span.a));
      const r1 = Math.max(r0, rowOf(g, t(Math.max(span.a, span.b - 1))));
      const box = cv.getBoundingClientRect();
      const top = box.top + rowTop(g, r0) - 8;
      const bottom = box.top + rowTop(g, r1) + L.numH + L.gap1 + L.tileH + 8; // the tiles
      const dock = document.querySelector<HTMLElement>('.dock');
      const limit = window.innerHeight - (dock?.offsetHeight ?? 0) - 8;
      let dy = bottom > limit ? bottom - limit : 0;
      if (top - dy < 8) dy = top - 8; // when it cannot all fit, its first row wins
      if (Math.abs(dy) < 2) return;
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollBy({ top: dy, behavior: still ? 'auto' : 'smooth' });
    };
    const soon = () => {
      cancelAnimationFrame(raf);
      // after React has re-rendered the dock and the score has been laid out
      raf = requestAnimationFrame(() => (raf = requestAnimationFrame(keepInView)));
    };
    const unsub = useUiStore.subscribe((s, p) => {
      if (s.caret === p.caret && s.range === p.range && s.selection === p.selection) return;
      soon();
    });
    // the dock grows (a panel opens, the bar changes): keep what you work on above it
    const dock = document.querySelector('.dock');
    let lastH = -1;
    const ro = new ResizeObserver(() => {
      if (ui().overview) request(); // the overview fits above the dock
      const h = (dock as HTMLElement | null)?.offsetHeight ?? 0;
      if (h > lastH && lastH >= 0) soon();
      lastH = h;
    });
    if (dock) ro.observe(dock);
    return () => {
      unsub();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [request]);

  /*
   * Stage: follow the playhead. When it moves to another row, scroll so that row sits near the
   * top, with the row before it still in view when there is room, like turning a page early.
   */
  useEffect(() => {
    let lastRow = -1;
    const follow = (s: ReturnType<typeof ui>) => {
      const g = geo.current;
      const cv = canvasRef.current;
      // what to keep in view: the playhead, or in a build the group that appears next to the rest
      let focus = s.playhead;
      if (focus === null && s.stage && s.build) {
        const rv = buildReveal(useDocStore.getState().doc, s.stagePrefs.buildDir, s.build.step);
        focus = s.stagePrefs.buildDir === 'start' ? Math.max(0, rv.b - 1e-6) : rv.a;
      }
      if (!s.stage || focus === null || !g || !cv) return void (lastRow = -1);
      const r = rowOf(g, Math.min(focus, g.grid.NB - 1e-6));
      if (r === lastRow) return;
      lastRow = r;
      const head = document.querySelector<HTMLElement>('.stage-head')?.offsetHeight ?? 0;
      const room = window.innerHeight - head;
      const context = room >= 3 * g.stride && r > 0 ? 1 : 0;
      const pageTop = cv.getBoundingClientRect().top + window.scrollY;
      // the top row in view sits under the title line (at the top: the title is shown)
      const top = r - context <= 0 ? 0 : pageTop + rowTop(g, r - context) - g.lane - head - 8;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = E.clamp(top, 0, Math.max(0, max));
      if (Math.abs(y - window.scrollY) < 2) return;
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: y, behavior: still ? 'auto' : 'smooth' });
    };
    return useUiStore.subscribe((s, p) => {
      if (
        s.playhead !== p.playhead ||
        s.stage !== p.stage ||
        s.build !== p.build ||
        s.stagePrefs !== p.stagePrefs
      )
        follow(s);
    });
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  /* ---------------------------------------------------------------- pointer down */
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const g = geo.current;
    if (!g) return;
    // a new first touch: any earlier fingers are gone (even if a lift was never reported)
    if (e.isPrimary) {
      pointers.current.clear();
      twoFingers.current = false;
      pinch.current = null;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // a second finger: whatever the first one started is undone, and nothing edits until every
    // finger is up; the fingers zoom (with our own pinch, or Safari's pinch events)
    if (pointers.current.size >= 2 || twoFingers.current) {
      twoFingers.current = true;
      end(true);
      if (pointers.current.size === 2 && !gestureEvents.current && !pinch.current) {
        const [a, b] = [...pointers.current.values()];
        pinch.current = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) };
      }
      return;
    }
    // in the overview a tap zooms back in around that place
    if (ui().overview) {
      diveAt(e.clientX, e.clientY);
      return;
    }
    // nothing edits on the stage (a tap there only brings its controls back)
    if (ui().stage) return;
    const [x, y] = point(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    const doc = useDocStore.getState().doc;
    const h = hit(g, x, y);
    // a click on a modulation marker (in the number row) opens it for editing
    const sections = doc.meter.sections ?? [];
    for (let i = 0; i < sections.length; i++) {
      const p = xOf(g, sections[i]!.at);
      const top = rowTop(g, p.r);
      if (p.r === h.r && y >= top && y <= top + L.numH && x >= p.x + 8 && x <= p.x + 190) {
        setUi({ modDialog: { index: i } });
        return;
      }
    }
    // a click on a phrase mark's flag (in the number row) names it
    const marks = doc.meter.marks ?? [];
    for (let i = 0; i < marks.length; i++) {
      const t = marks[i]!;
      const p = xOf(g, Math.min(t, g.grid.NB - 1e-6));
      const fx = p.x + (Math.abs(t - Math.round(t)) < 1e-9 ? 10 : 0);
      const w = doc.meter.markNames?.[i] ? 190 : 16;
      const top = rowTop(g, p.r);
      if (p.r === h.r && y >= top && y <= top + L.numH && x >= fx - 4 && x <= fx + w) {
        setUi({ markDialog: { k: E.nearestPulse(g.grid, t) } });
        return;
      }
    }
    // a click on a total's bracket (under the band) selects what it spans
    if (h.zone === 'totals') {
      const ti = totalAt(g, doc, x, y);
      const v = doc.meter.totals?.[ti];
      if (v) {
        sfx.snap();
        setRange(E.nearestPulse(g.grid, v.a), E.nearestPulse(g.grid, v.b));
      }
      return;
    }
    // a click on an ending's bracket (in the lane above a row) opens it for editing
    if (g.lane && y < rowTop(g, h.r) && y >= rowTop(g, h.r) - g.lane) {
      const voltas = doc.meter.voltas ?? [];
      const row = g.rows[h.r]!;
      const t = row.b0 + (x - L.margin) / row.bw;
      const i = voltas.findIndex((v) => t >= v.a - 0.05 && t <= v.b + 0.05);
      if (i >= 0) return void setUi({ voltaDialog: { index: i } });
    }
    // the beat-number row above the tiles is a ruler: drag along it to select a range (a click
    // there puts the caret on the nearest pulse)
    if (h.zone === 'tiles' && !h.outside && y < rowTop(g, h.r) + L.numH && !e.shiftKey) {
      const k = slotAt(g, x, y);
      gesture.current = sweep(k, x, y, () => {
        sfx.snap();
        setCaret(k);
      });
      return;
    }
    // Shift-click with a caret or range (and no tiles selected) selects a pulse range, like text;
    // ⌥-click puts the caret on any pulse, even inside a tile
    const st = ui();
    if (h.zone === 'tiles' && !h.outside && !st.selection.length) {
      if (e.shiftKey && (st.caret !== null || st.range)) {
        const anchor = st.rangeAnchor ?? st.caret ?? 0;
        setRange(anchor, E.clamp(slotAt(g, x, y), 0, g.grid.TS));
        gesture.current = { kind: 'sweep', anchor, x0: x, y0: y, moved: true, tap: () => {} };
        return;
      }
      if (e.altKey) {
        const k = slotAt(g, x, y);
        gesture.current = sweep(k, x, y, () => {
          sfx.snap();
          setCaret(k);
        });
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
    // the very start and end of the piece (and the end of a short row) take the caret
    const edge = edgeSlot(g, x, y, touch);
    if (edge !== null) {
      gesture.current = sweep(edge, x, y, () => {
        sfx.snap();
        setCaret(edge);
      });
      return;
    }
    const i = itemAt(g, doc.items, x, y);
    const item = doc.items[i];
    if (!item) {
      gesture.current = { kind: 'empty', slot: null };
      return;
    }
    if (E.isSpace(item)) {
      // a tap in the open space puts the caret on that pulse; a drag selects a range
      const k = slotAt(g, x, y);
      gesture.current = sweep(k, x, y, () => {
        if (ui().multi) return;
        sfx.snap();
        setCaret(k);
      });
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

  const sweep = (anchor: number, x0: number, y0: number, tap: () => void): Gesture => ({
    kind: 'sweep',
    anchor: E.clamp(anchor, 0, geo.current?.grid.TS ?? anchor),
    x0,
    y0,
    moved: false,
    tap,
  });

  /* ---------------------------------------------------------------- pointer move */
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointers.current.has(e.pointerId))
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (twoFingers.current) {
      if (!pinch.current || pointers.current.size !== 2) return;
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const ratio = d / pinch.current.d;
      // one zoom step each time the fingers spread or close by a quarter
      if (ratio > 1.25 || ratio < 0.8) {
        zoomStep(ratio > 1 ? 1 : -1, anchorAtPoint((a!.x + b!.x) / 2, (a!.y + b!.y) / 2));
        pinch.current.d = d;
      }
      return;
    }
    const g = geo.current;
    if (!g) return;
    const [x, y] = point(e);
    const gs = gesture.current;
    const cv = e.currentTarget;

    if (!gs) {
      if (ui().stage) return;
      const doc = useDocStore.getState().doc;
      const h = hit(g, x, y);
      const sel = E.selectedIndices(doc.items, ui().selection);
      const grip =
        h.zone === 'tiles' && sel.length === 1 ? hitTrimGrip(g, doc.items, sel[0]!, x, y) : null;
      const b = h.zone === 'tiles' && !grip ? hitBoundary(g, doc.items, x, y) : null;
      const i = itemAt(g, doc.items, x, y);
      const ruler = h.zone === 'tiles' && !h.outside && y < rowTop(g, h.r) + L.numH;
      cv.style.cursor = ruler
        ? 'text'
        : h.zone === 'lane'
          ? 'cell'
          : h.zone === 'totals'
            ? 'pointer'
            : b || grip
              ? 'ew-resize'
              : i >= 0 && !E.isSpace(doc.items[i]!)
                ? e.altKey
                  ? 'text'
                  : 'grab'
                : i >= 0
                  ? 'text'
                  : 'default';
      const key = b?.key ?? null;
      if (key !== hover.current) {
        hover.current = key;
        request();
      }
      return;
    }

    if (gs.kind === 'sweep') {
      if (!gs.moved && Math.hypot(x - gs.x0, y - gs.y0) <= DRAG_THRESHOLD) return;
      gs.moved = true;
      const k = E.clamp(slotAt(g, x, y), 0, g.grid.TS);
      const st = ui();
      const cur = st.range ? (st.caret ?? -1) : -1;
      if (k === cur || (k === gs.anchor && !st.range && st.caret === k)) return;
      sfx.snap();
      setRange(gs.anchor, k);
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
      // long-press then drag: select a pulse range from where the press began
      if (gs.long) {
        const k0 = slotAt(g, gs.x0, gs.y0);
        gesture.current = {
          kind: 'sweep',
          anchor: k0,
          x0: gs.x0,
          y0: gs.y0,
          moved: true,
          tap: () => {},
        };
        return onPointerMove(e);
      }
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

    if (gs.kind === 'sweep') {
      if (!cancelled && !gs.moved) gs.tap();
      return;
    }
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
        aria-label="Score. Drag a group to move it, drag a line to reshape, tap to select, shift-click to select several, drag in the open space or along the beat numbers (or alt-drag anywhere, or long-press and drag) to select a range of pulses, drag the grips of a selected group to trim it, paint the dotted band under a row to change subdivision. Use the group list after this for keyboard and screen reader access."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => {
          if (lift(e.pointerId)) end(false);
        }}
        onPointerCancel={(e) => {
          lift(e.pointerId);
          end(true);
        }}
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
