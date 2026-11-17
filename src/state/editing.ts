import * as E from '../engine';
import type { GroupKind, GroupSpec, ItemId } from '../engine';
import { rowOf } from '../score/geometry';
import { view } from '../score/view';
import { startPlayback, stopPlayback } from '../audio/player';
import { ui as sfx } from '../audio/voices';
import {
  announce,
  barsLabel,
  cutBars,
  paintSubdivision,
  plural,
  run,
  toast,
  wholeBars,
} from './actions';
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
  const b = E.beatOfPulse(grid, k);
  const j = k - grid.pre[b]!;
  const per = grid.pre[b + 1]! - grid.pre[b]!;
  const bb = E.barBeat(d.meter, b);
  return `bar ${bb.bar}, beat ${bb.beat}${j ? ` +${j}/${per}` : ''}`;
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
  if (s.beatSel) return void setUi({ beatSel: null, subPanel: false });
  if (s.selection.length || s.range) {
    const k = caretPulse();
    setUi({ selection: [], anchor: null, multi: false });
    if (k !== null) setCaret(k, { quiet: true });
    announce('Selection cleared');
  } else if (s.swapA) {
    setUi({ swapA: null });
    announce('Swap cancelled');
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
  const at = s.caret ?? defaultCaret();
  let r = E.insertAtPulse(d, at, groups);
  // writing on at the very end of a full piece: it grows by the bars that takes, as a score
  // does when you keep writing (one step to undo). Only with the caret put there on purpose.
  let grown = 0;
  if (r.report.reason === 'no-room' && s.caret !== null && at === TS()) {
    for (let n = 1; n <= 8 && !grown; n++) {
      const longer = E.appendBars(d, n);
      if (!longer.report.ok) break;
      const tried = E.insertAtPulse(E.joinRests(longer.doc), at, groups);
      if (tried.report.ok) {
        r = tried;
        grown = n;
      }
    }
  }
  if (r.report.reason === 'no-room') {
    sfx.nope();
    const free = E.freePulses(d);
    toast(
      free
        ? `${text} needs ${plural(sum(groups), 'pulse')}; only ${free} open`
        : d.items.some((x) => x.kind === 'rest')
          ? 'No room at the caret. Tap an empty stretch to write there'
          : 'The piece is full. Remove or shorten a group to write',
    );
    return false;
  }
  if (!run(r, { label, select: 'none', sound })) return false;
  setCaret(r.caret, { quiet: true });
  if (grown) toast(`${plural(grown, 'bar')} added to go on writing`, { undo: true });
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
    // whole bars: the first Backspace empties them (they stay selected and the toast offers to
    // take the bars away too); Backspace on bars that are already empty removes the bars, like
    // an empty line in a text
    const bars = wholeBars();
    if (bars) {
      let at = 0;
      const empty = !d.items.some((x) => {
        const hit = x.kind === 'sound' && at < b && at + x.n > a;
        at += x.n;
        return hit;
      });
      const count = bars.b - bars.a + 1;
      if (empty) {
        cutBars(bars.a, count);
        return true;
      }
      if (run(E.clearRange(d, a, b), { label: 'clear range', select: 'none', sound: sfx.remove })) {
        setUi({ range: { a, b }, rangeAnchor: a, caret: b });
        const name = barsLabel(bars.a, bars.b);
        toast(`${name[0]!.toUpperCase()}${name.slice(1)} emptied`, {
          action: {
            label: count === 1 ? 'Remove the bar' : 'Remove the bars',
            run: () => void cutBars(bars.a, count),
          },
        });
      }
      return true;
    }
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

/**
 * Shift+Space: with tiles or a range selected, loop that stretch (to practise or hear a passage
 * again and again); with only a caret, play on from it.
 */
export function playFromCaret(): void {
  if (ui().playing) return stopPlayback();
  const d = doc();
  const region = selectedRegion();
  const grid = E.buildGrid(d.meter);
  if (region && region.b > region.a) {
    const loop = { a: grid.times[region.a]!, b: grid.times[Math.min(region.b, grid.TS)]! };
    startPlayback(loop.a, loop);
    announce(`Looping ${plural(region.b - region.a, 'pulse')}. Space stops.`);
    return;
  }
  const k = ui().caret ?? 0;
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

/* ------------------------------------------------------------------ subdivision where you are */

/**
 * The beats the subdivision row works on: those picked in the band, else the beats under the
 * selection or range, else the caret's beat (the beat it starts, or is inside).
 */
export function beatsHere(): number[] {
  const d = doc();
  const grid = E.buildGrid(d.meter);
  const picked = ui().beatSel;
  if (picked) {
    const out: number[] = [];
    for (let x = Math.max(0, picked.a); x <= Math.min(picked.b, grid.NB - 1); x++) out.push(x);
    return out;
  }
  const region = selectedRegion();
  const caret = ui().caret;
  if (!region && caret === null) return [];
  const a = region ? region.a : Math.min(caret!, grid.TS - 1);
  const b = region ? Math.max(region.a, region.b - 1) : a;
  const out: number[] = [];
  for (let x = E.beatOfPulse(grid, a); x <= E.beatOfPulse(grid, b); x++) out.push(x);
  return out;
}

/** Open the docked subdivision row for the beats here. */
export function openSubdivision(): void {
  if (!beatsHere().length) {
    sfx.nope();
    return void toast('Tap the band under the tiles to pick beats');
  }
  setUi({ subPanel: true, fillPanel: null });
}

/**
 * Pick beats in the band (a tap, or a drag along it): they light up there and the row of ratios
 * opens for them. One selection at a time: tiles and ranges let go.
 */
export function pickBeats(a: number, b: number): void {
  const s = ui();
  if (s.selection.length || s.range) escape();
  setUi({ beatSel: { a: Math.min(a, b), b: Math.max(a, b) }, subPanel: true, fillPanel: null });
  const n = Math.abs(b - a) + 1;
  announce(`${plural(n, 'beat')} picked. Choose a ratio.`);
}

/** Every beat of the piece, for one ratio throughout. */
export function pickAllBeats(): void {
  pickBeats(0, doc().meter.subdivision.length - 1);
}

/** Close the row of ratios and let go of the beats picked in the band. */
export function closeSubdivision(): void {
  setUi({ subPanel: false, beatSel: null });
}

/**
 * Give these beats d pulses (and make d the brush). A range or caret follows its beats to the new
 * pulses, so the next ratio tried lands on the same beats.
 */
export function subdivideBeats(beats: readonly number[], d: number): void {
  const before = ui();
  setUi({ brush: d });
  paintSubdivision([...beats], d);
  const grid = E.buildGrid(doc().meter);
  const a = grid.pre[beats[0]!]!;
  const b = grid.pre[beats[beats.length - 1]! + 1] ?? grid.TS;
  if (before.beatSel) return; // beats picked in the band stay picked: try another ratio
  if (before.range) setRange(a, b);
  else if (before.caret !== null && !before.selection.length) setCaret(a, { quiet: true });
}

/**
 * ↑ ↓ : the caret goes to the row above or below, to the same place along the row, like a text
 * caret (⇧ carries the range there). Above the first row is the very start, below the last the
 * very end.
 */
export function caretRow(dir: -1 | 1, extend = false): void {
  const g = view.geo;
  if (!g) return;
  const grid = E.buildGrid(doc().meter);
  const s = ui();
  const anchor = s.rangeAnchor ?? s.caret ?? defaultCaret();
  const from = extend
    ? s.range
      ? s.range.a === anchor
        ? s.range.b
        : s.range.a
      : anchor
    : s.range
      ? dir < 0
        ? s.range.a
        : s.range.b
      : (s.caret ?? defaultCaret());
  const t = grid.times[Math.min(from, grid.TS)]!;
  // the very end belongs to the last row (it is where that row ends)
  const r = from >= grid.TS ? g.rows.length - 1 : rowOf(g, t);
  const to = r + dir;
  let k: number;
  if (to < 0) k = 0;
  else if (to >= g.rows.length) k = grid.TS;
  else {
    const row = g.rows[to]!;
    k = E.nearestPulse(grid, row.b0 + Math.min(t - g.rows[r]!.b0, row.nb));
  }
  if (k === from) return sfx.nope();
  sfx.snap();
  if (extend) setRange(anchor, k);
  else setCaret(k);
}

/** ⌘← / ⌘→: the caret goes to the bar line before or after it. */
export function caretBar(dir: -1 | 1): void {
  const d = doc();
  const grid = E.buildGrid(d.meter);
  const s = ui();
  const from = s.range ? (dir < 0 ? s.range.a : s.range.b) : (s.caret ?? defaultCaret());
  const lines = [...E.barMap(d.meter).barStarts.map((b) => grid.pre[b]!), grid.TS];
  const k = dir > 0 ? lines.find((x) => x > from) : [...lines].reverse().find((x) => x < from);
  if (k === undefined) return sfx.nope();
  sfx.snap();
  setCaret(k);
}

/**
 * The keys that work on tiles (S, M, D, + −, ⇧R) also work without selecting first. With a range,
 * on the groups that begin in it. With only a caret, on the group that ends at the caret (the one
 * just written), else the one the caret is in or before; and afterwards the caret stands after
 * what was worked on, so writing goes straight on ("3 + D D" = 4 4 4).
 */
export function onTilesHere(op: () => void): void {
  const s = ui();
  if (s.selection.length) return op();
  const items = doc().items;
  const ids: ItemId[] = [];
  const k = s.caret ?? defaultCaret();
  let at = 0;
  if (s.range) {
    for (const x of items) {
      if (x.kind === 'sound' && at >= s.range.a && at < s.range.b) ids.push(x.id);
      at += x.n;
    }
  } else {
    let ends: ItemId | null = null;
    let holds: ItemId | null = null;
    for (const x of items) {
      if (x.kind === 'sound' && x.n > 0) {
        if (at + x.n === k) ends = x.id;
        if (at <= k && k < at + x.n) holds = x.id;
      }
      at += x.n;
    }
    const id = ends ?? holds;
    if (id) ids.push(id);
  }
  if (!ids.length) {
    sfx.nope();
    return void toast('Nothing here: put the caret after a group, or select some');
  }
  setUi({ selection: ids, anchor: ids[0]!, range: null, rangeAnchor: null });
  op();
  if (s.range) return;
  // only a caret: back to writing, after what was worked on
  const left = ui().selection.length ? ui().selection : ids;
  const span = E.spanOf(doc(), left);
  setUi({ selection: [], anchor: null, multi: false, caret: span ? span.b : k });
}
