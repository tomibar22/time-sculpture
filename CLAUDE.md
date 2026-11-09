# Time Sculpture — working notes for Claude

Personal web app for a jazz pianist/composer (Tomer) to compose rhythmic phrases by building and
sculpting groups ("tiles") of pulses inside cycles, so every phrase lands on beat 1 of the next
cycle. Used daily on iPhone (home-screen PWA), iPad and desktop. Deployed on Vercel from `main`.

**Three devices, always** (user's rule): unless the user says otherwise, every change must work
and look right on desktop, iPad and iPhone. Check all three (e2e projects `desktop`, `ipad`,
`iphone`; screenshots at iPad Pro 11 portrait and landscape when the layout changes).

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
src/components/    header, toolbar, selection bar, status, keypad (number pad) + transport dock,
                   library, rows, options, help, toasts
src/export/        printed score sheet (sheet.ts) and a tiny PDF writer (pdfWriter.ts)
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
cycle downbeat, beat click, optional soft ticks, pitched tone per sounding group (by size, longer
= lower: 1 → G5, down the major pentatonic, 11 → G3, 16 and longer → G2), rests silent.

### Text-editor editing (ops/edit.ts, ops/range.ts, state/editing.ts)

- The **caret is a pulse** (`ui.caret`, 0..TS), like a caret between letters, and a **range** is
  a pulse range (`ui.range` {a,b}, `ui.rangeAnchor`). Tile selection still exists separately.
  `selectedRegion()` = range, else the selected tiles' span.
- Range rules (`fillRange`): a group cut at the range start keeps its head (same id); a group
  cut at the range end loses its onset, so its tail becomes silence; open space cut by a range
  stays open after it (a part before it becomes silence only if open space remains after).
  Property test: every onset outside the range is unchanged.
- `insertAtPulse`: at a boundary = normal insert (ripple toward the space); inside the space =
  silence up to the caret, then the groups; inside a group = split (head, groups, silent tail).
- Typing over a range writes at its start and silences the rest; Backspace silences a range.
  `sliceRange` copies a range (cut heads become silence).
- Keys: ← → caret by pulse (or move tiles when tiles are selected); ⌥← ⌥→ caret tile to tile
  (trim when tiles are selected); ⇧ arrows extend the range (⌥⇧ by tile); ⇧-click range; ⌥-click
  caret inside a tile; Home/End/⌘← → ends; Esc collapses to a caret, then removes it.
- The sequence line under the score is visually hidden (user request); it stays for screen
  readers and as the e2e `sequence` test id.

### Filling a region (engine/fills.ts, state/fill.ts, components/FillPanel.tsx)

- Region = range, tiles span, or the open space. A docked panel (above the number pad, so the
  score stays visible) has Random (uniform tiling) and Browse: `fillOptions` lists all tilings
  (≤ 400) or 400 distinct random ones, measured (tiles, onBeat, offBeat, variety, spread) and
  sorted (`FILL_SORTS`). Hover/focus previews via `ui.preview`; click applies with `fillRange`
  and keeps the region selected as a range.

### Trimming (trimEdge)

- Trim one edge of a group like a DAW clip; the opposite edge stays fixed in time. Growing eats
  into neighbours (space, rests, sounds; used-up = covered), shrinking leaves silence (joins a
  neighbouring rest/space, else a new rest). Property-tested.
- UI: a single selected group shows grips on its edges (they win over line handles there).
  Keys: ⌥←/→ end edge, ⌥⇧←/→ start edge; by pulse, or beat line in Beat mode. A run of selected
  groups trims its outer edges.

### Score layout (src/score/rows.ts)

- Each row: beat numbers (cycle downbeats red) → tiles → the subdivision band: a ruler with a
  tick where every pulse begins (aligned with tile edges, upper half), taller beat ticks, red
  cycle ticks; beats whose ratio differs from the most common one are tinted, and a run of
  beats with the same ratio is named once ("3:1") where it starts (also at the piece's and each
  section's start, and when it returns to the main ratio), in the band's lower half
  (not repeated per bar or row; user request). The band is both the display and the paint target (everything below the tiles).
  There is no separate lane above. B paints the brush on the beats under the selection.

- Rows (`rows.ts` `rowLayout`) are spans of time: they wrap every `ui.perRow` bars (the zoom), and at the
  document's **manual line breaks** (`meter.breaks`, times in beats, any pulse, toggled with Enter
  at the caret / "Break line"; `toggleBreak`, `withBreaks` snaps/dedupes/drops out-of-range).
  Wrapping restarts after a manual break, so a mid-bar break offsets the following rows (another
  break on a bar line realigns). Breaks are undoable and saved (`layout.breaks`); they snap to the
  nearest pulse when the subdivision changes and are dropped when the piece gets shorter. Old
  `rows` (bars per row) layouts load as breaks. "Join rows (N)" clears them.
- **Fit rows** (`ui.fitRows`, saved as `layout.fitRows`): every row gets its own beat width
  (`Row.bw`) so short rows stretch to the full width; off = one shared width (aligned beats).
  Always use `g.rows[r].bw`, never a global beat width, in geometry and drawing.
- Beat width is the same in every row (set by the widest row), so beats align vertically.
  Drawing works from pulse/beat _times_ clipped to each row. A row starting at a manual break
  mid-beat shows where it starts ("2+1/4") and an accent mark at its left. No "cycle N" labels.

### Zoom (state/zoom.ts, score/view.ts, components/ZoomControl.tsx)

- Zoom = how much time a row holds = `ui.perRow` (saved as `layout.cyclesPerRow`, the PDF uses
  it). Levels `ZOOM_LEVELS` (rows.ts): ¼, ½ bar (a row holds ⌈bar × f⌉ beats and rows restart
  at every bar line), 1, 2, 3, 4, 6, 8 bars; `zoomLevels` drops levels that look the same and
  ones longer than the piece; `zoomLabel` → "2 beats" / "4 bars". Rows reflow; tiles never
  scale or change height; no horizontal scroll.
- Every zoom keeps a point steady: `view.anchor` (time, dy in its row, client y) is taken before
  (pinch centre / tapped point / caret-range-selection if on screen / top visible row) and
  `restoreAnchor` scrolls after the new layout (in Score's draw). Smooth scrolls in flight are
  stopped first.
- Overview `ui.overview` (not saved): the closest level ≥ the zoom (up to 64 bars,
  `OVERVIEW_LEVELS`) at which everything fits above the dock (`overviewPer` in Score.tsx); the
  score scrolls to the top. A tap in it dives back to the zoom around that point (no edit);
  Esc / ⤢ / zoom in also leave it.
- Input: pinch (pointer events; Safari `gesture*` events take over; a second finger always
  cancels what the first started and nothing edits until every finger is up, `twoFingers`), ⌘/Ctrl + wheel (trackpad
  pinch), ⌥= ⌥− ⌥0, and − + ⤢ in `.score-head` (on phones beside the settings summary; on
  wider screens right above the score). `ZoomHud` shows the level briefly. Far out, per-pulse
  guides and ticks are skipped when a pulse is < 3 px.

### Metric modulation (engine/sections.ts, ops/sections.ts)

- `meter.sections`: `{at (local beat > 0), from, to, beatsPerBar}`. From `at`, "from:1 = to:1":
  a new beat lasts `to/from` of the old (2:1 = 3:1 → ♩72 → 48). Can start mid-bar; each section
  starts a new bar and has its own bar size. With sections, `cycles` = total bars (≤ 64) and the
  piece length is `subdivision.length` (grid NB = subdivision.length always).
- `barMap(meter)` (cached): per beat its section, bar and beat-in-bar, bar starts, and per
  section `scale` (main beats per local beat) and `mainAt`. Use it — never `beat % beatsPerCycle`
  — for downbeats, numbering, clicks and descriptions (`barBeat`). `toMain`/`fromMain` convert
  local ↔ main time; playback durations use `toMain`.
- `landing(meter)`: does the piece end on a main beat 1? `late` in main beats, and `fixes` =
  whole local beats of the last section to add/cut. Status shows it with buttons (`adjustEnd`).
- Ops: `addSection`, `updateSection`, `removeSection`, `setMainBarSize` (regroup, length kept),
  `resizeBeats` (insert/cut at max(last section start, middle); later sections/breaks/marks move).
  `resizeMeter` delegates to these when sections exist. Without sections the old B×C rules hold.
- UI: T / "Modulate…" at a beat-line caret opens `ModulationDialog` (also by clicking the amber
  marker). Beats keep their width; a section always starts a row; inside sections dashed red
  lines + small ticks show the main tempo's bars and beats. File: `modulations` (+ `sounds` in
  main beats).

### Phrase marks

- `meter.marks` (times in beats, any pulse, 0 allowed; `toggleMark`, `withMarks`, same snapping /
  dropping rules as breaks), toggled with P at the caret or "Phrase mark". Optional names:
  `meter.markNames` (one per mark, '' = none; absent when none is named). `withMarks(meter, marks,
  names = meter.markNames)` carries each name with its mark (callers that move marks pass the
  moved times unfiltered, NaN = cut). `nameMark` / `markNameAt`; ⇧P, "Name…" or a tap on the flag
  opens `MarkDialog`. Drawn in the score's ink (`P.fg`, never a tile colour): a thin line through
  the tiles and a flag in the number row (a small triangle, or a pill with the name). Saved as
  `phraseStarts` + `phraseNames`; printed in the PDF.

### Totals (engine/form.ts)

- `meter.totals` `{a, b}` (beats, on pulses): brackets under the band showing how many pulses a
  run of groups holds (to show the larger division: 3 3 2 → 8). They ride in `Form` (`formOf`/
  `withForm`), so every meter op snaps/moves/cuts them like endings; nesting and overlap allowed,
  exact duplicates dropped. `totalLevels` stacks them (inner ones nearer the band). Geometry:
  `g.under` = levels × `TOTAL_H` (18) added to the stride only when there are totals; `totalsY`,
  `totalAt`; hit zone `'totals'` (not painted by the brush). UI: G or "Total" / "Remove total"
  in the tile and range bars (`toggleTotalOver`); a tap on a bracket selects its range. Saved as
  `totals` `{fromBeat, toBeat, pulses}`.

### Repeats and endings (engine/form.ts)

- `meter.repeatStarts` (`|:`, 0 ≤ t < NB), `meter.repeatEnds` (`{at, times}`, `:|`, 0 < t ≤ NB,
  times 2–12) and `meter.voltas` (`{a, b, passes}`, endings "1.", "1. 2."), all times in beats on
  pulses. `withForm`/`refitForm` snap and clean them (same rules as breaks/marks; `resizeMeter`
  keeps a sign at the very end at the end; `resizeBeats` shifts them, signs inside a cut go,
  endings shrink). `formErrors` is part of `checkInvariants`.
- Pairing (`repeatsOf`): an end pairs with the last start since the previous end, else repeats
  from the previous end / the top. `playOrder(meter)` → stretches `{a, b, pass}` as heard:
  inside a repeat, endings that don't list the pass are cut out; endings after an end sign are
  simply played (reached on the last pass). The player (`audio/player.ts`) walks these stretches.
- Drawing: thick+thin bar with dots through the tiles (card halo), and a lane of `LANE_H` above
  every row (`g.lane`, only when there is an ending or a ×3+) with ending brackets (closed when
  they end at an end sign) and "×N". `rowTop` is below the lane. Tapping a bracket edits it.
- UI: caret bar `|: Start repeat` / `:| End repeat` / ×N stepper, `Ending…` in the range and
  tile bars (`VoltaDialog`, default passes from `defaultPasses`). Keys `[` `]` (physical
  Bracket keys), `V`, `+`/`−` on an end sign. File: `repeats` + derived `playOrder`.

### Stage (filming a performance; state/stage.ts, components/Stage.tsx)

- `ui.stage`: the score alone, full width (≤ 1200 px), for screen-recording a performance so
  listeners can follow. Entered by "Stage" in the header or F; Esc / F / ✕ leave. App renders
  `<Stage/>` instead of the editor (no dock, no toasts: `toast()` is a no-op on stage).
- Nothing edits (Score ignores taps; keys: Space, ⌥ zoom, Esc/F only). Drawing (`stage` in
  DrawState): no caret/range/selection/handles/open space; while playing, played sound groups get
  a veil (bed colour), the sounding one a ring that is heavier at its onset; the landing shows as
  a red bar at the end.
- Score follows the playhead: on each new row it scrolls that row near the top (with the row
  before when ≥ 3 rows fit).
- `ui.stagePrefs` (localStorage `time-sculpture/stage`): `countIn` 0/1/2 bars (main beats,
  `ui.countdown` drives the big number), `sound` all / click / off, `loop` (off = play once: the
  player schedules a landing click, holds the end 1.6 s, then stops).
- Controls fade while playing (`.stage.quiet`), a tap brings them back for 2.6 s. Wake lock while
  the stage is open; desktop browsers go full screen.
- Two presentations (switch "Perform | Build", key B): **Build** (`ui.build {step}`, direction
  `stagePrefs.buildDir`) fills the score in one sounding group per click, from the start or from
  the end, for explaining a piece while talking. `buildSteps` / `buildReveal` (state/stage.ts)
  give the shown stretch [a, b]; drawScore's `reveal` hides groups, marks and totals outside it
  (rests reach on to the next hidden group) and `pop` rings the group just shown (`ui.buildPop`,
  650 ms; its tone sounds unless the stage is silent). Next: a tap on the score, → ↓ Space
  PageDown Enter (remotes); back: ← ↑ PageUp Backspace; Home / End none / all. Controls fade 1.2 s
  after a step; a tap near the bottom brings them back. The score follows the newest group.

### Silence

- Rests are still items (selectable, movable, shown as "(n)" in the status) but are drawn as
  empty time: no tile, no number, unless selected, lifted or focused.

## Persistence

- IndexedDB store `time-sculpture/library`: `index` (entries), `piece:<id>` (SavedPiece v1),
  `current`. Autosave 400 ms after any change, and on `pagehide`.
- File format **v2** (`src/persistence/serialize.ts`, documented in `docs/file-format.md`):
  plain JSON with title, tempo, beatsPerCycle, cycles, subdivision[], start[] / ending[] of
  `{pulses, rest?}`, layout, and derived `sounds[]` ({at, length} in beats) for other programs.
  v1 files still load. Imports are validated with `checkInvariants`.
- PDF: `src/export/sheet.ts` renders A4 pages (≈216 dpi) with the print palette and
  `drawScore(noClear)`; `pdfWriter.ts` packs them as FlateDecode images. Loaded on demand.
  Files are delivered with the share sheet on touch devices, else downloaded.
- PWA updates (`src/pwa.ts`, `injectRegister: false`): `registerSW` with autoUpdate, plus
  `registration.update()` whenever the app becomes visible again (an iPhone home-screen app
  resumes without reloading, so it would otherwise keep an old version). No timer, so an
  update never reloads mid-work; the piece is saved on `pagehide`.
- Share links: `#s=` + `z` + base64url(deflate-raw(JSON)), or `j` + base64url(JSON) without
  CompressionStream. Opening one saves it to the library as "<name> (shared)".

## Testing notes

- Accessible names must contain the visible text (WCAG 2.5.3): prefer visible text +
  `sr-only` spans or `title` over an `aria-label` that differs from what is shown.
- Lighthouse baseline: 100/100/100/100 mobile and desktop; keep it there.

- e2e coordinates come from `e2e/helpers.ts`, which mirrors `src/score/geometry.ts` constants —
  update both together. Each Playwright test gets fresh storage.

## UI conventions

- **Wording: the UI says "bars", not "cycles"** (user's choice). The code/model keeps `cycles`.
- Beat numbers are centred on their beat's tick; a differing ratio is named in the band below.
- PDF sheet: title + one meta line (beats × bars · ratios · pulses) + score rows + footer. No
  phrase line, tempo or legend (removed at the user's request).

- Mobile-first, max content width 800 px, 16 px gutters + safe areas, generous gaps (24 px).
- **Touch layout (`DOCKED` = `(max-width: 560px), (pointer: coarse)` in `components/useMedia.ts`,
  same query in global.css): phones and iPads.** The meter / brush / drag settings fold into one
  summary line (`.setup-toggle`, `ui.setupOpen`, closed by default; always open on desktop); the
  selection / caret bar renders in the dock above the number pad (name line + one sideways-scrolling
  action row) instead of under the score.
- **Phone layout (≤ 560 px, `PHONE`)** adds: compact one-line header (intro paragraph hidden),
  short transport readout, 5-column number pad, no zoom label. iPad split view narrower than
  560 px gets the phone layout automatically.
- **Touch held sideways** (`(pointer: coarse) and (orientation: landscape)`, iPad landscape):
  one-line header, intro hidden, so the score starts high above the tall dock.
- Hover looks only under `@media (hover: hover)` (a tap leaves `:hover` stuck on iPad/iPhone);
  buttons are `user-select: none` (no text selection on long press). Undo/redo live in the transport on every size. The score
  scrolls the caret / range / selection into view above the dock (`keepInView` in `Score.tsx`).
  e2e: `openSetup(page)` unfolds the settings; `score()` scrolls the score to the top.
- Default meter 4 × 2 at 4:1. Tempo 40–160, default 72.
- Writing is by digits (keyboard, or the docked number pad: 1–9, ⌫, Sound/Silence, caret ←/→;
  toggled by **123** in the transport, on by default for coarse pointers). Without a caret,
  digits go to the end of the start and the caret follows. There is no tray/Pieces panel any
  more (removed at the user's request); the engine's tray/count/fill functions remain unused
  by the UI except `fillWithSilence` and `fillWithPieces` (status-line links: "Fill with
  silence" and "Fill randomly…", whose dialog picks the allowed sizes 1–9, `ui.fillSizes`;
  the toast offers "Another" roll). Clear lives in the Library.
- Drag modes: Pulse / Beat / Place. Arrow keys follow the mode.
- Keys: Space play/stop · ←/→ move · Delete remove · M merge · S split · R silence/sound ·
  D duplicate · Z undo · Y or ⇧⌘Z redo · ⌘A / ⇧A select all · Esc clear · 1–9 type · ⌘C/X/V ·
  ⌥←/→ trim end · ⌥⇧←/→ trim start · B brush · Enter line break · P phrase mark · T modulate ·
  [ ] repeat signs · V ending · +/− on an end sign: times · F stage · G total · ⇧P name mark.
- Toasts for anything non-obvious, with Undo: a small pill (0.8rem), 1.5 s, or 3 s with a button
  (user request: they were too big and stayed too long); the button keeps a ≥ 44 px hit area. aria-live announcements. Touch targets ≥ 44 px.
- Pointer Events; `touch-action: pan-y` on the canvas (a vertical swipe scrolls the page and
  cancels the gesture; sideways drags edit). Long-press 450 ms → multi-select.
- Dock bars also offer **Select all**, **Subdivision…** (`ui.subPanel`, `SubdivPanel`: ratios for
  `beatsHere()` = beats under the selection / range / caret; `subdivideBeats` re-aims the range
  or caret at the same beats; the panel takes the number pad's place while open) and, with the
  caret at 0, **Bar before**. Keep-in-view also runs when the dock grows.
- Caret at the ends: every row has an 18 px gutter left and right (`L.margin`; the score wrap
  reaches into the panel padding so tiles stay put). `edgeSlot` (geometry.ts): a tap in a row's
  gutter (or right of a short row) puts the caret at that row's start / end, whatever tile sits
  there; at the piece's very start / end the zone also reaches ≤ half a pulse (≤ 14 px) into the
  tile. Trim grips and lines win first. The number pad (and the caret bar without it) has ⇤ / ⇥
  ("Caret to the start / end") around ← →. e2e `M` = `L.margin`.
- `prependBars(doc, n)` (engine/ops/meter.ts): n bars before the beginning, copying the first
  bar's subdivision, become the open space; everything written moves into the ending (old open
  space → silence, reported in `created`); breaks, marks, sections and repeats shift with it.
  UI: "Bar before" (caret at 0) and "+ Bar at the start" in the settings.
- `appendBars(doc, n)`: the mirror: n bars after the end (copying the last bar's subdivision and,
  with modulations, the last section's bar size) become the open space; everything written
  becomes the start and keeps its time; breaks, marks, sections and repeats stay put. UI: "Bar
  after" (caret at TS) and "+ Bar at the end"; the caret goes to the old end. The Bars stepper
  still uses `resizeMeter` (bars appear in the middle, in the open space).

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
