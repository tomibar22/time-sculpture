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
import { SyncSection } from './SyncSection';
import { SYNCED } from '../persistence/sync';
import { MenuIcon, ChevronIcon, DiceIcon, ShareIcon } from './Icons';
import { LibraryList, placeInOpenFolder } from './LibraryList';

export function LibraryMenu() {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [opened, setOpened] = useState(0);
  const [sharing, setSharing] = useState(false);
  const currentId = useUiStore((s) => s.currentId);
  const currentName = useUiStore((s) => s.currentName);
  const [name, setName] = useState(currentName);
  useEffect(() => setName(currentName), [currentName]);

  const refresh = async () => setEntries(await listPieces());
  // pieces that came in from another device show up while the library is open
  useEffect(() => {
    const on = () => void listPieces().then(setEntries);
    window.addEventListener(SYNCED, on);
    return () => window.removeEventListener(SYNCED, on);
  }, []);
  const open = async () => {
    await saveNow();
    await refresh();
    setOpened((n) => n + 1);
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

  /** A new piece made here goes into the folder the list shows. */
  const make = (fn: () => Promise<void>) =>
    after(async () => {
      await fn();
      await placeInOpenFolder(useUiStore.getState().currentId);
    });

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
          <section className="lib-sec" aria-labelledby="lib-new">
            <h3 id="lib-new">New</h3>
            <div className="lib-actions lib-row">
              <button
                type="button"
                className="primary"
                title="An empty piece: 4 beats × 2 bars"
                onClick={() => void make(() => createPiece())}
              >
                Blank
              </button>
              <button
                type="button"
                title="The same beats, bars and subdivisions as this piece, with nothing written"
                onClick={() =>
                  void make(() => createPiece(sameGridDoc(useDocStore.getState().doc), 'Untitled'))
                }
              >
                Same grid
              </button>
              <button
                type="button"
                title="A copy of this piece to take somewhere else"
                onClick={() => void make(duplicatePiece)}
              >
                Duplicate
              </button>
              <button
                type="button"
                title="A meter and a phrase with a shape that already lands on 1, to answer or bend"
                onClick={() =>
                  void make(() => {
                    const s = surpriseDoc();
                    return createPiece(s.doc, s.name);
                  })
                }
              >
                <DiceIcon /> Surprise me
              </button>
            </div>
          </section>

          {/* folded away: the list of compositions is what the library is opened for */}
          <section className="lib-sec lib-share">
            <button
              type="button"
              className="lib-fold"
              aria-expanded={sharing}
              aria-controls="lib-save"
              onClick={() => setSharing(!sharing)}
            >
              <ShareIcon />
              Save and share
              <span className="dim"> · PDF, picture, MusicXML, MIDI, link</span>
              <ChevronIcon />
            </button>
            <div id="lib-save" className="lib-actions" hidden={!sharing}>
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
            <p className="lib-note" hidden={!sharing}>
              PDF and Picture are sheets to play from. MusicXML opens as notation (Dorico, Sibelius,
              MuseScore), MIDI in any DAW. JSON is the composition itself.
            </p>
          </section>

          <SyncSection />

          <LibraryList
            entries={entries}
            currentId={currentId}
            opened={opened}
            onOpen={(id) => void after(() => openPiece(id))}
            onDelete={async (ids) => {
              for (const id of ids) await after(() => removePiece(id), false);
            }}
          />

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
                dir="auto"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                enterKeyHint="done"
              />
              <button type="submit">Rename</button>
            </div>
          </form>

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
