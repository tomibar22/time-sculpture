import { useEffect } from 'react';
import * as E from '../engine';
import { togglePlayback } from '../audio/player';
import {
  duplicateSelection,
  mergeSelection,
  moveSelection,
  redo,
  removeSelection,
  selectAll,
  toast,
  openModulation,
  toggleLineBreak,
  togglePhraseMark,
  toggleRepeatStartAt,
  toggleRepeatEndAt,
  changeRepeatTimes,
  openVolta,
  toggleTotalOver,
  splitSelection,
  toggleSelectionKind,
  undo,
} from '../state/actions';
import {
  brushSelection,
  copySelection,
  caretHome,
  deleteAtCaret,
  escape,
  extendSelection,
  moveCaret,
  extendRange,
  paste,
  playFromCaret,
  resizeSelection,
  selectedRegion,
  reverseSelection,
  trimSelection,
  typeDigit,
} from '../state/editing';
import { useDocStore, useUiStore } from '../state/store';
import { toggleOverview, zoomStep } from '../state/zoom';
import { enterStage, exitStage } from '../state/stage';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.matches('input, textarea, select') || t.isContentEditable);
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

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // on the stage Space and Esc work even right after the tempo slider was moved
      const onSlider = e.target instanceof HTMLInputElement && e.target.type === 'range';
      const stageKey = (e.code === 'Space' || e.key === 'Escape') && useUiStore.getState().stage;
      if (isTyping(e.target) && !(onSlider && stageKey)) return;
      const mod = e.metaKey || e.ctrlKey;
      // letter shortcuts follow the physical key, so they work with any layout (e.g. Hebrew)
      const k = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
      const hasSel = useUiStore.getState().selection.length > 0;

      // the stage only plays: Space, zoom, and Esc / F to leave
      if (useUiStore.getState().stage) {
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
        if (isActivatable(e.target)) return;
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
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          return caretHome(e.key === 'ArrowRight');
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

      // digits: type a size (Shift+digit types a silence)
      const digit =
        /^Digit(\d)$/.exec(e.code)?.[1] ??
        /^Numpad(\d)$/.exec(e.code)?.[1] ??
        (/^\d$/.test(e.key) ? e.key : undefined);
      if (digit !== undefined) {
        e.preventDefault();
        return typeDigit(Number(digit), e.shiftKey ? 'rest' : 'sound');
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
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        // [ and ] : start / end repeat signs at the caret (or the selection's start / end)
        const region = selectedRegion();
        const start = e.code === 'BracketLeft';
        const at = region ? (start ? region.a : region.b) : useUiStore.getState().caret;
        if (at === null) return void toast('Place the caret where the repeat sign goes');
        e.preventDefault();
        return start ? toggleRepeatStartAt(at) : toggleRepeatEndAt(at);
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
        if (hasSel) return removeSelection();
        deleteAtCaret(e.key === 'Backspace' ? -1 : 1);
        return;
      }
      if (k === 'b' && useUiStore.getState().range) return brushSelection();
      if (!hasSel) return;
      if (e.key === '+' || e.key === '=') return resizeSelection(1);
      if (e.key === '-' || e.key === '_') return resizeSelection(-1);
      if (k === 'r' && e.shiftKey) return reverseSelection();
      if (k === 'b') return brushSelection();
      if (k === 's') splitSelection();
      else if (k === 'm') mergeSelection();
      else if (k === 'r') toggleSelectionKind();
      else if (k === 'd') duplicateSelection();
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

    window.addEventListener('keydown', onKey);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
}
