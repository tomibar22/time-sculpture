import * as E from '../engine';
import {
  clearSelection,
  duplicateSelection,
  mergeSelection,
  moveSelection,
  removeSelection,
  splitSelection,
  toggleMulti,
  openModulation,
  toggleLineBreak,
  togglePhraseMark,
  changeRepeatTimes,
  openVolta,
  toggleTotalOver,
  toggleRepeatEndAt,
  toggleRepeatStartAt,
  addBarAtStart,
  addBarAtEnd,
  selectAll,
} from '../state/actions';
import {
  caretHome,
  openSubdivision,
  selectedRegion,
  copyButton,
  deleteAtCaret,
  describePulse,
  escape,
  extendRange,
  moveCaret,
  paste,
  resizeSelection,
  reverseSelection,
  playFromCaret,
} from '../state/editing';
import { openFill } from '../state/fill';
import { useDocStore, useUiStore } from '../state/store';

export function SelectionBar() {
  const doc = useDocStore((s) => s.doc);
  const selection = useUiStore((s) => s.selection);
  const multi = useUiStore((s) => s.multi);
  const clip = useUiStore((s) => s.clipboard);
  const items = doc.items;
  const idx = E.selectedIndices(items, selection);
  if (!idx.length && !multi) return <CaretBar />;

  const sel = idx.map((i) => items[i]!);
  const total = sel.reduce((a, x) => a + x.n, 0);
  const si = E.spaceIndex(items);
  const contiguous = idx.length > 1 && E.isContiguous(idx);
  const free = E.freePulses(doc);
  const first = sel[0];

  return (
    <div className="selbar" role="toolbar" aria-label="Selected groups">
      <div className="selbar-head">
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
          className="selbar-done"
          aria-label="Done, clear the selection"
          onClick={clearSelection}
        >
          Done
        </button>
      </div>
      <div className="selbar-actions">
        <button
          type="button"
          aria-pressed={multi}
          title="Tap groups to add them to the selection"
          onClick={() => toggleMulti()}
        >
          Select several
        </button>
        {sel.length < items.length - 1 && (
          <button type="button" title="Select every group (⌘A)" onClick={selectAll}>
            Select all
          </button>
        )}
        <span className="selbar-sep" aria-hidden="true" />
        {/* place and size */}
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
        <span className="selbar-sep" aria-hidden="true" />
        {/* the groups themselves */}
        <button
          type="button"
          title="Split in two (S, or double-tap the group)"
          disabled={!sel.some((x) => x.n >= 2)}
          onClick={splitSelection}
        >
          Split
        </button>
        {contiguous && (
          <button type="button" title="Merge into one group (M)" onClick={mergeSelection}>
            Merge
          </button>
        )}
        <button
          type="button"
          title="A copy right after (D)"
          disabled={!sel.length || total > free}
          onClick={duplicateSelection}
        >
          Duplicate
        </button>
        <button
          type="button"
          title="Remove (Delete)"
          disabled={!sel.length}
          onClick={removeSelection}
        >
          Remove
        </button>
        <span className="selbar-sep" aria-hidden="true" />
        {/* hear it, say it another way */}
        {sel.length > 0 && <LoopButton />}
        <button
          type="button"
          disabled={!sel.length || !E.isContiguous(idx)}
          title="The same passage said another way: backwards, rotated, regrouped… (⇧V)"
          onClick={() => openFill('vary')}
        >
          Vary…
        </button>
        <button
          type="button"
          disabled={!contiguous && sel.length !== 1}
          title="Fill this stretch again: shapes, or every way to do it"
          onClick={() => openFill('browse')}
        >
          Refill…
        </button>
        {(contiguous || (sel.length > 1 && E.isContiguous(idx))) && (
          <button
            type="button"
            title="Retrograde: reverse the order (⇧R)"
            onClick={reverseSelection}
          >
            Reverse
          </button>
        )}
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
        <span className="selbar-sep" aria-hidden="true" />
        {/* marks on the score */}
        <TotalButton disabled={!sel.length || !E.isContiguous(idx)} />
        <button
          type="button"
          disabled={!sel.length || !E.isContiguous(idx)}
          title="Ending bracket over the selection: 1., 2. … (V)"
          onClick={() => openVolta(selectedRegion())}
        >
          Ending…
        </button>
        <button
          type="button"
          disabled={!sel.length}
          title="Subdivision of the beats under the selection (B paints the brush)"
          onClick={openSubdivision}
        >
          Subdivision…
        </button>
      </div>
    </div>
  );
}

/**
 * Shown when a caret is placed or a pulse range is selected (and no tiles are): the touch way to
 * do what the keys do.
 */
function CaretBar() {
  useDocStore((s) => s.version);
  const caret = useUiStore((s) => s.caret);
  const range = useUiStore((s) => s.range);
  const clip = useUiStore((s) => s.clipboard);
  const keypad = useUiStore((s) => s.keypad);
  if (caret === null && !range) return null;
  const docNow = useDocStore.getState().doc;
  const gridNow = E.buildGrid(docNow.meter);
  const beatHere = caret === null ? -1 : E.beatOfPulse(gridNow, Math.min(caret, gridNow.TS - 1));
  const isBeatLine =
    caret !== null && caret > 0 && caret < gridNow.TS && gridNow.pre[beatHere] === caret;
  const sectionHere = (docNow.meter.sections ?? []).some((s) => s.at === beatHere);
  const repeatEnd = caret === null ? null : E.repeatEndAt(docNow, caret);

  if (range) {
    return (
      <div className="selbar caretbar" role="toolbar" aria-label="Selected range">
        <div className="selbar-head">
          <span className="selname" data-testid="caretname">
            <b>{range.b - range.a}</b> pulses{' '}
            <span className="dim">· from {describePulse(range.a)}</span>
          </span>
          <button
            type="button"
            className="selbar-done"
            aria-label="Done, clear the selection"
            onClick={escape}
          >
            Done
          </button>
        </div>
        <div className="selbar-actions">
          <button type="button" aria-label="Select one pulse less" onClick={() => extendRange(-1)}>
            ⇤
          </button>
          <button type="button" aria-label="Select one pulse more" onClick={() => extendRange(1)}>
            ⇥
          </button>
          <LoopButton />
          <button type="button" onClick={() => openFill('random')}>
            Fill randomly
          </button>
          <button type="button" onClick={() => openFill('browse')}>
            Browse fills
          </button>
          <button
            type="button"
            title="The same passage said another way: backwards, rotated, regrouped… (⇧V)"
            onClick={() => openFill('vary')}
          >
            Vary…
          </button>
          <button
            type="button"
            title="Ending bracket over the range: 1., 2. … (V)"
            onClick={() => openVolta(range)}
          >
            Ending…
          </button>
          <TotalButton />
          <button
            type="button"
            title="Subdivision of the beats in the range"
            onClick={openSubdivision}
          >
            Subdivision…
          </button>
          <button type="button" title="Select every group (⌘A)" onClick={selectAll}>
            Select all
          </button>
          <button type="button" onClick={() => deleteAtCaret(-1)}>
            Silence
          </button>
          <button type="button" onClick={() => copyButton(false)}>
            Copy
          </button>
          <button type="button" onClick={() => copyButton(true)}>
            Cut
          </button>
          {clip.length > 0 && (
            <button type="button" onClick={() => paste()}>
              Paste
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="selbar caretbar" role="toolbar" aria-label="Caret">
      <div className="selbar-head">
        <span className="selname" data-testid="caretname">
          Caret <span className="dim">· {describePulse(caret!)}</span>
        </span>
        <button
          type="button"
          className="selbar-done"
          aria-label="Done, remove the caret"
          onClick={escape}
        >
          Done
        </button>
      </div>
      <div className="selbar-actions">
        {!keypad && (
          <>
            <button type="button" aria-label="Caret to the start" onClick={() => caretHome(false)}>
              ⇤
            </button>
            <button type="button" aria-label="Caret left" onClick={() => moveCaret(-1)}>
              ←
            </button>
            <button type="button" aria-label="Caret right" onClick={() => moveCaret(1)}>
              →
            </button>
            <button type="button" aria-label="Caret to the end" onClick={() => caretHome(true)}>
              ⇥
            </button>
          </>
        )}
        {isBeatLine && (
          <button
            type="button"
            title="Metric modulation from here (T)"
            onClick={() => openModulation(caret!)}
          >
            {sectionHere ? 'Modulation…' : 'Modulate…'}
          </button>
        )}
        <button
          type="button"
          title="Subdivision of the beat at the caret"
          onClick={openSubdivision}
        >
          Subdivision…
        </button>
        {caret === 0 && (
          <button
            type="button"
            title="Add an empty bar before the beginning, for an opening"
            onClick={addBarAtStart}
          >
            Bar before
          </button>
        )}
        {caret === gridNow.TS && (
          <button
            type="button"
            title="Add an empty bar after the end, to go on writing"
            onClick={addBarAtEnd}
          >
            Bar after
          </button>
        )}
        <button
          type="button"
          title="Mark the start of a phrase here (P)"
          onClick={() => togglePhraseMark(caret!)}
        >
          {E.hasMarkAt(useDocStore.getState().doc, caret!) ? 'Unmark phrase' : 'Phrase mark'}
        </button>
        {E.hasMarkAt(useDocStore.getState().doc, caret!) && (
          <button
            type="button"
            title="Name this phrase mark, or leave it without a name (⇧P)"
            onClick={() => useUiStore.getState().set({ markDialog: { k: caret! } })}
          >
            Name…
          </button>
        )}
        {caret! < gridNow.TS && (
          <button
            type="button"
            title="Start repeat sign here ([)"
            onClick={() => toggleRepeatStartAt(caret!)}
          >
            {E.repeatStartAt(docNow, caret!) ? 'Remove |:' : '|: Start repeat'}
          </button>
        )}
        {caret! > 0 && (
          <button
            type="button"
            title="End repeat sign here (])"
            onClick={() => toggleRepeatEndAt(caret!)}
          >
            {repeatEnd ? 'Remove :|' : ':| End repeat'}
          </button>
        )}
        {repeatEnd && (
          <div className="stepper repeat-times" role="group" aria-label="Times played">
            <button
              type="button"
              aria-label="Play it one time less"
              title="One time less (−)"
              disabled={repeatEnd.times <= E.MIN_REPEAT}
              onClick={() => changeRepeatTimes(caret!, -1)}
            >
              −
            </button>
            <output data-testid="repeat-times">×{repeatEnd.times}</output>
            <button
              type="button"
              aria-label="Play it one time more"
              title="One time more (+)"
              disabled={repeatEnd.times >= E.MAX_REPEAT}
              onClick={() => changeRepeatTimes(caret!, 1)}
            >
              +
            </button>
          </div>
        )}
        <button
          type="button"
          title="Start a new row here (Enter)"
          onClick={() => toggleLineBreak(caret!)}
        >
          {E.hasBreakAt(useDocStore.getState().doc, caret!) ? 'Join rows' : 'Break line'}
        </button>
        <button
          type="button"
          aria-label="Select from the caret, one pulse more"
          onClick={() => extendRange(1)}
        >
          Select ⇥
        </button>
        {clip.length > 0 && (
          <button type="button" title="Paste here (⌘V)" onClick={() => paste()}>
            Paste {E.formatGroups(clip)}
          </button>
        )}
        <button type="button" title="Select every group (⌘A)" onClick={selectAll}>
          Select all
        </button>
      </div>
      <span className="hint">
        {keypad
          ? 'Numbers from the pad below are written here. ⇧ arrows select a range.'
          : 'Type a number to write here; ⇧ arrows select a range (123 opens the number pad)'}
      </span>
    </div>
  );
}

/** Show (or remove) the total pulses of the selected groups or range, under the score (G). */
function TotalButton({ disabled = false }: { disabled?: boolean }) {
  useDocStore((s) => s.version);
  useUiStore((s) => s.range);
  useUiStore((s) => s.selection);
  const region = selectedRegion();
  const has = !!region && E.totalIndex(useDocStore.getState().doc, region.a, region.b) >= 0;
  return (
    <button
      type="button"
      disabled={disabled}
      title="A bracket under the score with the total pulses of the selection (G)"
      onClick={() => toggleTotalOver(selectedRegion())}
    >
      {has ? 'Remove total' : 'Total'}
    </button>
  );
}

/** Play the selected stretch round and round, to hear or practise it (⇧Space). */
function LoopButton() {
  const playing = useUiStore((s) => s.playing);
  return (
    <button
      type="button"
      className="loop-btn"
      aria-pressed={playing}
      title="Play the selection round and round (⇧Space)"
      onClick={playFromCaret}
    >
      {playing ? '■ Stop' : '↻ Loop'}
    </button>
  );
}
