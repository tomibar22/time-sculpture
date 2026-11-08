import { docFrom, makeMeter } from '../engine';
import type { Doc } from '../engine';

export const DEFAULT_TRAY = [2, 3, 4, 5, 7];
export const DEFAULT_TEMPO = 72;
export const MIN_TEMPO = 40;
export const MAX_TEMPO = 160;

/** The composition a new user sees: a phrase planned from both ends with some open space. */
export function defaultDoc(): Doc {
  return docFrom(makeMeter(4, 2, 4), [[2], 3, 3, 2, '|', 3, [1], 3, 2, 4]);
}

export function blankDoc(): Doc {
  return docFrom(makeMeter(4, 2, 4), ['|']);
}
