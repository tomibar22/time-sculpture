import { beatOfPulse, buildGrid } from '../grid';
import { clamp, group, isSpace, mintIds, startOf, syncSpace, withItems } from '../doc';
import { fail, report } from '../report';
import { insertionIndex, isContiguous, selectedIndices } from '../selection';
import type { Doc, Group, Item, ItemId, MoveUnit, OpResult } from '../types';

/* ------------------------------------------------------------------ Place mode */

/** The items with the selection lifted out (the rest closes up; the space grows). */
export function liftSelection(
  doc: Doc,
  ids: Iterable<ItemId>,
): { block: Group[]; rest: readonly Item[] } | null {
  const idx = selectedIndices(doc.items, ids);
  if (!idx.length) return null;
  const set = new Set(idx);
  const block = idx.map((i) => doc.items[i] as Group);
  const rest = syncSpace(
    doc.items.filter((_, i) => !set.has(i)),
    buildGrid(doc.meter).TS,
  );
  return { block, rest };
}

/** Reorder: lift the selection and insert it at `restIndex` of the closed-up list. */
export function reorderTo(doc: Doc, ids: Iterable<ItemId>, restIndex: number): OpResult {
  const lifted = liftSelection(doc, ids);
  if (!lifted) return { doc, report: fail('nothing-selected') };
  const { block, rest } = lifted;
  const at = clamp(restIndex, 0, rest.length);
  const items = [...rest.slice(0, at), ...block, ...rest.slice(at)];
  if (items.every((x, i) => x.id === doc.items[i]!.id)) return { doc, report: fail('no-change') };
  return { doc: withItems(doc, items), report: report({ moved: block.map((x) => x.id) }) };
}

/**
 * Reorder by dropping at pulse k (Place drag). Dropping inside the space attaches the block
 * to the start or the ending, whichever is nearer, so the space stays one piece.
 */
export function reorderAtPulse(doc: Doc, ids: Iterable<ItemId>, k: number): OpResult {
  const lifted = liftSelection(doc, ids);
  if (!lifted) return { doc, report: fail('nothing-selected') };
  return reorderTo(doc, ids, insertionIndex(lifted.rest, k));
}

/** Reorder one step: hop over the neighbouring item (which may be the space) to the left or right. */
export function reorderStep(doc: Doc, ids: Iterable<ItemId>, dir: -1 | 1): OpResult {
  const idSet = new Set(ids);
  const idx = selectedIndices(doc.items, idSet);
  if (!idx.length) return { doc, report: fail('nothing-selected') };
  const j = dir < 0 ? idx[0]! - 1 : idx[idx.length - 1]! + 1;
  const neighbour = doc.items[j];
  if (!neighbour) return { doc, report: fail('out-of-range') };
  const lifted = liftSelection(doc, idSet)!;
  const ni = lifted.rest.findIndex((x) => x.id === neighbour.id);
  return reorderTo(doc, idSet, dir < 0 ? ni : ni + 1);
}

/* ------------------------------------------------------------------ Sliding on the grid */

/** Clamp a slide of a contiguous block so it stays inside the piece. */
export function clampSlide(doc: Doc, ids: Iterable<ItemId>, d: number): number {
  const idx = selectedIndices(doc.items, ids);
  if (!idx.length || !isContiguous(idx)) return 0;
  const s0 = startOf(doc.items, idx[0]!);
  const len = idx.reduce((a, i) => a + doc.items[i]!.n, 0);
  return clamp(Math.round(d), -s0, buildGrid(doc.meter).TS - s0 - len) || 0;
}

/** The slide (in pulses) for one arrow-key step by pulse or to the next/previous beat line. */
export function stepDelta(doc: Doc, ids: Iterable<ItemId>, dir: -1 | 1, unit: MoveUnit): number {
  const idx = selectedIndices(doc.items, ids);
  if (!idx.length || !isContiguous(idx)) return 0;
  let d: number = dir;
  if (unit === 'beat') {
    const grid = buildGrid(doc.meter);
    const s0 = startOf(doc.items, idx[0]!);
    const b = beatOfPulse(grid, s0);
    const onBeat = grid.pre[b] === s0;
    const nb = dir > 0 ? b + 1 : onBeat ? b - 1 : b;
    d = grid.pre[clamp(nb, 0, grid.NB)]! - s0;
  }
  return clampSlide(doc, ids, d);
}

/**
 * Slide a contiguous selection by d pulses. Ahead of the block, the space, rests and sounds give
 * way: they shrink from the side facing the block, and anything used up is covered and removed.
 * Behind it, the vacated time joins an adjacent rest or the space, otherwise it becomes a new rest.
 * The total never changes.
 */
export function slide(doc: Doc, ids: Iterable<ItemId>, delta: number): OpResult {
  const idx = selectedIndices(doc.items, ids);
  if (!idx.length) return { doc, report: fail('nothing-selected') };
  if (!isContiguous(idx)) return { doc, report: fail('not-contiguous') };
  const d = clampSlide(doc, ids, delta);
  if (d === 0) return { doc, report: fail('out-of-range') };

  const lo = idx[0]!;
  const hi = idx[idx.length - 1]!;
  const sizes = doc.items.map((x) => x.n);
  const shortened: ItemId[] = [];
  const covered: ItemId[] = [];
  const step = d > 0 ? 1 : -1;
  let remaining = Math.abs(d);
  for (let j = d > 0 ? hi + 1 : lo - 1; remaining > 0 && j >= 0 && j < sizes.length; j += step) {
    const take = Math.min(sizes[j]!, remaining);
    sizes[j]! -= take;
    remaining -= take;
    const x = doc.items[j]!;
    if (take > 0 && !isSpace(x)) {
      if (sizes[j] === 0) covered.push(x.id);
      else if (x.kind === 'sound') shortened.push(x.id);
    }
  }

  const created: ItemId[] = [];
  let nextId = doc.nextId;
  let insert: { at: number; item: Group } | null = null;
  const behind = d > 0 ? lo - 1 : hi + 1;
  const b = doc.items[behind];
  if (b && (isSpace(b) || b.kind === 'rest')) sizes[behind]! += Math.abs(d);
  else {
    const minted = mintIds(doc, 1);
    nextId = minted.nextId;
    created.push(minted.ids[0]!);
    insert = { at: d > 0 ? lo : hi + 1, item: group(minted.ids[0]!, Math.abs(d), 'rest') };
  }

  const out: Item[] = [];
  doc.items.forEach((x, i) => {
    if (insert && insert.at === i) out.push(insert.item);
    const n = sizes[i]!;
    if (!isSpace(x) && n === 0) return;
    out.push(n === x.n ? x : { ...x, n });
  });
  if (insert && insert.at === doc.items.length) out.push(insert.item);

  return { doc: withItems(doc, out, nextId), report: report({ shortened, covered, created }) };
}
