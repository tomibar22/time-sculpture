import * as E from '../engine';
import type { FillOption } from '../engine';
import { ui as sfx } from '../audio/voices';
import { announce, plural, run, toast } from './actions';
import { selectedRegion, setCaret } from './editing';
import { useDocStore, useUiStore } from './store';

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

export function openFill(tab: 'random' | 'browse' | 'vary'): void {
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
  ui().set({ fillPanel: null, preview: null });
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
  } else setCaret(region.b, { quiet: true });
  return true;
}

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

/** Show an option in the score without committing it. */
export function previewFill(o: FillOption | null): void {
  const region = fillRegion();
  if (!o || !region) return ui().set({ preview: null });
  const r = E.fillRange(doc(), region.a, region.b, E.fillGroups(o));
  ui().set({ preview: r.report.ok ? r.doc : null });
}

export const describeRegion = (a: number, b: number) => plural(b - a, 'pulse');
