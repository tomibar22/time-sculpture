import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as E from '../engine';
import {
  addBars,
  barsHere,
  changeMetre,
  clearRowBars,
  cutBars,
  plural,
  removeModulation,
  setPlayStart,
  setPlayStartBar,
  setRowBars,
} from '../state/actions';
import { caretPulse } from '../state/editing';
import { rowLayout } from '../score/rows';
import { useDocStore, useUiStore } from '../state/store';

/** A small dialog in the app's style; closing it (Esc, the backdrop, Close) calls `onClose`. */
function Sheet(props: {
  open: boolean;
  id: string;
  title: string;
  onClose: () => void;
  onSubmit?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { open, onClose } = props;
  useEffect(() => {
    if (!open) return ref.current?.close();
    if (!ref.current?.open) ref.current?.showModal();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="library piece-dialog"
      aria-labelledby={props.id}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <form
        className="lib-inner"
        onSubmit={(e) => {
          e.preventDefault();
          props.onSubmit?.();
        }}
      >
        <div className="lib-head">
          <h2 id={props.id}>{props.title}</h2>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {open && props.children}
      </form>
    </dialog>
  );
}

/** − n + with a label, for the dialogs (values are 1-based as shown). */
function Num(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  testid?: string;
}) {
  const { label, value, min, max, onChange } = props;
  return (
    <div className="field">
      <span>{label}</span>
      <div className="stepper" role="group" aria-label={label}>
        <button
          type="button"
          aria-label={`${label}: one less`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <output aria-live="polite" data-testid={props.testid}>
          {value}
        </output>
        <button
          type="button"
          aria-label={`${label}: one more`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ metre */

/**
 * The bars from a beat on (or of the whole piece): one size, or a pattern of sizes that goes
 * round, like 5 5 4. Only the bar lines move: the tempo, the subdivision and what is written stay.
 */
export function MeterDialog() {
  const state = useUiStore((s) => s.meterDialog);
  const set = useUiStore((s) => s.set);
  const doc = useDocStore((s) => s.doc);
  const [bars, setBars] = useState<number[]>([4]);
  const at = state?.at ?? 0;
  useEffect(() => {
    if (state) setBars([...E.patternAt(useDocStore.getState().doc.meter, state.at)]);
  }, [state]);
  const close = () => set({ meterDialog: null });
  const sections = doc.meter.sections ?? [];
  const index = sections.findIndex((s) => s.at === at);
  const here = sections[index];
  const until = sections.find((s) => s.at > at)?.at ?? doc.meter.subdivision.length;
  const stretch = until - at;
  const fit = E.patternFit(stretch, bars);
  const label = E.patternLabel(bars);
  const bb = E.barBeat(doc.meter, at);
  const sum = bars.reduce((a, n) => a + n, 0);
  return (
    <Sheet
      open={!!state}
      id="metre-h"
      title={at === 0 ? 'Metre of the piece' : `Metre from bar ${bb.bar}`}
      onClose={close}
      onSubmit={() => changeMetre(at, bars) && close()}
    >
      <p className="rows-hint">
        Beats in each bar. One bar size, or several that go round. Only the bar lines move: the
        tempo, the subdivision and everything written stay as they are.
      </p>
      <div className="metre-bars" role="group" aria-label="Bars of the pattern">
        {bars.map((n, i) => (
          <div className="metre-bar" key={i}>
            <div className="stepper" role="group" aria-label={`Bar ${i + 1} of the pattern`}>
              <button
                type="button"
                aria-label={`Bar ${i + 1}: one beat less`}
                disabled={n <= 1}
                onClick={() => setBars(bars.map((x, j) => (j === i ? x - 1 : x)))}
              >
                −
              </button>
              <output data-testid={`metre-bar-${i}`}>{n}</output>
              <button
                type="button"
                aria-label={`Bar ${i + 1}: one beat more`}
                disabled={n >= E.MAX_BEATS}
                onClick={() => setBars(bars.map((x, j) => (j === i ? x + 1 : x)))}
              >
                +
              </button>
            </div>
            {bars.length > 1 && (
              <button
                type="button"
                className="ghost metre-drop"
                aria-label={`Take bar ${i + 1} out of the pattern`}
                onClick={() => setBars(bars.filter((_, j) => j !== i))}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {bars.length < E.MAX_PATTERN && (
          <button
            type="button"
            className="ghost"
            onClick={() => setBars([...bars, bars[bars.length - 1] ?? 4])}
          >
            + Another bar
          </button>
        )}
      </div>
      <p className="metre-fit" data-testid="metre-fit" aria-live="polite">
        <b>{stretch}</b> beats = {plural(fit.bars, 'bar')}
        {bars.length > 1 && fit.rounds > 0 ? ` · ${fit.rounds} × (${label})` : ` of ${label}`}
        {fit.left ? ` · and a last bar of ${fit.left}` : ''}
        {bars.length > 1 ? ` · the pattern is ${sum} beats` : ''}
      </p>
      <div className="lib-actions">
        <button type="submit" className="primary">
          {at === 0 ? 'Set the metre' : 'Change the metre here'}
        </button>
        {here && here.from === here.to && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              removeModulation(index);
              close();
            }}
          >
            Remove this change
          </button>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ bars */

/** Add bars anywhere (how many, and where), or remove a run of bars with what is in it. */
export function BarsDialog() {
  const open = useUiStore((s) => s.barsDialog);
  const set = useUiStore((s) => s.set);
  const meter = useDocStore((s) => s.doc.meter);
  const nBars = E.barMap(meter).barStarts.length;
  const [count, setCount] = useState(1);
  const [side, setSide] = useState<'before' | 'after'>('after');
  const [bar, setBar] = useState(1);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  useEffect(() => {
    if (!open) return;
    const n = E.barMap(useDocStore.getState().doc.meter).barStarts.length;
    const here = barsHere();
    setCount(1);
    setSide('after');
    setBar(here ? here.b + 1 : n);
    setFrom(here ? here.a + 1 : n);
    setTo(here ? here.b + 1 : n);
  }, [open]);
  const close = () => set({ barsDialog: false, doomed: null });
  // the bars that Remove would take are tinted in the score while that part is in use
  const [aiming, setAiming] = useState(false);
  useEffect(() => {
    if (!open) return setAiming(false);
    const n = E.barMap(useDocStore.getState().doc.meter).barStarts.length;
    const lo = Math.min(from, n);
    const hi = Math.max(lo, Math.min(to, n));
    set({ doomed: aiming && hi - lo + 1 < n ? { a: lo - 1, b: hi - 1 } : null });
  }, [open, aiming, from, to, set]);
  const max = E.isFree(meter) ? E.MAX_CYCLES * 2 : E.MAX_CYCLES;
  const b = Math.min(bar, nBars);
  const f = Math.min(from, nBars);
  const t = Math.max(f, Math.min(to, nBars));
  const gone = t - f + 1;
  return (
    <Sheet open={open} id="bars-h" title="Bars" onClose={close}>
      <h3 className="dialog-sub">Add</h3>
      <div className="dialog-row">
        <Num
          label="How many"
          value={count}
          min={1}
          max={Math.max(1, Math.min(16, max - nBars))}
          onChange={setCount}
          testid="bars-count"
        />
        <label className="field">
          <span>Where</span>
          <select value={side} onChange={(e) => setSide(e.target.value as 'before' | 'after')}>
            <option value="before">before bar</option>
            <option value="after">after bar</option>
          </select>
        </label>
        <Num label="Bar" value={b} min={1} max={nBars} onChange={setBar} testid="bars-at" />
      </div>
      <div className="lib-actions">
        <button
          type="button"
          className="primary"
          disabled={nBars + count > max}
          onClick={() => addBars(side === 'before' ? b - 1 : b, count) && close()}
        >
          Add {plural(count, 'bar')} {side} bar {b}
        </button>
      </div>
      <h3 className="dialog-sub">Remove</h3>
      <div
        className="dialog-row"
        onFocus={() => setAiming(true)}
        onPointerDown={() => setAiming(true)}
      >
        <Num
          label="From bar"
          value={f}
          min={1}
          max={nBars}
          onChange={(v) => {
            setFrom(v);
            if (v > to) setTo(v);
          }}
          testid="bars-from"
        />
        <Num label="To bar" value={t} min={f} max={nBars} onChange={setTo} testid="bars-to" />
      </div>
      <div className="lib-actions">
        <button
          type="button"
          className="danger"
          disabled={gone >= nBars}
          onClick={() => cutBars(f - 1, gone) && close()}
        >
          {gone === 1 ? `Remove bar ${f}` : `Remove bars ${f}–${t}`}
        </button>
        <span className="rows-hint">
          {gone >= nBars ? 'A piece keeps at least one bar.' : 'What is written in them goes too.'}
        </span>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ rows */

/** How many bars a row holds: this row only, or every row from it on. */
export function RowDialog() {
  const state = useUiStore((s) => s.rowDialog);
  const set = useUiStore((s) => s.set);
  const meter = useDocStore((s) => s.doc.meter);
  const perRow = useUiStore((s) => s.perRow);
  const [per, setPer] = useState(2);
  const [scope, setScope] = useState<'row' | 'on'>('row');
  const rows = rowLayout(meter, perRow);
  const t = state?.t ?? 0;
  let ri = 0;
  while (ri + 1 < rows.length && rows[ri + 1]!.t0 <= t + E.EPS) ri++;
  const row = rows[ri]!;
  const map = E.barMap(meter);
  const barsIn = (a: number, b: number) =>
    Math.max(1, map.barStarts.filter((x) => x >= a - E.EPS && x < b - E.EPS).length);
  const own = E.rowSizeAt(meter, row.t0);
  useEffect(() => {
    if (!state) return;
    const m = useDocStore.getState().doc.meter;
    const rs = rowLayout(m, useUiStore.getState().perRow);
    let i = 0;
    while (i + 1 < rs.length && rs[i + 1]!.t0 <= state.t + E.EPS) i++;
    const bm = E.barMap(m);
    setPer(
      Math.max(
        1,
        bm.barStarts.filter((x) => x >= rs[i]!.t0 - E.EPS && x < rs[i]!.t1 - E.EPS).length,
      ),
    );
    setScope('row');
  }, [state]);
  const close = () => set({ rowDialog: null });
  /** Where a row of `n` bars that starts at this row's start ends (null = the end of the piece). */
  const endOf = (n: number): number | null => {
    const bi = map.barStarts.filter((x) => x <= row.t0 + E.EPS).length - 1;
    const into = row.t0 - (map.barStarts[bi] ?? 0);
    const target = map.barStarts[bi + n];
    return target === undefined ? null : target + into;
  };
  const bb = E.barBeat(meter, Math.floor(row.t0 + E.EPS));
  return (
    <Sheet
      open={!!state}
      id="row-h"
      title={`Row ${ri + 1}`}
      onClose={close}
      onSubmit={() => setRowBars(row.t0, per, scope === 'row' ? endOf(per) : null) && close()}
    >
      <p className="rows-hint">
        It starts at bar {bb.bar}
        {bb.beat > 1 ? `, beat ${bb.beat}` : ''} and holds {plural(barsIn(row.t0, row.t1), 'bar')}
        {own ? '' : ' (by the zoom)'}.
      </p>
      <div className="dialog-row">
        <Num
          label="Bars in the row"
          value={per}
          min={1}
          max={E.MAX_ROW_BARS}
          onChange={setPer}
          testid="row-per"
        />
        <div className="field wrap-field">
          <span id="lbl-rowscope">For</span>
          <div className="segs text" role="group" aria-labelledby="lbl-rowscope">
            <button type="button" aria-pressed={scope === 'row'} onClick={() => setScope('row')}>
              This row only
            </button>
            <button type="button" aria-pressed={scope === 'on'} onClick={() => setScope('on')}>
              From this row on
            </button>
          </div>
        </div>
      </div>
      <div className="lib-actions">
        <button type="submit" className="primary">
          {scope === 'row'
            ? `${plural(per, 'bar')} in this row`
            : `${plural(per, 'bar')} a row from here`}
        </button>
        {own > 0 && (
          <button
            type="button"
            className="ghost"
            onClick={() => setRowBars(row.t0, 0, null) && close()}
          >
            Back to the zoom from here
          </button>
        )}
        {(meter.rowSizes?.length ?? 0) > 0 && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              clearRowBars();
              close();
            }}
          >
            Every row by the zoom
          </button>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ where Play starts */

/** Where Play starts: a bar by its number, the caret, or the top. */
export function StartDialog() {
  const open = useUiStore((s) => s.startDialog);
  const set = useUiStore((s) => s.set);
  const meter = useDocStore((s) => s.doc.meter);
  const playStart = useUiStore((s) => s.playStart);
  useUiStore((s) => s.caret);
  const map = E.barMap(meter);
  const nBars = map.barStarts.length;
  const close = () => set({ startDialog: false });
  const at = playStart ?? 0;
  const bar = (map.barOf[Math.min(map.NB - 1, Math.floor(at + E.EPS))] ?? 0) + 1;
  const onBar = Math.abs((map.barStarts[bar - 1] ?? 0) - at) < E.EPS;
  const caret = open ? caretPulse() : null;
  const bb = E.barBeat(meter, Math.floor(at + E.EPS));
  return (
    <Sheet open={open} id="start-h" title="Play from" onClose={close} onSubmit={close}>
      <p className="rows-hint" data-testid="start-now" aria-live="polite">
        {playStart === null
          ? 'Play starts from the top.'
          : onBar
            ? `Play starts at bar ${bar}.`
            : `Play starts in bar ${bb.bar}, at beat ${bb.beat}${
                Math.abs(at - Math.round(at)) > E.EPS ? ' and a bit' : ''
              }.`}
      </p>
      <div className="dialog-row">
        <Num
          label="Bar"
          value={bar}
          min={1}
          max={nBars}
          onChange={(v) => setPlayStartBar(v - 1)}
          testid="start-bar"
        />
      </div>
      <div className="lib-actions">
        <button type="submit" className="primary">
          Done
        </button>
        {caret !== null && (
          <button type="button" className="ghost" onClick={() => setPlayStart(caret)}>
            At the caret
          </button>
        )}
        {playStart !== null && (
          <button type="button" className="ghost" onClick={() => setPlayStart(null)}>
            From the top
          </button>
        )}
      </div>
    </Sheet>
  );
}
