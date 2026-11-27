import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import type { LibraryEntry } from '../persistence/library';
import { loadShelf, writeShelf } from '../persistence/library';
import {
  SORTS,
  createdOf,
  filterEntries,
  filterGroups,
  filterWords,
  sortEntries,
  sortNote,
} from '../persistence/facts';
import type { FilterKey, SortKey } from '../persistence/facts';
import {
  canMoveFolder,
  childrenOf,
  cleanName,
  countIn,
  deleteChanges,
  emptyShelf,
  folderOf,
  freeName,
  isLive,
  parentOf,
  pathOf,
  treeOf,
  within,
} from '../persistence/shelf';
import type { Folder, Place, Shelf } from '../persistence/shelf';
import { SYNCED } from '../persistence/sync';
import { inkFor, sizeColor } from '../score/colors';
import { useMedia } from './useMedia';
import { ChevronIcon, FilterIcon, FolderIcon, FolderPlusIcon, MoreIcon, SortIcon } from './Icons';

/**
 * The library's list: folders (and folders in folders), the pieces in the one that is open,
 * sorting, filtering by what the pieces are made of, and moving pieces and folders about.
 * Calm by design: one line of tools, filters folded away (only values the pieces have), each
 * row's own actions behind its ⋯.
 */

/* ------------------------------------------------------------------ how the list is viewed */

const VIEW = 'time-sculpture/library-view';
interface View {
  folder: string | null;
  sort: SortKey;
  reverse: boolean;
}
const DEFAULT_VIEW: View = { folder: null, sort: 'edited', reverse: false };

function readView(): View {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW) ?? 'null') as Partial<View> | null;
    return {
      folder: typeof v?.folder === 'string' ? v.folder : null,
      sort: SORTS.some((s) => s.key === v?.sort) ? v!.sort! : 'edited',
      reverse: v?.reverse === true,
    };
  } catch {
    return DEFAULT_VIEW;
  }
}
function saveView(v: View) {
  try {
    localStorage.setItem(VIEW, JSON.stringify(v));
  } catch {
    // private mode: the view is simply not remembered
  }
}

/** A piece made from the library goes into the folder the library shows. */
export async function placeInOpenFolder(pieceId: string | null): Promise<void> {
  const folder = readView().folder;
  if (!pieceId || !folder) return;
  const shelf = await loadShelf();
  if (isLive(shelf, folder))
    await writeShelf({ places: { [pieceId]: { folder, updated: Date.now() } } });
}

/* ------------------------------------------------------------------ small parts */

const when = (t: number) =>
  new Date(t).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const day = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A piece at a glance: its groups as coloured bars, silences and the open space as gaps. */
export function Mini({ strip }: { strip: number[] }) {
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

/** The folders a thing is in, as words: "Etudes / Tihais". */
const pathWords = (s: Shelf, id: string | null) =>
  pathOf(s, id)
    .map((f) => s.folders[f]!.name)
    .join(' / ');

/* ------------------------------------------------------------------ moving */

interface Moving {
  pieces: string[];
  folder?: string;
  label: string;
}

function MoveDialog({
  shelf,
  moving,
  onMove,
  onClose,
}: {
  shelf: Shelf;
  moving: Moving;
  onMove: (to: string | null, newName?: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  // where it is now (when everything moved is in one place)
  const froms = new Set(
    moving.folder
      ? [shelf.folders[moving.folder]?.parent ?? null]
      : moving.pieces.map((p) => folderOf(shelf, p)),
  );
  const here = froms.size === 1 ? [...froms][0]! : undefined;
  const allowed = (to: string | null) => !moving.folder || canMoveFolder(shelf, moving.folder, to);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = cleanName(name);
    if (n) onMove(here === undefined ? null : here, n);
  };
  return (
    <dialog
      ref={ref}
      className="lib-move"
      aria-labelledby="lib-move-h"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <div className="lib-move-inner">
        <h3 id="lib-move-h" dir="auto">
          Move {moving.label} to
        </h3>
        <ul className="lib-tree" aria-label="Folders">
          <li>
            <button
              type="button"
              disabled={here === null}
              onClick={() => onMove(null)}
              className="lib-tree-top"
            >
              The top of the library
              {here === null && <span className="here">here now</span>}
            </button>
          </li>
          {treeOf(shelf).map(({ id, depth }) => {
            const self = id === moving.folder;
            const ok = !self && allowed(id) && here !== id;
            return (
              <li key={id} style={{ ['--depth' as string]: depth }}>
                <button type="button" disabled={!ok} onClick={() => onMove(id)}>
                  <FolderIcon />
                  <span className="t" dir="auto">
                    {shelf.folders[id]!.name}
                  </span>
                  {here === id && <span className="here">here now</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <form className="lib-move-new" onSubmit={submit}>
          <input
            dir="auto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Or a new folder"
            aria-label="Name of a new folder"
            maxLength={60}
            enterKeyHint="done"
          />
          <button type="submit" disabled={!cleanName(name)}>
            Move there
          </button>
        </form>
        <div className="lib-move-foot">
          <button type="button" className="ghost" onClick={() => ref.current?.close()}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* ------------------------------------------------------------------ the list */

interface Note {
  text: string;
  undo?: () => void;
}

export function LibraryList({
  entries,
  currentId,
  opened,
  onOpen,
  onDelete,
}: {
  entries: LibraryEntry[];
  currentId: string | null;
  /** Bumped every time the library opens: searches and filters start afresh. */
  opened: number;
  onOpen: (id: string) => void;
  onDelete: (ids: string[]) => Promise<void>;
}) {
  const fine = useMedia('(pointer: fine)');
  const [shelf, setShelf] = useState<Shelf>(emptyShelf);
  const [view, setViewState] = useState<View>(readView);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterKey[]>([]);
  const [filtering, setFiltering] = useState(false);
  const [everywhere, setEverywhere] = useState(false);
  const [row, setRow] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [moving, setMoving] = useState<Moving | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const dragging = useRef<{ pieces: string[]; folder?: string } | null>(null);

  const setView = (v: Partial<View>) =>
    setViewState((old) => {
      const next = { ...old, ...v };
      saveView(next);
      return next;
    });

  const reload = async () => setShelf(await loadShelf());
  useEffect(() => {
    void reload();
    const on = () => void reload();
    window.addEventListener(SYNCED, on);
    return () => window.removeEventListener(SYNCED, on);
  }, []);
  useEffect(() => {
    void reload();
    setQuery('');
    setFilters([]);
    setFiltering(false);
    setEverywhere(false);
    setRow(null);
    setConfirm(null);
    setRenaming(null);
    setSelecting(false);
    setPicked([]);
    setNote(null);
  }, [opened]);

  // the folder shown is gone (deleted here or on another device): back to the top
  const folder = isLive(shelf, view.folder) ? view.folder : null;
  const go = (f: string | null) => {
    setView({ folder: f });
    setRow(null);
    setConfirm(null);
    setRenaming(null);
    setEverywhere(false);
  };

  const ids = useMemo(() => entries.map((e) => e.id), [entries]);
  const q = query.trim().toLowerCase();
  const narrowing = !!q || filters.length > 0;
  const scope = everywhere ? null : folder;
  // searching and filtering look into the folder shown and every folder inside it
  const inScope = useMemo(
    () =>
      entries.filter((e) =>
        narrowing ? within(shelf, e.id, scope) : folderOf(shelf, e.id) === folder,
      ),
    [entries, shelf, narrowing, scope, folder],
  );
  const groups = useMemo(() => filterGroups(inScope, filters), [inScope, filters]);
  const shown = useMemo(() => {
    const searched = q
      ? inScope.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            pathWords(shelf, folderOf(shelf, e.id)).toLowerCase().includes(q),
        )
      : inScope;
    return sortEntries(filterEntries(searched, filters), view.sort, view.reverse);
  }, [inScope, q, filters, view.sort, view.reverse, shelf]);
  const folders = useMemo(() => {
    if (!narrowing) return childrenOf(shelf, folder);
    if (!q || filters.length) return [];
    const inside =
      scope === null
        ? treeOf(shelf).map((t) => t.id)
        : [
            ...pathOf(shelf, scope).slice(-1),
            ...treeOf(shelf)
              .map((t) => t.id)
              .filter((f) => pathOf(shelf, f).includes(scope) && f !== scope),
          ];
    return inside.filter((f) => shelf.folders[f]!.name.toLowerCase().includes(q));
  }, [shelf, folder, narrowing, q, filters.length, scope]);

  const path = pathOf(shelf, folder);
  const nothingHere = !folders.length && !shown.length;

  /* ---- changes */

  const say = (text: string, undo?: () => void) => setNote({ text, undo });

  /** Move pieces or a folder; offers Undo, which puts back the records as they were. */
  const moveTo = async (
    what: { pieces: string[]; folder?: string },
    to: string | null,
    newName?: string,
  ) => {
    const now = Date.now();
    let dest = to;
    const made: Record<string, Folder> = {};
    if (newName) {
      dest = `f${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      made[dest] = { name: newName, parent: to, updated: now };
    }
    const beforePlaces: Record<string, Place> = {};
    const places: Record<string, Place> = {};
    for (const p of what.pieces) {
      beforePlaces[p] = { folder: folderOf(shelf, p), updated: now + 1 };
      places[p] = { folder: dest, updated: now };
    }
    const beforeFolders: Record<string, Folder> = {};
    const fs: Record<string, Folder> = { ...made };
    if (what.folder) {
      const f = shelf.folders[what.folder]!;
      if (!canMoveFolder({ ...shelf, folders: { ...shelf.folders, ...made } }, what.folder, dest))
        return say('A folder cannot go into itself.');
      beforeFolders[what.folder] = { ...f, updated: now + 1 };
      fs[what.folder] = { ...f, parent: dest, updated: now };
    }
    setShelf(await writeShelf({ folders: fs, places }));
    const name = dest ? (made[dest] ?? shelf.folders[dest])!.name : 'the top';
    const label = what.folder
      ? `“${shelf.folders[what.folder]!.name}”`
      : what.pieces.length === 1
        ? `“${entries.find((e) => e.id === what.pieces[0])?.name ?? ''}”`
        : plural(what.pieces.length, 'composition');
    say(
      `Moved ${label} to ${name === 'the top' ? name : `“${name}”`}`,
      () =>
        void writeShelf({ folders: beforeFolders, places: beforePlaces }).then((s) => {
          setShelf(s);
          setNote(null);
        }),
    );
    setRow(null);
  };

  const newFolder = async () => {
    const id = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const name = freeName(shelf, folder);
    setShelf(
      await writeShelf({ folders: { [id]: { name, parent: folder, updated: Date.now() } } }),
    );
    setRow(`f:${id}`);
    setRenaming({ id, name });
    setNote(null);
  };

  const rename = async (id: string, name: string) => {
    const n = cleanName(name);
    const f = shelf.folders[id];
    setRenaming(null);
    if (!f || !n || n === f.name) return;
    setShelf(await writeShelf({ folders: { [id]: { ...f, name: n, updated: Date.now() } } }));
  };

  const removeFolder = async (id: string) => {
    const f = shelf.folders[id]!;
    const up =
      f.parent && isLive(shelf, f.parent) ? `“${shelf.folders[f.parent]!.name}”` : 'the top';
    const had = countIn(shelf, id, ids) + childrenOf(shelf, id).length;
    setShelf(await writeShelf(deleteChanges(shelf, id, ids, Date.now())));
    setRow(null);
    setConfirm(null);
    say(had ? `Folder deleted. What was in it is now in ${up}.` : 'Folder deleted.');
  };

  const removePieces = async (ps: string[]) => {
    setRow(null);
    setConfirm(null);
    await onDelete(ps);
    setPicked([]);
    if (ps.length > 1) say(`${plural(ps.length, 'composition')} deleted.`);
  };

  /* ---- dragging (a mouse or a trackpad: pieces and folders onto folders) */

  const dragStart = (e: DragEvent, what: { pieces: string[]; folder?: string }) => {
    dragging.current = what;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', what.folder ?? what.pieces.join(' '));
  };
  const dropProps = (to: string | null) => {
    const key = to ?? 'top';
    const ok = () => {
      const d = dragging.current;
      if (!d) return false;
      if (d.folder) return d.folder !== to && canMoveFolder(shelf, d.folder, to);
      return d.pieces.some((p) => folderOf(shelf, p) !== to);
    };
    return {
      onDragOver: (e: DragEvent) => {
        if (!ok()) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dropOn !== key) setDropOn(key);
      },
      onDragLeave: () => setDropOn((d) => (d === key ? null : d)),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const d = dragging.current;
        setDropOn(null);
        dragging.current = null;
        if (d && ok()) void moveTo(d, to);
      },
      'data-drop': dropOn === key ? '' : undefined,
    };
  };
  const dragEnd = () => {
    dragging.current = null;
    setDropOn(null);
  };

  /* ---- selecting several */

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const stopSelecting = () => {
    setSelecting(false);
    setPicked([]);
    setConfirm(null);
  };

  const sortLabel = SORTS.find((s) => s.key === view.sort)!.label;
  const showSearch = entries.length > 6 || treeOf(shelf).length > 0;

  return (
    <section className="lib-sec lib-browse" aria-labelledby="lib-all">
      <div className="lib-list-head">
        <h3 id="lib-all">
          Compositions <span className="dim">{entries.length}</span>
        </h3>
        <div className="lib-head-tools">
          <button
            type="button"
            className="ghost lib-tool"
            title="A new folder here"
            onClick={() => void newFolder()}
          >
            <FolderPlusIcon />
            <span className="tool-lbl">New folder</span>
          </button>
          <button
            type="button"
            className="ghost lib-tool"
            aria-pressed={selecting}
            title="Pick several compositions to move or delete together"
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
          >
            {selecting ? 'Done' : 'Select'}
          </button>
        </div>
      </div>

      {showSearch && (
        <input
          type="search"
          dir="auto"
          className="lib-search"
          placeholder={folder ? `Search in ${shelf.folders[folder]!.name}` : 'Search'}
          aria-label="Search compositions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      <div className="lib-view">
        <label className="lib-sort" title="Sort by">
          <SortIcon />
          <span className="sr-only">Sort by</span>
          <select value={view.sort} onChange={(e) => setView({ sort: e.target.value as SortKey })}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </label>
        <button
          type="button"
          className="ghost lib-tool lib-reverse"
          aria-pressed={view.reverse}
          title={`${sortLabel}, the other way round`}
          onClick={() => setView({ reverse: !view.reverse })}
        >
          <span aria-hidden="true">{view.reverse ? '↑' : '↓'}</span>
          <span className="sr-only">The other way round</span>
        </button>
        <span className="lib-gap" />
        <button
          type="button"
          className="ghost lib-tool lib-filter-btn"
          aria-expanded={filtering}
          aria-controls="lib-filters"
          data-on={filters.length > 0 || undefined}
          onClick={() => setFiltering(!filtering)}
        >
          <FilterIcon />
          <span className="tool-lbl">Filter</span>
          {filters.length > 0 && <span className="lib-count">{filters.length}</span>}
        </button>
      </div>

      <div id="lib-filters" className="lib-filters" hidden={!filtering}>
        {groups.length ? (
          groups.map((g) => (
            <div key={g.id} className="lib-fgroup" role="group" aria-label={g.label}>
              <span className="lib-flabel">{g.label}</span>
              <div className="lib-chips">
                {g.chips.map((c) => {
                  const on = filters.includes(c.key);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      className="lib-chip"
                      aria-pressed={on}
                      onClick={() =>
                        setFilters(on ? filters.filter((k) => k !== c.key) : [...filters, c.key])
                      }
                    >
                      {c.label}
                      <span className="n">{c.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <p className="lib-note">
            The compositions here are all alike so far: nothing to tell them apart by.
          </p>
        )}
      </div>

      {path.length > 0 && (
        <nav className="lib-path" aria-label="Folders">
          <button type="button" className="ghost" onClick={() => go(null)} {...dropProps(null)}>
            All
          </button>
          {path.map((f, i) => (
            <span key={f} className="lib-crumb">
              <span className="sep" aria-hidden="true">
                /
              </span>
              {i === path.length - 1 ? (
                <span className="here" aria-current="location" dir="auto">
                  {shelf.folders[f]!.name}
                </span>
              ) : (
                <button
                  type="button"
                  className="ghost"
                  dir="auto"
                  onClick={() => go(f)}
                  {...dropProps(f)}
                >
                  {shelf.folders[f]!.name}
                </button>
              )}
            </span>
          ))}
        </nav>
      )}

      {narrowing && (
        <p className="lib-scope" aria-live="polite">
          <span>
            {shown.length} of {inScope.length}
            {scope ? ` in “${shelf.folders[scope]!.name}”` : ''}
            {filters.length > 0 && ` · ${filterWords(filters, groups)}`}
          </span>
          {folder && !everywhere && (
            <button type="button" className="link-btn" onClick={() => setEverywhere(true)}>
              Everywhere
            </button>
          )}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setQuery('');
              setFilters([]);
            }}
          >
            Clear
          </button>
        </p>
      )}

      {note && (
        <p className="lib-done" role="status">
          <span dir="auto">{note.text}</span>
          {note.undo && (
            <button type="button" className="link-btn" onClick={note.undo}>
              Undo
            </button>
          )}
        </p>
      )}

      <ul className="lib-list" aria-label="Saved compositions">
        {folders.map((id) => {
          const f = shelf.folders[id]!;
          const open = row === `f:${id}`;
          const n = countIn(shelf, id, ids);
          const subs = childrenOf(shelf, id).length;
          return (
            <li
              key={id}
              className={`lib-folder${open ? ' open' : ''}`}
              draggable={fine && !selecting && renaming?.id !== id}
              onDragStart={(e) => dragStart(e, { pieces: [], folder: id })}
              onDragEnd={dragEnd}
              {...dropProps(id)}
            >
              <button
                type="button"
                className="lib-open lib-dir"
                onClick={() => {
                  setQuery('');
                  setFilters([]);
                  go(id);
                }}
              >
                <FolderIcon />
                <span className="t" dir="auto">
                  {f.name}
                </span>
                {narrowing && parentOf(shelf, id) !== scope && (
                  <span className="lib-where" dir="auto">
                    {pathWords(shelf, parentOf(shelf, id))}
                  </span>
                )}
                <span className="n">
                  {n || subs ? n : 'empty'}
                  <span className="sr-only">{n === 1 ? ' composition' : ' compositions'}</span>
                </span>
              </button>
              {!selecting && (
                <button
                  type="button"
                  className="ghost icon lib-more"
                  aria-expanded={open}
                  aria-label={`More for the folder ${f.name}`}
                  onClick={() => {
                    setRow(open ? null : `f:${id}`);
                    setConfirm(null);
                    setRenaming(null);
                  }}
                >
                  <MoreIcon />
                </button>
              )}
              {open && (
                <div className="lib-acts">
                  {renaming?.id === id ? (
                    <form
                      className="lib-rename-folder"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void rename(id, renaming.name);
                      }}
                    >
                      <input
                        dir="auto"
                        autoFocus
                        aria-label="Name of the folder"
                        value={renaming.name}
                        maxLength={60}
                        enterKeyHint="done"
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setRenaming({ id, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            e.stopPropagation();
                            setRenaming(null);
                          }
                        }}
                      />
                      <button type="submit" className="primary">
                        Save
                      </button>
                    </form>
                  ) : confirm === `f:${id}` ? (
                    <>
                      <span className="lib-acts-note">
                        {n || subs
                          ? `What is in it moves to ${f.parent && isLive(shelf, f.parent) ? `“${shelf.folders[f.parent]!.name}”` : 'the top'}.`
                          : 'It is empty.'}
                      </span>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => void removeFolder(id)}
                      >
                        Delete the folder
                      </button>
                      <button type="button" className="ghost" onClick={() => setConfirm(null)}>
                        Keep it
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setRenaming({ id, name: f.name })}>
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => setMoving({ pieces: [], folder: id, label: `“${f.name}”` })}
                      >
                        Move to…
                      </button>
                      <button type="button" className="ghost" onClick={() => setConfirm(`f:${id}`)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}

        {shown.map((e) => {
          const open = row === `p:${e.id}`;
          const on = picked.includes(e.id);
          const where = folderOf(shelf, e.id);
          const note = sortNote(e, view.sort);
          const date =
            e.id === currentId
              ? 'open now'
              : view.sort === 'created'
                ? `made ${day(createdOf(e.id, e.updated))}`
                : when(e.updated);
          return (
            <li
              key={e.id}
              className={`${e.id === currentId ? 'current' : ''}${open ? ' open' : ''}${on ? ' picked' : ''}`}
              draggable={fine && (!selecting || on)}
              onDragStart={(ev) => dragStart(ev, { pieces: selecting && on ? picked : [e.id] })}
              onDragEnd={dragEnd}
            >
              {selecting && (
                <label className="lib-check">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(e.id)}
                    aria-label={`Select ${e.name}`}
                  />
                </label>
              )}
              <button
                type="button"
                className="lib-open"
                aria-current={e.id === currentId}
                aria-pressed={selecting ? on : undefined}
                onClick={() => (selecting ? toggle(e.id) : onOpen(e.id))}
              >
                <span className="lib-line">
                  <span className="t" dir="auto">
                    {e.name}
                  </span>
                  <span className="d">
                    {note ? `${note} · ` : e.meta ? `${e.meta} · ` : ''}
                    {date}
                  </span>
                </span>
                {narrowing && where !== scope && where && (
                  <span className="lib-where" dir="auto">
                    <FolderIcon />
                    {pathWords(shelf, where)}
                  </span>
                )}
                <Mini strip={e.strip ?? []} />
              </button>
              {!selecting && (
                <button
                  type="button"
                  className="ghost icon lib-more"
                  aria-expanded={open}
                  aria-label={`More for ${e.name}`}
                  onClick={() => {
                    setRow(open ? null : `p:${e.id}`);
                    setConfirm(null);
                  }}
                >
                  <MoreIcon />
                </button>
              )}
              {open && (
                <div className="lib-acts">
                  <button
                    type="button"
                    onClick={() => setMoving({ pieces: [e.id], label: `“${e.name}”` })}
                  >
                    <FolderIcon /> Move to…
                  </button>
                  {confirm === e.id ? (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void removePieces([e.id])}
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
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {nothingHere && (
        <p className="lib-empty">
          {narrowing
            ? q
              ? `Nothing called “${query.trim()}”${filters.length ? ' with those filters' : ''}.`
              : 'No composition here has all of that.'
            : folder
              ? 'This folder is empty. Move compositions here with ⋯ → Move to, or start a new one above: it is made here.'
              : 'Nothing saved yet.'}
        </p>
      )}

      {selecting && (
        <div className="lib-selbar" role="toolbar" aria-label="Selected compositions">
          <span className="lib-selcount">
            {picked.length ? `${picked.length} selected` : 'Tap compositions to select them'}
          </span>
          {shown.length > 0 && picked.length < shown.length && (
            <button
              type="button"
              className="ghost"
              onClick={() => setPicked(shown.map((e) => e.id))}
            >
              All
            </button>
          )}
          <button
            type="button"
            disabled={!picked.length}
            onClick={() =>
              setMoving({ pieces: picked, label: plural(picked.length, 'composition') })
            }
          >
            Move to…
          </button>
          {confirm === 'picked' ? (
            <button type="button" className="danger" onClick={() => void removePieces(picked)}>
              Delete {picked.length}?
            </button>
          ) : (
            <button
              type="button"
              className="ghost"
              disabled={!picked.length}
              onClick={() => setConfirm('picked')}
            >
              Delete
            </button>
          )}
        </div>
      )}

      {moving && (
        <MoveDialog
          shelf={shelf}
          moving={moving}
          onClose={() => setMoving(null)}
          onMove={(to, newName) => {
            const m = moving;
            setMoving(null);
            void moveTo(m, to, newName).then(() => {
              if (selecting) stopSelecting();
            });
          }}
        />
      )}
    </section>
  );
}
