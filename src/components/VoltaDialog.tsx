import { useEffect, useRef, useState } from 'react';
import * as E from '../engine';
import { removeVoltaAt, saveVolta } from '../state/actions';
import { describePulse } from '../state/editing';
import { useDocStore, useUiStore } from '../state/store';

/**
 * Add or edit an ending ("volta"): the bracket over a stretch that is played only on some passes
 * of its repeat: "1." before the end repeat sign, "2." right after it, or "1. 2." and "3." for a
 * passage played three times.
 */
export function VoltaDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const state = useUiStore((s) => s.voltaDialog);
  const set = useUiStore((s) => s.set);
  const doc = useDocStore((s) => s.doc);
  const grid = E.buildGrid(doc.meter);
  const editing = state && 'index' in state ? doc.meter.voltas?.[state.index] : undefined;
  const ka = state ? ('ka' in state ? state.ka : E.nearestPulse(grid, editing?.a ?? 0)) : 0;
  const kb = state ? ('kb' in state ? state.kb : E.nearestPulse(grid, editing?.b ?? 0)) : 0;
  const [passes, setPasses] = useState<number[]>([1]);

  useEffect(() => {
    if (!state) return dialog.current?.close();
    setPasses(
      editing
        ? [...editing.passes]
        : E.defaultPasses(doc.meter, grid.times[ka] ?? 0, grid.times[kb] ?? 0),
    );
    if (!dialog.current?.open) dialog.current?.showModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const close = () => set({ voltaDialog: null });
  // offer as many passes as the repeat it belongs to has (at least 4)
  const rep = E.repeatsOf(doc.meter);
  const most = Math.min(
    E.MAX_PASS,
    Math.max(4, ...rep.map((r) => r.times), ...passes, ...(editing?.passes ?? [])),
  );
  const toggle = (p: number) =>
    setPasses((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p].sort((x, y) => x - y),
    );
  const where = state ? `${describePulse(ka)}, ${kb - ka} pulse${kb - ka === 1 ? '' : 's'}` : '';

  return (
    <dialog
      ref={dialog}
      className="library"
      aria-labelledby="volta-h"
      onClose={close}
      onClick={(e) => e.target === dialog.current && close()}
    >
      <div className="lib-inner">
        <div className="lib-head">
          <h2 id="volta-h">{editing ? 'Ending' : 'New ending'}</h2>
          <button type="button" className="ghost" onClick={close}>
            Close
          </button>
        </div>
        <p className="rows-hint">
          From {where}. It is played only on the passes you pick: a 1st ending goes just before the
          end repeat sign, the 2nd right after it.
        </p>
        <div className="field wrap-field">
          <span id="lbl-passes">Played on pass</span>
          <div className="segs volta-passes" role="group" aria-labelledby="lbl-passes">
            {Array.from({ length: most }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={passes.includes(p)}
                onClick={() => toggle(p)}
              >
                {p}.
              </button>
            ))}
          </div>
        </div>
        <p className="mod-summary" aria-live="polite">
          {passes.length ? (
            <>
              Bracket: <b>{E.passesLabel(passes)}</b>
            </>
          ) : (
            'Pick at least one pass'
          )}
        </p>
        <div className="lib-actions">
          <button
            type="button"
            className="primary"
            disabled={!passes.length}
            onClick={() => saveVolta(ka, kb, passes) && close()}
          >
            {editing ? 'Save' : 'Add ending'}
          </button>
          {editing && state && 'index' in state && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                removeVoltaAt(state.index);
                close();
              }}
            >
              Remove ending
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
