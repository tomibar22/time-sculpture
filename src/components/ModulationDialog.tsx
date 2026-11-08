import { useEffect, useRef, useState } from 'react';
import * as E from '../engine';
import { editModulation, modulate, removeModulation } from '../state/actions';
import { describePulse } from '../state/editing';
import { useDocStore, useUiStore } from '../state/store';
import { beatsLabel } from '../score/draw';

const RATIOS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Add or edit a metric modulation: "x:1 = y:1" (a pulse of x per beat before equals a pulse of y
 * per beat after) and the bar size from there on.
 */
export function ModulationDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const state = useUiStore((s) => s.modDialog);
  const tempo = useUiStore((s) => s.tempo);
  const set = useUiStore((s) => s.set);
  const doc = useDocStore((s) => s.doc);
  const editing = state && 'index' in state ? doc.meter.sections?.[state.index] : undefined;
  const at = state ? ('at' in state ? state.at : (editing?.at ?? 0)) : 0;
  const prevIdx = E.sectionAt(doc.meter, Math.max(0, at - 0.5));
  const before = E.barMap(doc.meter).sections[prevIdx]!;
  const [from, setFrom] = useState(2);
  const [to, setTo] = useState(3);
  const [bar, setBar] = useState(4);

  useEffect(() => {
    if (!state) return dialog.current?.close();
    setFrom(editing?.from ?? 2);
    setTo(editing?.to ?? 3);
    setBar(editing?.beatsPerBar ?? before.beatsPerBar);
    if (!dialog.current?.open) dialog.current?.showModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const close = () => set({ modDialog: null });
  const beforeTempo = tempo / before.scale;
  const afterTempo = beforeTempo * (from / to);
  const ratio = to / from;
  const grid = E.buildGrid(doc.meter);
  const where = state ? describePulse(grid.pre[at] ?? 0) : '';

  const Seg = ({
    value,
    onPick,
    label,
  }: {
    value: number;
    onPick: (n: number) => void;
    label: string;
  }) => (
    <div className="segs ratios mod-ratios" role="group" aria-label={label}>
      {RATIOS.map((n) => (
        <button key={n} type="button" aria-pressed={value === n} onClick={() => onPick(n)}>
          {n}:1
        </button>
      ))}
    </div>
  );

  return (
    <dialog
      ref={dialog}
      className="library"
      aria-labelledby="mod-h"
      onClose={close}
      onClick={(e) => e.target === dialog.current && close()}
    >
      <div className="lib-inner">
        <div className="lib-head">
          <h2 id="mod-h">{editing ? 'Modulation' : 'Modulate here'}</h2>
          <button type="button" className="ghost" onClick={close}>
            Close
          </button>
        </div>
        <p className="rows-hint">
          From {where}: a pulse of the first ratio before equals a pulse of the second after.
        </p>
        <div className="mod-eq">
          <span className="lbl">Before</span>
          <Seg value={from} onPick={setFrom} label="Ratio before" />
          <span className="mod-equals" aria-hidden="true">
            =
          </span>
          <span className="lbl">After</span>
          <Seg value={to} onPick={setTo} label="Ratio after" />
        </div>
        <div className="field">
          <span id="lbl-modbar">Beats per bar after it</span>
          <div className="stepper" role="group" aria-labelledby="lbl-modbar">
            <button
              type="button"
              aria-label="Fewer beats per bar"
              disabled={bar <= 1}
              onClick={() => setBar(bar - 1)}
            >
              −
            </button>
            <output>{bar}</output>
            <button
              type="button"
              aria-label="More beats per bar"
              disabled={bar >= 13}
              onClick={() => setBar(bar + 1)}
            >
              +
            </button>
          </div>
        </div>
        <p className="mod-summary" aria-live="polite">
          <b>
            {from}:1 = {to}:1
          </b>{' '}
          · a new beat lasts {beatsLabel(ratio)} old beat{ratio === 1 ? '' : 's'} · ♩{' '}
          {Math.round(beforeTempo * 10) / 10} → <b>{Math.round(afterTempo * 10) / 10}</b>
        </p>
        <div className="lib-actions">
          <button
            type="button"
            className="primary"
            onClick={() => {
              const spec = { from, to, beatsPerBar: bar };
              const ok =
                editing && state && 'index' in state
                  ? editModulation(state.index, spec)
                  : modulate(at, spec);
              if (ok) close();
            }}
          >
            {editing ? 'Save' : 'Modulate'}
          </button>
          {editing && state && 'index' in state && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                removeModulation(state.index);
                close();
              }}
            >
              Remove modulation
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
