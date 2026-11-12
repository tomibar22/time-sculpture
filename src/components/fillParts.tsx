import { useMemo } from 'react';
import * as E from '../engine';
import { fillRegion } from '../state/fill';
import { useDocStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';
import { CloseIcon, HeartIcon } from './Icons';

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
}: {
  sizes: number[];
  rests?: number[];
  beats?: StripLine[];
  locked?: number[];
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
            className={locked?.includes(i) ? 'strip-locked' : undefined}
            style={{ ...pos, background: sizeColor(n), color: inkFor(sizeColor(n)) }}
          >
            {n}
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
  what,
  onUse,
  onCancel,
}: {
  /** The fill on trial, or null: the bar keeps its place (nothing jumps under a second tap). */
  trying: { sizes: number[]; rests?: number[] } | null;
  beats?: StripLine[];
  /** "fill" or "variation", for the hint. */
  what: string;
  onUse: () => void;
  onCancel: () => void;
}) {
  if (!trying)
    return (
      <p className="fill-usebar idle">
        Tap a {what} to try it in the score. Nothing is written until you tap Use.
      </p>
    );
  return (
    <div className="fill-usebar" role="group" aria-label="Trying">
      <span className="fill-trying" role="status">
        Trying
        <span className="sr-only"> {trying.sizes.join(' ')}</span>
      </span>
      <Strip sizes={trying.sizes} rests={trying.rests} beats={beats} />
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
