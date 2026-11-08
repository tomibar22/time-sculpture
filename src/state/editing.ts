import * as E from '../engine';
import type { GroupKind, GroupSpec } from '../engine';
import { startPlayback, stopPlayback } from '../audio/player';
import { ui as sfx } from '../audio/voices';
import { announce, paintSubdivision, plural, run, toast } from './actions';
import { useDocStore, useUiStore } from './store';

/**
 * Word-processor editing on the timeline. The caret sits on any pulse (inside tiles too, like a
 * text caret between letters); Shift+arrows select a pulse range, which may cover tiles, parts
 * of tiles, silence and open space. Typing, deleting, copying and pasting work on the caret or
 * the range; with tiles selected they work on the tiles.
 */

const doc = () => useDocStore.getState().doc;
const ui = () => useUiStore.getState();
const setUi = (p: Parameters<ReturnType<typeof useUiStore.getState>['set']>[0]) => ui().set(p);
const TS = () => E.buildGrid(doc().meter).TS;

/* ------------------------------------------------------------------ positions */

/** "bar 1, beat 2" (or "beat 2 +1/4" inside a beat) for a pulse. */
export function describePulse(k: number): string {
  const d = doc();
  const grid = E.buildGrid(d.meter);
  if (k >= grid.TS) return 'the very end';
  const B = d.meter.beatsPerCycle;
  const b = E.beatOfPulse(grid, k);
  const j = k - grid.pre[b]!;
  const per = grid.pre[b + 1]! - grid.pre[b]!;
  return `bar ${Math.floor(b / B) + 1}, beat ${(b % B) + 1}${j ? ` +${j}/${per}` : ''}`;
}

/** Where typing goes when there is no caret: the end of the start. */
const defaultCaret = () => E.spaceRange(doc()).a;

/** The caret pulse, the end of the range, or the end of the tile selection. */
export function caretPulse(): number | null {
  const s = ui();
  if (s.range) return s.range.b;
  const span = E.spanOf(doc(), s.selection);
  if (span) return span.b;
  return s.caret;
}

/** The selected region: a pulse range, or the span of the selected tiles. */
export function selectedRegion(): { a: number; b: number } | null {
  const s = ui();
  return s.range ?? E.spanOf(doc(), s.selection);
}

export function setCaret(k: number | null, opts: { quiet?: boolean } = {}): void {
  if (k === null) return setUi({ caret: null, range: null, rangeAnchor: null });
  const c = E.clamp(Math.round(k), 0, TS());
  setUi({ caret: c, range: null, rangeAnchor: null, selection: [], anchor: null, multi: false });
  if (!opts.quiet) announce(`Caret: ${describePulse(c)}`);
}

export function setRange(anchor: number, head: number): void {
  const a = Math.min(anchor, head);
  const b = Math.max(anchor, head);
  if (a === b) return setCaret(anchor, { quiet: true });
  setUi({
    range: { a, b },
    rangeAnchor: anchor,
    caret: head,
    selection: [],
    anchor: null,
    multi: false,
  });
  announce(`Selected ${plural(b - a, 'pulse')}, from ${describePulse(a)}`);
}

/** Next/previous tile boundary from a pulse (for ⌥ arrows, like jumping by words). */
function boundaryFrom(k: number, dir: -1 | 1): number {
  const bs = E.boundaryPulses(doc());
  if (dir > 0) return bs.find((x) => x > k) ?? TS();
  return [...bs].reverse().find((x) => x < k) ?? 0;
}

/** ←/→ without a tile selection: move the caret one pulse (or to the next tile edge). */
export function moveCaret(dir: -1 | 1, byTile = false): void {
  const s = ui();
  if (s.range) {
    sfx.snap();
    return setCaret(dir < 0 ? s.range.a : s.range.b);
  }
  const k = s.caret ?? defaultCaret();
  const next = byTile ? boundaryFrom(k, dir) : k + dir;
  if (next < 0 || next > TS()) return sfx.nope();
  sfx.snap();
  setCaret(next);
}

export function caretHome(end: boolean): void {
  sfx.snap();
  setCaret(end ? TS() : 0);
}

/** Shift+←/→: grow or shrink the pulse range like text, from the caret. */
export function extendRange(dir: -1 | 1, byTile = false): void {
  const s = ui();
  const anchor = s.rangeAnchor ?? s.caret ?? defaultCaret();
  const head0 = s.range ? (s.range.a === anchor ? s.range.b : s.range.a) : anchor;
  const head = byTile ? boundaryFrom(head0, dir) : head0 + dir;
  if (head < 0 || head > TS()) return sfx.nope();
  sfx.snap();
  setRange(anchor, head);
}

/** Shift+←/→ with tiles selected: grow or shrink the tile selection. */
export function extendSelection(dir: -1 | 1): void {
  const d = doc();
  const s = ui();
  let idx = E.selectedIndices(d.items, s.selection);
  if (!idx.length) return extendRange(dir);
  if (!E.isContiguous(idx)) idx = [idx[0]!, idx[idx.length - 1]!];
  const anchorI = s.anchor ? E.indexOfId(d.items, s.anchor) : idx[0]!;
  let lo = idx[0]!;
  let hi = idx[idx.length - 1]!;
  const movingHi = anchorI <= lo;
  if (movingHi) hi += dir;
  else lo += dir;
  const step = (k: number) => (d.items[k] && E.isSpace(d.items[k]!) ? k + dir : k);
  if (movingHi) hi = step(hi);
  else lo = step(lo);
  if (lo < 0 || hi >= d.items.length) return sfx.nope();
  if (lo > hi) return setUi({ selection: [d.items[anchorI]!.id] });
  const sel = d.items
    .slice(lo, hi + 1)
    .filter(E.isGroup)
    .map((x) => x.id);
  sfx.snap();
  setUi({ selection: sel, anchor: d.items[anchorI]?.id ?? sel[0] ?? null });
  const n = sel.reduce((a, id) => a + (E.findItem(d, id)?.n ?? 0), 0);
  announce(`${sel.length} selected, ${plural(n, 'pulse')}`);
}

/** Esc: a selection or range collapses to a caret at its end; a lone caret is dismissed. */
export function escape(): void {
  const s = ui();
  if (s.selection.length || s.range) {
    const k = caretPulse();
    setUi({ selection: [], anchor: null, multi: false });
    if (k !== null) setCaret(k, { quiet: true });
    announce('Selection cleared');
  } else if (s.caret !== null) {
    setUi({ caret: null, multi: false });
    announce('Caret removed');
  } else setUi({ multi: false });
}

/* ------------------------------------------------------------------ writing */

const sum = (gs: readonly GroupSpec[]) => gs.reduce((a, g) => a + g.n, 0);

/**
 * Put groups where the user is writing: over a range (they must fit; the rest of the range
 * becomes silence), over selected tiles, or at the caret. Leaves the caret after them.
 */
function write(groups: GroupSpec[], label: string): boolean {
  const d = doc();
  const s = ui();
  const sound = () => (groups[0]?.kind === 'rest' ? sfx.remove() : sfx.add(groups[0]?.n ?? 3));
  const text = E.formatGroups(groups);
  if (s.range) {
    const { a, b } = s.range;
    const need = sum(groups);
    if (need > b - a) {
      sfx.nope();
      toast(`${text} needs ${plural(need, 'pulse')}; the selection is ${b - a}`);
      return false;
    }
    const fill = need < b - a ? [...groups, { n: b - a - need, kind: 'rest' as const }] : groups;
    if (!run(E.fillRange(d, a, b, fill), { label, select: 'none', sound })) return false;
    setCaret(a + need, { quiet: true });
    return true;
  }
  if (s.selection.length) {
    const r = E.replaceGroups(d, s.selection, groups);
    if (r.report.reason === 'not-contiguous') {
      sfx.nope();
      toast('Select neighbouring groups to type or paste over them');
      return false;
    }
    if (!run(r, { label, select: 'none', sound })) return false;
    const span = E.spanOf(r.doc, r.report.created);
    setCaret(span ? span.b : 0, { quiet: true });
    return true;
  }
  const r = E.insertAtPulse(d, s.caret ?? defaultCaret(), groups);
  if (r.report.reason === 'no-room') {
    sfx.nope();
    const free = E.freePulses(d);
    toast(
      free
        ? `${text} needs ${plural(sum(groups), 'pulse')}; only ${free} open`
        : 'No open space left',
    );
    return false;
  }
  if (!run(r, { label, select: 'none', sound })) return false;
  setCaret(r.caret, { quiet: true });
  return true;
}

/**
 * Type a size (1–9): over a range, over selected tiles, or at the caret (without a caret, at the
 * end of the start). Every digit is its own group.
 */
export function typeDigit(digit: number, kind: GroupKind = 'sound'): void {
  if (digit < 1 || digit > 9) return sfx.nope();
  if (write([{ n: digit, kind }], kind === 'rest' ? `(${digit})` : `+${digit}`))
    announce(`${kind === 'rest' ? 'Silence of ' : ''}${digit} typed, ${E.freePulses(doc())} open`);
}

/**
 * Backspace / Delete. A range becomes silence. At the caret, the tile before (Backspace) or after
 * (Delete) it is removed. Returns false when tiles are selected (the caller removes them).
 */
export function deleteAtCaret(dir: -1 | 1): boolean {
  const d = doc();
  const s = ui();
  if (s.selection.length) return false;
  if (s.range) {
    const { a, b } = s.range;
    if (run(E.clearRange(d, a, b), { label: 'clear range', select: 'none', sound: sfx.remove })) {
      setCaret(a, { quiet: true });
      announce(`${plural(b - a, 'pulse')} silenced`);
    }
    return true;
  }
  if (s.caret === null) return false;
  const k = s.caret;
  let start = 0;
  let j = -1;
  for (let i = 0; i < d.items.length; i++) {
    const x = d.items[i]!;
    const e = start + x.n;
    if (dir < 0 ? start < k && k <= e : start <= k && k < e) {
      j = i;
      break;
    }
    start = e;
  }
  const x = d.items[j];
  if (!x || E.isSpace(x)) {
    sfx.nope();
    announce(x ? 'The open space is next to the caret' : 'Nothing to delete');
    return true;
  }
  const r = E.remove(d, [x.id]);
  if (run(r, { label: `−${E.describeItem(x)}`, select: 'none', sound: sfx.remove })) {
    setCaret(E.startOf(r.doc.items, j), { quiet: true });
    announce(`Deleted ${x.kind === 'rest' ? 'silence' : 'group'} of ${x.n}`);
  }
  return true;
}

/* ------------------------------------------------------------------ clipboard */

export function copySelection(cut = false): string | null {
  const d = doc();
  const s = ui();
  const groups = s.range ? E.sliceRange(d, s.range.a, s.range.b) : E.copyGroups(d, s.selection);
  if (!groups.length) return null;
  const text = E.formatGroups(groups);
  setUi({ clipboard: groups });
  if (!cut) {
    sfx.snap();
    toast(`Copied ${text}`);
    return text;
  }
  if (s.range) {
    const { a, b } = s.range;
    if (run(E.clearRange(d, a, b), { label: `cut ${text}`, select: 'none', sound: sfx.remove })) {
      setCaret(a, { quiet: true });
      toast(`Cut ${text}`, { undo: true });
    }
  } else {
    const first = E.selectedIndices(d.items, s.selection)[0]!;
    const r = E.remove(d, s.selection);
    if (run(r, { label: `cut ${text}`, select: 'none', sound: sfx.remove })) {
      setCaret(E.startOf(r.doc.items, first), { quiet: true });
      toast(`Cut ${text}`, { undo: true });
    }
  }
  return text;
}

/** For buttons: also put the text on the system clipboard (allowed inside a user gesture). */
export function copyButton(cut = false): void {
  const text = copySelection(cut);
  if (text) void navigator.clipboard?.writeText(text).catch(() => undefined);
}

export function paste(groups: GroupSpec[] = ui().clipboard): void {
  if (!groups.length) {
    sfx.nope();
    return void toast('Nothing to paste. Select groups and copy them first.');
  }
  const text = E.formatGroups(groups);
  if (write(groups, `paste ${text}`)) announce(`Pasted ${text}`);
}

/* ------------------------------------------------------------------ shaping */

export function resizeSelection(delta: 1 | -1): void {
  const sel = ui().selection;
  if (!sel.length) return sfx.nope();
  const r = E.resizeGroups(doc(), sel, delta);
  if (r.report.reason === 'too-small')
    return void (sfx.nope(), toast('A group needs at least 1 pulse'));
  if (run(r, { label: delta > 0 ? 'grow' : 'shrink', select: 'keep' })) {
    const one = sel.length === 1 ? E.findItem(r.doc, sel[0]!) : null;
    announce(
      one
        ? `Now ${one.n}, ${E.freePulses(r.doc)} open`
        : `${delta > 0 ? 'Grew' : 'Shrank'} ${plural(sel.length, 'group')}`,
    );
  }
}

export function reverseSelection(): void {
  const sel = ui().selection;
  const r = E.reverseGroups(doc(), sel);
  if (r.report.reason === 'nothing-selected')
    return void (sfx.nope(), toast('Select two or more neighbouring groups to reverse'));
  if (r.report.reason === 'no-change')
    return void (sfx.nope(), toast('It reads the same backwards'));
  if (run(r, { label: 'reverse', select: 'keep' })) announce('Reversed');
}

/* ------------------------------------------------------------------ playback */

/** Shift+Space: play from the caret (or the selection's start). */
export function playFromCaret(): void {
  if (ui().playing) return stopPlayback();
  const d = doc();
  const region = selectedRegion();
  const k = region ? region.a : (ui().caret ?? 0);
  const grid = E.buildGrid(d.meter);
  startPlayback(k >= grid.TS ? 0 : grid.times[k]!);
}

/* ------------------------------------------------------------------ trimming edges */

/**
 * ⌥←/→ move the end edge of the selection, ⌥⇧←/→ its start edge (by a pulse, or to the next
 * beat line in Beat mode). The opposite edge stays put; neighbours give way or silence fills in.
 */
export function trimSelection(side: 'start' | 'end', dir: -1 | 1): void {
  const d = doc();
  const idx = E.selectedIndices(d.items, ui().selection);
  if (!idx.length) return sfx.nope();
  const i = side === 'end' ? idx[idx.length - 1]! : idx[0]!;
  const x = d.items[i]!;
  const s0 = E.startOf(d.items, i);
  const edge = side === 'end' ? s0 + x.n : s0;
  let target = edge + dir;
  if (ui().moveMode === 'beat') {
    const grid = E.buildGrid(d.meter);
    const b = E.beatOfPulse(grid, Math.min(edge, grid.TS - 1));
    const onBeat = grid.pre[b] === edge;
    const nb = dir > 0 ? (edge >= grid.TS ? grid.NB : b + 1) : onBeat ? b - 1 : b;
    target = grid.pre[E.clamp(nb, 0, grid.NB)]!;
  }
  // growing = moving the edge outwards
  const delta = side === 'end' ? target - edge : edge - target;
  const r = E.trimEdge(d, x.id, side, delta);
  if (r.report.reason === 'out-of-range' || r.report.reason === 'no-change') return sfx.nope();
  if (!run(r, { label: `trim ${side}`, select: 'keep' })) return;
  const now = E.findItem(r.doc, x.id);
  const parts: string[] = [];
  if (r.report.shortened.length)
    parts.push(`${plural(r.report.shortened.length, 'group')} shortened`);
  if (r.report.covered.length) parts.push(`${plural(r.report.covered.length, 'group')} covered`);
  if (parts.length) toast(`Trimmed to ${now?.n}. ${parts.join(', ')}.`, { undo: true });
  else announce(`${now?.n} pulses`);
}

/** B: paint the brush subdivision on the beats under the selection. */
export function brushSelection(): void {
  const d = doc();
  const region = selectedRegion();
  if (!region) return sfx.nope();
  const grid = E.buildGrid(d.meter);
  const s0 = region.a;
  const e0 = region.b;
  const b0 = E.beatOfPulse(grid, s0);
  const b1 = E.beatOfPulse(grid, Math.max(s0, e0 - 1));
  const beats: number[] = [];
  for (let b = b0; b <= b1; b++) beats.push(b);
  paintSubdivision(beats);
}
