import { clamp, freePulses, group, indexOfId, isSpace, mintIds, withItems } from '../doc';
import { fail, report } from '../report';
import { isContiguous, selectedIndices } from '../selection';
import type { Doc, GroupKind, Item, ItemId, OpResult } from '../types';

/**
 * Text-editor style editing: a caret sits between items (an index 0..items.length), groups are
 * typed, copied, cut and pasted like words. The space is never copied; pasting needs room in it.
 */

/** A group without identity, as held on the clipboard. */
export interface GroupSpec {
  readonly n: number;
  readonly kind: GroupKind;
}

const sumOf = (gs: readonly GroupSpec[]) => gs.reduce((a, g) => a + g.n, 0);

/** Insert groups at an item index (0..items.length). Fails with `no-room` if they don't fit. */
export function insertGroups(doc: Doc, index: number, groups: readonly GroupSpec[]): OpResult {
  if (!groups.length) return { doc, report: fail('nothing-selected') };
  if (groups.some((g) => !Number.isInteger(g.n) || g.n < 1))
    return { doc, report: fail('too-small') };
  if (sumOf(groups) > freePulses(doc)) return { doc, report: fail('no-room') };
  const { ids, nextId } = mintIds(doc, groups.length);
  const at = clamp(index, 0, doc.items.length);
  const items = doc.items.slice();
  items.splice(at, 0, ...groups.map((g, i) => group(ids[i]!, g.n, g.kind)));
  return { doc: withItems(doc, items, nextId), report: report({ created: ids }) };
}

/**
 * Replace a contiguous selection with new groups at the same place (typing or pasting over a
 * selection). Room = the selection plus the open space.
 */
export function replaceGroups(
  doc: Doc,
  ids: Iterable<ItemId>,
  groups: readonly GroupSpec[],
): OpResult {
  const idx = selectedIndices(doc.items, ids);
  if (!idx.length || !groups.length) return { doc, report: fail('nothing-selected') };
  if (!isContiguous(idx)) return { doc, report: fail('not-contiguous') };
  if (groups.some((g) => !Number.isInteger(g.n) || g.n < 1))
    return { doc, report: fail('too-small') };
  const removedSum = idx.reduce((a, i) => a + doc.items[i]!.n, 0);
  if (sumOf(groups) > freePulses(doc) + removedSum) return { doc, report: fail('no-room') };
  const { ids: fresh, nextId } = mintIds(doc, groups.length);
  const items: Item[] = doc.items.slice();
  items.splice(idx[0]!, idx.length, ...groups.map((g, i) => group(fresh[i]!, g.n, g.kind)));
  return {
    doc: withItems(doc, items, nextId),
    report: report({ created: fresh, removed: idx.map((i) => doc.items[i]!.id) }),
  };
}

/** Change one group's size; the open space gives or takes the difference. */
export function resizeGroup(doc: Doc, id: ItemId, n: number): OpResult {
  const i = indexOfId(doc.items, id);
  const x = doc.items[i];
  if (!x || isSpace(x)) return { doc, report: fail('nothing-selected') };
  if (!Number.isInteger(n) || n < 1) return { doc, report: fail('too-small') };
  if (n === x.n) return { doc, report: fail('no-change') };
  if (n - x.n > freePulses(doc)) return { doc, report: fail('no-room') };
  const items = doc.items.slice();
  items[i] = { ...x, n };
  return { doc: withItems(doc, items), report: report() };
}

/** Grow or shrink every selected group by `delta`, all or nothing. */
export function resizeGroups(doc: Doc, ids: Iterable<ItemId>, delta: number): OpResult {
  const idx = selectedIndices(doc.items, ids);
  if (!idx.length) return { doc, report: fail('nothing-selected') };
  if (delta === 0) return { doc, report: fail('no-change') };
  if (idx.some((i) => doc.items[i]!.n + delta < 1)) return { doc, report: fail('too-small') };
  if (delta * idx.length > freePulses(doc)) return { doc, report: fail('no-room') };
  const set = new Set(idx);
  const items = doc.items.map((x, i) => (set.has(i) ? { ...x, n: x.n + delta } : x));
  return { doc: withItems(doc, items), report: report() };
}

/** Retrograde: reverse the order of a contiguous selection in place. */
export function reverseGroups(doc: Doc, ids: Iterable<ItemId>): OpResult {
  const idx = selectedIndices(doc.items, ids);
  if (idx.length < 2) return { doc, report: fail('nothing-selected') };
  if (!isContiguous(idx)) return { doc, report: fail('not-contiguous') };
  const block = idx.map((i) => doc.items[i]!).reverse();
  if (block.every((x, k) => x.n === doc.items[idx[k]!]!.n && x.kind === doc.items[idx[k]!]!.kind))
    return { doc, report: fail('no-change') };
  const items = doc.items.slice();
  items.splice(idx[0]!, idx.length, ...block);
  return { doc: withItems(doc, items), report: report({ moved: block.map((x) => x.id) }) };
}

/** Groups of a selection, in item order, without identity. */
export function copyGroups(doc: Doc, ids: Iterable<ItemId>): GroupSpec[] {
  return selectedIndices(doc.items, ids).map((i) => {
    const x = doc.items[i]!;
    return { n: x.n, kind: x.kind === 'rest' ? 'rest' : 'sound' };
  });
}

/** "3 (2) 4": sounds as numbers, rests in parentheses (same as the status line). */
export function formatGroups(groups: readonly GroupSpec[]): string {
  return groups.map((g) => (g.kind === 'rest' ? `(${g.n})` : `${g.n}`)).join(' ');
}

/**
 * Parse clipboard text such as "3 (2) 4", "3, r2, 4" or "3+2+4". Returns null if the text is not
 * a phrase (any other characters, sizes outside 1..999).
 */
export function parseGroups(text: string): GroupSpec[] | null {
  const tokens = text
    .trim()
    .split(/[\s,+·]+/)
    .filter(Boolean);
  if (!tokens.length || tokens.length > 500) return null;
  const out: GroupSpec[] = [];
  for (const t of tokens) {
    const m = /^(?:\((\d{1,3})\)|[rR](\d{1,3})|(\d{1,3}))$/.exec(t);
    if (!m) return null;
    const rest = m[1] ?? m[2];
    const n = Number(rest ?? m[3]);
    if (n < 1) return null;
    out.push({ n, kind: rest !== undefined ? 'rest' : 'sound' });
  }
  return out;
}

/**
 * Trim one edge of a group, like a clip in a DAW: the other edge stays where it is in time.
 * `side` 'end' moves the right edge by `delta` pulses (+ later), 'start' moves the left edge by
 * `delta` (+ earlier, i.e. longer). Growing eats into whatever is on that side (space, rests,
 * sounds; used-up groups are covered), like a slide. Shrinking leaves the freed time as silence:
 * it joins a neighbouring rest or the space, otherwise a new rest is created. The total never changes.
 */
export function trimEdge(doc: Doc, id: ItemId, side: 'start' | 'end', delta: number): OpResult {
  const i = indexOfId(doc.items, id);
  const x = doc.items[i];
  if (!x || isSpace(x)) return { doc, report: fail('nothing-selected') };
  const total = doc.items.reduce((a, y) => a + y.n, 0);
  let start = 0;
  for (let j = 0; j < i; j++) start += doc.items[j]!.n;
  const end = start + x.n;
  // growing is limited by the piece, shrinking by the group's own size
  const d = Math.round(clamp(delta, -(x.n - 1), side === 'end' ? total - end : start)) || 0;
  if (d === 0) return { doc, report: fail(delta === 0 ? 'no-change' : 'out-of-range') };

  const sizes = doc.items.map((y) => y.n);
  sizes[i] = x.n + d;
  const shortened: ItemId[] = [];
  const covered: ItemId[] = [];
  const created: ItemId[] = [];
  let nextId = doc.nextId;
  let insert: { at: number; n: number } | null = null;
  const step = side === 'end' ? 1 : -1;
  const beside = i + step;

  if (d > 0) {
    let remaining = d;
    for (let j = beside; remaining > 0 && j >= 0 && j < sizes.length; j += step) {
      const take = Math.min(sizes[j]!, remaining);
      sizes[j]! -= take;
      remaining -= take;
      const y = doc.items[j]!;
      if (take > 0 && !isSpace(y)) {
        if (sizes[j] === 0) covered.push(y.id);
        else if (y.kind === 'sound') shortened.push(y.id);
      }
    }
  } else {
    const n = beside >= 0 && beside < sizes.length ? doc.items[beside] : undefined;
    if (n && (isSpace(n) || n.kind === 'rest')) sizes[beside]! += -d;
    else insert = { at: side === 'end' ? i + 1 : i, n: -d };
  }

  const out: Item[] = [];
  let restItem: Item | null = null;
  if (insert) {
    const minted = mintIds(doc, 1);
    nextId = minted.nextId;
    created.push(minted.ids[0]!);
    restItem = group(minted.ids[0]!, insert.n, 'rest');
  }
  doc.items.forEach((y, j) => {
    if (insert && restItem && insert.at === j) out.push(restItem);
    const n = sizes[j]!;
    if (!isSpace(y) && n === 0) return;
    out.push(n === y.n ? y : { ...y, n });
  });
  if (insert && restItem && insert.at === doc.items.length) out.push(restItem);
  return { doc: withItems(doc, out, nextId), report: report({ shortened, covered, created }) };
}
