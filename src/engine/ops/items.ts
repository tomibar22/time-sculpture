import { buildGrid } from '../grid';
import { freePulses, group, isSpace, mintIds, spaceIndex, withItems } from '../doc';
import { fail, report } from '../report';
import { isContiguous, selectedIndices } from '../selection';
import { sampleTiling } from '../count';
import type { AddAt, Doc, GroupKind, Item, ItemId, OpResult } from '../types';
import { SPACE_ID } from '../types';

const same = (doc: Doc, reason: Parameters<typeof fail>[0]): OpResult => ({
  doc,
  report: fail(reason),
});

/** Add a group of `size` pulses. Fails with `no-room` if the space is too small. */
export function add(doc: Doc, size: number, kind: GroupKind, at: AddAt): OpResult {
  if (!Number.isInteger(size) || size < 1) return same(doc, 'too-small');
  if (size > freePulses(doc)) return same(doc, 'no-room');
  const si = spaceIndex(doc.items);
  const idx =
    at === 'start' ? si : at === 'end' ? si + 1 : Math.max(0, Math.min(doc.items.length, at.index));
  const { ids, nextId } = mintIds(doc, 1);
  const items = doc.items.slice();
  items.splice(idx, 0, group(ids[0]!, size, kind));
  return { doc: withItems(doc, items, nextId), report: report({ created: ids }) };
}

/** Split each selected group of 2+ into ceil/floor halves. The first half keeps the id. */
export function split(doc: Doc, ids: Iterable<ItemId>): OpResult {
  const idx = selectedIndices(doc.items, ids).filter((i) => doc.items[i]!.n >= 2);
  if (!idx.length) return same(doc, 'too-small');
  const { ids: fresh, nextId } = mintIds(doc, idx.length);
  const set = new Set(idx);
  const out: Item[] = [];
  let f = 0;
  doc.items.forEach((x, i) => {
    if (!set.has(i) || isSpace(x)) return void out.push(x);
    out.push({ ...x, n: Math.ceil(x.n / 2) }, group(fresh[f++]!, Math.floor(x.n / 2), x.kind));
  });
  return { doc: withItems(doc, out, nextId), report: report({ created: fresh }) };
}

/** Merge a contiguous selection of 2+ groups into one (keeps the first id; rest only if all were rests). */
export function merge(doc: Doc, ids: Iterable<ItemId>): OpResult {
  const idx = selectedIndices(doc.items, ids);
  if (idx.length < 2) return same(doc, 'nothing-selected');
  if (!isContiguous(idx)) return same(doc, 'not-contiguous');
  const block = idx.map((i) => doc.items[i]!);
  const n = block.reduce((a, x) => a + x.n, 0);
  const kind: GroupKind = block.every((x) => x.kind === 'rest') ? 'rest' : 'sound';
  const items = doc.items.slice();
  items.splice(idx[0]!, idx.length, group(block[0]!.id, n, kind));
  return {
    doc: withItems(doc, items),
    report: report({ removed: block.slice(1).map((x) => x.id) }),
  };
}

/** Copy the selection right after its last group. Needs room in the space. */
export function duplicate(doc: Doc, ids: Iterable<ItemId>): OpResult {
  const idx = selectedIndices(doc.items, ids);
  if (!idx.length) return same(doc, 'nothing-selected');
  const block = idx.map((i) => doc.items[i]!);
  const need = block.reduce((a, x) => a + x.n, 0);
  if (need > freePulses(doc)) return same(doc, 'no-room');
  const { ids: fresh, nextId } = mintIds(doc, block.length);
  const copies = block.map((x, i) => group(fresh[i]!, x.n, x.kind === 'rest' ? 'rest' : 'sound'));
  const items = doc.items.slice();
  items.splice(idx[idx.length - 1]! + 1, 0, ...copies);
  return { doc: withItems(doc, items, nextId), report: report({ created: fresh }) };
}

export function remove(doc: Doc, ids: Iterable<ItemId>): OpResult {
  const idx = selectedIndices(doc.items, ids);
  if (!idx.length) return same(doc, 'nothing-selected');
  const set = new Set(idx);
  const items = doc.items.filter((_, i) => !set.has(i));
  return {
    doc: withItems(doc, items),
    report: report({ removed: idx.map((i) => doc.items[i]!.id) }),
  };
}

/** If any selected group sounds, silence them all; otherwise make them all sound. */
export function toggleKind(doc: Doc, ids: Iterable<ItemId>): OpResult {
  const idx = selectedIndices(doc.items, ids);
  if (!idx.length) return same(doc, 'nothing-selected');
  const toRest = idx.some((i) => doc.items[i]!.kind === 'sound');
  const kind: GroupKind = toRest ? 'rest' : 'sound';
  const set = new Set(idx);
  const items = doc.items.map((x, i) => (set.has(i) && !isSpace(x) ? { ...x, kind } : x));
  return { doc: withItems(doc, items), report: report() };
}

/** Kind of a selection after toggling (for button labels). */
export function toggledKind(doc: Doc, ids: Iterable<ItemId>): GroupKind {
  const idx = selectedIndices(doc.items, ids);
  return idx.some((i) => doc.items[i]!.kind === 'sound') ? 'rest' : 'sound';
}

/** Fill the whole space with tray pieces, chosen uniformly among all tilings. Inserted at the end of the start. */
export function fillWithPieces(
  doc: Doc,
  tray: readonly number[],
  rng: () => number = Math.random,
): OpResult {
  const R = freePulses(doc);
  if (R <= 0) return same(doc, 'no-room');
  const tiling = sampleTiling(R, tray, rng);
  if (!tiling) return same(doc, 'cannot-fill');
  const { ids, nextId } = mintIds(doc, tiling.length);
  const items = doc.items.slice();
  items.splice(spaceIndex(items), 0, ...tiling.map((n, i) => group(ids[i]!, n, 'sound')));
  return { doc: withItems(doc, items, nextId), report: report({ created: ids }) };
}

/** Fill the whole space with one rest. */
export function fillWithSilence(doc: Doc): OpResult {
  const R = freePulses(doc);
  if (R <= 0) return same(doc, 'no-room');
  const { ids, nextId } = mintIds(doc, 1);
  const items = doc.items.slice();
  items.splice(spaceIndex(items), 0, group(ids[0]!, R, 'rest'));
  return { doc: withItems(doc, items, nextId), report: report({ created: ids }) };
}

export function clear(doc: Doc): OpResult {
  if (doc.items.length === 1) return same(doc, 'no-change');
  const items: Item[] = [{ id: SPACE_ID, kind: 'space', n: buildGrid(doc.meter).TS }];
  return {
    doc: withItems(doc, items),
    report: report({ removed: doc.items.filter((x) => !isSpace(x)).map((x) => x.id) }),
  };
}
