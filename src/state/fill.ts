import * as E from '../engine';
import type { FillOption } from '../engine';
import { ui as sfx } from '../audio/voices';
import { announce, plural, run, toast } from './actions';
import { selectedRegion } from './editing';
import { noteMotif } from '../persistence/sync';
import { MAX_MOTIFS, useDocStore, useUiStore } from './store';
import { startPlayback, stopPlayback } from '../audio/player';

/**
 * Filling a region: the selected range, the selected tiles' span, or (with neither) the open
 * space. Random fills are uniform over every way to fill it with the chosen sizes; browsing lists
 * the ways (all of them, or a large sample) to sort, preview and pick.
 */

const doc = () => useDocStore.getState().doc;
const ui = () => useUiStore.getState();

export function fillRegion(): { a: number; b: number; kind: 'selection' | 'space' } | null {
  const r = selectedRegion();
  if (r) return { ...r, kind: 'selection' };
  const s = E.spaceRange(doc());
  return s.b > s.a ? { ...s, kind: 'space' } : null;
}

export function openFill(tab: 'browse' | 'vary' | 'land'): void {
  const region = fillRegion();
  if (tab === 'vary' && region?.kind !== 'selection') {
    sfx.nope();
    return void toast('Select the groups (or a range) to vary');
  }
  if (!region) return void toast('Select a region, or leave some open space, to fill');
  ui().set({ fillPanel: tab, subPanel: false });
}

/** What is written in the selected region now: the passage that Vary works from. */
export function regionGroups(): E.GroupSpec[] {
  const region = fillRegion();
  return region?.kind === 'selection' ? E.sliceRange(doc(), region.a, region.b) : [];
}

/** Say the selected passage another way (same length, so everything around it stays put). */
export function varyWith(v: E.Variation): void {
  if (apply(v.groups, `vary ${v.key}`)) announce(`${v.label}: ${v.key}`);
}

export function previewVary(v: E.Variation | null): void {
  const region = fillRegion();
  if (!v || !region) return ui().set({ preview: null });
  const r = E.fillRange(doc(), region.a, region.b, v.groups);
  ui().set({ preview: r.report.ok ? r.doc : null });
}

export function closeFill(): void {
  if (ui().playing && ui().loop) stopPlayback();
  const r = ui().range;
  if (filledSpace && r && r.a === filledSpace.a && r.b === filledSpace.b)
    ui().set({ range: null, rangeAnchor: null });
  filledSpace = null;
  ui().set({ fillPanel: null, preview: null });
}

/**
 * Listen while choosing: loop the region, so every fill tried (hovered, focused, dragged over on
 * the map) is heard in time, in place. Again to stop.
 */
export function toggleListen(): void {
  if (ui().playing) return stopPlayback();
  const region = fillRegion();
  if (!region) return;
  const grid = E.buildGrid(doc().meter);
  const loop = { a: grid.times[region.a]!, b: grid.times[Math.min(region.b, grid.TS)]! };
  startPlayback(loop.a, loop);
  announce('Listening: every fill you try plays in the loop');
}

/** Show any tiling of the region in the score (and the listening loop) without committing it. */
export function previewSizes(sizes: number[] | null): void {
  const region = fillRegion();
  if (!sizes || !region) return ui().set({ preview: null });
  const r = E.fillRange(doc(), region.a, region.b, E.fillGroups({ sizes }));
  ui().set({ preview: r.report.ok ? r.doc : null });
}

/** Write a tiling into the region. */
export function fillSizes(sizes: number[], what = 'Filled with'): void {
  const key = sizes.join(' ');
  if (apply(E.fillGroups({ sizes }), `fill ${key}`)) announce(`${what} ${key}`);
}

/* ------------------------------------------------------------------ saved motifs (♥) */

export const isMotif = (sizes: readonly number[]) => {
  const k = sizes.join(' ');
  return ui().motifs.some((m) => m.join(' ') === k);
};

/** Keep a fill you like (♥), or let it go again. Kept on this device, for any piece. */
export function toggleMotif(sizes: readonly number[]): void {
  const k = sizes.join(' ');
  const has = isMotif(sizes);
  ui().set({
    motifs: has
      ? ui().motifs.filter((m) => m.join(' ') !== k)
      : [[...sizes], ...ui().motifs].slice(0, MAX_MOTIFS),
  });
  noteMotif(sizes, has);
  toast(has ? `Let go of ${k}` : `Kept ${k}`);
}

function apply(groups: E.GroupSpec[], label: string): boolean {
  const region = fillRegion();
  if (!region) return false;
  const r = E.fillRange(doc(), region.a, region.b, groups);
  ui().set({ preview: null });
  if (!run(r, { label, select: [...r.report.created] })) return false;
  // keep the region selected as a range, so the next roll fills the same place
  if (region.kind === 'selection') {
    useUiStore.getState().set({
      selection: [],
      range: { a: region.a, b: region.b },
      rangeAnchor: region.a,
      caret: region.b,
    });
  } else {
    // the open space, now full: it stays the region while the panel is open (another fill, or a
    // variation of this one, goes to the same place); closing the panel leaves only the caret
    filledSpace = { a: region.a, b: region.b };
    useUiStore.getState().set({
      selection: [],
      range: { a: region.a, b: region.b },
      rangeAnchor: region.a,
      caret: region.b,
    });
  }
  return true;
}

/** The stretch that was open space until a fill from the panel was written into it. */
let filledSpace: { a: number; b: number } | null = null;

/** Fill the region with a random tiling of the chosen sizes. */
export function fillRandom(): boolean {
  const region = fillRegion();
  const sizes = ui().fillSizes;
  if (!region) return false;
  const t = E.sampleTiling(region.b - region.a, sizes);
  if (!t) {
    sfx.nope();
    toast(`These sizes can't fill ${region.b - region.a} pulses exactly`);
    return false;
  }
  if (!apply(E.fillGroups({ sizes: t }), `fill ${t.join(' ')}`)) return false;
  announce(`Filled with ${t.join(' ')}`);
  return true;
}

export function fillWith(o: FillOption): void {
  if (apply(E.fillGroups(o), `fill ${o.key}`)) announce(`Filled with ${o.key}`);
}

/**
 * What a landing writes, and where: from its first tile to the point it lands on, which is the
 * end of the region moved by `landShift` (early: the pulses after it are left as air, or the
 * last tile, falling on the 1 early, rings to the end; late: it runs on past the region). A gati
 * way also sets the subdivision of its beats.
 */
function landingResult(l: E.PatternLanding): { r: E.OpResult; b: number } | null {
  const region = fillRegion();
  if (!region) return null;
  const d = doc();
  const start = region.a + l.lead;
  if (l.gati) {
    const grid = E.buildGrid(d.meter);
    const b0 = E.beatOfPulse(grid, Math.min(start, grid.TS - 1));
    const endBeat = E.beatOfPulse(grid, Math.min(region.b, grid.TS - 1));
    const r = E.writeGati(d, b0, l.gati);
    const g2 = E.buildGrid(r.doc.meter);
    return { r, b: region.b >= grid.TS ? g2.TS : g2.pre[endBeat]! };
  }
  const shift = ui().landShift;
  const sounds: E.GroupSpec[] = l.sizes.map((n) => ({ n, kind: 'sound' }));
  if (shift < 0) {
    const k = -shift;
    sounds.push({ n: k, kind: l.on1 ? 'sound' : 'rest' });
    return { r: E.fillRange(d, start, region.b, sounds), b: region.b };
  }
  return { r: E.fillRange(d, start, region.b + shift, sounds), b: region.b };
}

/** Land a pattern: show it in the score, ending where the region ends (not written). */
export function previewLanding(l: E.PatternLanding | null): void {
  const x = l && landingResult(l);
  ui().set({ preview: x?.r.report.ok ? x.r.doc : null });
}

/** Land a pattern: write it. What is before its first tile stays as it is. */
export function writeLanding(l: E.PatternLanding): void {
  const region = fillRegion();
  const x = landingResult(l);
  ui().set({ preview: null });
  if (!region || !x) return;
  if (!run(x.r, { label: `land ${l.sizes.join(' ')}`, select: 'none' })) return;
  // the stretch stays the region while the panel is open, so another way can be tried
  if (region.kind === 'space') filledSpace = { a: region.a, b: x.b };
  ui().set({
    selection: [],
    range: { a: region.a, b: x.b },
    rangeAnchor: region.a,
    caret: x.b,
  });
  announce(`Written: ${l.sizes.join(' ')}`);
}

/** Show an option in the score without committing it. */
export function previewFill(o: FillOption | null): void {
  const region = fillRegion();
  if (!o || !region) return ui().set({ preview: null });
  const r = E.fillRange(doc(), region.a, region.b, E.fillGroups(o));
  ui().set({ preview: r.report.ok ? r.doc : null });
}

export const describeRegion = (a: number, b: number) => plural(b - a, 'pulse');
