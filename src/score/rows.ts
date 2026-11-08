/**
 * Row layout: how many cycles each row of the score shows. A view setting saved with the piece
 * (not part of the undoable musical document).
 *
 * `rows` lists cycles per row from the top. It is normalised against the piece: rows are kept in
 * order while they fit, the last one is cut to what remains, and any cycles left over are laid out
 * `perRow` at a time.
 */
export const MAX_PER_ROW = 8;

export function normalizeRows(rows: readonly number[], cycles: number, perRow: number): number[] {
  const per = Math.max(1, Math.min(MAX_PER_ROW, Math.round(perRow)));
  const out: number[] = [];
  let left = cycles;
  for (const r0 of rows) {
    if (left <= 0) break;
    const r = Math.max(1, Math.min(MAX_PER_ROW, Math.round(r0), left));
    out.push(r);
    left -= r;
  }
  while (left > 0) {
    const r = Math.min(per, left);
    out.push(r);
    left -= r;
  }
  return out;
}

/** Set row `index` to `count` cycles; later rows keep their sizes where they still fit. */
export function setRowCycles(
  rows: readonly number[],
  index: number,
  count: number,
  cycles: number,
  perRow: number,
): number[] {
  const cur = normalizeRows(rows, cycles, perRow);
  if (index < 0 || index >= cur.length) return cur;
  const next = cur.slice();
  next[index] = count;
  return normalizeRows(next, cycles, perRow);
}

/** First cycle of each row. */
export function rowStarts(rows: readonly number[]): number[] {
  const out: number[] = [];
  let a = 0;
  for (const r of rows) {
    out.push(a);
    a += r;
  }
  return out;
}

export const rowLabel = (first: number, count: number) =>
  count === 1 ? `bar ${first + 1}` : `bars ${first + 1}–${first + count}`;
