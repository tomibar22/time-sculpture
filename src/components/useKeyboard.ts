import { useEffect } from 'react';
import * as E from '../engine';
import { togglePlayback } from '../audio/player';
import {
  duplicateSelection,
  duplicateRange,
  mergeSelection,
  moveSelection,
  redo,
  removeSelection,
  selectAll,
  toast,
  announce,
  openModulation,
  toggleLineBreak,
  togglePhraseMark,
  toggleRepeatStartAt,
  toggleRepeatEndAt,
  changeRepeatTimes,
  openVolta,
  toggleTotalOver,
  toggleMuteOver,
  splitSelection,
  undo,
} from '../state/actions';
import {
  openSubdivision,
  copySelection,
  caretHome,
  deleteAtCaret,
  escape,
  extendSelection,
  moveCaret,
  extendRange,
  caretRow,
  caretBar,
  onTilesHere,
  paste,
  playFromCaret,
  resizeSelection,
  selectedRegion,
  reverseSelection,
  trimSelection,
  typeDigit,
  typeSize,
} from '../state/editing';
import { useDocStore, useUiStore } from '../state/store';
import { swapNow, swapStep } from '../state/swap';
import { MAX_TEMPO, MIN_TEMPO } from '../state/defaults';
import { fillRegion, openFill } from '../state/fill';
import { openMenuAtSelection } from '../score/menu';
import { deleteBarsHere, toggleDoubleBarAt, toggleRepeatOver } from '../state/actions';
import { toggleOverview, zoomStep } from '../state/zoom';
import { buildStep, buildTo, enterStage, exitStage, setBuild } from '../state/stage';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.matches('input, textarea, select') || t.isContentEditable);
/** A field that takes text (not a slider, checkbox or select): it keeps its own undo. */
const isTextEntry = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.matches('textarea') ||
    t.isContentEditable ||
    (t instanceof HTMLInputElement &&
      !['range', 'checkbox', 'radio', 'button', 'submit', 'color'].includes(t.type)));
const inDialog = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('dialog');
const isActivatable = (t: EventTarget | null) =>
  t instanceof HTMLElement && t.matches('button, summary, a, [role="button"]');
/** The page has selected text (e.g. in the help): leave copy to the browser. */
const hasTextSelection = () => (window.getSelection()?.toString() ?? '') !== '';

/**
 * All keyboard shortcuts. Digits type sizes at the caret, ⌘C/⌘X/⌘V copy and paste groups
 * (also as text such as "3 (2) 4", so phrases can be pasted from Notes).
 */
export function useKeyboard() {
  useEffect(() => {
    let pendingPaste: number | undefined;
    /** Text of the groups just copied or cut by the keyboard, for the copy/cut event. */
    let copiedText: string | null = null;
    /** Digits typed while ⇧ is held: one number of two digits (⇧1 2 = 12), written on the
     * second digit or when ⇧ is let go. */
    let shiftDigits = '';
    const flushDigits = () => {
      const n = Number(shiftDigits);
      shiftDigits = '';
      if (n > 0) typeSize(n, 'sound');
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Esc with a dialog open closes the dialog and nothing else, even before its field has the
      // focus (it used to clear the caret too, under a just-opened phrase-mark dialog)
      if (e.key === 'Escape' && document.querySelector('dialog[open]')) return;
      // on the stage Space and Esc work even right after the tempo slider was moved
      const onSlider = e.target instanceof HTMLInputElement && e.target.type === 'range';
      const stageKey = (e.code === 'Space' || e.key === 'Escape') && useUiStore.getState().stage;
      const mod = e.metaKey || e.ctrlKey;
      // undo / redo (⌘Z, ⇧⌘Z, ⌘Y) work whatever has the focus (a slider, a switch, a select:
      // the tempo slider kept them from working), except while typing in a text field, which
      // has its own
      if (
        mod &&
        !e.altKey &&
        (e.code === 'KeyZ' || e.code === 'KeyY') &&
        !isTextEntry(e.target) &&
        !inDialog(e.target) &&
        !useUiStore.getState().stage
      ) {
        e.preventDefault();
        return e.code === 'KeyY' || e.shiftKey ? redo() : undo();
      }
      if (isTyping(e.target) && !(onSlider && (stageKey || e.code === 'Space'))) return;
      // letter shortcuts follow the physical key, so they work with any layout (e.g. Hebrew)
      const k = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
      const hasSel = useUiStore.getState().selection.length > 0;

      // the context menu has the keys while it is open (it handles its own; Esc puts it away)
      if (useUiStore.getState().menu) {
        if (e.key === 'Escape') useUiStore.getState().set({ menu: null, doomed: null });
        return;
      }
      if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
        if (useUiStore.getState().stage) return;
        e.preventDefault();
        return openMenuAtSelection();
      }

      // the stage only plays: Space, zoom, and Esc / F to leave
      if (useUiStore.getState().stage) {
        // build: → Space PageDown Enter show the next group, ← PageUp Backspace hide the last
        // (presentation remotes send these keys), Home / End none / all
        if (useUiStore.getState().build && !mod && !e.altKey) {
          // (Space always steps, even with a button focused; Enter still presses that button)
          if (isActivatable(e.target) && e.key === 'Enter') return;
          const next = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key);
          const back = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key);
          if (next || back || e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            if (e.key === 'Home' || e.key === 'End') return buildTo(e.key === 'End');
            return buildStep(next ? 1 : -1);
          }
        }
        if (k === 'b' && !mod && !e.altKey) return setBuild(!useUiStore.getState().build);
        if (e.key === ' ' || e.code === 'Space') {
          if (isActivatable(e.target)) return;
          e.preventDefault();
          return togglePlayback();
        }
        if (e.altKey && !mod && ['Equal', 'Minus', 'Digit0'].includes(e.code)) {
          e.preventDefault();
          if (e.code === 'Digit0') return toggleOverview();
          return zoomStep(e.code === 'Equal' ? 1 : -1);
        }
        if (e.key === 'Escape' && useUiStore.getState().overview) return toggleOverview();
        if (e.key === 'Escape' || (k === 'f' && !mod)) return exitStage();
        return;
      }
      if (k === 'f' && !mod && !e.altKey && !e.shiftKey)
        return void (e.preventDefault(), enterStage());

      if (e.key === ' ' || e.code === 'Space') {
        // Space is Play, whatever has the focus (user request): only a dialog keeps it for its
        // own buttons (typing in a field never gets here)
        if (inDialog(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) playFromCaret();
        else togglePlayback();
        return;
      }
      if (mod) {
        if (k === 'a') return void (e.preventDefault(), selectAll());
        if (k === 'z') return void (e.preventDefault(), e.shiftKey ? redo() : undo());
        if (k === 'y') return void (e.preventDefault(), redo());
        if (
          (k === 'c' || k === 'x') &&
          (hasSel || useUiStore.getState().range) &&
          !hasTextSelection()
        ) {
          // do the work here (it must also work if no copy event follows); the event writes the text
          copiedText = copySelection(k === 'x');
          return;
        }
        if (k === 'v') {
          // prefer the system clipboard text from the paste event; fall back to our own clipboard
          clearTimeout(pendingPaste);
          pendingPaste = window.setTimeout(() => paste(), 60);
          return;
        }
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.altKey && !e.shiftKey) {
          // ⌘← ⌘→: the caret to the bar line before / after (Home / End go to the very ends)
          e.preventDefault();
          return caretBar(e.key === 'ArrowLeft' ? -1 : 1);
        }
        return;
      }
      if (
        e.altKey &&
        !mod &&
        ['Equal', 'Minus', 'Digit0', 'NumpadAdd', 'NumpadSubtract'].includes(e.code)
      ) {
        // ⌥= ⌥− zoom in and out, ⌥0 shows everything (the physical keys, any layout)
        e.preventDefault();
        if (e.code === 'Digit0') return toggleOverview();
        return zoomStep(e.code === 'Equal' || e.code === 'NumpadAdd' ? 1 : -1);
      }
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        // ⌥↑ ⌥↓ : the tempo, one faster or slower (⇧: five)
        e.preventDefault();
        const st = useUiStore.getState();
        const step = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 5 : 1);
        const tempo = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, st.tempo + step));
        st.set({ tempo });
        return announce(`Tempo ${tempo}`);
      }
      if (e.altKey) {
        // ⌥←/→ trim the end edge, ⌥⇧←/→ the start edge (preventDefault also stops Alt+← = Back)
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const dir = e.key === 'ArrowLeft' ? -1 : 1;
          if (hasSel) return trimSelection(e.shiftKey ? 'start' : 'end', dir);
          // no tiles selected: jump the caret (or the range's end) from tile edge to tile edge
          return e.shiftKey ? extendRange(dir, true) : moveCaret(dir, true);
        }
        return;
      }

      // digits: type a size
      const digit =
        /^Digit(\d)$/.exec(e.code)?.[1] ??
        /^Numpad(\d)$/.exec(e.code)?.[1] ??
        (/^\d$/.test(e.key) ? e.key : undefined);
      if (digit !== undefined) {
        e.preventDefault();
        if (e.shiftKey && !mod && !e.altKey) {
          if (e.repeat) return;
          if (!shiftDigits && digit === '0') return; // a number does not begin with 0
          shiftDigits += digit;
          if (shiftDigits.length >= 2) return flushDigits();
          toast(`${shiftDigits}… (⇧: type a second digit, or let go)`);
          return;
        }
        if (shiftDigits) flushDigits();
        return typeDigit(Number(digit), 'sound');
      }
      if (e.key === '?') {
        // the help, opened and brought into view
        // the help, opened at the keys
        const help = document.querySelector<HTMLDetailsElement>('details.help-panel');
        const keys = document.querySelector<HTMLDetailsElement>('#help-keys');
        if (help) {
          e.preventDefault();
          help.open = true;
          if (keys) keys.open = true;
          (keys ?? help).scrollIntoView({ block: 'start', behavior: 'smooth' });
          (keys ?? help).querySelector('summary')?.focus({ preventScroll: true });
        }
        return;
      }
      if (k === 'a' && e.shiftKey) return void (e.preventDefault(), selectAll());
      if (k === 'z') return void (e.preventDefault(), undo());
      if (k === 'y') return void (e.preventDefault(), redo());
      if (e.key === 'Escape') {
        // the overview closes first, back to where you were
        if (useUiStore.getState().overview) return toggleOverview();
        return escape();
      }
      if (k === 't' && !e.shiftKey) {
        const region = selectedRegion();
        const at = region ? region.a : useUiStore.getState().caret;
        if (at === null) return void toast('Put the caret on a beat line to modulate there');
        e.preventDefault();
        return openModulation(at);
      }
      if (k === 'g' && !e.shiftKey) {
        e.preventDefault();
        return toggleTotalOver(selectedRegion());
      }
      if (k === 'u' && !e.shiftKey) {
        e.preventDefault();
        return toggleMuteOver(selectedRegion());
      }
      if (k === 'p' && e.shiftKey) {
        // name the phrase mark at the caret (or where the selection starts)
        const region = selectedRegion();
        const at = region ? region.a : useUiStore.getState().caret;
        if (at === null) return void toast('Place the caret where the phrase starts');
        e.preventDefault();
        return useUiStore.getState().set({ markDialog: { k: at } });
      }
      if (k === 'p' && !e.shiftKey) {
        // a phrase mark at the caret (or where the selection starts)
        const region = selectedRegion();
        const at = region ? region.a : useUiStore.getState().caret;
        if (at === null) {
          toast('Place the caret first: click a line between tiles, or ⌥-click inside one');
          return;
        }
        e.preventDefault();
        return togglePhraseMark(at);
      }
      if (e.code === 'Backslash' && !e.shiftKey) {
        // \ : a section end (double bar line) at the caret, or where the selection ends
        e.preventDefault();
        const region = selectedRegion();
        return toggleDoubleBarAt(region ? region.b : useUiStore.getState().caret);
      }
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        // [ and ] : start / end repeat signs at the caret (or the selection's start / end)
        const region = selectedRegion();
        const start = e.code === 'BracketLeft';
        const at = region ? (start ? region.a : region.b) : useUiStore.getState().caret;
        if (at === null) return void toast('Place the caret where the repeat sign goes');
        e.preventDefault();
        return start ? toggleRepeatStartAt(at) : toggleRepeatEndAt(at);
      }
      if (k === 'v' && e.shiftKey) {
        e.preventDefault();
        return openFill('vary');
      }
      if (k === 'v' && !e.shiftKey) {
        e.preventDefault();
        return openVolta(selectedRegion());
      }
      if ((e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') && !hasSel) {
        // with the caret on an end repeat: play the passage one time more / less
        const caret = useUiStore.getState().caret;
        if (caret !== null && E.repeatEndAt(useDocStore.getState().doc, caret))
          return changeRepeatTimes(caret, e.key === '+' || e.key === '=' ? 1 : -1);
      }
      // X: swap two stretches (the first X marks the selection, the second swaps with it)
      if (k === 'x' && !e.shiftKey) return void (e.preventDefault(), swapStep());
      if (e.key === 'Enter' && useUiStore.getState().swapA && !isActivatable(e.target)) {
        e.preventDefault();
        return void swapNow();
      }
      if (e.key === 'Enter' && !isActivatable(e.target)) {
        // a line break at the caret (or where the selection starts), like in a text editor
        const st = useUiStore.getState();
        const region = selectedRegion();
        const k = region ? region.a : st.caret;
        if (k === null) return;
        e.preventDefault();
        return toggleLineBreak(k);
      }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        return caretHome(e.key === 'End');
      }
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !hasSel) {
        // like a text caret: to the row above or below (⇧ carries the range there)
        e.preventDefault();
        return caretRow(e.key === 'ArrowUp' ? -1 : 1, e.shiftKey);
      }
      // Land open on long and short: L and S build the pattern
      {
        const st = useUiStore.getState();
        if (st.fillPanel === 'land' && st.landMode === 'ls' && (k === 'l' || k === 's')) {
          e.preventDefault();
          const x = k === 'l' ? 'L' : 'S';
          const region = fillRegion();
          const R = region ? region.b - region.a : 0;
          if (E.lsRoomFor(st.landLS, x, R, st.landOn1)) st.set({ landLS: [...st.landLS, x] });
          else
            toast(`No room for another ${x === 'L' ? 'long' : 'short'} tile in these ${R} pulses`);
          return;
        }
      }
      // the panels: ⇧F fill (browse), L land, K the metronome (practice, click pattern, mix)
      if (k === 'f' && e.shiftKey) return void (e.preventDefault(), openFill('browse'));
      if (k === 'l' && !e.shiftKey) return void (e.preventDefault(), openFill('land'));
      if (k === 'k' && !e.shiftKey) {
        e.preventDefault();
        const st = useUiStore.getState();
        st.set({ practiceOpen: !st.practiceOpen });
        // the keys go on inside it: its page tabs take the focus
        if (!st.practiceOpen)
          requestAnimationFrame(() =>
            document.querySelector<HTMLElement>('.practice-tabs [aria-selected="true"]')?.focus(),
          );
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        if (e.shiftKey) {
          e.preventDefault();
          return extendSelection(dir);
        }
        if (hasSel) {
          e.preventDefault();
          return moveSelection(dir);
        }
        e.preventDefault();
        return moveCaret(dir);
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        // ⇧⌫: the bars themselves go (the ones under the selection or the caret), time and all
        if (e.shiftKey) return void deleteBarsHere();
        if (hasSel) return removeSelection();
        deleteAtCaret(e.key === 'Backspace' ? -1 : 1);
        return;
      }
      // B: the ratios for the beats under the selection, the range or the caret alone
      if (k === 'b' && !mod && !e.altKey) return openSubdivision();
      // the keys that work on groups: on the selection, else on the groups of the range, else on
      // the group at the caret (the one just written), and then writing goes on after it
      if (e.key === '+' || e.key === '=') return onTilesHere(() => resizeSelection(1));
      if (e.key === '-' || e.key === '_') return onTilesHere(() => resizeSelection(-1));
      if (k === 'r' && e.shiftKey) return onTilesHere(reverseSelection);
      // R: repeat signs around the selection or range, both at once
      if (k === 'r' && !e.shiftKey)
        return void (e.preventDefault(), toggleRepeatOver(selectedRegion()));
      if (k === 's') return onTilesHere(splitSelection);
      if (k === 'm') return onTilesHere(mergeSelection);
      if (k === 'd') {
        if (useUiStore.getState().range) return duplicateRange();
        return onTilesHere(duplicateSelection);
      }
    };

    const onCopy = (e: ClipboardEvent) => {
      if (isTyping(e.target) || hasTextSelection() || copiedText === null) return;
      e.clipboardData?.setData('text/plain', copiedText);
      e.preventDefault();
      copiedText = null;
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      clearTimeout(pendingPaste);
      const parsed = E.parseGroups(e.clipboardData?.getData('text/plain') ?? '');
      e.preventDefault();
      paste(parsed ?? undefined);
    };

    // Space played on keydown: the focused button must not be pressed by the same key on keyup
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && shiftDigits) flushDigits();
      if (e.code !== 'Space' || isTyping(e.target) || inDialog(e.target)) return;
      if (useUiStore.getState().menu) return;
      if (isActivatable(e.target) && !useUiStore.getState().stage) e.preventDefault();
    };
    const onBlur = () => flushDigits();
    window.addEventListener('blur', onBlur);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('keydown', onKey);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
}
