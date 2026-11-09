import { useEffect, useRef, useState } from 'react';
import type { LibraryEntry } from '../persistence/library';
import {
  createPiece,
  duplicatePiece,
  exportBackup,
  exportFile,
  exportImage,
  exportMidi,
  exportMusicXml,
  exportPdf,
  importFile,
  listPieces,
  openPiece,
  phraseText,
  removePiece,
  renamePiece,
  saveNow,
  shareLink,
} from '../persistence/session';
import { clearAll, toast } from '../state/actions';
import { sameGridDoc, surpriseDoc } from '../state/defaults';
import { useDocStore, useUiStore } from '../state/store';
import { inkFor, sizeColor } from '../score/colors';
import { MenuIcon } from './Icons';

const when = (t: number) =>
  new Date(t).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** A piece at a glance: its groups as coloured bars, silences and the open space as gaps. */
function Mini({ strip }: { strip: number[] }) {
  if (!strip.length) return null;
  return (
    <span className="mini" aria-hidden="true">
      {strip.map((n, i) => {
        const open = !Number.isInteger(n);
        const size = Math.abs(open ? n - 0.5 : n);
        return (
          <span
            key={i}
            className={open ? 'open' : n < 0 ? 'rest' : ''}
            style={{
              flexGrow: size,
              ...(n > 0 && !open ? { background: sizeColor(n), color: inkFor(sizeColor(n)) } : {}),
            }}
          />
        );
      })}
    </span>
  );
}

export function LibraryMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const currentId = useUiStore((s) => s.currentId);
  const currentName = useUiStore((s) => s.currentName);
  const [name, setName] = useState(currentName);
  useEffect(() => setName(currentName), [currentName]);

  const refresh = async () => setEntries(await listPieces());
  const open = async () => {
    await saveNow();
    await refresh();
    setConfirm(null);
    setQuery('');
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();
  const after = async (fn: () => Promise<void> | void, closeAfter = true) => {
    try {
      await fn();
    } catch {
      toast('That did not work. Nothing was changed.');
    }
    await refresh();
    if (closeAfter) close();
  };
  const rename = () => {
    if (!name.trim() || name.trim() === currentName) return setName(currentName);
    renamePiece(name);
    void saveNow().then(refresh);
    toast('Renamed');
  };
  const share = async () => {
    const url = await shareLink();
    try {
      if (navigator.share) await navigator.share({ title: currentName, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Share link copied. Open it on another device.');
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      window.prompt('Copy this link', url);
    }
  };
  const copyText = async () => {
    const text = phraseText();
    try {
      await navigator.clipboard.writeText(text);
      toast(`Copied ${text.length > 40 ? 'the phrase as text' : text}`);
    } catch {
      window.prompt('Copy the phrase', text);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = q ? entries.filter((e) => e.name.toLowerCase().includes(q)) : entries;

  return (
    <>
      <button
        type="button"
        className="icon ghost lib-btn"
        aria-haspopup="dialog"
        title="Library: your compositions, new, save and share"
        onClick={() => void open()}
      >
        <MenuIcon />
        <span className="lib-name">Library</span>
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
              rename();
            }}
          >
            <label htmlFor="lib-name">Name of this composition</label>
            <div className="row">
              <input
                id="lib-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                enterKeyHint="done"
              />
              <button type="submit">Rename</button>
            </div>
          </form>

          <section className="lib-sec" aria-labelledby="lib-new">
            <h3 id="lib-new">New</h3>
            <div className="lib-actions">
              <button
                type="button"
                className="primary"
                title="An empty piece: 4 beats × 2 bars"
                onClick={() => void after(() => createPiece())}
              >
                Blank
              </button>
              <button
                type="button"
                title="The same beats, bars and subdivisions as this piece, with nothing written"
                onClick={() =>
                  void after(() => createPiece(sameGridDoc(useDocStore.getState().doc), 'Untitled'))
                }
              >
                Same grid
              </button>
              <button
                type="button"
                title="A copy of this piece to take somewhere else"
                onClick={() => void after(duplicatePiece)}
              >
                Duplicate
              </button>
              <button
                type="button"
                title="A meter and a phrase with a shape that already lands on 1, to answer or bend"
                onClick={() =>
                  void after(() => {
                    const s = surpriseDoc();
                    return createPiece(s.doc, s.name);
                  })
                }
              >
                🎲 Surprise me
              </button>
            </div>
          </section>

          <section className="lib-sec" aria-labelledby="lib-save">
            <h3 id="lib-save">Save and share</h3>
            <div className="lib-actions">
              <button
                type="button"
                className="primary"
                title="A clean printed sheet"
                onClick={() => void after(exportPdf)}
              >
                PDF score
              </button>
              <button
                type="button"
                title="The sheet as a picture (PNG), to send or post"
                onClick={() => void after(exportImage, false)}
              >
                Picture
              </button>
              <button
                type="button"
                title="For Dorico, Sibelius, MuseScore: the rhythm as notes, ready to be given pitches"
                onClick={() => void after(exportMusicXml, false)}
              >
                MusicXML
              </button>
              <button
                type="button"
                title="As it is heard, repeats played out, for any DAW or player"
                onClick={() => void after(exportMidi, false)}
              >
                MIDI
              </button>
              <button
                type="button"
                title="The composition itself: open it here again, or read it in other programs"
                onClick={() => void after(exportFile, false)}
              >
                JSON
              </button>
              <button type="button" onClick={() => void after(share)}>
                Share link
              </button>
              <button
                type="button"
                title="The phrase as plain text, like 3 3 2 (1) 4"
                onClick={() => void after(copyText, false)}
              >
                Copy as text
              </button>
            </div>
            <p className="lib-note">
              PDF and Picture are sheets to play from. MusicXML opens as notation (Dorico, Sibelius,
              MuseScore), MIDI in any DAW. JSON is the composition itself.
            </p>
          </section>

          <section className="lib-sec" aria-labelledby="lib-all">
            <div className="lib-list-head">
              <h3 id="lib-all">
                Compositions <span className="dim">{entries.length}</span>
              </h3>
              {entries.length > 6 && (
                <input
                  type="search"
                  className="lib-search"
                  placeholder="Search"
                  aria-label="Search compositions"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              )}
            </div>
            <ul className="lib-list" aria-label="Saved compositions">
              {shown.map((e) => (
                <li key={e.id} className={e.id === currentId ? 'current' : ''}>
                  <button
                    type="button"
                    className="lib-open"
                    aria-current={e.id === currentId}
                    onClick={() => void after(() => openPiece(e.id))}
                  >
                    <span className="lib-line">
                      <span className="t">{e.name}</span>
                      <span className="d">
                        {e.meta ? `${e.meta} · ` : ''}
                        {e.id === currentId ? 'open now' : when(e.updated)}
                      </span>
                    </span>
                    <Mini strip={e.strip ?? []} />
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
            {q && !shown.length && <p className="lib-note">Nothing called “{query.trim()}”.</p>}
          </section>

          <div className="lib-actions lib-foot">
            <button
              type="button"
              title="Open a composition file, or bring a backup in"
              onClick={() => fileInput.current?.click()}
            >
              Open a file
            </button>
            <button
              type="button"
              title="Every composition in one file, to keep safe or move to another device"
              onClick={() => void after(exportBackup, false)}
            >
              Back up everything
            </button>
            <button type="button" className="ghost" onClick={() => void after(clearAll)}>
              Clear this composition
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
        </div>
      </dialog>
    </>
  );
}
