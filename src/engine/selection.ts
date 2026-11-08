import { isSpace } from './doc';
import type { Item, ItemId } from './types';

/** Indices of the selected groups (the space is never selectable), in item order. */
export function selectedIndices(items: readonly Item[], ids: Iterable<ItemId>): number[] {
  const set = new Set(ids);
  const out: number[] = [];
  items.forEach((x, i) => {
    if (!isSpace(x) && set.has(x.id)) out.push(i);
  });
  return out;
}

export function isContiguous(indices: readonly number[]): boolean {
  return indices.length > 0 && indices.every((v, i) => i === 0 || v === indices[i - 1]! + 1);
}

/** Ids of all groups between two items (inclusive), in order. */
export function rangeIds(items: readonly Item[], a: ItemId, b: ItemId): ItemId[] {
  const ia = items.findIndex((x) => x.id === a);
  const ib = items.findIndex((x) => x.id === b);
  if (ia < 0 || ib < 0) return [];
  const [lo, hi] = ia < ib ? [ia, ib] : [ib, ia];
  return items
    .slice(lo, hi + 1)
    .filter((x) => !isSpace(x))
    .map((x) => x.id);
}

/**
 * Where something dropped at pulse k would be inserted. The open space stays whole:
 * dropping inside it joins the start or the ending, whichever half k falls into.
 */
export function insertionIndex(items: readonly Item[], k: number): number {
  let a = 0;
  for (let i = 0; i < items.length; i++) {
    const x = items[i]!;
    if (isSpace(x)) {
      if (x.n > 0 && k >= a && k < a + x.n) return k < a + x.n / 2 ? i : i + 1;
      if (x.n === 0 && k < a) return i;
    } else if (k < a + x.n / 2) return i;
    a += x.n;
  }
  return items.length;
}
