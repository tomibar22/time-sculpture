import { useRef } from 'react';
import { ui as sfx } from '../audio/voices';
import { announce } from '../state/actions';
import { useDocStore, useUiStore } from '../state/store';
import { MAX_PER_ROW, normalizeRows, rowLabel, rowStarts, setRowCycles } from '../score/rows';
import { Stepper } from './Stepper';

/** "Per row" stepper, plus a dialog to give specific rows a different number of cycles. */
export function RowsControl() {
  const cycles = useDocStore((s) => s.doc.meter.cycles);
  const perRow = useUiStore((s) => s.perRow);
  const custom = useUiStore((s) => s.rows);
  const set = useUiStore((s) => s.set);
  const dialog = useRef<HTMLDialogElement>(null);
  const rows = normalizeRows(custom, cycles, perRow);
  const starts = rowStarts(rows);
  const isCustom = custom.length > 0;
  const max = Math.min(MAX_PER_ROW, cycles);

  const setRow = (i: number, n: number) => {
    const next = setRowCycles(rows, i, n, cycles, perRow);
    set({ rows: next });
    sfx.snap();
    announce(`Row ${i + 1}: ${n} bar${n === 1 ? '' : 's'}`);
  };

  return (
    <>
      <Stepper
        label="Per row"
        value={Math.min(perRow, max)}
        min={1}
        max={max}
        fewer="Fewer bars per row"
        more="More bars per row"
        onChange={(n) => {
          set({ perRow: n, rows: [] });
          announce(`${n} bar${n === 1 ? '' : 's'} per row`);
        }}
      />
      <button
        type="button"
        className="ghost rows-btn"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        Rows…{isCustom && <span className="dot" aria-label=" (custom)" />}
      </button>
      <dialog
        ref={dialog}
        className="library"
        aria-labelledby="rows-h"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="lib-inner">
          <div className="lib-head">
            <h2 id="rows-h">Rows</h2>
            <button type="button" className="ghost" onClick={() => dialog.current?.close()}>
              Close
            </button>
          </div>
          <p className="rows-hint">
            How many bars each row of the score shows. Beats keep the same width in every row, so
            they line up like a score.
          </p>
          <ol className="rows-list">
            {rows.map((n, i) => {
              const after = cycles - starts[i]! - n;
              return (
                <li key={i}>
                  <span className="rows-name">
                    Row {i + 1} <span className="dim">· {rowLabel(starts[i]!, n)}</span>
                  </span>
                  <div className="stepper" role="group" aria-label={`Row ${i + 1}, bars`}>
                    <button
                      type="button"
                      aria-label={`Fewer bars in row ${i + 1}`}
                      disabled={n <= 1}
                      onClick={() => setRow(i, n - 1)}
                    >
                      −
                    </button>
                    <output data-testid={`row-${i + 1}-value`}>{n}</output>
                    <button
                      type="button"
                      aria-label={`More bars in row ${i + 1}`}
                      disabled={n >= MAX_PER_ROW || after <= 0}
                      onClick={() => setRow(i, n + 1)}
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="lib-actions">
            <button
              type="button"
              disabled={!isCustom}
              onClick={() => {
                set({ rows: [] });
                announce(`Every row: ${perRow} bar${perRow === 1 ? '' : 's'}`);
              }}
            >
              Same for every row ({Math.min(perRow, max)})
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
