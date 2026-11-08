import { applySubdivisionEverywhere, toggleTraySize } from '../state/actions';
import { useDocStore, useUiStore } from '../state/store';

export function Options() {
  const tray = useUiStore((s) => s.tray);
  const snap = useUiStore((s) => s.snap);
  const ticks = useUiStore((s) => s.ticks);
  const brush = useUiStore((s) => s.brush);
  const set = useUiStore((s) => s.set);
  const log = useDocStore((s) => s.log);
  return (
    <details className="disclosure">
      <summary>Options</summary>
      <div className="dbody">
        <div className="chips" role="group" aria-labelledby="lbl-tray">
          <span className="lbl" id="lbl-tray">
            Tray sizes (pulses)
          </span>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={tray.includes(n)}
              onClick={() => toggleTraySize(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <label className="opt">
          <input type="checkbox" checked={snap} onChange={(e) => set({ snap: e.target.checked })} />{' '}
          Lines snap to tray sizes
        </label>
        <label className="opt">
          <input
            type="checkbox"
            checked={ticks}
            onChange={(e) => set({ ticks: e.target.checked })}
          />{' '}
          Hear the subdivisions
        </label>
        <div>
          <button type="button" onClick={applySubdivisionEverywhere}>
            Apply {brush}:1 to every beat
          </button>
        </div>
        {log.length > 0 && <p className="hist">Recent: {log.join(' → ')}</p>}
      </div>
    </details>
  );
}
