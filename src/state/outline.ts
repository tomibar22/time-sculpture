import * as E from '../engine';
import type { Doc } from '../engine';
import type { OutlineMark } from '../score/draw';
import { announce, toast } from './actions';
import { useUiStore } from './store';

/**
 * The outline of what is written (engine/outline.ts), as brackets for the score: of the selected
 * stretch when there is one, else of each passage (the start, the ending). Cached by document
 * and region, since the score is drawn every frame while playing.
 */
let cache: { doc: Doc; key: string; marks: OutlineMark[] } | null = null;

export function outlineMarks(doc: Doc, region: { a: number; b: number } | null): OutlineMark[] {
  const key = region ? `${region.a}:${region.b}` : '';
  if (cache && cache.doc === doc && cache.key === key) return cache.marks;
  const grid = E.buildGrid(doc.meter);
  const passages: { at: number; sizes: number[] }[] = [];
  if (region && region.b > region.a) {
    passages.push({ at: region.a, sizes: E.sliceRange(doc, region.a, region.b).map((g) => g.n) });
  } else {
    let at = 0;
    let cur: { at: number; sizes: number[] } | null = null;
    // a passage runs from a stroke to the end of the last stroke before the open space (a
    // silence inside it is part of it; one at its edges is not)
    let rests = 0;
    const close = () => {
      if (cur) passages.push({ at: cur.at, sizes: cur.sizes.slice(0, cur.sizes.length - rests) });
      cur = null;
      rests = 0;
    };
    for (const x of doc.items) {
      if (E.isSpace(x)) close();
      else if (x.kind === 'rest' && !cur) {
        // silence before the first stroke
      } else {
        cur ??= { at, sizes: [] };
        cur.sizes.push(x.n);
        rests = x.kind === 'rest' ? rests + 1 : 0;
      }
      at += x.n;
    }
    close();
  }
  const marks: OutlineMark[] = [];
  for (const p of passages) {
    const spans = E.outlineOf(p.sizes);
    const tops = spans.filter((s) => s.depth === 0 && s.kind === 'statement');
    for (const s of spans) {
      const k = p.at + s.b;
      const top = s.depth === 0 && s.kind === 'statement';
      marks.push({
        a: grid.times[p.at + s.a]!,
        b: grid.times[Math.min(k, grid.TS)]!,
        label: top ? E.whereWords(doc.meter, k, grid) : null,
        yati: s.kind === 'yati',
        home: top && s === tops[tops.length - 1],
      });
    }
  }
  cache = { doc, key, marks };
  return marks;
}

/** Show or hide the outline (O). */
export function toggleOutline(): void {
  const on = !useUiStore.getState().outline;
  useUiStore.getState().set({ outline: on });
  toast(on ? 'Outline: statements, and where each lands' : 'Outline hidden');
  announce(on ? 'Outline shown' : 'Outline hidden');
}
