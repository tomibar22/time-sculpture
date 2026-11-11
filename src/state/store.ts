import { create } from 'zustand';
import type { Doc, FillAxis, FillSort, ShapeFamily, GroupKind, GroupSpec, ItemId } from '../engine';

import { DEFAULT_TEMPO, defaultDoc } from './defaults';

export type MoveMode = 'pulse' | 'beat' | 'place';
export type Theme = 'system' | 'light' | 'dark';
/** What the stage plays: everything, only the click, or nothing (the score just moves). */
export type StageSound = 'all' | 'click' | 'off';

/** Stage settings, remembered on this device between sessions. */
export interface StagePrefs {
  /** Bars of count-in before the piece starts. */
  countIn: 0 | 1 | 2;
  sound: StageSound;
  /** Play the piece again and again, or once (stop when it lands on 1). */
  loop: boolean;
  /** Build: reveal the groups from the start to the end, or from the end back to the start. */
  buildDir: BuildDir;
}
export type BuildDir = 'start' | 'end';
const STAGE_KEY = 'time-sculpture/stage';
export const DEFAULT_STAGE: StagePrefs = {
  countIn: 1,
  sound: 'all',
  loop: false,
  buildDir: 'start',
};
function loadStage(): StagePrefs {
  try {
    const raw = localStorage.getItem(STAGE_KEY);
    return raw ? { ...DEFAULT_STAGE, ...(JSON.parse(raw) as Partial<StagePrefs>) } : DEFAULT_STAGE;
  } catch {
    return DEFAULT_STAGE;
  }
}
export function saveStage(p: StagePrefs): void {
  try {
    localStorage.setItem(STAGE_KEY, JSON.stringify(p));
  } catch {
    /* private mode: the settings last for this session only */
  }
}

/** Choices remembered on this device between sessions (not part of any piece). */
export interface DevicePrefs {
  theme: Theme;
  ticks: boolean;
  click: boolean;
  moveMode: MoveMode;
  fillSizes: number[];
  /** Fills saved with ♥ (sizes), fitted to any region later; the newest first. */
  motifs: number[][];
}
const PREFS_KEY = 'time-sculpture/prefs';
export const MAX_MOTIFS = 60;
function loadPrefs(): Partial<DevicePrefs> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<DevicePrefs>) : {};
    const out: Partial<DevicePrefs> = {};
    if (p.theme === 'system' || p.theme === 'light' || p.theme === 'dark') out.theme = p.theme;
    if (typeof p.ticks === 'boolean') out.ticks = p.ticks;
    if (typeof p.click === 'boolean') out.click = p.click;
    if (p.moveMode === 'pulse' || p.moveMode === 'beat' || p.moveMode === 'place')
      out.moveMode = p.moveMode;
    if (Array.isArray(p.fillSizes)) {
      const sizes = p.fillSizes.filter((n) => Number.isInteger(n) && n >= 1 && n <= 9);
      if (sizes.length) out.fillSizes = [...new Set(sizes)].sort((a, b) => a - b);
    }
    if (Array.isArray(p.motifs))
      out.motifs = p.motifs
        .filter(
          (m) => Array.isArray(m) && m.length > 0 && m.every((n) => Number.isInteger(n) && n >= 1),
        )
        .slice(0, MAX_MOTIFS);
    return out;
  } catch {
    return {};
  }
}
function savePrefs(p: DevicePrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode: the choices last for this session only */
  }
}

const HISTORY_LIMIT = 200;
const LOG_LIMIT = 8;

/* ------------------------------------------------------------------ document slice (undoable) */

export interface DocState {
  doc: Doc;
  past: Doc[];
  future: Doc[];
  /** Short labels of recent actions ("+3⇥", "slide +2", …). */
  log: string[];
  /** Increments on every committed change (used to expire toasts and trigger saves). */
  version: number;
  commit: (doc: Doc, label: string) => void;
  undo: () => boolean;
  redo: () => boolean;
  /** Replace the document without history (load from library / share link). */
  load: (doc: Doc) => void;
}

export const useDocStore = create<DocState>((set, get) => ({
  doc: defaultDoc(),
  past: [],
  future: [],
  log: [],
  version: 0,
  commit: (doc, label) => {
    const s = get();
    if (doc === s.doc) return;
    set({
      doc,
      past: [...s.past.slice(-(HISTORY_LIMIT - 1)), s.doc],
      future: [],
      log: [...s.log.slice(-(LOG_LIMIT - 1)), label],
      version: s.version + 1,
    });
  },
  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return false;
    set({
      doc: prev,
      past: s.past.slice(0, -1),
      future: [s.doc, ...s.future],
      version: s.version + 1,
    });
    return true;
  },
  redo: () => {
    const s = get();
    const next = s.future[0];
    if (!next) return false;
    set({ doc: next, past: [...s.past, s.doc], future: s.future.slice(1), version: s.version + 1 });
    return true;
  },
  load: (doc) => set((s) => ({ doc, past: [], future: [], log: [], version: s.version + 1 })),
}));

/* ------------------------------------------------------------------ UI slice (not undoable) */

export interface Toast {
  id: number;
  message: string;
  /** Show an Undo button while the document is still at this version. */
  undoVersion?: number;
  action?: { label: string; run: () => void };
}

export interface UiState {
  selection: ItemId[];
  anchor: ItemId | null;
  multi: boolean;
  moveMode: MoveMode;
  brush: number;
  /** What the number pad types: sounds, or silences. */
  addKind: GroupKind;
  /**
   * Zoom: bars per row before the score wraps (below 1, a share of each bar; manual line breaks
   * live in the document). See state/zoom.ts.
   */
  perRow: number;
  /** The overview: the whole piece fitted on the screen (not saved). */
  overview: boolean;
  /** A short label shown while zooming. */
  zoomHud: { text: string; at: number } | null;
  /** Stretch rows that end early (at a line break, or the last row) to the full width. */
  fitRows: boolean;
  ticks: boolean;
  /** Hear the click on every beat (off: only the groups and the landing on 1). */
  click: boolean;
  /**
   * Practice loop: while playing, only this stretch of written time (beats) goes round and
   * round. Null = the whole piece in its play order.
   */
  loop: { a: number; b: number } | null;
  /** The tempo dialog (tap tempo, exact steps). */
  tempoDialog: boolean;
  tempo: number;
  playing: boolean;
  /** The docked number pad (shown by default on touch screens). */
  keypad: boolean;
  /** Phones: the meter / brush / drag settings are folded into one line until opened. */
  setupOpen: boolean;
  /** Tile sizes the fill panel may use. */
  fillSizes: number[];
  /** The fill panel: closed, or open on the random, browse or vary tab. */
  fillPanel: 'random' | 'browse' | 'vary' | null;
  fillSort: FillSort;
  /** Browse: which shapes to list ('shapes' = all shaped fills, 'any' = every fill, sorted). */
  fillShape: ShapeFamily | 'shapes' | 'any' | 'mine' | 'bred';
  /** Browse as a list, or as a map of the fills laid out by two measures. */
  fillView: 'list' | 'map';
  fillAxes: [FillAxis, FillAxis];
  /** Fills saved with ♥ (device preference). */
  motifs: number[][];
  /** The docked subdivision row, for the beats under the selection, range or caret. */
  subPanel: boolean;
  /** The modulation dialog: adding one at a beat, or editing one (index into meter.sections). */
  modDialog: { at: number } | { index: number } | null;
  /** The endings dialog: a new ending over pulses [ka, kb), or editing one (index into voltas). */
  voltaDialog: { ka: number; kb: number } | { index: number } | null;
  /** The phrase-mark name dialog, for the mark at pulse k (added if there is none yet). */
  markDialog: { k: number } | null;
  /** Playhead in beats while playing. */
  playhead: number | null;
  /**
   * Stage: a clean, full-screen view for filming a performance. Nothing edits; the score follows
   * the playhead, the sounding group lights up, and the controls fade away while playing.
   */
  stage: boolean;
  stagePrefs: StagePrefs;
  /**
   * The stage's build presentation (null = the play presentation): the score fills in one
   * sounding group per click, from the start or from the end; `step` groups are shown.
   */
  build: { step: number } | null;
  /** The group just revealed and when (performance.now()), for its entrance. */
  buildPop: { id: string; at: number } | null;
  /** During a count-in: the beat being counted (1-based) and how many beats a bar has. */
  countdown: { beat: number; of: number } | null;
  theme: Theme;
  /** Live preview during a drag (rendered instead of the document). */
  preview: Doc | null;
  /** Ids of the lifted block during a move drag. */
  lifted: ItemId[];
  /** Text caret on a pulse (0..total), like a caret between letters. */
  caret: number | null;
  /** A selected pulse range [a, b) and its fixed end (the other end follows Shift+arrows). */
  range: { a: number; b: number } | null;
  rangeAnchor: number | null;
  /** Copied groups (also written to the system clipboard as text). */
  clipboard: GroupSpec[];
  flash: { ids: ItemId[]; until: number };
  /** When the piece was last completed (performance.now()), for the light that sweeps over it. */
  completedAt: number;
  toast: Toast | null;
  announcement: string;
  /** Item focused in the screen-reader list (drawn with a dashed outline). */
  focusedId: ItemId | null;
  currentId: string | null;
  currentName: string;
  set: (patch: Partial<UiState>) => void;
}

let toastSeq = 0;
export const nextToastId = () => ++toastSeq;

export const useUiStore = create<UiState>((set) => ({
  selection: [],
  anchor: null,
  multi: false,
  moveMode: 'pulse',
  brush: 4,
  addKind: 'sound',
  perRow: 1,
  overview: false,
  zoomHud: null,
  fitRows: false,
  ticks: true,
  click: true,
  loop: null,
  tempoDialog: false,
  tempo: DEFAULT_TEMPO,
  playing: false,
  fillSizes: [2, 3, 4, 5, 7],
  fillPanel: null,
  fillSort: 'onbeat',
  fillShape: 'shapes',
  fillView: 'list',
  fillAxes: ['tiles', 'sync'],
  motifs: [],
  subPanel: false,
  modDialog: null,
  voltaDialog: null,
  markDialog: null,
  keypad: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
  setupOpen: false,
  playhead: null,
  stage: false,
  stagePrefs: loadStage(),
  build: null,
  buildPop: null,
  countdown: null,
  theme: 'system',
  preview: null,
  lifted: [],
  caret: null,
  range: null,
  rangeAnchor: null,
  clipboard: [],
  flash: { ids: [], until: 0 },
  completedAt: 0,
  toast: null,
  announcement: '',
  focusedId: null,
  currentId: null,
  currentName: 'Untitled',
  set: (patch) => set(patch),
  ...loadPrefs(),
}));

useUiStore.subscribe((s, p) => {
  if (
    s.theme !== p.theme ||
    s.ticks !== p.ticks ||
    s.click !== p.click ||
    s.moveMode !== p.moveMode ||
    s.fillSizes !== p.fillSizes ||
    s.motifs !== p.motifs
  )
    savePrefs({
      theme: s.theme,
      ticks: s.ticks,
      click: s.click,
      moveMode: s.moveMode,
      fillSizes: s.fillSizes,
      motifs: s.motifs,
    });
});
