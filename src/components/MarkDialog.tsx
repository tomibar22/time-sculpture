import { useEffect, useRef, useState } from 'react';
import * as E from '../engine';
import { nameMarkAt, togglePhraseMark } from '../state/actions';
import { describePulse } from '../state/editing';
import { useDocStore, useUiStore } from '../state/store';

/**
 * Name a phrase mark ("A", "theme", "answer"…), or leave it unnamed: then it is only a line and
 * a small flag. Opened from the caret bar (⇧P) or by tapping a mark's flag.
 */
export function MarkDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const state = useUiStore((s) => s.markDialog);
  const set = useUiStore((s) => s.set);
  const doc = useDocStore((s) => s.doc);
  const k = state?.k ?? 0;
  const current = state ? E.markNameAt(doc, k) : null;
  const [name, setName] = useState('');

  useEffect(() => {
    if (!state) return dialog.current?.close();
    setName(E.markNameAt(useDocStore.getState().doc, state.k) ?? '');
    if (!dialog.current?.open) dialog.current?.showModal();
    requestAnimationFrame(() => input.current?.select());
  }, [state]);

  const close = () => set({ markDialog: null });
  const save = () => nameMarkAt(k, name) && close();

  return (
    <dialog
      ref={dialog}
      className="library"
      aria-labelledby="mark-h"
      onClose={close}
      onClick={(e) => e.target === dialog.current && close()}
    >
      <form
        className="lib-inner"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="lib-head">
          <h2 id="mark-h">{current === null ? 'New phrase mark' : 'Phrase mark'}</h2>
          <button type="button" className="ghost" onClick={close}>
            Close
          </button>
        </div>
        <p className="rows-hint">
          At {state ? describePulse(k) : ''}. Give it a name, or leave it empty for just the mark.
        </p>
        <label className="field wrap-field">
          <span>Name</span>
          <input
            ref={input}
            type="text"
            className="mark-name"
            value={name}
            maxLength={E.MAX_MARK_NAME}
            placeholder="No name"
            enterKeyHint="done"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="lib-actions">
          <button type="submit" className="primary">
            {current === null ? 'Add mark' : 'Save'}
          </button>
          {current !== null && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                togglePhraseMark(k);
                close();
              }}
            >
              Remove mark
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
