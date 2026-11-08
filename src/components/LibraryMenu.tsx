import { useEffect, useRef, useState } from 'react';
import type { LibraryEntry } from '../persistence/library';
import {
  createPiece,
  duplicatePiece,
  exportFile,
  exportPdf,
  importFile,
  listPieces,
  openPiece,
  removePiece,
  renamePiece,
  saveNow,
  shareLink,
} from '../persistence/session';
import { clearAll, toast } from '../state/actions';
import { useUiStore } from '../state/store';
import { MenuIcon } from './Icons';

const when = (t: number) =>
  new Date(t).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function LibraryMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const currentId = useUiStore((s) => s.currentId);
  const currentName = useUiStore((s) => s.currentName);
  const [name, setName] = useState(currentName);
  useEffect(() => setName(currentName), [currentName]);

  const refresh = async () => setEntries(await listPieces());
  const open = async () => {
    await saveNow();
    await refresh();
    setConfirm(null);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();
  const after = async (fn: () => Promise<void> | void, closeAfter = true) => {
    await fn();
    await refresh();
    if (closeAfter) close();
  };

  return (
    <>
      <button
        type="button"
        className="icon ghost lib-btn"
        aria-haspopup="dialog"
        onClick={() => void open()}
      >
        <MenuIcon />
        <span className="lib-name">{currentName}</span>
      </button>
      <dialog
        ref={dialog}
        className="library"
        aria-labelledby="lib-h"
        onClick={(e) => e.target === dialog.current && close()}
      >
        <div className="lib-inner">
          <div className="lib-head">
            <h2 id="lib-h">Library</h2>
            <button type="button" className="ghost" onClick={close}>
              Close
            </button>
          </div>
          <form
            className="lib-rename"
            onSubmit={(e) => {
              e.preventDefault();
              renamePiece(name);
              void saveNow().then(refresh);
              toast('Renamed');
            }}
          >
            <label htmlFor="lib-name">Name of this composition</label>
            <div className="row">
              <input
                id="lib-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
              <button type="submit">Rename</button>
            </div>
          </form>
          <div className="lib-save">
            <h3>Save as a file</h3>
            <div className="lib-actions">
              <button type="button" className="primary" onClick={() => void after(exportPdf)}>
                PDF score
              </button>
              <button type="button" onClick={() => void after(exportFile, false)}>
                JSON
              </button>
            </div>
            <p className="lib-note">
              The PDF is a clean sheet to play or study from. The JSON file is the composition
              itself: open it here again, or read it in other programs.
            </p>
          </div>
          <div className="lib-actions">
            <button
              type="button"
              className="primary"
              onClick={() => void after(() => createPiece())}
            >
              New
            </button>
            <button type="button" onClick={() => void after(duplicatePiece)}>
              Duplicate
            </button>
            <button type="button" onClick={() => fileInput.current?.click()}>
              Open a file
            </button>
            <button
              type="button"
              onClick={() =>
                void after(async () => {
                  const url = await shareLink();
                  try {
                    if (navigator.share) await navigator.share({ title: currentName, url });
                    else {
                      await navigator.clipboard.writeText(url);
                      toast('Share link copied. Open it on another device.');
                    }
                  } catch {
                    window.prompt('Copy this link', url);
                  }
                })
              }
            >
              Share link
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void after(() => importFile(f));
              }}
            />
          </div>
          <ul className="lib-list" aria-label="Saved compositions">
            {entries.map((e) => (
              <li key={e.id} className={e.id === currentId ? 'current' : ''}>
                <button
                  type="button"
                  className="lib-open"
                  aria-current={e.id === currentId}
                  onClick={() => void after(() => openPiece(e.id))}
                >
                  <span className="t">{e.name}</span>
                  <span className="d">{e.id === currentId ? 'open now' : when(e.updated)}</span>
                </button>
                {confirm === e.id ? (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => void after(() => removePiece(e.id), false)}
                  >
                    Delete?
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ghost"
                    aria-label={`Delete ${e.name}`}
                    onClick={() => setConfirm(e.id)}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="lib-actions">
            <button type="button" className="ghost" onClick={() => void after(clearAll)}>
              Clear this composition
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
