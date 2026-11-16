import { useDocStore, useUiStore } from '../state/store';

export function Options() {
  const ticks = useUiStore((s) => s.ticks);
  const click = useUiStore((s) => s.click);
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
          Hear the beats (a click on every beat; the 1 of a bar always sounds)
        </label>
        <label className="opt">
          <input
            type="checkbox"
            checked={ticks}
            onChange={(e) => set({ ticks: e.target.checked })}
          />{' '}
          Hear the subdivisions
        </label>
        {log.length > 0 && <p className="hist">Recent: {log.join(' → ')}</p>}
      </div>
    </details>
  );
}
