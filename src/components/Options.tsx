import { applySubdivisionEverywhere } from '../state/actions';
import { useDocStore, useUiStore } from '../state/store';

export function Options() {
  const ticks = useUiStore((s) => s.ticks);
  const click = useUiStore((s) => s.click);
  const brush = useUiStore((s) => s.brush);
  const set = useUiStore((s) => s.set);
  const log = useDocStore((s) => s.log);
  return (
    <details className="disclosure">
      <summary>Options</summary>
      <div className="dbody">
        <label className="opt">
          <input
            type="checkbox"
            checked={click}
            onChange={(e) => set({ click: e.target.checked })}
          />{' '}
          Hear the beat (a click on every beat; the 1 always sounds)
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
