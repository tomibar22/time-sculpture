import { announce, clearBreaks } from '../state/actions';
import { useDocStore, useUiStore } from '../state/store';

/**
 * Row options. How much a row holds is the zoom (ZoomControl); manual line breaks (Enter at the
 * caret, any pulse) are part of the composition, and "Join rows" removes them all.
 */
export function RowsControl() {
  const cycles = useDocStore((s) => s.doc.meter.cycles);
  const breaks = useDocStore((s) => s.doc.meter.breaks?.length ?? 0);
  const fitRows = useUiStore((s) => s.fitRows);
  const set = useUiStore((s) => s.set);
  return (
    <>
      {(breaks > 0 || cycles > 1) && (
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={fitRows}
          title="Stretch rows that end early to the full width"
          onClick={() => {
            set({ fitRows: !fitRows });
            announce(
              fitRows ? 'Rows keep a common beat width' : 'Short rows stretch to the full width',
            );
          }}
        >
          <span className="switch-track" aria-hidden="true">
            <span className="switch-knob" />
          </span>
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
