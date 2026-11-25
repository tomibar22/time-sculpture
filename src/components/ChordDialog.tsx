import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import * as E from '../engine';
import { groupWhere, neighbourGroup, writeChord } from '../state/chords';
import { describePulse } from '../state/editing';
import { useDocStore, useUiStore } from '../state/store';

/**
 * Write a chord symbol over a tile ("C-7(b6)", free text). Enter saves; Next / Tab saves and
 * goes on to the next tile, so a whole progression is typed in one go (⇧Tab / Previous back).
 */
export function ChordDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const state = useUiStore((s) => s.chordDialog);
  const set = useUiStore((s) => s.set);
  useDocStore((s) => s.doc); // the head follows the document
  const id = state?.id ?? null;
  const where = id ? groupWhere(id) : null;
  const [text, setText] = useState('');

  useEffect(() => {
    if (!state) return dialog.current?.close();
    setText(E.chordOf(useDocStore.getState().doc, state.id));
    const opening = !dialog.current?.open;
    if (opening) dialog.current?.showModal();
    // show the tile being named
    useUiStore.getState().set({ selection: [state.id], anchor: state.id, range: null });
    // select once, on opening (going on to the next tile selects at once, in go)
    if (opening) requestAnimationFrame(() => input.current?.select());
  }, [state]);

  const close = () => {
    input.current?.blur(); // at once, so the next key (Z to undo) reaches the score
    set({ chordDialog: null });
  };
  const save = () => {
    if (id) writeChord(id, text);
  };
  const go = (dir: -1 | 1) => {
    if (!id) return;
    save();
    const to = neighbourGroup(id, dir);
    if (!to) return close();
    // at once, not a frame later: typing may go straight on
    flushSync(() => setText(E.chordOf(useDocStore.getState().doc, to)));
    input.current?.select();
    set({ chordDialog: { id: to } });
  };
  const prev = id ? neighbourGroup(id, -1) : null;
  const next = id ? neighbourGroup(id, 1) : null;

  return (
    <dialog
      ref={dialog}
      className="library chord-dialog"
      aria-labelledby="chord-h"
      onClose={close}
      onClick={(e) => e.target === dialog.current && close()}
    >
      <form
        className="lib-inner"
        onSubmit={(e) => {
          e.preventDefault();
          save();
          close();
        }}
      >
        <div className="lib-head">
          <h2 id="chord-h">Chord</h2>
          <button type="button" className="ghost" onClick={close}>
            Close
          </button>
        </div>
        <p className="rows-hint">
          {where ? `On the ${where.n} at ${describePulse(where.at)}.` : ''} Next writes it and goes
          on to the next tile.
        </p>
        <label className="field wrap-field">
          <span>Chord</span>
          <input
            ref={input}
            type="text"
            className="chord-name"
            value={text}
            maxLength={E.MAX_CHORD}
            placeholder="C-7(b6)"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint={next ? 'next' : 'done'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                go(e.shiftKey ? -1 : 1);
              } else if (e.key === 'Enter' && next && !e.metaKey && !e.ctrlKey) {
                // Enter goes on through the progression; ⌘Enter (or Save) ends it
                e.preventDefault();
                go(1);
              }
            }}
          />
        </label>
        <div className="lib-actions">
          <button type="button" disabled={!prev} onClick={() => go(-1)}>
            ‹ Previous
          </button>
          <button type="button" className="primary" disabled={!next} onClick={() => go(1)}>
            Next ›
          </button>
          <button type="submit">Save</button>
          {id && E.chordOf(useDocStore.getState().doc, id) && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                writeChord(id, '');
                close();
              }}
            >
              Remove
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
