# Time Sculpture — working notes for Claude

Personal web app for a jazz pianist/composer (Tomer) to compose rhythmic phrases by building and
sculpting groups ("tiles") of pulses inside cycles, so every phrase lands on beat 1 of the next
cycle. Used daily on iPhone (home-screen PWA) and desktop. Deployed on Vercel from `main`.

`docs/prototype.html` is the behavioural reference (interactions, edge cases, feel). Never copy
its code; rebuild cleanly. Priorities: musical-model correctness → calm, spacious UI → speed →
breadth. Every gesture has a keyboard and a button equivalent.

## Workflow

- The user wants every milestone **merged into `main` and pushed** (they review on Vercel).
  Develop on `claude/beautiful-cerf-j0e88k`, then fast-forward/merge into `main` and push both.
- Small, well-named commits. After each milestone, report: what works, what's next, decisions.
- Keep this file updated when the model, conventions, or tokens change.

## Commands

- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint`
- `npm test` (Vitest, engine + store) · `npm run coverage` · `npm run e2e` (Playwright)
- Playwright is pinned to the version matching the pre-installed Chromium; do not run
  `playwright install` in the cloud container.

## Stack

Vite + React 18 + TS strict (`noUncheckedIndexedAccess`). Zustand (undoable document slice +
UI slice). One Canvas 2D score; everything else semantic HTML. Web Audio lookahead scheduler.
Plain CSS with custom-property tokens. @fontsource fonts. vite-plugin-pwa. idb-keyval library.

## Folder structure

```
src/engine/        pure TS, no React/DOM. Fully unit + property tested.
  types.ts         Doc, Meter, Item (Group | Space), Report, OpResult
  grid.ts          meter → pulse grid (times in beats), nearest/floor/ceil pulse
  doc.ts           helpers, syncSpace, invariants (checkInvariants/assertValid), docFrom (tests)
  selection.ts     selected indices, contiguity, range, insertionIndex (drop target)
  count.ts         BigInt tiling counts, tray states, uniform random tiling
  playback.ts      nextPulse (walks beat-time), pitchForSize (pentatonic)
  ops/items.ts     add, split, merge, duplicate, remove, toggleKind, fills, clear
  ops/shape.ts     reshapeLine, stretchEdge, snap helpers
  ops/move.ts      reorder (Place), slide (Pulse/Beat), stepDelta, clampSlide
  ops/meter.ts     setSubdivision, resizeMeter
  ops/edit.ts      text-editor ops: insertGroups, replaceGroups, resizeGroup(s), reverseGroups,
                   copyGroups, formatGroups / parseGroups ("3 (2) 4"), trimEdge
src/state/         Zustand store: document (undo/redo) + ui; actions.ts, editing.ts (caret)
src/audio/         AudioContext unlock, scheduler, voices, interface sounds
src/score/         canvas: geometry, draw, hit-testing, gestures
src/components/    header, toolbar, selection bar, status, pieces, options, help, transport, toasts
src/persistence/   IndexedDB library, JSON import/export, share links
src/styles/        tokens.css, global.css
e2e/               Playwright specs (iPhone 14 + desktop)
```

## Domain model (src/engine)

- **Meter**: `beatsPerCycle` 3–13 (no denominator), `cycles` 1–32, `subdivision[beat]` 1–8 for
  every beat of the piece (length = beats × cycles).
- **Grid**: pulse j of beat b (d pulses) starts at time `b + j/d` (beats). `TS` = Σ subdivisions.
  `times[TS] = NB`. Tempo is beats/min, so a beat always lasts the same; only density changes.
- **Items**: ordered `Group {id, kind: 'sound'|'rest', n}` plus exactly one
  `Space {id: 'space', kind: 'space', n}`. The space's `n` is _derived_ (TS − Σ groups) and
  recomputed by `syncSpace` at the end of every op. Before the space = "the start"; after it =
  "the ending". The ending is anchored to the end, so the phrase always lands on 1.
- **Ids**: minted from `doc.nextId` (`g1`, `g2`, …) so ops are pure/deterministic. Ids are never
  reused. Split keeps the id on the first half; merge keeps the first id.

### Invariants (enforced by every op, checked by fast-check)

1. Group sizes ≥ 1 (space may be 0); all sizes are integers.
2. Σ sizes = TS.
3. Exactly one space.
4. Ids unique; carried over or brand new (and then listed in `report.created`).
5. A failed op (`report.ok === false`) returns the same `doc` object.
6. Meter values in range; `subdivision.length = beats × cycles`.

### Operations — all pure, `(doc, …) → { doc, report }`

Report: `ok, reason?, moved, shortened, covered, created, removed, startsMoved, absorbed`.

- `add(size, kind, 'start'|'end'|{index})` — start = just before the space; end = just after.
- `reshapeLine(leftId, leftSize)` — pair keeps its total, each side ≥ 1.
- `stretchEdge(id, size)` — group touching the space grows into it / shrinks back.
- `split` (ceil/floor), `merge` (contiguous ≥ 2; rest only if all rests), `duplicate` (needs room;
  copies go after the last selected), `remove`, `toggleKind` (any sound → all rest, else all sound).
- `reorderTo / reorderAtPulse / reorderStep` (Place): lift block, rest closes up (space grows),
  insert. Dropping inside the space attaches to the nearer side (`insertionIndex`).
- `slide(ids, d)` contiguous block by d pulses (clamped to the piece). Ahead: space/rests/sounds
  give way from the side facing the block; used-up groups are `covered`; partly eaten sounds are
  `shortened`. Behind: vacated time joins an adjacent rest or the space, else a new rest.
  `stepDelta(ids, dir, 'pulse'|'beat')` — beat steps go to the next/previous beat line.
- `setSubdivision(beats, d)` — every boundary keeps its time, snaps to the nearest new pulse
  (ties → earlier), order kept; groups squeezed to 0 are absorbed. Reports `startsMoved`, `absorbed`.
- `resizeMeter(beats, cycles, fill)` — first ⌈NB/2⌉ beats copy the old start's subdivisions,
  the rest copy the old end's; gaps get `fill` (the brush). Item sizes kept; space absorbs. If too
  short, groups next to the space are removed (start side first) → `removed`.
- `fillWithPieces(tray, rng)` (uniform over all tilings, inserted at the end of the start),
  `fillWithSilence`, `clear`.
- `countWays(R, tray)` BigInt; `trayStates(R, tray)` → fits / dead (can't finish) / big.

### Playback

Walk beat-time, not pulse indices: `nextPulse(doc, T)` = first pulse at or after T. Edits and
subdivision changes during playback apply immediately without jumps. Sounds: landing (pulse 0),
cycle downbeat, beat click, optional soft ticks, pitched tone per sounding group (pentatonic from
G3 by size), rests silent.

### Text-editor editing (ops/edit.ts, state/editing.ts)

- The **caret** sits between items: `ui.cursor = { after: ItemId | null }` (null = very start;
  `after: 'space'` = start of the ending), resolved to an index with `cursorIndex`. Anchoring to
  an id keeps it in place through edits elsewhere. Drawn only when nothing is selected.
- Placed by tapping a line/edge without dragging, or the open space (nearer side). Clearing a
  selection (Esc / Done) collapses it to a caret after it. Selecting a tile drops the caret.
- Digits 1–9 type a group at the caret (Shift = silence); each digit is its own group, however
  fast they are typed (no multi-digit sizes). With a selection, typing/pasting replaces it
  (contiguous only; room = selection + space). Tray taps insert at the caret too.
- Clipboard: `ui.clipboard` (GroupSpec[]) plus system text "3 (2) 4"; paste parses text first.
- Keys: ←/→ move the selection (by drag mode) or the caret; ⇧←/→ extend the selection;
  Home/End and ⌘←/→ caret to the ends; Backspace/Delete beside the caret; +/− resize; ⇧R
  reverse; ⇧Space play from the caret.

### Trimming (trimEdge)

- Trim one edge of a group like a DAW clip; the opposite edge stays fixed in time. Growing eats
  into neighbours (space, rests, sounds; used-up = covered), shrinking leaves silence (joins a
  neighbouring rest/space, else a new rest). Property-tested.
- UI: a single selected group shows grips on its edges (they win over line handles there).
  Keys: ⌥←/→ end edge, ⌥⇧←/→ start edge; by pulse, or beat line in Beat mode. A run of selected
  groups trims its outer edges.

### Score layout (src/score/rows.ts)

- Each row: beat numbers (cycle downbeats red, ratio of differing beats as an accent label) →
  tiles → the dotted subdivision band (a pill per beat, a dot per pulse; red mark at each
  downbeat). The band is both the display and the paint target (everything below the tiles).
  There is no separate lane above. B paints the brush on the beats under the selection.

- Rows show whole cycles: `ui.perRow` (default 1) plus optional custom `ui.rows` (cycles per
  row from the top), normalised by `normalizeRows`. Saved with the piece (not undoable).
- Beat width is the same in every row (set by the widest row), so beats align vertically;
  shorter rows end early. No "cycle N" labels (the user found them busy): the red "1" and red downbeat lines mark cycles.

### Silence

- Rests are still items (selectable, movable, shown as "(n)" in the status) but are drawn as
  empty time: no tile, no number, unless selected, lifted or focused.

## Persistence

- IndexedDB store `time-sculpture/library`: `index` (entries), `piece:<id>` (SavedPiece v1),
  `current`. Autosave 400 ms after any change, and on `pagehide`.
- File format v1 (`src/persistence/serialize.ts`): items as `"3"` sound, `"r3"` rest, `"|"` space,
  plus meter, tray, tempo and the row layout (`perRow`, `rows`; optional, default 1 / []). Imports are validated with `checkInvariants`.
- Share links: `#s=` + `z` + base64url(deflate-raw(JSON)), or `j` + base64url(JSON) without
  CompressionStream. Opening one saves it to the library as "<name> (shared)".

## Testing notes

- Accessible names must contain the visible text (WCAG 2.5.3): prefer visible text +
  `sr-only` spans or `title` over an `aria-label` that differs from what is shown.
- Lighthouse baseline: 100/100/100/100 mobile and desktop; keep it there.

- e2e coordinates come from `e2e/helpers.ts`, which mirrors `src/score/geometry.ts` constants —
  update both together. Each Playwright test gets fresh storage.

## UI conventions

- Mobile-first, max content width 800 px, 16 px gutters + safe areas, generous gaps (24 px).
- Default tray: 2, 3, 4, 5, 7. Default meter 4 × 2 at 4:1. Tempo 40–160, default 72.
- Drag modes: Pulse / Beat / Place. Arrow keys follow the mode.
- Keys: Space play/stop · ←/→ move · Delete remove · M merge · S split · R silence/sound ·
  D duplicate · Z undo · Y or ⇧⌘Z redo · ⌘A select all · Esc clear · 1–9 type · ⌘C/X/V ·
  ⌥←/→ trim end · ⌥⇧←/→ trim start · B brush.
- Toasts for anything non-obvious, with Undo. aria-live announcements. Touch targets ≥ 44 px.
- Pointer Events; `touch-action: none` on the canvas only. Long-press 450 ms → multi-select.

## Design tokens (src/styles/tokens.css)

| token                 | light   | dark    |
| --------------------- | ------- | ------- |
| --bg                  | #f1f3f6 | #0f1114 |
| --card                | #ffffff | #171a1f |
| --fg                  | #16191e | #eceef1 |
| --muted               | #646c78 | #a0a7b1 |
| --faint               | #9aa2ad | #6c737d |
| --line                | #e1e5ea | #262b32 |
| --soft                | #f5f7f9 | #1e2228 |
| --accent              | #0d7a72 | #3cc4b6 |
| --accent-ink          | #ffffff | #0b1413 |
| --land (downbeat red) | #c9302c | #ff6369 |
| --warn                | #9a6516 | #e2b04a |
| --sel                 | #2b59d9 | #7ea2ff |

Size colours (index = size, cycling 1–12): 1 #7d8794, 2 #159a90, 3 #4b5fd3, 4 #d4961c,
5 #c43a5c, 6 #3c9550, 7 #8657d3, 8 #d97424, 9 #2399bd, 10 #a8448a, 11 #66792a, 12 #bf432a.
Fonts: Bricolage Grotesque (display), Atkinson Hyperlegible (body), IBM Plex Mono (numbers).
Tile text colour is picked per size colour by contrast (`inkFor`). Light --land/--warn and size 5
were darkened from the prototype to meet WCAG AA for text.
Radii: panels 20 px, controls 12 px, tiles 9 px. Theme: follows system; `data-theme` on `<html>`
overrides.
