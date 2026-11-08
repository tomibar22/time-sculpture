import { expect } from 'vitest';
import { checkInvariants, describeItem, docFrom, makeMeter } from '../doc';
import type { Doc } from '../types';

export const m44 = makeMeter(4, 2, 4); // 32 pulses
export const show = (doc: Doc) => doc.items.map(describeItem).join(' ');
export const valid = (doc: Doc) => expect(checkInvariants(doc)).toEqual([]);
export const m26 = makeMeter(13, 1, 2); // 26 pulses
export const sample = () => docFrom(m26, [[2], 3, 3, 2, '|', 3, [1], 3, 2, 4]);
