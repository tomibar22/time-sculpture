# UX log

A running record of the review rounds: what was found, what was changed, what is still open.
Newest round first. (Earlier rounds are summarised in CLAUDE.md: "Calm round", "Calm lists".)

## Round: the pattern panels — Fill (Browse), Land, Vary (2026-11-25)

### What each panel is for (reading the code)

- **Fill** (was "Browse fills"; `FillPanel` → `Browse`): _ways to fill a stretch_. The
  stretch is given (a range, the selected tiles, or the open space); the app proposes: shapes
  (tihai, yati, speeds, known rhythms, woven…), what is already in the piece, what you kept,
  every way (Anything), a map, A/B compare, breeding. You come here when you don't yet know what
  goes there.
- **Land** (`LandPanel`): _your pattern, made to arrive_. You bring a pattern (3 3 2, or L S S)
  and it is said again and again, as a tihai, yati, korvai, chain, halving, gati… so that it
  ends exactly on the end of the stretch. You come here when you know the material and want the
  arithmetic done.
- **Vary** (`VaryPanel`): _what is written, said another way_ in the same time: balanced
  (same sum), nearby, reordered, broader/denser, long-short, shuffled; locks; a history tree.
  You come here when something is written and almost right.
- Flow between them: Fill and Land write into the stretch and keep it selected (also the open
  space, `filledSpace`), so Vary can take what was just written. Fill's Use bar has its own
  in-place variations of the fill on trial (before writing). Hearts keep a fill (Fill, Vary);
  kept fills come back fitted to any stretch.

### What was wrong (first pass, desktop and iPhone)

- **No sense of place.** None of the three said which one you were in (only Vary had a title),
  and Close sat in three different places (Fill: end of the tools line; Land: end of the
  pattern line; Vary: its head). Esc did not close the panel; it collapsed the selection
  underneath instead.
- **No way across.** Fill → Land → Vary meant Close, find the other entry (state line, bar,
  menu), open again. The words gave no hint of the difference between them.
- **Land on an iPhone showed no ways at all.** The pattern line, the sizes, the "Last tile"
  switch, Begins and the new Lands row (last round) filled the whole panel window. The round
  that added the long forms made Land deeper and, on a phone, unusable without scrolling first.
- **Two "Vary"s.** Fill's Use bar had a "Vary" button that shows the fill on trial in other
  ways, in place; the Vary panel varies what is written. Same word, two places, two behaviours.
- **Inconsistent group headings.** Land and Vary open a kind in place ("all N" / "fewer"); Fill's
  "all N" jumped to that family (the Shape filter changed under you).
- **No way back.** Nothing remembered what you had just written; going back to "that tihai from
  before" meant finding it again. Land offered "Before it" and "Copied" but not your own
  previous patterns. Land had no heart, so a good landing could not be kept.
- **Keyboard**: ↑ ↓ walked the Fill list but not Land's or Vary's; focus previewed in Fill only.
- **Wording drift**: "Browse fills", "Refill…", "Fill again…", "Fill it…" for one panel.

How it felt: rich, but like three separate tools found in three drawers. On a phone, Land felt
like a form, not an instrument.

### What changed

1. **One head for the three** (`PanelHead` in FillPanel.tsx): **Fill · Land · Vary** tabs, the
   stretch they work on ("the open space (9 pulses)", phones: "9 pulses"), Close. Sticky. A tab
   switches on the same stretch; Vary is shown but greyed while the stretch is open space (its
   title says why), and lights up once something is written there. Each tab's title says what
   it is for. Esc now closes the panel (the selection stays). Close is in one place everywhere.
2. **Land's options fold into one line** — "Landing: on the end, beginning anywhere" — that says
   what is set ("last tile on the 1 · begins on a beat · 2 early") and opens the three controls.
   On an iPhone the first ways are now in sight under the pattern and sizes.
3. **Recent** (`ui.recentFills`, device pref, 12): whatever Fill, Land or Vary wrote is
   remembered and offered in Fill, fitted to any stretch: a chip, and the first group of "All
   shapes". Land remembers the patterns you landed (`ui.landRecent`, 4) and offers them as
   "Lately 3 3 2" beside "Before it" and "Copied".
4. **Kept** (was "Mine"): the heart is now on Land's rows too, and kept fills form their own
   group near the top of "All shapes", after Recent. One word for the heart and its list.
5. **One kind of group heading**: Fill's groups use the same `GroupHead` as Land and Vary;
   "all N" opens the kind in place (the family chips still filter).
6. **One keyboard**: ↑ ↓ Home End walk the rows in all three (`listKeys`); a row focused by the
   keys is tried in the score in all three.
7. **Words**: the panel is **Fill** everywhere it is opened (tile bar "Fill…", range bar
   "Fill…", menu "Fill…"; the state line keeps "Fill it…"); the Use bar's in-place button is
   **Variations** (not "Vary"); Vary's lock note is short ("Tap a tile to lock it").

Nothing was removed: every shape family, every Land kind and option, Compare, Breed, Map, the
tiles filter, Surprise, the Vary tree, locks and Keep the ending are where they were or one tap
further (the Land options).

### Checked after

- Scenarios again on desktop and iPhone: first time (the head names the place and the three
  roles); "something like a tihai" (Fill → Shape → Tihai, 2 taps, or Land → 3 → first group);
  free browsing (unchanged speed, groups open in place); Fill → Land → Vary → Fill without
  closing, on the same stretch; going back (Recent / Lately / Kept); Esc.
- e2e: `e2e/panels.spec.ts` (the head, switching, Vary greyed then lit, Recent, Esc, Land's
  heart, Lately, the folded options), plus the updated Fill / Land specs, on desktop, iPad and
  iPhone; unit tests, lint, typecheck, build.

### Still open / for Tomer to decide

- The head costs one line (about 44 px) in a short window, mostly on phones. It replaced three
  Close buttons and Vary's own head, and is what makes the flow possible; a round earlier asked
  for "no head row in Browse" (it then held Random / Browse / Listen). If it feels heavy, the
  tabs could move into the Fill/Land first line instead.
- Fill on a phone still spends three lines on controls before the list (head, Sizes/Shape/Tiles,
  List/Map + tools). The tools line (Compare, Breed, Surprise, List/Map) could fold too.
- Vary's own head line (lock strip + note + Keep the ending + From here) is still two lines on a
  phone.
- A search box ("tihai", "5 7 9", "clave") across Fill's names and Land's kinds was considered and
  left out: the family chips and groups already reach every kind in one or two taps.

### Diminishing returns?

Structurally, yes: the three now have one frame, one way in and across, one way back. What is
left is phone space (the controls above the list) and taste; another round would be smaller.
