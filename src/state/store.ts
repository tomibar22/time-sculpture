import { create } from 'zustand';
import { CLICK_PATTERN, cleanClickPattern } from '../engine';
import type {
  ClickPattern,
  Doc,
  FillAxis,
  FillSort,
  ShapeFamily,
  GroupKind,
  GroupSpec,
  ItemId,
  LS,
} from '../engine';

import { DEFAULT_TEMPO, defaultDoc, MAX_TEMPO, MIN_TEMPO } from './defaults';

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
  /** Bars counted in before Play in the editor (the stage has its own setting). */
  countIn: 0 | 1 | 2;
  /** Practice: are the tiles heard, silent (the click alone), or heard and silent in turn? */
  tiles: TilesMode;
  /** In turn: this many times round with the tiles, then this many with the click alone. */
  turns: { on: number; off: number };
  /** The count-in also ticks the subdivision of the bar it counts. */
  countSub: boolean;
  /** The low drum under the click on the piece's 1 (the landing); off = the click alone. */
  landDrum: boolean;
  /** How loud each voice is, 0–100 (see MIX_DEFAULT). */
  mix: Mix;
  /** The click as a rhythm of its own: which beats, pulses and bars have it (engine/click.ts). */
  clickPat: ClickPattern;
  /** Practice: the tempo climbs while it plays (see SpeedUp). */
  speedUp: SpeedUp;
}

/** The tempo climbs by itself: `step` faster every `every` times round, until it is `to`. */
export interface SpeedUp {
  on: boolean;
  step: number;
  every: number;
  to: number;
}
export const SPEED_STEPS = [1, 2, 3, 4, 5, 6, 8, 10];
export const SPEED_EVERY = [1, 2, 3, 4, 6, 8];

/** The mixer: the drum (tiles), the 1 of every bar, the other beats, the subdivision ticks. */
export interface Mix {
  drum: number;
  one: number;
  beat: number;
  sub: number;
}
export type MixChannel = keyof Mix;
/** Where every fader stands when untouched (the gain there is the voice's own level). */
export const MIX_DEFAULT: Mix = { drum: 70, one: 70, beat: 70, sub: 70 };
/**
 * How steeply a fader rises: the ticks are made very soft, so their fader reaches further (four
 * times louder at the top; the others twice).
 */
const MIX_CURVE: Mix = { drum: 2, one: 2, beat: 2, sub: 4 };
/** A fader's gain: 1 at its default, 0 at the bottom, a few times louder at the top. */
export const mixGain = (mix: Mix, ch: MixChannel) => (mix[ch] / MIX_DEFAULT[ch]) ** MIX_CURVE[ch];
/** Stored mixes say which scale they are on (the first one had the ticks' default at 35). */
const MIX_SCALE = 2;

export type TilesMode = 'on' | 'off' | 'turns';
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
    if (p.countIn === 0 || p.countIn === 1 || p.countIn === 2) out.countIn = p.countIn;
    if (p.tiles === 'on' || p.tiles === 'off' || p.tiles === 'turns') out.tiles = p.tiles;
    const n = (v: unknown) => (Number.isInteger(v) ? Math.max(1, Math.min(8, v as number)) : 1);
    if (p.turns && typeof p.turns === 'object')
      out.turns = { on: n(p.turns.on), off: n(p.turns.off) };
    if (typeof p.countSub === 'boolean') out.countSub = p.countSub;
    if (typeof p.landDrum === 'boolean') out.landDrum = p.landDrum;
    if (p.mix && typeof p.mix === 'object') {
      const m = { ...MIX_DEFAULT };
      for (const k of Object.keys(m) as MixChannel[]) {
        const v = (p.mix as Partial<Mix>)[k];
        if (typeof v === 'number' && v >= 0 && v <= 100) m[k] = Math.round(v);
      }
      // the first scale: the same loudness on today's fader
      if ((p as { mixScale?: number }).mixScale !== MIX_SCALE)
        m.sub = Math.min(100, Math.round((70 * Math.sqrt(m.sub / 35)) / 5) * 5);
      out.mix = m;
    }
    if (p.clickPat) out.clickPat = cleanClickPattern(p.clickPat);
    if (p.speedUp && typeof p.speedUp === 'object') {
      const u = p.speedUp as Partial<SpeedUp>;
      out.speedUp = {
        on: u.on === true,
        step: SPEED_STEPS.includes(u.step as number) ? u.step! : 4,
        every: SPEED_EVERY.includes(u.every as number) ? u.every! : 2,
        to: Number.isInteger(u.to) ? Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, u.to!)) : 120,
      };
    }
    if (p.moveMode === 'pulse' || p.moveMode === 'beat' || p.moveMode === 'place')
      out.moveMode = p.moveMode;
    if (Array.isArray(p.fillSizes)) {
      const sizes = p.fillSizes.filter((n) => Number.isInteger(n) && n >= 1 && n <= 16);
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
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...p, mixScale: MIX_SCALE }));
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

export interface ContextMenuState {
  x: number;
  y: number;
  kind: 'tiles' | 'range' | 'caret' | 'bar';
  bar: number;
  k: number;
  /** Opened by a finger held down: taps count only once that finger is up. */
  touch: boolean;
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
  fillPanel: 'browse' | 'vary' | 'land' | null;
  /** Land a pattern: the tiles of the pattern being tried (kept while the app is open). */
  landPattern: number[];
  /** Land: the last tile falls on the 1 after the stretch (not written), like a tihai's. */
  landOn1: boolean;
  /** Land: only the ways that begin anywhere / on a beat / on a 1. */
  landFrom: 'any' | 'beat' | 'one';
  /** Land: the pattern is built of sizes, or of long and short tiles ("L S S"). */
  landMode: 'sizes' | 'ls';
  /** Land: the long–short pattern being tried. */
  landLS: LS[];
  fillSort: FillSort;
  /** Browse: which shapes to list ('shapes' = all shaped fills, 'any' = every fill, sorted). */
  fillShape: ShapeFamily | 'shapes' | 'any' | 'mine' | 'bred' | 'echo';
  /** Browse: only fills with exactly this many tiles (null = any number). */
  fillTiles: number | null;
  /** Browse as a list, or as a map of the fills laid out by two measures. */
  fillView: 'list' | 'map';
  fillAxes: [FillAxis, FillAxis];
  /** Fills saved with ♥ (device preference). */
  motifs: number[][];
  /** Bars counted in before Play in the editor: off, 1 or 2 (a device preference). */
  countIn: 0 | 1 | 2;
  /** Practice: the tiles heard, silent, or in turn (device preferences; see DevicePrefs). */
  tiles: TilesMode;
  turns: { on: number; off: number };
  countSub: boolean;
  landDrum: boolean;
  mix: Mix;
  clickPat: ClickPattern;
  speedUp: SpeedUp;
  /** While playing with Speed up: how much faster than the piece's tempo it is by now. */
  tempoBoost: number;
  /** While playing: this time round the tiles are silent (the score goes grey). */
  hushed: boolean;
  /** The practice popover beside Play (count-in, tiles heard or silent). */
  practiceOpen: boolean;
  /** Its page: practice (tempo, count-in, tiles), the click pattern, the mixer. */
  practiceTab: 'practice' | 'click' | 'mix';
  /** While playing with a click pattern: the bar of its cycle that sounds now. */
  clickBarNow: number | null;
  /**
   * While playing with a click pattern: bars heard minus the playing bar's number, so the score
   * can show which bar of the cycle every written bar is in this time round.
   */
  clickPhase: number | null;
  /** The docked subdivision row, for the beats picked in the band, or under the selection, range or caret. */
  subPanel: boolean;
  /** Beats picked in the subdivision band (first to last, both included): what the row works on. */
  beatSel: { a: number; b: number } | null;
  /** The modulation dialog: adding one at a beat, or editing one (index into meter.sections). */
  modDialog: { at: number } | { index: number } | null;
  /** The endings dialog: a new ending over pulses [ka, kb), or editing one (index into voltas). */
  voltaDialog: { ka: number; kb: number } | { index: number } | null;
  /** The metre dialog: the bars from this beat on (0 = the whole piece). */
  meterDialog: { at: number } | null;
  /** The bars dialog: add or remove bars anywhere. */
  barsDialog: boolean;
  /**
   * The context menu (right-click, long press, ⇧F10): where it opens (client px), what it is
   * about, the bar that was pointed at (0-based) and the pulse there.
   */
  menu: ContextMenuState | null;
  /** Bars about to be removed (0-based, first to last): tinted in the score as a warning. */
  doomed: { a: number; b: number } | null;
  /**
   * Swapping two stretches: the first one, marked (pulses) while the other one is chosen.
   * Cleared by any change to the document, Esc and the swap itself.
   */
  swapA: { a: number; b: number } | null;
  /** The row dialog: how many bars the row at this time holds. */
  rowDialog: { t: number } | null;
  /** The dialog that says where Play starts. */
  startDialog: boolean;
  /** Where Play starts (beats, on a pulse); null = from the top. Not part of the piece. */
  playStart: number | null;
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
  /** Count-in: beat (1-based) of `of` in the bar, and the bar (1-based) of `bars`. */
  countdown: { beat: number; of: number; bar?: number; bars?: number } | null;
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
  landPattern: [],
  landOn1: false,
  landFrom: 'any',
  landMode: 'sizes',
  landLS: [],
  fillSort: 'onbeat',
  fillShape: 'shapes',
  fillTiles: null,
  fillView: 'list',
  fillAxes: ['tiles', 'sync'],
  motifs: [],
  countIn: 0,
  tiles: 'on',
  turns: { on: 1, off: 1 },
  countSub: false,
  landDrum: true,
  mix: { ...MIX_DEFAULT },
  clickPat: CLICK_PATTERN,
  speedUp: { on: false, step: 4, every: 2, to: 120 },
  tempoBoost: 0,
  hushed: false,
  practiceOpen: false,
  practiceTab: 'practice',
  clickBarNow: null,
  clickPhase: null,
  subPanel: false,
  beatSel: null,
  modDialog: null,
  voltaDialog: null,
  markDialog: null,
  meterDialog: null,
  barsDialog: false,
  menu: null,
  doomed: null,
  swapA: null,
  rowDialog: null,
  startDialog: false,
  playStart: null,
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
    s.motifs !== p.motifs ||
    s.countIn !== p.countIn ||
    s.tiles !== p.tiles ||
    s.turns !== p.turns ||
    s.countSub !== p.countSub ||
    s.landDrum !== p.landDrum ||
    s.mix !== p.mix ||
    s.clickPat !== p.clickPat ||
    s.speedUp !== p.speedUp
  )
    savePrefs({
      theme: s.theme,
      ticks: s.ticks,
      click: s.click,
      moveMode: s.moveMode,
      fillSizes: s.fillSizes,
      motifs: s.motifs,
      countIn: s.countIn,
      tiles: s.tiles,
      turns: s.turns,
      countSub: s.countSub,
      landDrum: s.landDrum,
      mix: s.mix,
      clickPat: s.clickPat,
      speedUp: s.speedUp,
    });
});
