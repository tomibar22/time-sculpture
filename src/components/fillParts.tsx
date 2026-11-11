import { useMemo } from 'react';
import * as E from '../engine';
import { fillRegion } from '../state/fill';
import { useDocStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';
import { HeartIcon } from './Icons';

/**
 * A small picture of a fill: one coloured bar per tile, widths in proportion, with the beat
 * lines it sits in drawn through it (`beats`: fractions of the way, 0–1) so the way it settles
 * into the frame of time shows at a glance.
 */
export function Strip({
  sizes,
  rests,
  beats,
  locked,
}: {
  sizes: number[];
  rests?: number[];
  beats?: number[];
  locked?: number[];
}) {
  return (
    <span className="strip" aria-hidden="true">
      {sizes.map((n, i) =>
        rests?.includes(i) ? (
          <span key={i} className="strip-rest" style={{ flexGrow: n }} />
        ) : (
          <span
            key={i}
            className={locked?.includes(i) ? 'strip-locked' : undefined}
            style={{ flexGrow: n, background: sizeColor(n), color: inkFor(sizeColor(n)) }}
          >
            {n}
          </span>
        ),
      )}
      {beats?.map((f) => (
        <i key={f} className="strip-beat" style={{ left: `${f * 100}%` }} />
      ))}
    </span>
  );
}

export function GroupStrip({ groups, beats }: { groups: E.GroupSpec[]; beats?: number[] }) {
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

/** Where the beat lines fall inside the region (fractions of its length). */
export function useRegionBeats(): number[] {
  const meter = useDocStore((s) => s.doc.meter);
  const region = fillRegion();
  const a = region?.a ?? 0;
  const b = region?.b ?? 0;
  return useMemo(() => {
    const grid = E.buildGrid(meter);
    const out: number[] = [];
    for (let k = a + 1; k < b; k++) if (E.isOnBeat(grid, k)) out.push((k - a) / (b - a));
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
