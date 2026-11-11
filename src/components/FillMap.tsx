import { useMemo, useRef, useState } from 'react';
import * as E from '../engine';
import type { FillOption } from '../engine';
import { previewFill } from '../state/fill';
import { useUiStore } from '../state/store';
import { sizeColor } from '../score/colors';

/** The size heard most often in a fill (its colour on the map). */
function mainSize(sizes: number[]): number {
  const n = new Map<number, number>();
  for (const s of sizes) n.set(s, (n.get(s) ?? 0) + s);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1;
}

/** A small, steady offset so fills with the same measures don't hide each other. */
function jitter(key: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return [((h & 255) / 255 - 0.5) * 0.05, (((h >> 8) & 255) / 255 - 0.5) * 0.05];
}

/**
 * The fills as a map: two measures as axes (density × syncopation, surprise × drive, …). Run a
 * finger or the pointer over it to hear and see each fill in place; lifting keeps the last one
 * as the candidate. Arrow keys walk to the nearest fill in that direction, Enter uses it.
 */
export function FillMap({
  options,
  cand,
  onCand,
  onUse,
}: {
  options: FillOption[];
  cand: FillOption | null;
  onCand: (o: FillOption | null) => void;
  onUse: (o: FillOption) => void;
}) {
  const axes = useUiStore((s) => s.fillAxes);
  const set = useUiStore((s) => s.set);
  const box = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const pts = useMemo(() => {
    const [ax, ay] = axes;
    const range = (k: E.FillAxis) => {
      const v = options.map((o) => o[k]);
      const lo = Math.min(...v);
      const hi = Math.max(...v);
      return (x: number) => (hi > lo ? (x - lo) / (hi - lo) : 0.5);
    };
    const fx = range(ax);
    const fy = range(ay);
    return options.map((o) => {
      const [jx, jy] = jitter(o.key);
      return {
        o,
        x: Math.min(0.97, Math.max(0.03, 0.06 + fx(o[ax]) * 0.88 + jx)),
        y: Math.min(0.95, Math.max(0.05, 0.08 + fy(o[ay]) * 0.84 + jy)),
      };
    });
  }, [options, axes]);

  const nearest = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect();
    let best: (typeof pts)[number] | null = null;
    let bd = Infinity;
    for (const p of pts) {
      const dx = r.left + p.x * r.width - cx;
      const dy = r.bottom - p.y * r.height - cy;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return bd < 48 * 48 ? best : null;
  };
  const hover = (e: React.PointerEvent) => {
    const p = nearest(e.clientX, e.clientY);
    if (p && p.o.key !== cand?.key) {
      onCand(p.o);
      previewFill(p.o);
    }
  };
  const step = (dx: number, dy: number) => {
    const here = pts.find((p) => p.o.key === cand?.key) ?? { x: 0.5, y: 0.5 };
    let best: (typeof pts)[number] | null = null;
    let bd = Infinity;
    for (const p of pts) {
      const vx = p.x - here.x;
      const vy = p.y - here.y;
      const along = vx * dx + vy * dy;
      if (along <= 0.001) continue;
      const d = along + 3 * Math.abs(vx * dy - vy * dx);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best) {
      onCand(best.o);
      previewFill(best.o);
    }
  };
  const label = (k: E.FillAxis) => E.FILL_AXES.find((a) => a.id === k)!;

  return (
    <div className="fill-mapwrap">
      <div
        ref={box}
        className={`fill-map${dragging ? ' dragging' : ''}`}
        role="application"
        aria-label={`Map of ${options.length} fills: ${label(axes[0]).label} across, ${label(axes[1]).label} up. Arrow keys move, Enter uses.`}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          hover(e);
        }}
        onPointerMove={(e) => {
          if (dragging || e.pointerType === 'mouse') hover(e);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(e) => {
          const d: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, 1],
            ArrowDown: [0, -1],
          };
          if (e.key === 'Enter' && cand) {
            e.preventDefault();
            e.stopPropagation();
            return onUse(cand);
          }
          const v = d[e.key];
          if (v) {
            e.preventDefault();
            e.stopPropagation();
            step(v[0], v[1]);
          }
        }}
      >
        {pts.map((p) => (
          <i
            key={p.o.key}
            className={`fill-dot${p.o.key === cand?.key ? ' on' : ''}${p.o.shape ? ' shaped' : ''}`}
            style={{
              left: `${p.x * 100}%`,
              bottom: `${p.y * 100}%`,
              background: sizeColor(mainSize(p.o.sizes)),
            }}
          />
        ))}
      </div>
      <p className="fill-axes" aria-hidden="true">
        <span>{label(axes[0]).low}</span>
        <span>
          ↑ {label(axes[1]).high} · {label(axes[0]).high} →
        </span>
      </p>
      <div className="fill-sort">
        <label htmlFor="fill-ax">Across</label>
        <select
          id="fill-ax"
          value={axes[0]}
          onChange={(e) => set({ fillAxes: [e.target.value as E.FillAxis, axes[1]] })}
        >
          {E.FILL_AXES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <label htmlFor="fill-ay">Up</label>
        <select
          id="fill-ay"
          value={axes[1]}
          onChange={(e) => set({ fillAxes: [axes[0], e.target.value as E.FillAxis] })}
        >
          {E.FILL_AXES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
