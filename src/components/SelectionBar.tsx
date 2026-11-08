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
import {
  copyButton,
  describeCursor,
  moveCursor,
  paste,
  resizeSelection,
  reverseSelection,
} from '../state/editing';
import { cursorIndex, useDocStore, useUiStore } from '../state/store';

export function SelectionBar() {
  const doc = useDocStore((s) => s.doc);
  const selection = useUiStore((s) => s.selection);
  const multi = useUiStore((s) => s.multi);
  const clip = useUiStore((s) => s.clipboard);
  const items = doc.items;
  const idx = E.selectedIndices(items, selection);
  if (!idx.length && !multi) return <CursorBar />;

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
      <span className="selbar-sep" aria-hidden="true" />
      <button
        type="button"
        disabled={!sel.length}
        title="Copy (⌘C)"
        onClick={() => copyButton(false)}
      >
        Copy
      </button>
      <button
        type="button"
        disabled={!sel.length}
        title="Cut (⌘X)"
        onClick={() => copyButton(true)}
      >
        Cut
      </button>
      {clip.length > 0 && (
        <button
          type="button"
          disabled={!sel.length}
          title={`Paste ${E.formatGroups(clip)} over the selection (⌘V)`}
          onClick={() => paste()}
        >
          Paste
        </button>
      )}
      {(contiguous || (sel.length > 1 && E.isContiguous(idx))) && (
        <button type="button" title="Retrograde: reverse the order (⇧R)" onClick={reverseSelection}>
          Reverse
        </button>
      )}
      <button
        type="button"
        aria-label="−1 pulse"
        title="Shorter by one pulse (−)"
        disabled={!sel.length || sel.some((x) => x.n < 2)}
        onClick={() => resizeSelection(-1)}
      >
        −1
      </button>
      <button
        type="button"
        aria-label="+1 pulse"
        title="Longer by one pulse (+)"
        disabled={!sel.length || free < sel.length}
        onClick={() => resizeSelection(1)}
      >
        +1
      </button>
      <button type="button" aria-label="Clear selection" onClick={clearSelection}>
        Done
      </button>
    </div>
  );
}

/** Shown when a text caret is placed and nothing is selected: the touch equivalent of the keys. */
function CursorBar() {
  const doc = useDocStore((s) => s.doc);
  const cursor = useUiStore((s) => s.cursor);
  const clip = useUiStore((s) => s.clipboard);
  const set = useUiStore((s) => s.set);
  const index = cursorIndex(doc, cursor);
  if (index === null) return null;
  return (
    <div className="selbar caretbar" role="toolbar" aria-label="Caret">
      <span className="selname" data-testid="caretname">
        Caret <span className="dim">· {describeCursor(index)}</span>
      </span>
      <button
        type="button"
        aria-label="Caret left"
        disabled={index === 0}
        onClick={() => moveCursor(-1)}
      >
        ←
      </button>
      <button
        type="button"
        aria-label="Caret right"
        disabled={index === doc.items.length}
        onClick={() => moveCursor(1)}
      >
        →
      </button>
      {clip.length > 0 && (
        <button type="button" title="Paste here (⌘V)" onClick={() => paste()}>
          Paste {E.formatGroups(clip)}
        </button>
      )}
      <span className="hint">Tap a piece or type a number to insert here</span>
      <button
        type="button"
        aria-label="Done, remove the caret"
        onClick={() => set({ cursor: null })}
      >
        Done
      </button>
    </div>
  );
}
