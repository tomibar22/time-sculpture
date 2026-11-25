import { useEffect, useMemo, useState } from 'react';
import * as E from '../engine';
import { fillRegion } from '../state/fill';
import { useDocStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';
import { BranchIcon, CloseIcon, HeartIcon } from './Icons';

/** A line in a strip: where it falls (0–1 of the region) and whether a bar starts there. */
export interface StripLine {
  f: number;
  bar: boolean;
}

/**
 * A small picture of a fill: one coloured bar per tile, placed exactly by its pulses, with the
 * beat and bar lines it sits in drawn through it (`beats`) so the way it settles into the frame
 * of time shows at a glance. Tiles are inset by 1 px on each side, so every tile edge is centred
 * on its true time and a line on that time runs right through the gap.
 */
export function Strip({
  sizes,
  rests,
  beats,
  locked,
  gaps,
  labels,
}: {
  sizes: number[];
  rests?: number[];
  beats?: StripLine[];
  locked?: number[];
  /** Tiles that are the gaps between the times a pattern is said (Land): drawn lighter. */
  gaps?: number[];
  /**
   * What each tile says (and its colour), when `sizes` are only widths: a gati way's tiles are
   * drawn in a common unit of time, but each is so many pulses of its own beat.
   */
  labels?: number[];
}) {
  const R = sizes.reduce((a, b) => a + b, 0) || 1;
  let at = 0;
  return (
    <span className="strip" aria-hidden="true">
      {sizes.map((n, i) => {
        const pos = { left: `${(at / R) * 100}%`, width: `${(n / R) * 100}%` };
        at += n;
        return rests?.includes(i) ? (
          <span key={i} className="strip-rest" style={pos} />
        ) : (
          <span
            key={i}
            className={
              locked?.includes(i) ? 'strip-locked' : gaps?.includes(i) ? 'strip-gap' : undefined
            }
            style={{
              ...pos,
              background: sizeColor(labels?.[i] ?? n),
              color: inkFor(sizeColor(labels?.[i] ?? n)),
            }}
          >
            {labels?.[i] ?? n}
          </span>
        );
      })}
      {beats?.map((l) => (
        <i
          key={l.f}
          className={l.bar ? 'strip-beat strip-bar' : 'strip-beat'}
          style={{ left: `${l.f * 100}%` }}
        />
      ))}
    </span>
  );
}

export function GroupStrip({ groups, beats }: { groups: E.GroupSpec[]; beats?: StripLine[] }) {
  return (
    <Strip
      sizes={groups.map((g) => g.n)}
      rests={groups.flatMap((g, i) => (g.kind === 'rest' ? [i] : []))}
      beats={beats}
    />
  );
}

/** The contour of a fill: its sizes as a line (rising, falling, arch, …). */
export function Contour({ sizes }: { sizes: number[] }) {
  if (sizes.length < 2) return null;
  const max = Math.max(...sizes);
  const min = Math.min(...sizes);
  const W = 30;
  const H = 14;
  const pts = sizes
    .map((n, i) => {
      const x = (i / (sizes.length - 1)) * (W - 2) + 1;
      const y = max === min ? H / 2 : H - 1 - ((n - min) / (max - min)) * (H - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className="contour" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline points={pts} />
    </svg>
  );
}

/** Where the beat and bar lines fall inside the region (fractions of its length). */
export function useRegionBeats(): StripLine[] {
  const meter = useDocStore((s) => s.doc.meter);
  const region = fillRegion();
  const a = region?.a ?? 0;
  const b = region?.b ?? 0;
  return useMemo(() => {
    const grid = E.buildGrid(meter);
    const bars = new Set(E.barMap(meter).barStarts);
    const out: StripLine[] = [];
    for (let k = a + 1; k < b; k++)
      if (E.isOnBeat(grid, k))
        out.push({ f: (k - a) / (b - a), bar: bars.has(Math.round(grid.times[k]!)) });
    return out;
  }, [meter, a, b]);
}

/** The heart: keep a fill on this device, to fit into other regions and to breed from. */
export function Heart({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="fill-heart"
      aria-pressed={on}
      title={on ? `Let go of ${label}` : `Keep ${label}`}
      onClick={onClick}
    >
      <HeartIcon filled={on} />
      <span className="sr-only">Keep {label}</span>
    </button>
  );
}

/**
 * What is being tried, and the one way to keep it. Everywhere in the panel a tap (a row, a dot
 * on the map, a step between two fills) only tries: the fill shows in the score and plays in the
 * listening loop. "Use" (or a second tap on the same thing) writes it.
 */
export function UseBar({
  trying,
  beats,
  onUse,
  onCancel,
  onVary,
  varying = false,
}: {
  /** Browse: show this fill's variations in the list (it is not written). */
  onVary?: () => void;
  /** The list already shows the variations of this very fill. */
  varying?: boolean;
  /** The fill on trial, or null (no bar). */
  trying: { sizes: number[]; rests?: number[]; gaps?: number[]; labels?: number[] } | null;
  beats?: StripLine[];
  onUse: () => void;
  onCancel: () => void;
}) {
  // the row on trial stays in sight: the bar lies over the foot of the list, and would hide it
  const key = trying ? trying.sizes.join(' ') : '';
  useEffect(() => {
    if (!key) return;
    const id = requestAnimationFrame(() =>
      document
        .querySelector('.fillpanel .fill-list .fill-main[aria-pressed="true"]')
        ?.scrollIntoView({ block: 'nearest' }),
    );
    return () => cancelAnimationFrame(id);
  }, [key]);
  // nothing on trial: no bar at all (the panel says nothing a tap does not show)
  if (!trying) return null;
  return (
    <div className="fill-usebar" role="group" aria-label="Trying">
      <span className="fill-trying" role="status">
        Trying
        <span className="sr-only"> {trying.sizes.join(' ')}</span>
      </span>
      <Strip
        sizes={trying.sizes}
        rests={trying.rests}
        gaps={trying.gaps}
        labels={trying.labels}
        beats={beats}
      />
      {onVary && (
        <button
          type="button"
          className="fill-vary"
          aria-pressed={varying}
          disabled={varying}
          title="Not quite it? See this fill said other ways: nudged, rotated, backwards, regrouped…"
          onClick={onVary}
        >
          <BranchIcon />
          Variations
        </button>
      )}
      <button type="button" className="primary" onClick={onUse}>
        Use
      </button>
      <button type="button" className="ghost icon" title="Stop trying it" onClick={onCancel}>
        <CloseIcon />
        <span className="sr-only">Stop trying it</span>
      </button>
    </div>
  );
}

/**
 * ↑ ↓ Home End walk the rows of a list in Fill, Land and Vary alike (a row focused by the keys
 * is tried in the score: each list previews on focus).
 */
export function listKeys(e: React.KeyboardEvent<HTMLUListElement>): void {
  const step = { ArrowDown: 1, ArrowUp: -1, Home: -Infinity, End: Infinity }[e.key];
  if (step === undefined) return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('.fill-main')];
  const i = rows.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  rows[Math.max(0, Math.min(rows.length - 1, i + step))]?.focus();
}

/** How many rows of a group a list shows before "all N" (the same in Browse, Vary and Land). */
export const GROUP_FEW = 3;

/**
 * Which groups of a list are open in full; all close again when `reset` changes (a new
 * passage, pattern or region). The rest show their first GROUP_FEW rows.
 */
export function useOpenGroups(reset: unknown) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => setOpen(new Set()), [reset]);
  const toggle = (id: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return { open, toggle };
}

/** A group's rows as shown: all when open, else the first few, and always the row on trial. */
export function shownRows<T>(rows: readonly T[], open: boolean, keep?: (row: T) => boolean): T[] {
  return open ? [...rows] : rows.filter((r, i) => i < GROUP_FEW || keep?.(r));
}

/**
 * A group's heading in a list: its name, an optional quiet note, and "all N" (or "fewer") when
 * it has more rows than are shown. Calm on purpose: one line, small caps, a link.
 */
export function GroupHead({
  label,
  note,
  count,
  open,
  onToggle,
}: {
  label: string;
  note?: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="fill-group">
      <span className="fill-group-name">{label}</span>
      {note && <span className="land-group-note">{note}</span>}
      {count > GROUP_FEW && (
        <button type="button" className="link-btn" aria-expanded={open} onClick={onToggle}>
          {open ? 'fewer' : `all ${count}`}
          <span className="sr-only"> of {label}</span>
        </button>
      )}
    </li>
  );
}
