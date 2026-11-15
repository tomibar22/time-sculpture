import { group, isSpace, mintIds, syncSpace, withBreaks, withMarks, withRowSizes } from '../doc';
import { formOf, withForm } from '../form';
import type { Form } from '../form';
import {
  buildGrid,
  EPS,
  MAX_BEATS,
  MAX_CYCLES,
  MAX_PATTERN,
  MAX_ROW_BARS,
  MIN_BEATS,
  MIN_CYCLES,
} from '../grid';
import { fail, report } from '../report';
import { barMap, isFree } from '../sections';
import type { Doc, Item, ItemId, Meter, OpResult, RowSize, Section } from '../types';
import { withMeter, withSections } from './sections';

/**
 * Bars as the user works with them: the metre from a beat on (one bar size, or a pattern of
 * sizes that goes round, "5 5 4"), bars added or removed anywhere, and how many bars a row holds.
 * A change of metre never changes the tempo, the subdivision or the length: only the bar lines.
 */

const maxBars = (meter: Meter) => (isFree(meter) ? MAX_CYCLES * 2 : MAX_CYCLES);

/** "5 5 4", "5+5+4", "7" → bar sizes (each 1..13, at most MAX_PATTERN), or null. */
export function parsePattern(text: string): number[] | null {
  const parts = text
    .trim()
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number);
  if (!parts.length || parts.length > MAX_PATTERN) return null;
  if (parts.some((n) => !Number.isInteger(n) || n < 1 || n > MAX_BEATS)) return null;
  return parts;
}

/** The bar sizes in force at local beat `at` (the pattern of the section it is in). */
export function patternAt(meter: Meter, at: number): readonly number[] {
  const map = barMap(meter);
  const b = Math.max(0, Math.min(map.NB - 1, Math.floor(at + EPS)));
  return map.sections[map.sectionOf[b] ?? 0]!.pattern;
}

const samePattern = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((n, i) => n === b[i]);

/**
 * From beat `at` on (0 = the whole piece), bars follow `pattern`: one size, or several that go
 * round. The tempo and every pulse stay as they are; a change inside the piece becomes a section
 * whose pulse equation is 1 = 1 (or keeps the modulation that already starts there).
 */
export function setBars(doc: Doc, at: number, pattern: readonly number[]): OpResult {
  const { meter } = doc;
  const NB = meter.subdivision.length;
  if (!Number.isInteger(at) || at < 0 || at >= NB) return { doc, report: fail('out-of-range') };
  if (
    !pattern.length ||
    pattern.length > MAX_PATTERN ||
    pattern.some((n) => !Number.isInteger(n) || n < 1 || n > MAX_BEATS)
  )
    return { doc, report: fail('out-of-range') };
  const sections = meter.sections ?? [];
  const at0 = sections.find((s) => s.at === at);
  // the same bars as the section before, with no modulation of its own: nothing to say here
  const first = pattern[0]!;
  const many = pattern.length > 1;
  let next: Meter;
  if (at === 0) {
    if (samePattern(patternAt(meter, 0), pattern)) return { doc, report: fail('no-change') };
    const plain = !many && first >= MIN_BEATS;
    const { bars: _b, ...rest } = meter;
    void _b;
    next = withSections(
      {
        ...rest,
        beatsPerCycle: Math.max(MIN_BEATS, Math.min(MAX_BEATS, first)),
        ...(plain ? {} : { bars: [...pattern] }),
      },
      sections,
    );
  } else {
    if (samePattern(patternAt(meter, at), pattern) && at0)
      return { doc, report: fail('no-change') };
    const made: Section = {
      at,
      from: at0?.from ?? 1,
      to: at0?.to ?? 1,
      beatsPerBar: first,
      ...(many ? { bars: [...pattern] } : {}),
    };
    // a change that says what the bars before it already say is no change: it goes
    const before = patternAt(meter, at - 1);
    const redundant = made.from === made.to && samePattern(before, pattern);
    const list = [...sections.filter((s) => s.at !== at), ...(redundant ? [] : [made])].sort(
      (x, y) => x.at - y.at,
    );
    if (redundant && !at0) return { doc, report: fail('no-change') };
    next = withSections(meter, list);
  }
  if (next.cycles > MAX_CYCLES * 2) return { doc, report: fail('out-of-range') };
  return { doc: withMeter(doc, next), report: report() };
}

/** How a stretch of `beats` divides into bars of `pattern`: whole rounds, and what is left. */
export function patternFit(
  beats: number,
  pattern: readonly number[],
): { rounds: number; bars: number; left: number } {
  const sum = pattern.reduce((a, n) => a + n, 0);
  const rounds = Math.floor(beats / sum);
  let left = beats - rounds * sum;
  let bars = rounds * pattern.length;
  for (const n of pattern) {
    if (left < n) break;
    left -= n;
    bars++;
  }
  return { rounds, bars, left };
}

/* ------------------------------------------------------------------ adding and removing bars */

const moveForm = (meter: Meter, starts: (t: number) => number, ends: (t: number) => number) => {
  const f = formOf(meter);
  const form: Form = {
    repeatStarts: f.repeatStarts.map(starts),
    repeatEnds: f.repeatEnds.map((e) => ({ ...e, at: ends(e.at) })),
    voltas: f.voltas.map((v) => ({ ...v, a: starts(v.a), b: ends(v.b) })),
    totals: f.totals.map((v) => ({ a: starts(v.a), b: ends(v.b) })),
  };
  return form;
};

/**
 * Add `n` empty bars before bar `atBar` (0-based; the number of bars = after the last one). They
 * take the size and the subdivision of the bar before them (of the first bar, at the very start).
 * What comes after moves later with all its marks; the new time is open space when it touches
 * the open space, otherwise silence (reported in `created`). A group the bar line cuts through
 * is split there.
 */
export function insertBars(doc: Doc, atBar: number, n: number): OpResult {
  const { meter } = doc;
  const map = barMap(meter);
  const nBars = map.barStarts.length;
  const NB = map.NB;
  if (!Number.isInteger(n) || n < 1 || !Number.isInteger(atBar) || atBar < 0 || atBar > nBars)
    return { doc, report: fail('out-of-range') };
  if (meter.cycles + n > maxBars(meter)) return { doc, report: fail('out-of-range') };
  const at = atBar >= nBars ? NB : map.barStarts[atBar]!;
  const ref = Math.max(0, atBar - 1);
  const ra = map.barStarts[ref]!;
  const refSub = meter.subdivision.slice(ra, map.barStarts[ref + 1] ?? NB);
  // the new bars go on with the pattern of the section they join
  const sec = map.sections[map.sectionOf[ra] ?? 0]!;
  const phase = map.barStarts.filter((b) => b >= sec.at && b < at).length;
  const subs: number[] = [];
  for (let i = 0; i < n; i++) {
    const len = isFree(meter)
      ? sec.pattern[(phase + i) % sec.pattern.length]!
      : meter.beatsPerCycle;
    for (let j = 0; j < len; j++) subs.push(refSub[j % refSub.length] ?? 4);
  }
  const len = subs.length;
  const starts = (t: number) => (t >= at - EPS ? t + len : t);
  const ends = (t: number) => (t > at + EPS ? t + len : t);
  const sections = (meter.sections ?? []).map((s) => (s.at >= at ? { ...s, at: s.at + len } : s));
  const grid = buildGrid(meter);
  const {
    breaks: _b,
    marks: _m,
    markNames: _n,
    sections: _s,
    rowSizes: _r,
    repeatStarts: _rs,
    repeatEnds: _re,
    voltas: _v,
    totals: _t,
    ...core
  } = meter;
  void [_b, _m, _n, _s, _r, _rs, _re, _v, _t];
  let nm: Meter = {
    ...core,
    subdivision: [...meter.subdivision.slice(0, at), ...subs, ...meter.subdivision.slice(at)],
    cycles: meter.cycles + n,
    ...(sections.length ? { sections } : {}),
  };
  if (isFree(nm)) nm = { ...nm, cycles: barMap(nm).barStarts.length };
  nm = withRowSizes(nm, meter.rowSizes ?? [], starts);
  nm = withBreaks(nm, (meter.breaks ?? []).map(starts));
  nm = withMarks(nm, (meter.marks ?? []).map(starts), meter.markNames);
  nm = withForm(nm, moveForm(meter, starts, ends));
  if (nm.cycles > MAX_CYCLES * 2) return { doc, report: fail('out-of-range') };

  // the items: new time at pulse k
  const k = grid.pre[at]!;
  const P = buildGrid(nm).TS - grid.TS;
  const { ids, nextId } = mintIds(doc, 2);
  const created: ItemId[] = [];
  const items: Item[] = [];
  let s = 0;
  let done = false;
  const rest = () => {
    items.push(group(ids[0]!, P, 'rest'));
    created.push(ids[0]!);
  };
  doc.items.forEach((x, i) => {
    const e = s + x.n;
    if (!done && k === s) {
      // on a boundary: open space next to it takes the new time, else it is silence
      const prev = doc.items[i - 1];
      if (!isSpace(x) && !(prev && isSpace(prev))) rest();
      done = true;
    }
    if (!done && k > s && k < e) {
      done = true;
      if (isSpace(x)) items.push(x);
      else {
        items.push({ ...x, n: k - s });
        rest();
        items.push(group(ids[1]!, e - k, x.kind));
        created.push(ids[1]!);
      }
    } else items.push(x);
    s = e;
  });
  if (!done && !isSpace(doc.items[doc.items.length - 1]!)) rest();
  return {
    doc: {
      meter: nm,
      items: syncSpace(items, buildGrid(nm).TS),
      nextId: created.length ? nextId : doc.nextId,
    },
    report: report({ created }),
  };
}

/**
 * Remove `count` bars from bar `fromBar` (0-based) with everything in them. What comes after
 * moves earlier with its marks. A group that begins before the cut keeps what is left of it; one
 * that began inside it and reaches past it loses its attack, so what is left is silence.
 */
export function removeBars(doc: Doc, fromBar: number, count: number): OpResult {
  const { meter } = doc;
  const map = barMap(meter);
  const nBars = map.barStarts.length;
  if (
    !Number.isInteger(fromBar) ||
    !Number.isInteger(count) ||
    count < 1 ||
    fromBar < 0 ||
    fromBar + count > nBars
  )
    return { doc, report: fail('out-of-range') };
  if (nBars - count < MIN_CYCLES) return { doc, report: fail('too-small') };
  const NB = map.NB;
  const a = map.barStarts[fromBar]!;
  const b = map.barStarts[fromBar + count] ?? NB;
  const len = b - a;
  const starts = (t: number) => (t < a - EPS ? t : t < b - EPS ? NaN : t - len);
  const ends = (t: number) => (t <= a + EPS ? t : t <= b + EPS ? (t > b - EPS ? a : NaN) : t - len);
  const span = (t: number) => (t <= a + EPS ? t : Math.max(a, t - len));

  // sections: those inside the cut go; one right after it moves to where the cut began
  const byAt = new Map<number, Section>();
  for (const s of meter.sections ?? []) {
    if (s.at > a && s.at < b) continue;
    byAt.set(s.at >= b ? s.at - len : s.at, s.at >= b ? { ...s, at: s.at - len } : s);
  }
  const {
    breaks: _b,
    marks: _m,
    markNames: _n,
    sections: _s,
    rowSizes: _r,
    repeatStarts: _rs,
    repeatEnds: _re,
    voltas: _v,
    totals: _t,
    ...core
  } = meter;
  void [_b, _m, _n, _s, _r, _rs, _re, _v, _t];
  let base: Meter = {
    ...core,
    subdivision: [...meter.subdivision.slice(0, a), ...meter.subdivision.slice(b)],
    cycles: meter.cycles - count,
  };
  // a section that now starts the piece is the main one: its bars become the piece's
  const head = byAt.get(0);
  if (head) {
    byAt.delete(0);
    const { bars: _old, ...noBars } = base;
    void _old;
    const plain = !head.bars && head.beatsPerBar >= MIN_BEATS;
    base = {
      ...noBars,
      beatsPerCycle: Math.max(MIN_BEATS, Math.min(MAX_BEATS, head.beatsPerBar)),
      ...(plain ? {} : { bars: [...(head.bars ?? [head.beatsPerBar])] }),
    };
  }
  const sections = [...byAt.values()].sort((x, y) => x.at - y.at);
  let nm: Meter = sections.length ? { ...base, sections } : base;
  if (isFree(nm)) nm = { ...nm, cycles: barMap(nm).barStarts.length };
  else if (nm.subdivision.length % nm.beatsPerCycle) nm = withSections(nm, []);
  nm = withRowSizes(nm, meter.rowSizes ?? [], starts);
  nm = withBreaks(
    nm,
    (meter.breaks ?? []).map(starts).filter((t) => Number.isFinite(t)),
  );
  nm = withMarks(nm, (meter.marks ?? []).map(starts), meter.markNames);
  const f = formOf(meter);
  nm = withForm(nm, {
    repeatStarts: f.repeatStarts.map(starts),
    repeatEnds: f.repeatEnds.map((e) => ({ ...e, at: ends(e.at) })),
    voltas: f.voltas.map((v) => ({ ...v, a: span(v.a), b: span(v.b) })),
    totals: f.totals.map((v) => ({ a: span(v.a), b: span(v.b) })),
  });

  const grid = buildGrid(meter);
  const ka = grid.pre[a]!;
  const kb = grid.pre[b]!;
  const removed: ItemId[] = [];
  const shortened: ItemId[] = [];
  const items: Item[] = [];
  let s = 0;
  for (const x of doc.items) {
    const e = s + x.n;
    const cut = Math.max(0, Math.min(e, kb) - Math.max(s, ka));
    const left = x.n - cut;
    if (isSpace(x)) items.push(x);
    else if (left === 0) removed.push(x.id);
    else if (cut === 0) items.push(x);
    else if (s >= ka) items.push({ ...x, n: left, kind: 'rest' });
    else {
      items.push({ ...x, n: left });
      if (x.kind === 'sound') shortened.push(x.id);
    }
    s = e;
  }
  return {
    doc: { meter: nm, items: syncSpace(items, buildGrid(nm).TS), nextId: doc.nextId },
    report: report({ removed, shortened }),
  };
}

/* ------------------------------------------------------------------ rows */

/** The row size in force at time t (0 = the zoom decides), from the piece's row sizes. */
export function rowSizeAt(meter: Meter, t: number): number {
  let per = 0;
  for (const r of meter.rowSizes ?? []) if (r.at <= t + EPS) per = r.per;
  return per;
}

/**
 * Rows hold `per` bars from time `a` on (0 = follow the zoom again). With `b`, only up to there:
 * the size that held before `a` comes back at `b` (for one row that differs from the others).
 */
export function setRowSize(doc: Doc, a: number, per: number, b: number | null = null): OpResult {
  const NB = doc.meter.subdivision.length;
  if (!Number.isInteger(per) || per < 0 || per > MAX_ROW_BARS || a < -EPS || a >= NB - EPS)
    return { doc, report: fail('out-of-range') };
  const cur = doc.meter.rowSizes ?? [];
  const before = rowSizeAt(doc.meter, a - 2 * EPS);
  const list: RowSize[] = cur.filter((r) => Math.abs(r.at - a) > EPS);
  if (b !== null && b < NB - EPS) {
    // inside the stretch nothing else changes the size; after it, the earlier size returns
    const inside = (r: RowSize) => r.at > a + EPS && r.at < b - EPS;
    const kept = list.filter((r) => !inside(r));
    list.length = 0;
    list.push(...kept);
    if (!list.some((r) => Math.abs(r.at - b) <= EPS)) list.push({ at: b, per: before });
  }
  // at the very start, "the zoom decides" is simply no entry
  if (!(a <= EPS && per === 0)) list.push({ at: Math.max(0, a), per });
  const meter = withRowSizes(doc.meter, list);
  if (JSON.stringify(meter.rowSizes ?? []) === JSON.stringify(cur))
    return { doc, report: fail('no-change') };
  return { doc: { ...doc, meter }, report: report() };
}

/** Every row follows the zoom again. */
export function clearRowSizes(doc: Doc): OpResult {
  if (!doc.meter.rowSizes?.length) return { doc, report: fail('no-change') };
  const { rowSizes: _r, ...meter } = doc.meter;
  void _r;
  return { doc: { ...doc, meter }, report: report() };
}
