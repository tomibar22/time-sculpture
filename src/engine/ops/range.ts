import { buildGrid } from '../grid';
import { clamp, group, isSpace, mintIds, spaceIndex, syncSpace } from '../doc';
import { fail, report } from '../report';
import type { Doc, GroupKind, Item, ItemId, OpResult } from '../types';
import { SPACE_ID } from '../types';
import type { GroupSpec } from './edit';

/**
 * Time-based editing: a caret on any pulse and selections of pulse ranges [a, b), like text.
 * A range may cover tiles fully or partly, silence and open space.
 *
 * Conventions when a range cuts through a group:
 * - the part before the range keeps the group (same id and kind, shorter);
 * - the part after the range has lost its onset, so it becomes silence;
 * - open space cut by a range: the part after it stays open; a part before it becomes silence
 *   only when there is also open space after it (there is exactly one open space).
 */

interface Seg {
  s: number;
  e: number;
  item: Item;
}

function segments(doc: Doc): Seg[] {
  const out: Seg[] = [];
  let a = 0;
  for (const item of doc.items) {
    out.push({ s: a, e: a + item.n, item });
    a += item.n;
  }
  return out;
}

const total = (doc: Doc) => buildGrid(doc.meter).TS;

/** The pulse range covered by a set of selected groups (first start to last end), or null. */
export function spanOf(doc: Doc, ids: Iterable<ItemId>): { a: number; b: number } | null {
  const set = new Set(ids);
  let a = Infinity;
  let b = -Infinity;
  for (const g of segments(doc)) {
    if (isSpace(g.item) || !set.has(g.item.id)) continue;
    a = Math.min(a, g.s);
    b = Math.max(b, g.e);
  }
  return a < b ? { a, b } : null;
}

/** The open space as a pulse range. */
export function spaceRange(doc: Doc): { a: number; b: number } {
  const seg = segments(doc).find((g) => isSpace(g.item))!;
  return { a: seg.s, b: seg.e };
}

/** Item boundaries (pulse positions where a group or the space starts or ends). */
export function boundaryPulses(doc: Doc): number[] {
  const out = new Set<number>([0]);
  for (const g of segments(doc)) out.add(g.e);
  return [...out].sort((x, y) => x - y);
}

/**
 * Replace the pulse range [a, b) with `groups`, whose sizes must add up to exactly b − a. Things
 * outside the range keep their place in time (see the conventions above).
 */
export function fillRange(
  doc: Doc,
  a0: number,
  b0: number,
  groups: readonly GroupSpec[],
): OpResult {
  const TS = total(doc);
  const a = clamp(Math.round(a0), 0, TS);
  const b = clamp(Math.round(b0), 0, TS);
  if (b <= a) return { doc, report: fail('nothing-selected') };
  if (groups.some((g) => !Number.isInteger(g.n) || g.n < 1))
    return { doc, report: fail('too-small') };
  if (groups.reduce((x, g) => x + g.n, 0) !== b - a) return { doc, report: fail('out-of-range') };

  const segs = segments(doc);
  const sp = segs.find((g) => isSpace(g.item))!;
  const spaceAfter = sp.e > b ? sp.e - Math.max(b, sp.s) : 0; // open space left after the range
  let nextId = doc.nextId;
  const fresh = (n: number, kind: GroupKind): Item => {
    const id = `g${nextId++}`;
    return group(id, n, kind);
  };
  const created: ItemId[] = [];
  const removed: ItemId[] = [];
  const shortened: ItemId[] = [];
  const before: Item[] = [];
  const after: Item[] = [];
  let spacePlaced = false;

  for (const g of segs) {
    const { s, e, item } = g;
    if (e <= a) {
      if (isSpace(item)) spacePlaced = true;
      before.push(item);
      continue;
    }
    if (s >= b) {
      if (isSpace(item)) spacePlaced = true;
      after.push(item);
      continue;
    }
    // overlaps the range
    if (isSpace(item)) {
      const left = Math.max(0, a - s);
      if (left > 0) {
        if (spaceAfter > 0) {
          const r = fresh(left, 'rest');
          created.push(r.id);
          before.push(r);
        } else {
          before.push({ id: SPACE_ID, kind: 'space', n: left });
          spacePlaced = true;
        }
      }
      if (spaceAfter > 0) {
        after.push({ id: SPACE_ID, kind: 'space', n: spaceAfter });
        spacePlaced = true;
      }
      continue;
    }
    const head = Math.max(0, a - s);
    const tail = Math.max(0, e - b);
    if (head > 0) {
      before.push({ ...item, n: head });
      if (item.kind === 'sound') shortened.push(item.id);
    } else removed.push(item.id);
    if (tail > 0) {
      const r = fresh(tail, 'rest');
      created.push(r.id);
      after.push(r); // segments come in time order, so the tail lands right after the range
    }
  }

  const middle: Item[] = groups.map((gs) => {
    const it = fresh(gs.n, gs.kind);
    created.push(it.id);
    return it;
  });
  // the range covered the whole open space: it closes, right after the new groups
  const items = [
    ...before,
    ...middle,
    ...(spacePlaced ? [] : [{ id: SPACE_ID, kind: 'space' as const, n: 0 }]),
    ...after,
  ];
  const out: Doc = { meter: doc.meter, items: syncSpace(items, TS), nextId };
  return {
    doc: out,
    report: report({
      created: created.filter((id) => out.items.some((x) => x.id === id)),
      removed,
      shortened,
    }),
  };
}

/** Silence a pulse range (Delete / Backspace on a range). */
export function clearRange(doc: Doc, a: number, b: number): OpResult {
  return fillRange(doc, a, b, [{ n: Math.round(b) - Math.round(a), kind: 'rest' }]);
}

/**
 * The content of a range as groups (for copy): a group cut at the start of the range lost its
 * onset, so it is copied as silence; open space is copied as silence.
 */
export function sliceRange(doc: Doc, a: number, b: number): GroupSpec[] {
  const out: GroupSpec[] = [];
  for (const g of segments(doc)) {
    const s = Math.max(g.s, a);
    const e = Math.min(g.e, b);
    if (e <= s) continue;
    const kind: GroupKind = isSpace(g.item) || g.item.kind === 'rest' || g.s < a ? 'rest' : 'sound';
    const last = out[out.length - 1];
    if (kind === 'rest' && last?.kind === 'rest') out[out.length - 1] = { n: last.n + e - s, kind };
    else out.push({ n: e - s, kind });
  }
  return out;
}

/**
 * Insert groups at a pulse, like typing at a caret. At a boundary between groups this is a
 * normal insert (things move toward the open space to make room). Inside the open space, the
 * gap before the caret becomes silence and the groups start exactly at the caret. Inside a
 * group, it is split: its head stays, the groups follow, and its tail (which lost its onset)
 * becomes silence. Needs room in the open space. Returns the caret position after the insert.
 */
export function insertAtPulse(
  doc: Doc,
  k0: number,
  groups: readonly GroupSpec[],
): OpResult & { caret: number } {
  const TS = total(doc);
  const k = clamp(Math.round(k0), 0, TS);
  const G = groups.reduce((x, g) => x + g.n, 0);
  const no = (reason: Parameters<typeof fail>[0]) => ({ doc, report: fail(reason), caret: k });
  if (!groups.length) return no('nothing-selected');
  if (groups.some((g) => !Number.isInteger(g.n) || g.n < 1)) return no('too-small');
  const segs = segments(doc);
  const si = spaceIndex(doc.items);
  const sp = segs[si]!;
  const { ids, nextId } = mintIds(doc, groups.length + 1);
  const made = groups.map((g, i) => group(ids[i]!, g.n, g.kind));
  const items = doc.items.slice();
  let at: number;
  const created = made.map((x) => x.id);

  if (k > sp.s && k < sp.e) {
    // inside the open space: silence up to the caret, then the groups
    const gap = k - sp.s;
    if (gap + G > sp.item.n) return no('no-room');
    const rest = group(ids[groups.length]!, gap, 'rest');
    items.splice(si, 0, rest, ...made);
    created.unshift(rest.id);
    at = si + 1 + made.length;
  } else {
    if (G > sp.item.n) return no('no-room');
    const inside = segs.findIndex((g) => g.s < k && k < g.e && !isSpace(g.item));
    if (inside >= 0) {
      const g = segs[inside]!;
      const tail = group(ids[groups.length]!, g.e - k, 'rest');
      items.splice(inside, 1, { ...g.item, n: k - g.s }, ...made, tail);
      created.push(tail.id);
      at = inside + 1 + made.length;
    } else {
      // a boundary: the space's own edges decide start or ending
      const idx = k === sp.s ? si : k === sp.e ? si + 1 : segs.findIndex((g) => g.s === k);
      const index = idx < 0 ? items.length : idx;
      items.splice(index, 0, ...made);
      at = index + made.length;
    }
  }
  const out: Doc = { meter: doc.meter, items: syncSpace(items, TS), nextId };
  let caret = 0;
  for (let i = 0; i < at; i++) caret += out.items[i]!.n;
  // after a split, the caret sits right after the new groups (before the silent tail)
  return { doc: out, report: report({ created }), caret };
}
