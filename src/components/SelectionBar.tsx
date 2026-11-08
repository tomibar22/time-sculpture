import * as E from '../engine';
import {
  clearSelection,
  duplicateSelection,
  mergeSelection,
  moveSelection,
  removeSelection,
  splitSelection,
  toggleMulti,
  toggleSelectionKind,
} from '../state/actions';
import { useDocStore, useUiStore } from '../state/store';

export function SelectionBar() {
  const doc = useDocStore((s) => s.doc);
  const selection = useUiStore((s) => s.selection);
  const multi = useUiStore((s) => s.multi);
  const items = doc.items;
  const idx = E.selectedIndices(items, selection);
  if (!idx.length && !multi) return null;

  const sel = idx.map((i) => items[i]!);
  const total = sel.reduce((a, x) => a + x.n, 0);
  const si = E.spaceIndex(items);
  const allRest = sel.length > 0 && sel.every((x) => x.kind === 'rest');
  const contiguous = idx.length > 1 && E.isContiguous(idx);
  const free = E.freePulses(doc);
  const first = sel[0];

  return (
    <div className="selbar" role="toolbar" aria-label="Selected groups">
      <span className="selname" data-testid="selname">
        {sel.length === 0 ? (
          'Tap groups to select'
        ) : sel.length === 1 && first ? (
          <>
            {first.kind === 'rest' ? 'Silence' : 'Group'} <b>{first.n}</b>{' '}
            <span className="dim">· {idx[0]! < si ? 'start' : 'ending'}</span>
          </>
        ) : (
          <>
            <b>{sel.length}</b> selected <span className="dim">· {total} pulses</span>
          </>
        )}
      </span>
      <button
        type="button"
        aria-pressed={multi}
        title="Tap groups to add them to the selection"
        onClick={() => toggleMulti()}
      >
        Select several
      </button>
      <button
        type="button"
        aria-label="Move left"
        disabled={!sel.length || idx[0] === 0}
        onClick={() => moveSelection(-1)}
      >
        ←
      </button>
      <button
        type="button"
        aria-label="Move right"
        disabled={!sel.length || idx[idx.length - 1] === items.length - 1}
        onClick={() => moveSelection(1)}
      >
        →
      </button>
      {contiguous && (
        <button type="button" onClick={mergeSelection}>
          Merge
        </button>
      )}
      <button type="button" disabled={!sel.some((x) => x.n >= 2)} onClick={splitSelection}>
        Split
      </button>
      <button type="button" disabled={!sel.length} onClick={toggleSelectionKind}>
        {allRest ? 'Sound' : 'Silence'}
      </button>
      <button type="button" disabled={!sel.length || total > free} onClick={duplicateSelection}>
        Duplicate
      </button>
      <button type="button" disabled={!sel.length} onClick={removeSelection}>
        Remove
      </button>
      <button type="button" aria-label="Clear selection" onClick={clearSelection}>
        Done
      </button>
    </div>
  );
}
