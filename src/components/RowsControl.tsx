import { announce, clearBreaks } from '../state/actions';
import { useDocStore, useUiStore } from '../state/store';
import { MAX_PER_ROW } from '../score/rows';
import { Stepper } from './Stepper';

/**
 * "Per row": how many bars a row holds before the score wraps. Manual line breaks (Enter at the
 * caret, any pulse) are part of the composition; "Join rows" removes them all.
 */
export function RowsControl() {
  const cycles = useDocStore((s) => s.doc.meter.cycles);
  const breaks = useDocStore((s) => s.doc.meter.breaks?.length ?? 0);
  const perRow = useUiStore((s) => s.perRow);
  const fitRows = useUiStore((s) => s.fitRows);
  const set = useUiStore((s) => s.set);
  const max = Math.min(MAX_PER_ROW, cycles);
  return (
    <>
      {cycles > 1 && (
        <Stepper
          label="Per row"
          value={Math.min(perRow, max)}
          min={1}
          max={max}
          fewer="Fewer bars per row"
          more="More bars per row"
          onChange={(n) => {
            set({ perRow: n });
            announce(`${n} bar${n === 1 ? '' : 's'} per row`);
          }}
        />
      )}
      {(breaks > 0 || cycles > 1) && (
        <button
          type="button"
          className="ghost rows-btn"
          aria-pressed={fitRows}
          title="Stretch rows that end early to the full width"
          onClick={() => {
            set({ fitRows: !fitRows });
            announce(
              fitRows ? 'Rows keep a common beat width' : 'Short rows stretch to the full width',
            );
          }}
        >
          Fit rows
        </button>
      )}
      {breaks > 0 && (
        <button
          type="button"
          className="ghost rows-btn"
          title="Remove every manual line break"
          onClick={clearBreaks}
        >
          Join rows ({breaks})
        </button>
      )}
    </>
  );
}
