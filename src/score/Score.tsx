import { useCallback, useEffect, useRef } from 'react';
import * as E from '../engine';
import type { Doc, ItemId, OpResult } from '../engine';
import { startPlayback, stopPlayback } from '../audio/player';
import { ui as sfx } from '../audio/voices';
import { announce, flash, reportSlide, run, select, splitSelection, toast } from '../state/actions';
import { setCaret, setRange, closeSubdivision, pickBeats } from '../state/editing';
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
  hitHandle,
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
/** How long the light takes to pass over a piece that was just completed. */
const SWEEP_MS = 900;
const DOUBLE_TAP_MS = 330;
const DRAG_THRESHOLD = 8;

type Gesture =
  | { kind: 'lane'; beats: Set<number> }
  | {
      kind: 'boundary';
      b: Boundary;
      base: Doc;
      result: OpResult | null;
      /** A finger reshapes only next to a selected group; otherwise its drag selects a range. */
      armed: boolean;
      x0: number;
      y0: number;
      touch: boolean;
    }
  | {
      kind: 'trim';
      base: Doc;
      id: ItemId;
      side: 'start' | 'end';
      edge: number;
      result: OpResult | null;
      delta: number;
      x0: number;
      y0: number;
      touch: boolean;
    }
  | {
      kind: 'press';
      id: ItemId;
      x0: number;
      y0: number;
      mods: { shift: boolean; toggle: boolean };
      long: boolean;
      timer: number;
      touch: boolean;
      /** The group was already selected when the finger came down: its drag moves the selection. */
      wasSelected: boolean;
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
  | {
      kind: 'sweep';
      anchor: number;
      x0: number;
      y0: number;
      moved: boolean;
      tap: () => void;
      touch: boolean;
    }
  /** Selecting several: a finger dragged over groups adds them to the selection. */
  | { kind: 'paint'; base: ItemId[]; anchor: number };

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

/** The beats picked in the band, as a set for drawing. */
function pickedBeats(sel: { a: number; b: number } | null): ReadonlySet<number> | null {
  if (!sel) return null;
  const out = new Set<number>();
  for (let b = sel.a; b <= sel.b; b++) out.add(b);
  return out;
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
  const lastRuler = useRef({ bar: -1, t: 0 });
  /** Fingers on the score, and a pinch in progress (its last distance). */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number } | null>(null);
  /** Safari's own pinch events (iOS, macOS trackpads) take over from the pointer pinch. */
  const gestureEvents = useRef(false);
  /** A finger lifted: false while a pinch is still winding down (no tap or drag then). */
  const twoFingers = useRef(false);
  /** A drag that owns the touch: the page does not scroll under it. */
  const locked = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const scrollRaf = useRef(0);
  /** The last pointer was a finger: lines show their handles only next to a selected group. */
  const byTouch = useRef(
    typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
  );
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
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sweepT = s.completedAt && !still && !stage ? (now - s.completedAt) / SWEEP_MS : 2;
    const sweep = sweepT >= 0 && sweepT < 1 ? sweepT : null;
    drawScore(
      c,
      g,
      {
        doc,
        stage,
        selection: new Set(stage ? [] : s.selection),
        lifted: new Set(s.lifted),
        picked: gs?.kind === 'lane' ? gs.beats : stage ? null : pickedBeats(s.beatSel),
        activeBoundary: gs?.kind === 'boundary' ? gs.b.key : null,
        hoverBoundary: hover.current,
        showHandles: !stage && gs?.kind !== 'slide' && gs?.kind !== 'place',
        armed: byTouch.current ? new Set(s.selection) : null,
        playStart: stage ? null : s.playStart,
        mainTempo: s.tempo,
        cursor: stage ? null : s.caret,
        range: stage ? null : s.range,
        playhead: s.playhead,
        loop: stage ? null : s.loop,
        sweep,
        invite: stage
          ? null
          : matchMedia('(pointer: coarse)').matches || s.keypad
            ? 'Tap a number to begin'
            : 'Type a number to begin',
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
    if (flashAlpha > 0 || popAlpha > 0 || sweep !== null) request();
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
    // a drag that is ours (a selection, a move, a trim) must not scroll the page under the finger
    const onTouchMove = (e: TouchEvent) => {
      if (locked.current && e.cancelable) e.preventDefault();
    };
    cv.addEventListener('touchmove', onTouchMove, { passive: false });
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('gesturestart', onGestureStart);
    cv.addEventListener('gesturechange', onGestureChange);
    cv.addEventListener('gestureend', onGestureEnd);
    window.addEventListener('resize', request);
    return () => {
      cv.removeEventListener('touchmove', onTouchMove);
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
    // The editor follows too, more quietly: only when the playhead reaches a row that is out of
    // sight (above the screen or under the dock), and never while a finger is at work.
    let editRow = -1;
    const followEdit = (s: ReturnType<typeof ui>) => {
      const g = geo.current;
      const cv = canvasRef.current;
      if (s.stage || s.playhead === null || !g || !cv) return void (editRow = -1);
      const r = rowOf(g, Math.min(s.playhead, g.grid.NB - 1e-6));
      if (r === editRow || gesture.current) return;
      editRow = r;
      const top = cv.getBoundingClientRect().top + rowTop(g, r) - g.lane;
      const height = g.stride - L.gapR;
      const dock = document.querySelector<HTMLElement>('.dock')?.offsetHeight ?? 0;
      const limit = window.innerHeight - dock;
      if (top >= 4 && top + height <= limit - 4) return;
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollBy({
        top: top - Math.max(12, (limit - height) * 0.2),
        behavior: still ? 'auto' : 'smooth',
      });
    };
    return useUiStore.subscribe((s, p) => {
      if (s.playhead !== p.playhead) followEdit(s);
      if (
        s.playhead !== p.playhead ||
        s.stage !== p.stage ||
        s.build !== p.build ||
        s.stagePrefs !== p.stagePrefs
      )
        follow(s);
    });
  }, []);

  const point = (cx: number, cy: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [cx - r.left, cy - r.top] as const;
  };

  /*
   * A drag that is ours: the page must not scroll under it (a native touchmove listener checks
   * `locked`), and near the top of the screen or the dock the score scrolls by itself, so a
   * selection or a move can go on past the rows in view.
   */
  const lock = () => {
    if (locked.current) return;
    locked.current = true;
    if (!scrollRaf.current) scrollRaf.current = requestAnimationFrame(autoScroll);
  };
  const autoScroll = () => {
    scrollRaf.current = 0;
    const p = lastPt.current;
    if (!locked.current || !gesture.current || !p) return;
    const dock = document.querySelector<HTMLElement>('.dock');
    const limit = window.innerHeight - (dock?.offsetHeight ?? 0);
    const zone = 44;
    let dy = 0;
    if (p.y < zone) dy = -Math.ceil((zone - p.y) / 3);
    else if (p.y > limit - zone) dy = Math.ceil((p.y - (limit - zone)) / 3);
    dy = E.clamp(dy, -16, 16);
    if (dy) {
      const before = window.scrollY;
      window.scrollBy({ top: dy, behavior: 'instant' });
      if (window.scrollY !== before) dragTo(p.x, p.y);
    }
    scrollRaf.current = requestAnimationFrame(autoScroll);
  };
  /**
   * Is this drag ours yet? A finger's drag is claimed once it has clearly moved sideways; a
   * swipe that starts up or down belongs to the page (it scrolls). A mouse just needs to move.
   */
  const claim = (
    x0: number,
    y0: number,
    x: number,
    y: number,
    touch: boolean,
    threshold = DRAG_THRESHOLD,
  ): 'wait' | 'ours' | 'scroll' => {
    if (locked.current) return 'ours';
    const dx = x - x0;
    const dy = y - y0;
    if (Math.hypot(dx, dy) <= threshold) return 'wait';
    if (touch && Math.abs(dy) > Math.abs(dx)) return 'scroll';
    lock();
    return 'ours';
  };
  /** Let go of a gesture without doing anything (the page scrolls instead). */
  const drop = () => {
    const gs = gesture.current;
    if (gs?.kind === 'press') clearTimeout(gs.timer);
    gesture.current = null;
    if (ui().preview || ui().lifted.length) setUi({ preview: null, lifted: [] });
    request();
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
    const [x, y] = point(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
    const touch = e.pointerType === 'touch';
    if (byTouch.current !== touch) {
      byTouch.current = touch;
      request();
    }
    lastPt.current = { x: e.clientX, y: e.clientY };
    const doc = useDocStore.getState().doc;
    const h = hit(g, x, y);
    // the knob of the caret, or of an end of the range: drag it to select on from there, across
    // rows too (the selection is kept: its other end stays where it is)
    const st0 = ui();
    if (!st0.selection.length) {
      const hh = hitHandle(g, st0.range, st0.range ? null : st0.caret, x, y, touch);
      if (hh) {
        const anchor = hh === 'a' ? st0.range!.b : hh === 'b' ? st0.range!.a : st0.caret!;
        gesture.current = {
          kind: 'sweep',
          anchor,
          x0: x,
          y0: y,
          moved: false,
          tap: () => {},
          touch,
        };
        lock();
        return;
      }
    }
    // a click on a modulation or metre marker (in the lane above its row) opens it for editing
    const sections = doc.meter.sections ?? [];
    for (let i = 0; i < sections.length; i++) {
      const p = xOf(g, sections[i]!.at);
      const top = rowTop(g, p.r);
      if (p.r === h.r && y >= top - g.lane - 4 && y < top && x >= p.x - 4 && x <= p.x + 150) {
        setUi(
          sections[i]!.from === sections[i]!.to
            ? { meterDialog: { at: sections[i]!.at } }
            : { modDialog: { index: i } },
        );
        return;
      }
    }
    if (g.lane && doc.meter.bars && h.r === 0 && y < rowTop(g, 0) && x <= L.margin + 110) {
      setUi({ meterDialog: { at: 0 } });
      return;
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
      gesture.current = sweep(k, x, y, touch, () => {
        // while the piece plays, a tap on the ruler jumps there (like a playhead on a timeline)
        const now = ui();
        if (now.playing && !now.loop) {
          stopPlayback();
          startPlayback(g.grid.times[Math.min(k, g.grid.TS - 1)]!);
          return;
        }
        // a second tap on the same bar selects the whole bar
        const map = E.barMap(doc.meter);
        const bar = map.barOf[E.beatOfPulse(g.grid, Math.min(k, g.grid.TS - 1))] ?? 0;
        const t = performance.now();
        if (lastRuler.current.bar === bar && t - lastRuler.current.t < DOUBLE_TAP_MS) {
          lastRuler.current = { bar: -1, t: 0 };
          const a = map.barStarts[bar] ?? 0;
          const b = map.barStarts[bar + 1] ?? map.NB;
          setRange(g.grid.pre[a]!, g.grid.pre[b]!);
          return;
        }
        lastRuler.current = { bar, t };
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
        gesture.current = {
          kind: 'sweep',
          anchor,
          x0: x,
          y0: y,
          moved: true,
          tap: () => {},
          touch,
        };
        lock();
        return;
      }
      if (e.altKey) {
        const k = slotAt(g, x, y);
        gesture.current = sweep(k, x, y, touch, () => {
          sfx.snap();
          setCaret(k);
        });
        return;
      }
    }
    // the band under the tiles is selectable like the tiles: a tap picks a beat, a drag a run
    // of beats (⇧ reaches on from the beats already picked), and the row of ratios opens for them
    if (h.zone === 'lane') {
      const had = e.shiftKey ? ui().beatSel : null;
      const beats = new Set<number>([h.beat]);
      if (had)
        for (let b = Math.min(had.a, h.beat); b <= Math.max(had.b, h.beat); b++) beats.add(b);
      gesture.current = { kind: 'lane', beats };
      request();
      return;
    }
    // anything else lets go of the beats picked in the band
    if (ui().beatSel) closeSubdivision();
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
          x0: x,
          y0: y,
          touch,
        };
        sfx.lift();
        request();
        return;
      }
    }
    const b = hitBoundary(g, doc.items, x, y, touch);
    if (b) {
      // a finger reshapes a line only next to a group that is selected (select, then edit);
      // otherwise a drag from a line selects a range that starts exactly on it
      const selected = new Set(ui().selection);
      const near = [doc.items[b.i], b.kind === 'line' ? doc.items[b.i + 1] : undefined];
      const armed = !touch || near.some((it) => it && selected.has(it.id));
      gesture.current = {
        kind: 'boundary',
        b,
        base: doc,
        result: null,
        armed,
        x0: x,
        y0: y,
        touch,
      };
      request();
      return;
    }
    // the very start and end of the piece (and the end of a short row) take the caret
    const edge = edgeSlot(g, x, y, touch);
    if (edge !== null) {
      gesture.current = sweep(edge, x, y, touch, () => {
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
    if (E.isSpace(item) || item.kind === 'rest') {
      // a tap in the open space or a silence puts the caret on that pulse; a drag selects a range
      const k = slotAt(g, x, y);
      gesture.current = sweep(k, x, y, touch, () => {
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
      const cur = ui().selection;
      if (touch) {
        // a finger held on a group picks it up: drag on to move it (with whatever is selected),
        // or let go to select several
        if (!cur.includes(item.id))
          setUi({
            selection: ui().multi ? [...cur, item.id] : [item.id],
            anchor: item.id,
            caret: null,
            range: null,
            rangeAnchor: null,
          });
        setUi({ lifted: ui().selection });
        lock();
        sfx.lift();
        return;
      }
      setUi({
        multi: true,
        selection: cur.includes(item.id) ? cur : [...cur, item.id],
        anchor: item.id,
      });
      sfx.lift();
      announce('Selecting several. Tap more groups.');
    }, LONG_PRESS_MS);
    gesture.current = {
      kind: 'press',
      id: item.id,
      x0: x,
      y0: y,
      mods,
      long: false,
      timer,
      touch,
      wasSelected: ui().selection.includes(item.id),
    };
  };

  const sweep = (
    anchor: number,
    x0: number,
    y0: number,
    touch: boolean,
    tap: () => void,
  ): Gesture => ({
    kind: 'sweep',
    anchor: E.clamp(anchor, 0, geo.current?.grid.TS ?? anchor),
    x0,
    y0,
    moved: false,
    tap,
    touch,
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
    if (gesture.current) {
      lastPt.current = { x: e.clientX, y: e.clientY };
      return dragTo(e.clientX, e.clientY);
    }
    if (ui().stage) return;
    const [x, y] = point(e.clientX, e.clientY);
    const cv = e.currentTarget;
    const doc = useDocStore.getState().doc;
    const h = hit(g, x, y);
    const st = ui();
    const sel = E.selectedIndices(doc.items, st.selection);
    const knob = !sel.length && hitHandle(g, st.range, st.range ? null : st.caret, x, y);
    const grip =
      h.zone === 'tiles' && sel.length === 1 ? hitTrimGrip(g, doc.items, sel[0]!, x, y) : null;
    const b = h.zone === 'tiles' && !grip ? hitBoundary(g, doc.items, x, y) : null;
    const i = itemAt(g, doc.items, x, y);
    const ruler = h.zone === 'tiles' && !h.outside && y < rowTop(g, h.r) + L.numH;
    cv.style.cursor = knob
      ? 'ew-resize'
      : ruler
        ? 'text'
        : h.zone === 'lane'
          ? 'cell'
          : h.zone === 'totals'
            ? 'pointer'
            : b || grip
              ? 'ew-resize'
              : i >= 0 && doc.items[i]!.kind === 'sound'
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
  };

  /** The gesture in progress follows the pointer (also called while the score scrolls itself). */
  const dragTo = (cx: number, cy: number): void => {
    const g = geo.current;
    const gs = gesture.current;
    const cv = canvasRef.current;
    if (!g || !gs || !cv) return;
    const [x, y] = point(cx, cy);

    if (gs.kind === 'sweep') {
      if (!gs.moved) {
        const c = claim(gs.x0, gs.y0, x, y, gs.touch);
        if (c === 'scroll') return drop();
        if (c === 'wait') return;
        gs.moved = true;
      }
      lock();
      const k = E.clamp(slotAt(g, x, y), 0, g.grid.TS);
      const st = ui();
      const cur = st.range ? (st.caret ?? -1) : -1;
      if (k === cur || (k === gs.anchor && !st.range && st.caret === k)) return;
      sfx.snap();
      setRange(gs.anchor, k);
      return;
    }

    if (gs.kind === 'paint') {
      // selecting several: every group the finger passes over joins the selection
      const doc = useDocStore.getState().doc;
      const kNow = E.floorPulse(g.grid, hit(g, x, y).t);
      const lo = Math.min(gs.anchor, kNow);
      const hi = Math.max(gs.anchor, kNow) + 1;
      const add: ItemId[] = [];
      let s = 0;
      for (const it of doc.items) {
        if (it.kind === 'sound' && s < hi && s + it.n > lo) add.push(it.id);
        s += it.n;
      }
      const next = [...gs.base, ...add.filter((id) => !gs.base.includes(id))];
      if (next.join() !== ui().selection.join()) {
        setUi({ selection: next, anchor: next[next.length - 1] ?? null });
        sfx.snap();
      }
      return;
    }

    if (gs.kind === 'lane') {
      const beat = hit(g, x, y).beat;
      if (!gs.beats.has(beat)) {
        // a run, not a scatter: everything between the ends is in
        const lo = Math.min(beat, ...gs.beats);
        const hi = Math.max(beat, ...gs.beats);
        for (let b = lo; b <= hi; b++) gs.beats.add(b);
        request();
      }
      return;
    }

    if (gs.kind === 'boundary') {
      const { base, b } = gs;
      if (gs.touch) {
        const c = claim(gs.x0, gs.y0, x, y, true);
        if (c === 'scroll') return drop();
        if (c === 'wait') return;
        if (!gs.armed) {
          // not next to a selected group: the drag selects, from this line on
          gesture.current = {
            kind: 'sweep',
            anchor: b.slot,
            x0: gs.x0,
            y0: gs.y0,
            moved: true,
            tap: () => {},
            touch: true,
          };
          return dragTo(cx, cy);
        }
      } else lock();
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
      const c = gs.long && gs.touch ? 'ours' : claim(gs.x0, gs.y0, x, y, gs.touch);
      if (c === 'wait') return;
      clearTimeout(gs.timer);
      if (c === 'scroll') return drop();
      const base = useDocStore.getState().doc;
      const st = ui();
      const k0 = slotAt(g, gs.x0, gs.y0);
      const kf = E.floorPulse(g.grid, hit(g, gs.x0, gs.y0).t);
      const inRange = !!st.range && !st.selection.length && kf >= st.range.a && kf < st.range.b;
      // a mouse held still and then dragged selects a range from where the press began; so
      // does a finger dragged over a group that is not selected (select first, then move:
      // nothing is moved or resized by a drag that only meant to select)
      if ((!gs.touch && gs.long) || (gs.touch && !gs.long && !gs.wasSelected && !inRange)) {
        if (gs.touch && st.multi) {
          gesture.current = {
            kind: 'paint',
            base: st.selection,
            anchor: E.floorPulse(g.grid, hit(g, gs.x0, gs.y0).t),
          };
          return dragTo(cx, cy);
        }
        gesture.current = {
          kind: 'sweep',
          anchor: k0,
          x0: gs.x0,
          y0: gs.y0,
          moved: true,
          tap: () => {},
          touch: gs.touch,
        };
        return dragTo(cx, cy);
      }
      let sel = st.selection;
      if (inRange) {
        // a drag from inside the selected range moves the groups that begin in it
        const inside: ItemId[] = [];
        let s = 0;
        for (const it of base.items) {
          if (it.kind === 'sound' && s >= st.range!.a && s < st.range!.b) inside.push(it.id);
          s += it.n;
        }
        sel = inside.includes(gs.id) ? inside : [gs.id];
        setUi({ selection: sel, anchor: gs.id, caret: null, range: null, rangeAnchor: null });
      } else if (!sel.includes(gs.id)) {
        sel = [gs.id];
        setUi({ selection: sel, anchor: gs.id });
      }
      const idx = E.selectedIndices(base.items, sel);
      const ids = idx.map((i) => base.items[i]!.id);
      const mode = ui().moveMode;
      sfx.lift();
      cv.style.cursor = 'grabbing';
      if (mode !== 'place') {
        // every selected group moves, neighbours or not, by the same number of pulses
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
      } else gesture.current = { kind: 'place', base, ids, result: null };
      lock();
      setUi({ lifted: ids, preview: base });
      return dragTo(cx, cy);
    }

    if (gs.kind === 'trim') {
      const { base, id, side, edge } = gs;
      const c = claim(gs.x0, gs.y0, x, y, gs.touch, gs.touch ? DRAG_THRESHOLD : 0);
      if (c === 'scroll') return drop();
      if (c === 'wait') return;
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
      const d = E.clampRuns(base, ids, target - s0);
      if (d === gs.delta) return;
      gs.delta = d;
      gs.result = d ? E.slideRuns(base, ids, d) : null;
      if (gs.result && !gs.result.report.ok) gs.result = null;
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
    locked.current = false;
    lastPt.current = null;
    if (!gs) return;
    const clearDrag = () => setUi({ preview: null, lifted: [] });

    if (gs.kind === 'sweep') {
      if (!cancelled && !gs.moved) gs.tap();
      return;
    }
    if (gs.kind === 'paint') {
      if (!cancelled) announce(`${ui().selection.length} selected`);
      return;
    }
    if (gs.kind === 'lane') {
      request();
      if (!cancelled) pickBeats(Math.min(...gs.beats), Math.max(...gs.beats));
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
      if (ui().lifted.length) setUi({ lifted: [] });
      if (cancelled) return;
      if (gs.long) {
        // a finger held on a group and let go without moving: select several from here
        if (gs.touch && !ui().multi) {
          setUi({ multi: true });
          announce('Selecting several. Tap more groups.');
        }
        return;
      }
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
        aria-label="Score. Drag a group to move it, drag a line to reshape, tap to select, shift-click to select several, drag in the open space or along the beat numbers (or alt-drag anywhere, or long-press and drag) to select a range of pulses, drag the knob under the caret or under an end of the selection to select on, drag the grips of a selected group to trim it, pick beats in the band under a row to change their subdivision. Use the group list after this for keyboard and screen reader access."
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
