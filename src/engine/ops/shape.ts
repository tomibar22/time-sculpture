import { clamp, freePulses, indexOfId, isSpace, withItems } from '../doc';
import { fail, report } from '../report';
import type { Doc, ItemId, OpResult } from '../types';

/**
 * Move the line between group `leftId` and the next item (also a group) so the left one
 * has `leftSize` pulses. The pair keeps its total. Sizes clamp to 1..total-1.
 */
export function reshapeLine(doc: Doc, leftId: ItemId, leftSize: number): OpResult {
  const i = indexOfId(doc.items, leftId);
  const A = doc.items[i];
  const B = doc.items[i + 1];
  if (!A || !B || isSpace(A) || isSpace(B)) return { doc, report: fail('not-adjacent') };
  const total = A.n + B.n;
  const n = clamp(Math.round(leftSize), 1, total - 1);
  if (n === A.n) return { doc, report: fail('no-change') };
  const items = doc.items.slice();
  items[i] = { ...A, n };
  items[i + 1] = { ...B, n: total - n };
  return { doc: withItems(doc, items), report: report({ moved: [B.id] }) };
}

/**
 * Resize a group that touches the space: it grows into the space or gives pulses back.
 * Sizes clamp to 1..(n + space).
 */
export function stretchEdge(doc: Doc, id: ItemId, size: number): OpResult {
  const i = indexOfId(doc.items, id);
  const A = doc.items[i];
  if (!A || isSpace(A)) return { doc, report: fail('not-adjacent') };
  const touches = (j: number) => doc.items[j] !== undefined && isSpace(doc.items[j]!);
  if (!touches(i - 1) && !touches(i + 1)) return { doc, report: fail('not-adjacent') };
  const n = clamp(Math.round(size), 1, A.n + freePulses(doc));
  if (n === A.n) return { doc, report: fail('no-change') };
  const items = doc.items.slice();
  items[i] = { ...A, n };
  return { doc: withItems(doc, items), report: report() };
}

/** Nearest left size for a line drag when lines snap to tray sizes (both halves must be tray sizes). */
export function snapPair(total: number, want: number, tray: readonly number[]): number | null {
  const set = new Set(tray);
  let best: number | null = null;
  for (let q = 1; q < total; q++) {
    if (!set.has(q) || !set.has(total - q)) continue;
    if (best === null || Math.abs(q - want) < Math.abs(best - want)) best = q;
  }
  return best;
}

/** Nearest tray size not above max, for edge stretches that snap to tray sizes. */
export function snapSize(want: number, max: number, tray: readonly number[]): number | null {
  let best: number | null = null;
  for (const q of tray) {
    if (q > max || q < 1) continue;
    if (best === null || Math.abs(q - want) < Math.abs(best - want)) best = q;
  }
  return best;
}
