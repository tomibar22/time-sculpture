import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as E from '../engine';
import { startPlayback, stopPlayback } from '../audio/player';
import {
  addBars,
  barsLabel,
  cutBars,
  duplicateRange,
  duplicateSelection,
  mergeSelection,
  openModulation,
  openVolta,
  pulsesOfBars,
  removeSelection,
  selectAll,
  selectBars,
  splitSelection,
  toggleLineBreak,
  toggleMulti,
  togglePhraseMark,
  toggleRepeatEndAt,
  toggleDoubleBarAt,
  toggleRepeatStartAt,
  toggleTotalOver,
  toggleMuteOver,
  mutedOver,
  toggleRepeatOver,
  repeatedOver,
  wholeBars,
} from '../state/actions';
import {
  copyButton,
  deleteAtCaret,
  describePulse,
  openSubdivision,
  paste,
  playFromCaret,
  reverseSelection,
  selectedRegion,
  setCaret,
  setRange,
} from '../state/editing';
import { openFill } from '../state/fill';
import { chordTarget, openChord } from '../state/chords';
import { swapStep } from '../state/swap';
import { useDocStore, useUiStore } from '../state/store';
import type { ContextMenuState } from '../state/store';
import { view } from '../score/view';
import {
  ChevronIcon,
  CopyIcon,
  DuplicateIcon,
  EraseIcon,
  PasteIcon,
  ScissorsIcon,
  TrashIcon,
} from './Icons';

/**
 * The context menu of the score: right-click, a long press (touch), or ⇧F10 / the Menu key.
 *
 * It is short and about what was pointed at (see score/menu.ts): the clipboard as a row of icons
 * on top (as in Finder, Figma, iOS), then what is done most with that thing, then its marks.
 * Everything about the bar under the pointer is one step in ("Bar 3 ›"), and pointing at the
 * beat numbers opens that page directly. Removing a bar tints it red in the score first.
 */

interface Quick {
  label: string;
  icon: ReactNode;
  run: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface Row {
  label: string;
  hint?: string;
  run?: () => void;
  disabled?: boolean;
  /** Removes these bars (0-based): tinted in the score while pointed at; asked twice by touch. */
  doom?: { a: number; b: number };
  /** Opens the page about the bar instead of closing the menu. */
  page?: 'bar';
}

type Entry = Row | 'sep';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ContextMenu() {
  const menu = useUiStore((s) => s.menu);
  if (!menu) return null;
  // a new menu (another place) starts afresh
  return <Menu key={`${menu.x},${menu.y},${menu.kind}`} menu={menu} />;
}

function Menu({ menu }: { menu: ContextMenuState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<'main' | 'bar'>(menu.kind === 'bar' ? 'bar' : 'main');
  const [asked, setAsked] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  /** A tap counts once a press began inside the menu (not the lift of the finger that opened it). */
  const pressed = useRef(false);
  const set = useUiStore.getState().set;
  const close = (refocus = true) => {
    set({ menu: null, doomed: null });
    if (refocus && !menu.touch) view.canvas?.focus({ preventScroll: true });
  };

  // inside the screen, beside the pointer; above a finger when there is room (not under it)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = menu.touch ? menu.x - w / 2 : menu.x + 2;
    let top = menu.touch ? menu.y - h - 18 : menu.y + 2;
    if (menu.touch && top < 8) top = menu.y + 26;
    if (!menu.touch && left + w > vw - 8) left = menu.x - w - 2;
    if (!menu.touch && top + h > vh - 8) top = menu.y - h - 2;
    setPos({
      left: Math.max(8, Math.min(left, vw - w - 8)),
      top: Math.max(8, Math.min(top, vh - h - 8)),
    });
  }, [menu, page]);

  useEffect(() => {
    if (!menu.touch)
      ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [menu.touch, page]);

  // anything that moves the score under the menu puts it away
  useEffect(() => {
    const away = () => useUiStore.getState().set({ menu: null, doomed: null });
    window.addEventListener('resize', away);
    window.addEventListener('blur', away);
    return () => {
      window.removeEventListener('resize', away);
      window.removeEventListener('blur', away);
      useUiStore.getState().set({ doomed: null });
    };
  }, []);

  const doc = useDocStore.getState().doc;
  const ui = useUiStore.getState();
  const grid = E.buildGrid(doc.meter);
  const map = E.barMap(doc.meter);
  const nBars = map.barStarts.length;
  const clip = ui.clipboard;
  const pasteHint = clip.length ? E.formatGroups(clip) : '';

  // the bars this menu speaks about: the selected whole bars when the pointer is in them
  const whole = wholeBars();
  const bars =
    whole && menu.bar >= whole.a && menu.bar <= whole.b ? whole : { a: menu.bar, b: menu.bar };
  const many = bars.b > bars.a;
  const barName = cap(barsLabel(bars.a, bars.b));
  const barStart = map.barStarts[bars.a] ?? 0;
  const removeBars: Row = {
    label: `Remove ${barsLabel(bars.a, bars.b)}`,
    hint: '⇧⌫',
    disabled: bars.b - bars.a + 1 >= nBars,
    doom: bars,
    run: () => void cutBars(bars.a, bars.b - bars.a + 1),
  };

  let title: string;
  let quick: Quick[] = [];
  let rows: Entry[];

  if (page === 'bar') {
    title = barName;
    rows = [
      {
        label: many ? 'Select these bars' : 'Select the bar',
        run: () => selectBars(bars.a, bars.b),
      },
      {
        label: 'Play from here',
        run: () => {
          stopPlayback();
          startPlayback(barStart);
        },
      },
      'sep',
      {
        label: 'Add a bar before',
        disabled: nBars >= maxBars(doc),
        run: () => void addBars(bars.a, 1),
      },
      {
        label: 'Add a bar after',
        disabled: nBars >= maxBars(doc),
        run: () => void addBars(bars.b + 1, 1),
      },
      {
        label: 'Add or remove several…',
        run: () => {
          if (!selectedRegion() && ui.caret === null)
            setCaret(pulsesOfBars(bars.a).a, { quiet: true });
          set({ barsDialog: true });
        },
      },
      (() => {
        const p = pulsesOfBars(bars.a, bars.b);
        const muted = mutedOver(p);
        return {
          label: muted
            ? `Let ${many ? 'them' : 'it'} sound again`
            : `Mute ${many ? 'these bars' : 'this bar'} (nothing sounds)`,
          run: () => toggleMuteOver(p),
        };
      })(),
      'sep',
      { label: 'Metre from here…', run: () => set({ meterDialog: { at: barStart } }) },
      { label: 'Bars in this row…', run: () => set({ rowDialog: { t: barStart } }) },
      (() => {
        const end = pulsesOfBars(bars.b).b;
        return {
          label: E.doubleBarAt(doc, end)
            ? 'Remove the section end'
            : `Section end after ${many ? 'them' : 'it'} ‖`,
          run: () => toggleDoubleBarAt(end),
        };
      })(),
      'sep',
      removeBars,
    ];
  } else if (menu.kind === 'tiles') {
    const idx = E.selectedIndices(doc.items, ui.selection);
    const sel = idx.map((i) => doc.items[i]!);
    const run = sel.length > 1 && E.isContiguous(idx);
    const total = sel.reduce((a, x) => a + x.n, 0);
    const region = selectedRegion();
    const hasTotal = !!region && E.totalIndex(doc, region.a, region.b) >= 0;
    title = sel.length === 1 ? `Group of ${sel[0]!.n}` : `${sel.length} groups · ${total} pulses`;
    quick = [
      { label: 'Cut', icon: <ScissorsIcon />, run: () => copyButton(true) },
      { label: 'Copy', icon: <CopyIcon />, run: () => copyButton(false) },
      { label: 'Paste', icon: <PasteIcon />, run: () => paste(), disabled: !clip.length },
      { label: 'Duplicate', icon: <DuplicateIcon />, run: duplicateSelection },
      { label: 'Remove', icon: <TrashIcon />, run: removeSelection, danger: true },
    ];
    rows = [
      ...(sel.some((x) => x.kind === 'sound')
        ? [
            {
              label: E.chordOf(doc, chordTarget() ?? '') ? 'Change the chord…' : 'Chord…',
              hint: 'C',
              run: () => openChord(),
            },
          ]
        : []),
      { label: 'Split', hint: 'S', disabled: !sel.some((x) => x.n >= 2), run: splitSelection },
      ...(run
        ? ([
            { label: 'Merge', hint: 'M', run: mergeSelection },
            { label: 'Reverse', hint: '⇧R', run: reverseSelection },
          ] satisfies Row[])
        : []),
      {
        label: ui.swapA ? 'Swap with the marked stretch' : 'Swap with…',
        hint: 'X',
        disabled: !E.isContiguous(idx),
        run: swapStep,
      },
      'sep',
      { label: ui.playing ? 'Stop' : 'Loop', hint: '⇧Space', run: playFromCaret },
      {
        label: 'Vary…',
        hint: '⇧V',
        disabled: !E.isContiguous(idx),
        run: () => openFill('vary'),
      },
      {
        label: 'Fill…',
        disabled: !E.isContiguous(idx),
        run: () => openFill('browse'),
      },
      'sep',
      {
        label: hasTotal ? 'Remove total' : 'Total',
        hint: 'G',
        disabled: !E.isContiguous(idx),
        run: () => toggleTotalOver(selectedRegion()),
      },
      {
        label: mutedOver(region) ? 'Let it sound again' : 'Mute (nothing sounds)',
        hint: 'U',
        disabled: !E.isContiguous(idx),
        run: () => toggleMuteOver(selectedRegion()),
      },
      {
        label: repeatedOver(region) ? 'Remove the repeat' : 'Repeat |: :|',
        hint: 'R',
        disabled: !E.isContiguous(idx),
        run: () => toggleRepeatOver(selectedRegion()),
      },
      {
        label:
          region && E.doubleBarAt(doc, region.b)
            ? 'Remove the section end'
            : 'Section end after it ‖',
        hint: '\\',
        run: () => toggleDoubleBarAt(selectedRegion()?.b ?? null),
      },
      {
        label: 'Ending…',
        hint: 'V',
        disabled: !E.isContiguous(idx),
        run: () => openVolta(selectedRegion()),
      },
      { label: 'Subdivision…', hint: 'B', run: openSubdivision },
      'sep',
      ...(ui.multi
        ? []
        : ([{ label: 'Select several', run: () => toggleMulti() }, 'sep'] satisfies Entry[])),
      { label: barName, page: 'bar' },
    ];
  } else if (menu.kind === 'range' && ui.range) {
    const r = ui.range;
    const hasTotal = E.totalIndex(doc, r.a, r.b) >= 0;
    title = whole ? barName : `${r.b - r.a} pulses · from ${describePulse(r.a)}`;
    quick = [
      { label: 'Cut', icon: <ScissorsIcon />, run: () => copyButton(true) },
      { label: 'Copy', icon: <CopyIcon />, run: () => copyButton(false) },
      { label: 'Paste', icon: <PasteIcon />, run: () => paste(), disabled: !clip.length },
      { label: 'Duplicate', icon: <DuplicateIcon />, run: duplicateRange },
      { label: 'Empty', icon: <EraseIcon />, run: () => void deleteAtCaret(-1), danger: true },
    ];
    rows = [
      { label: ui.playing ? 'Stop' : 'Loop', hint: '⇧Space', run: playFromCaret },
      { label: 'Fill…', run: () => openFill('browse') },
      { label: 'Vary…', hint: '⇧V', run: () => openFill('vary') },
      { label: 'Land a pattern…', run: () => openFill('land') },
      {
        label: ui.swapA ? 'Swap with the marked stretch' : 'Swap with…',
        hint: 'X',
        run: swapStep,
      },
      'sep',
      {
        label: hasTotal ? 'Remove total' : 'Total',
        hint: 'G',
        run: () => toggleTotalOver(r),
      },
      {
        label: mutedOver(r) ? 'Let it sound again' : 'Mute (nothing sounds)',
        hint: 'U',
        run: () => toggleMuteOver(r),
      },
      {
        label: repeatedOver(r) ? 'Remove the repeat' : 'Repeat |: :|',
        hint: 'R',
        run: () => toggleRepeatOver(r),
      },
      {
        label: E.doubleBarAt(doc, r.b) ? 'Remove the section end' : 'Section end after it ‖',
        hint: '\\',
        run: () => toggleDoubleBarAt(r.b),
      },
      { label: 'Ending…', hint: 'V', run: () => openVolta(r) },
      { label: 'Subdivision…', hint: 'B', run: openSubdivision },
      'sep',
      ...(whole ? [removeBars] : []),
      { label: whole ? `More about ${barsLabel(bars.a, bars.b)}` : barName, page: 'bar' },
    ];
  } else {
    const k = E.clamp(ui.caret ?? menu.k, 0, grid.TS);
    const beat = E.beatOfPulse(grid, Math.min(k, grid.TS - 1));
    const onBeat = k > 0 && k < grid.TS && grid.pre[beat] === k;
    const section = (doc.meter.sections ?? []).some((s) => s.at === beat);
    const gap = gapAt(doc, k);
    title = cap(describePulse(k));
    rows = [
      ...(clip.length
        ? ([{ label: `Paste ${pasteHint}`, hint: '⌘V', run: () => paste() }] satisfies Row[])
        : []),
      ...(gap
        ? ([
            {
              label: `Fill these ${gap.b - gap.a} pulses…`,
              run: () => {
                setRange(gap.a, gap.b);
                openFill('browse');
              },
            },
            {
              label: 'Land a pattern here…',
              run: () => {
                setRange(gap.a, gap.b);
                openFill('land');
              },
            },
          ] satisfies Row[])
        : []),
      {
        label: 'Play from here',
        disabled: k >= grid.TS,
        run: () => {
          stopPlayback();
          startPlayback(grid.times[k]!);
        },
      },
      'sep',
      {
        label: E.hasMarkAt(doc, k) ? 'Remove the phrase mark' : 'Phrase mark',
        hint: 'P',
        run: () => togglePhraseMark(k),
      },
      {
        label: E.hasBreakAt(doc, k) ? 'Join the rows' : 'Break the line here',
        hint: '↵',
        run: () => toggleLineBreak(k),
      },
      ...(k < grid.TS
        ? ([
            {
              label: E.repeatStartAt(doc, k) ? 'Remove |:' : '|: Start repeat',
              hint: '[',
              run: () => toggleRepeatStartAt(k),
            },
          ] satisfies Row[])
        : []),
      ...(k > 0
        ? ([
            {
              label: E.repeatEndAt(doc, k) ? 'Remove :|' : ':| End repeat',
              hint: ']',
              run: () => toggleRepeatEndAt(k),
            },
            {
              label: E.doubleBarAt(doc, k) ? 'Remove the section end' : '‖ Section end',
              hint: '\\',
              run: () => toggleDoubleBarAt(k),
            },
          ] satisfies Row[])
        : []),
      ...(onBeat
        ? ([
            {
              label: section ? 'Modulation…' : 'Modulate from here…',
              hint: 'T',
              run: () => openModulation(k),
            },
          ] satisfies Row[])
        : []),
      { label: 'Subdivision…', hint: 'B', run: openSubdivision },
      'sep',
      { label: 'Select all', hint: '⌘A', run: selectAll },
      'sep',
      { label: barName, page: 'bar' },
    ];
  }

  const act = (run: () => void) => {
    close();
    run();
  };
  /** Mouse and touch taps need a press that began in the menu; the keyboard (detail 0) does not. */
  const real = (e: React.MouseEvent) => e.detail === 0 || pressed.current;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = [
      ...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []),
    ];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (j: number) => items[(j + items.length) % items.length]?.focus();
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      if (e.key === 'Escape' && page === 'bar' && menu.kind !== 'bar') return setPage('main');
      return close();
    }
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i < 0 ? -1 : i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(-1);
    else if (e.key === 'ArrowLeft' && page === 'bar' && menu.kind !== 'bar') setPage('main');
    else return; // Enter and Space click the focused item
    e.preventDefault();
  };

  return (
    <div
      className="ctx-back"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onWheel={(e) => e.target === e.currentTarget && close()}
      onContextMenu={(e) => {
        e.preventDefault();
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        className={`ctx${menu.touch ? ' by-touch' : ''}`}
        role="menu"
        aria-label={title}
        data-testid="ctx"
        style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
        onPointerDown={() => (pressed.current = true)}
        onKeyDown={onKeyDown}
      >
        <div className="ctx-title">
          {page === 'bar' && menu.kind !== 'bar' && (
            <button
              type="button"
              className="ctx-back-btn"
              role="menuitem"
              aria-label="Back"
              onClick={(e) => real(e) && (setPage('main'), setAsked(false), set({ doomed: null }))}
            >
              <ChevronIcon />
            </button>
          )}
          <span>{title}</span>
        </div>
        {quick.length > 0 && (
          <div className="ctx-quick">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                role="menuitem"
                className={q.danger ? 'danger' : ''}
                disabled={q.disabled}
                title={q.label === 'Paste' && pasteHint ? `Paste ${pasteHint}` : q.label}
                onClick={(e) => real(e) && act(q.run)}
              >
                {q.icon}
                <span>{q.label}</span>
              </button>
            ))}
          </div>
        )}
        <div className="ctx-rows">
          {rows.map((row, i) =>
            row === 'sep' ? (
              <hr key={i} />
            ) : (
              <button
                key={row.label}
                type="button"
                role="menuitem"
                className={row.doom ? 'danger' : ''}
                disabled={row.disabled}
                aria-haspopup={row.page ? 'menu' : undefined}
                onPointerEnter={() => row.doom && !row.disabled && set({ doomed: row.doom })}
                onPointerLeave={() => row.doom && !asked && set({ doomed: null })}
                onFocus={() => row.doom && !row.disabled && set({ doomed: row.doom })}
                onBlur={() => row.doom && !asked && set({ doomed: null })}
                onClick={(e) => {
                  if (!real(e)) return;
                  if (row.page) return setPage(row.page);
                  // a finger sees no hover: the first tap shows what would go, the second does it
                  if (row.doom && menu.touch && !asked) {
                    setAsked(true);
                    set({ doomed: row.doom });
                    return;
                  }
                  if (row.run) act(row.run);
                }}
              >
                <span className="ctx-label">{row.doom && asked ? `${row.label}?` : row.label}</span>
                {row.page ? (
                  <span className="ctx-more" aria-hidden="true">
                    <ChevronIcon />
                  </span>
                ) : (
                  row.hint && (
                    <kbd className="ctx-hint" aria-hidden="true">
                      {row.hint}
                    </kbd>
                  )
                )}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

const maxBars = (doc: E.Doc) => (E.isFree(doc.meter) ? E.MAX_CYCLES * 2 : E.MAX_CYCLES);

/** The empty stretch (open space and silence side by side) around pulse k, if k is in one. */
function gapAt(doc: E.Doc, k: number): { a: number; b: number } | null {
  let at = 0;
  let a = -1;
  let b = -1;
  for (const x of doc.items) {
    const end = at + x.n;
    if (x.kind === 'sound') {
      if (a >= 0 && k >= a && k < b) break;
      a = -1;
    } else if (x.n > 0) {
      if (a < 0) a = at;
      b = end;
    }
    at = end;
  }
  return a >= 0 && k >= a && k < b ? { a, b } : null;
}
