export function Help() {
  return (
    <details className="disclosure help-panel">
      <summary>How to use it</summary>
      <div className="dbody">
        <ol className="help-start">
          <li>
            <b>Write.</b> Type a number (or tap one on the pad): a group of that many pulses.
          </li>
          <li>
            <b>Plan from both ends.</b> What you write before the open space is the start; what
            comes after it is the ending, and it always lands on 1.
          </li>
          <li>
            <b>Shape.</b> Select a group: the bar above the pad has what is done most, and More the
            rest. Right-click (or hold) anything for every action on it.
          </li>
          <li>
            <b>Listen.</b> Space plays. ⇧Space loops what is selected.
          </li>
        </ol>
        <div className="help">
          <h3 className="help-group">Write and shape</h3>
          <details className="help-topic">
            <summary>Write</summary>
            <p>
              The caret sits on any pulse, like a text caret between letters: tap a line or the open
              space to place it, ⌥-click to place it inside a tile, and move it with ← → (one pulse)
              or ⌥← ⌥→ (tile to tile). Type a number (1–9) to write a group there; hold ⇧ and type
              two digits for a longer one (⇧ 1 2 = 12); on the pad, tap 10+, then the ten, then the
              size (10+ 1 2 = 12). To write a chord over a tile, select it (or put the caret after
              it) and press C or Chord…; Next goes on to the next tile, so a whole progression is
              typed in one go. Inside the open space the gap before the caret becomes silence;
              inside a tile, the tile is split. On a phone, use the number pad (123). Tap the very
              start or end of the score, or use ⇤ and ⇥ on the pad, to put the caret there. To write
              an opening before what is already there, put the caret at the very start and tap Bar
              before (or + Bar at the start in the settings): an open bar is added in front, and
              what was written moves on with it, still landing on 1. To go on after the end, put the
              caret at the very end (End) and tap Bar after (or + Bar at the end): what was written
              stays where it is and the new bar is open to write in. (The Bars stepper adds bars in
              the middle, in the open space.)
            </p>
          </details>
          <details className="help-topic">
            <summary>Select</summary>
            <p>
              Tap a group. Shift-click selects a range, Ctrl or ⌘-click adds one. ⌘A or ⇧A (or
              Select all) selects every group; Esc, or a click off the score, clears the selection.
              Select first, then edit: a drag over the score (mouse or finger) selects a stretch of
              time, starting anywhere, on a group, a line or empty time, and never moves or resizes
              anything; drag the knob under either end of the selection (or under the caret) to
              carry it on, across rows too. The page holds still under such a drag and scrolls by
              itself near the edges; a swipe that starts up or down scrolls. “Select several” lets
              you tap groups, or sweep a finger over them, to add them.
            </p>
          </details>
          <details className="help-topic">
            <summary>Select time</summary>
            <p>
              Tap the beat numbers of a bar twice to select the whole bar. ⇧← ⇧→ (or ⇧-click, or
              Select ⇥ on a phone) select a range of pulses, whether it is empty, full or part of a
              tile. Typing over it writes there and silences the rest; Backspace silences it; copy,
              cut and paste work on it too.
            </p>
          </details>
          <details className="help-topic">
            <summary>Move</summary>
            <p>
              With <b>Pulse</b> or <b>Beat</b>, a dragged group (or a run of selected groups) slides
              along the grid in those steps. Whatever it runs into gives way: open space and
              silences shrink, sounding groups are shortened, and the time it leaves behind becomes
              silence. With <b>Place</b>, dragging reorders groups instead and the others make room.
              The arrow keys follow the same choice. Several selected groups move together, even
              when they are not neighbours. Drag a group that is already selected (select it first),
              or by touch hold a finger on any group until it is picked up and drag on; drag from
              inside a selected range to move the groups in it.
            </p>
          </details>
          <details className="help-topic">
            <summary>Resize</summary>
            <p>
              Groups are not stretched by dragging. + and − (or −1 and +1) make the selected group,
              or the one just written, a pulse shorter or longer. ⌥← ⌥→ move its end edge, ⌥⇧← ⌥⇧→
              its start edge (by a pulse, or by a beat in Beat mode): its other edge stays put,
              whatever it runs into gives way, and time it lets go of becomes silence. To merge,
              select neighbouring groups and press Merge.
            </p>
          </details>
          <details className="help-topic">
            <summary>Split</summary>
            <p>Double-tap a group, or press S.</p>
          </details>
          <details className="help-topic">
            <summary>Shape</summary>
            <p>
              + / − make the selected groups a pulse longer or shorter (the open space gives or
              takes it). Reverse (⇧R) plays a run of groups backwards.
            </p>
          </details>
          <details className="help-topic">
            <summary>Copy &amp; paste</summary>
            <p>
              ⌘C / ⌘X copy or cut the selection, ⌘V pastes at the caret or over a selection. Copies
              are also plain text such as “3 (2) 4”, so you can paste a phrase typed in Notes.
              Chords come along: in the text each one stands in brackets after its size, “3[C-7(b6)]
              4[F7]”, so you can type a progression in Notes too. Copy as text (in the Library)
              copies the whole phrase that way.
            </p>
          </details>
          <details className="help-topic">
            <summary>Swap two stretches</summary>
            <p>
              Select a stretch (tiles or a range) and choose <b>Swap…</b> (X, also in the menu): it
              is marked with a dashed line. Select the other stretch and choose <b>Swap them</b> (X
              or Enter): each goes to the other’s place. When they differ in length, what lies
              between them moves along; everything before and after keeps its time. Esc cancels.
            </p>
          </details>
          <details className="help-topic">
            <summary>The menu: right-click, or hold</summary>
            <p>
              Right-click anything in the score (hold a finger on it on a phone or tablet; ⇧F10 on a
              keyboard) for a short menu about just that: a group (cut, copy, duplicate, split,
              loop, vary…), a selected range, an empty place (paste, fill it, play from here, marks
              and repeats), or, on the beat numbers, the bar. Every menu ends with the bar under the
              pointer: add a bar before or after, select it, change the metre from it, remove it. A
              finger held on a group and then dragged still moves the group.
            </p>
          </details>
          <details className="help-topic">
            <summary>Undo by touch</summary>
            <p>
              A double tap with two fingers undoes; a double tap with three fingers redoes. The
              arrows in the transport, Z and Y do the same.
            </p>
          </details>
          <h3 className="help-group">Fill, vary, land</h3>
          <details className="help-topic">
            <summary>Fill</summary>
            <p>
              <b>Fill it…</b> (beside what is left to go) works on the selected range or tiles, or
              on the open space: choose the sizes, then browse every way to fill it, as a list or as
              a map. A tap tries a fill in the score and Play loops the stretch so it is heard; Use
              writes it. Surprise (the dice) writes one at random. Browse opens on fills with a
              shape: repeats, growing patterns, pyramids, refrains, even spreads, cadences, mirrors,
              and the <b>tihai</b>: a phrase said three times with the same tile between, so the
              third time ends exactly on the 1. <b>All shapes</b> lists a few fills of every kind
              under its name, with the way to all of that kind; ↑ ↓ walk the list. A <b>Yati</b>{' '}
              says a cell three times, its main size growing or shrinking around a mean (5 7 9), so
              it lands where three of the middle one would. <b>Speeds</b> says one phrase faster and
              faster (3 3 3 · 2 2 2 · 1 1 1). The sort{' '}
              <b>Across inside, on the beat at the seams</b> puts first the fills whose phrases
              cross the beat but begin and end on it. <b>Known rhythms</b> are fills with a name
              (tresillo, cinquillo, the claves, bossa, bembé, aksak), at any breadth that fits;{' '}
              <b>Rotating</b> starts a cell one group later each time. <b>From the piece</b> takes
              what is written just before the region, and the opening, and says it again there: as
              it is, backwards, turned.
            </p>
            <p>
              <b>Tiles</b> narrows the fills to those with a set number of tiles. Almost right? Tap
              a fill to try it, then <b>Variations</b> beside Use: the list becomes that fill said
              other ways (nudged, swapped, rotated, backwards, regrouped), without anything being
              written. Tap one to try it, Use to write it, Variations again to go further, ‹ Back to
              return. In Fill, Land and Vary alike, every kind shows its first few; <b>all N</b>{' '}
              beside its name opens the rest.
            </p>
            <p>
              <b>Fill · Land · Vary</b> share one head: Fill proposes ways to fill the stretch, Land
              makes a pattern of yours arrive exactly at its end, Vary says what is written there
              another way. Switch between them on the same stretch; Esc closes. <b>Recent</b> holds
              what you wrote lately from any of the three, <b>Kept</b> what you kept with the heart
              (in all three), both fitted to the stretch; Land offers the patterns you landed lately
              when its pattern is empty.
            </p>
          </details>
          <details className="help-topic">
            <summary>Vary</summary>
            <p>
              Select a run of groups (or a range) and press Vary… (⇧V): the same stretch of time
              said another way. Nearby (a line nudged, two neighbours swapped), reordered
              (backwards, starting from another group, halves swapped), broader or denser (joined in
              pairs, every group halved), or shuffled. <b>Same long and short</b> hears the passage
              as long and short tiles (3 3 2 is L L S) and gives other sizes with that shape. Tap
              groups first to lock them in place. Pointing at one previews it; everything around the
              passage stays where it is, so it still lands on 1. A tap tries a variation in the
              score; Use writes it. From here varies what is there now. <b>Keep the ending</b> locks
              the passage’s last third, so every variation rhymes on the same cadence (as a kaida’s
              variations do).
            </p>
            <p>
              <b>Balanced</b> comes first: when the passage is a cell said again (a tihai, a repeat,
              a yati), its main size is shared out again with the same sum: three 7s become 5 7 9 or
              9 7 5, and back; the sum is shown (5+7+9 = 3×7). Any passage can also slow down or
              speed up, written out, every tile a step longer or shorter, in the same time. One
              level down, <b>Inside</b> shares out the runs of the main size within the cell (X · X
              X · X X X becomes X X X · X X · X, or X X · X X · X X). And <b>Gaps give / take</b>{' '}
              trades between the breath and the cells: 6 6 before each becomes 6 while every cell’s
              main size grows by one (5 7 9 → 6 8 10), or the other way round. <b>Speeds</b>: a
              phrase said at several speeds (3 3 3 3 3 · 2 2 2 2 2 · 1 1 1 1 1) can be said slower
              and slower, or at one speed, with the same strokes in the same time. And <b>across</b>{' '}
              the statements, the inner shape can change from one to the next: 3 2 1, then 2 2 2,
              then 1 2 3 (turning round), or only the last one as written (arriving at it); every
              statement keeps its length.
            </p>
          </details>
          <details className="help-topic">
            <summary>Land a pattern (tihais, crossing patterns)</summary>
            <p>
              How many fives fit before the 1, and where must they begin? Select a stretch (or use
              the open space), choose <b>Land…</b>, and tap sizes to build a pattern: one tile, or a
              whole phrase. Every way it ends exactly on the end of the stretch is listed: said 4
              times, 3 times… with the place where it must begin; as a tihai (three times, the gap a
              tile of its own between them) or any number of times with a gap; and shaped: worn
              away, built up, broad then as written, running through. Tap one to see and hear it in
              the score, Use to write it. What is before its first tile stays as it is. With an
              empty pattern, <b>Before it</b> takes the strokes written just before the stretch, and
              <b>Copied</b> what was copied last.
            </p>
            <p>
              <b>Yati</b>: the pattern said three times, its main size (the one it has most of)
              changing each time while the rest stays: 5 → 7 → 9 widening, 9 → 7 → 5 narrowing, or
              swelling and pinched. 5 + 7 + 9 = 3 × 7, so it lands exactly where three 7s would:
              take from one time, give to another, and the landing stays. Gaps of whole beats are
              written as beat strokes; “before each” puts the gap before every time.
            </p>
            <p>
              <b>Speeds</b>: the pattern said again with shorter strokes, faster and faster (3 3 3 3
              3 → 2 2 2 2 2 → 1 1 1 1 1), or slower and slower, once or three times, with a closing
              stroke of the slowest size; or with the speeds turning round from one time to the next
              (3 2 1 | 2 2 2 | 1 2 3).
            </p>
            <p>
              <b>Long forms</b>: a <b>Korvai</b> (a yati of strokes, 6 5 4 3 2 1, drawn into a tihai
              of the pattern; ×3 when only the third time lands), a <b>Tihai of tihais</b> (nine
              statements: the row says where the inner tihais land, 2 before 1, 1 before 1, on 1;{' '}
              <b>Farmaishi</b> when they fall on the 1 one after another), a <b>Chain of tihais</b>{' '}
              (the statements shrink as the gaps grow, so one still begins every so many pulses),
              the <b>Tail</b> (a pattern of 3–5 phrases: abcd ×3, bcd ×2, cd, c, each phrase
              stretched or shortened so it lands: 3a+5b+7c+6d), <b>Halving</b> (kuraippu: the last
              half each time, its start halving too, 8 → 4 → 2 → 1, once or traded) and <b>Gati</b>{' '}
              (the same strokes at three speeds of the beat: the beats change their subdivision, 2 →
              3 → 6, faster and faster).
            </p>
            <p>
              <b>Lands</b> ‹ › « »: land early (anagat: a pulse or a beat before the end, with air
              after it, or on the 1 of an imagined bar) or late (atit: it runs on past the end).
            </p>
            <p>
              <b>Last tile on the 1</b>: as in a tihai, the pattern’s last tile begins exactly where
              the stretch ends, so it is not written (the 1 is that stroke). <b>Begins</b> keeps
              only the ways that start on a beat, or on a 1.
            </p>
            <p>
              <b>L·S</b> builds the pattern of long and short tiles instead of sizes (tap Long and
              Short, or press L and S): “L S S”. Every way to give them sizes is listed, every long
              longer than every short: <b>Even</b> (one size for the longs and one for the shorts, 4
              : 2, said as many times as fit) and <b>Free</b> (the longs or the shorts of different
              sizes, filling the stretch once).
            </p>
          </details>
          <details className="help-topic">
            <summary>Outline</summary>
            <p>
              The outline button (beside the zoom) or <b>O</b> hangs brackets under the score for
              the statements of what is written: the three of a tihai or a yati, a korvai’s yati and
              its mora, and inside a tihai of tihais its small tihais too. Each statement says where
              it lands (where the stroke after it begins): on 1, on beat 3, 2 before 1… so the long
              arithmetic can be followed. Of the selection when there is one, else of all that is
              written.
            </p>
          </details>
          <h3 className="help-group">Listen and practise</h3>
          <details className="help-topic">
            <summary>Listen and loop</summary>
            <p>
              <b>Practice</b>: the metronome beside Play opens three pages (Play still starts and
              stops while it is open, so every change is heard at once). On the first, the tempo can
              be typed or tapped; <b>Count-in</b> (1 or 2 bars) counts the bar in, large in the
              middle of a softened screen, then plays (a tap on the count stops), and can tick the
              subdivision too. <b>Tiles</b>: Silent leaves only the click, so the rhythm is yours to
              play; In turn plays so many times round with the tiles and so many with the click
              alone (the score goes grey while they are silent). <b>Speed up</b> lets the tempo
              climb while it plays, so many faster every so many times round, up to a tempo; the
              piece’s own tempo is not changed, and Stop goes back to it. <b>The 1 silent</b> leaves
              the piece’s 1 unheard (no click, no stroke on it): feel where it lands. On the Click
              page, <b>Hidden beat</b> clicks every so many pulses from where playing begins, a
              larger pulse over the written one (a tihai built of 3s is felt in 3s).
            </p>
            <p>
              <b>Mix</b>: how loud the drum, the 1 of every bar, the other beats and the subdivision
              are. Each fader is on its own; pulled to nothing, its voice is off.
            </p>
            <p>
              <b>Click pattern</b> makes the click a rhythm of its own. The bar is shown as it is:
              every beat a numbered cell, then a dot for each pulse inside it. Tap the beats and the
              pulses that should click: only beats 2 and 4, a different pulse in every beat, or a
              single sixteenth in the whole bar (<b>Clear the bar</b>, then tap it). A pulse you
              pick sounds as a clear click. <b>Every beat</b> sets a dot in all the beats at once.
              <b>+</b> makes a cycle of bars, each with a pattern of its own (new bars are silent),
              so the 1 can sound once in four bars. The chips at the top are patterns to start from
              (2 and 4, only the 1, off-beats, two bars on and two off). While a pattern is on, the
              band under the tiles shows it: a pulse that clicks has a head on its tick, a silent
              one is faint, so you see where the click falls against what you wrote. Switched off,
              the click is the plain one again and the pattern is kept.
            </p>
            <p>
              Play starts at the caret when there is one (Esc removes it; then Play starts at the
              top, or where you set it). Space always plays and stops, whatever was clicked last.
            </p>
            <p>
              Space plays from the top; with tiles or a range selected, the selection loops until
              you stop it. To start somewhere else, tap “from the top” beside Play and choose a bar
              by its number, or place the caret and press ▶ Start here: a green flag marks the place
              and Play starts (and comes round again) from there until you take it away. While it
              plays, the score keeps the playing row in sight and a tap on the beat numbers jumps
              there. The group that sounds lights up as it goes. Select tiles (or a range) and press
              ⇧Space, or ↻ Loop: that stretch plays round and round, to hear it or practise over it;
              change it while it loops and you hear the change. Tap the tempo number for exact steps
              and <b>Tap the beat</b>, or type it. The click on the beats and the subdivision ticks
              can be turned off in the metronome’s Mix (or in Options); the 1 of a bar always
              sounds.
            </p>
          </details>
          <details className="help-topic">
            <summary>Stage</summary>
            <p>
              For filming a performance (F). The score alone, full screen: it follows the music, the
              sounding group lights up and played ones fade back. Count in a bar or two, choose what
              is heard (all, the click only, or nothing), and play once (it stops when it lands on
              1) or loop. The controls fade while playing; tap to bring them back. Esc leaves. Build
              (B) is a second presentation, for talking it through: the score fills in one group per
              click (a tap on the score, → or Space, or a presentation remote), from the start or
              from the end; ← takes the last one back. Totals and phrase marks appear with their
              groups.
            </p>
          </details>
          <h3 className="help-group">Time and form</h3>
          <details className="help-topic">
            <summary>Subdivision</summary>
            <p>
              The dotted band under each row shows the pulses of every beat (beats that differ are
              tinted, and each change of ratio is named once, in the band). Tap a beat in the band,
              or drag along it to pick several (⇧ reaches on): the ratios 1:1 to 8:1 open above the
              transport, and you can try one after another. “Every beat” picks the whole piece.
              Groups keep their moments in time and snap to the nearest new pulse; you can undo.
              Subdivision… (in the bar above the number pad) or B does the same for the beats under
              the selection, range or caret.
            </p>
          </details>
          <details className="help-topic">
            <summary>Bars and metre</summary>
            <p>
              <b>To remove a bar</b>: right-click (or hold) its beat numbers and choose Remove bar;
              the bar turns red before it goes. Or select bars (tap a bar’s numbers twice, drag on
              along the numbers for more) and tap Remove bars in the bar below, or press ⌫ twice:
              once empties them, once more takes the bars away. ⇧⌫ removes the bars under the caret
              or the selection at once. What comes after moves up; Undo brings it all back.
            </p>
            <p>
              <b>Bars…</b> (at the caret, or “Add or remove bars…” in the settings) adds any number
              of bars before or after any bar, or removes a run of bars with what is in it; the
              music after them moves along with its marks. Duplicate (D) never needs room made for
              it: with no space left, the bars it needs are added at the end, and the same goes for
              writing on with the caret at the very end of a full piece. <b>Metre…</b> changes the
              bars without touching the tempo, the subdivision or what is written: one bar size, or
              a pattern that goes round. 42 beats in bars of 7 become 5 + 5 + 4 three times by
              setting the bars to 5, 5, 4. From the settings it is the whole piece; at the caret on
              a beat line, from there on. The new bars are named above the row; tap the name to
              change them.
            </p>
          </details>
          <details className="help-topic">
            <summary>Modulation</summary>
            <p>
              Put the caret on a beat line (mid-bar is fine) and press T (or Modulate…): choose the
              pulse equation, e.g. 2:1 = 3:1 (a pulse of 2:1 before equals a pulse of 3:1 after, so
              ♩ 72 becomes 48), and the bars after it. Beats keep their width on screen; the new
              section starts a new row, an amber marker above the row names it, and dashed red lines
              show where the main tempo's bar lines fall. The status says whether the piece ends on
              1 of the main tempo and offers whole beats to add or cut at the end. Click a marker to
              edit or remove it. With modulations, Beats regroups the main bars and Bars adds or
              cuts a bar at the end.
            </p>
          </details>
          <details className="help-topic">
            <summary>Repeats</summary>
            <p>
              Put the caret where a repeat starts and press [ (or |: Start repeat), then where it
              ends and press ] (or :| End repeat): the passage plays twice. On the end sign, + and −
              (or the ×2 stepper) play it up to 12 times; the count shows above the sign. An end
              sign with no start before it repeats from the top, or from the previous end sign.
            </p>
          </details>
          <details className="help-topic">
            <summary>Endings</summary>
            <p>
              Select the stretch of a 1st ending (tiles, or a range with ⇧ arrows) and press V (or
              Ending…): pick the passes it is played on, e.g. 1. before the end sign and 2. right
              after it, or 1. 2. and 3. for a passage played three times. Tap a bracket to change or
              remove it. Playback follows the repeats and endings; the PDF and the file keep them.
            </p>
          </details>
          <details className="help-topic">
            <summary>Totals</summary>
            <p>
              Select a run of groups (or a range) and press G (or Total): a bracket under the score
              shows how many pulses they hold, so 3 3 2 reads as 8. Totals can nest: 3 3 under 6,
              and 6 2 under 8. Tap a bracket to select what it spans; G again (or Remove total)
              removes it.
            </p>
          </details>
          <details className="help-topic">
            <summary>Phrase marks</summary>
            <p>
              Press P (or Phrase mark) at the caret to flag where a phrase starts, on any pulse.
              Give it a name of your own with ⇧P (or Name…, or tap its flag), or leave it as just a
              mark. P again removes it. Marks print in the PDF too.
            </p>
          </details>
          <h3 className="help-group">The page</h3>
          <details className="help-topic">
            <summary>Zoom</summary>
            <p>
              Zoom sets how much a row holds: from 1 beat (wide beats, for fine work) to 8 bars.
              Pinch the score, use − and + above it, ⌥− and ⌥=, or ⌘/Ctrl + scroll (pinch on a
              trackpad). The score reflows like text and keeps what you are working on where it is.
              ⤢ (or ⌥0) shows the whole piece at once; tap a place in it to zoom back in there (Esc
              goes back too). The zoom is saved with the piece and the PDF prints its rows; the
              overview is only a look.
            </p>
          </details>
          <details className="help-topic">
            <summary>Rows</summary>
            <p>
              The zoom sets how much a row holds before the score wraps. Press Enter (or Break line)
              at the caret to start a new row there, on any pulse, even inside a beat; press it
              again at the same place to join the rows. Wrapping restarts after a break, so a phrase
              that does not start on beat 1 lines up row under row. Join rows removes every break.
              Fit rows stretches rows that end early to the full width (their beats get wider, so
              they no longer line up with full rows). <b>Row…</b> at the caret gives that row its
              own number of bars, for that row only or for every row from it on, whatever the zoom.
            </p>
          </details>
          <details className="help-topic">
            <summary>Library and files</summary>
            <p>
              Tap the name at the top to rename the piece. The Library keeps every composition on
              this device, each with a small picture. New: Blank, Same grid (this meter and its
              subdivisions, empty), Duplicate, or Surprise me (a meter and a shaped phrase that
              already lands on 1, to answer or bend). Save and share: a PDF or a picture of the
              sheet; MusicXML for Dorico, Sibelius or MuseScore (the rhythm as notes on one pitch,
              ready to be given notes; tuplets, ties, bars, modulations, repeats on bar lines); MIDI
              as it is heard; JSON, the composition itself; a share link. <b>Back up everything</b>
              saves the whole library as one file; Open a file brings a composition or a backup in
              (nothing is ever replaced).
            </p>
          </details>
          <details className="help-topic" id="help-keys">
            <summary>Keys</summary>
            <p>
              Nothing needs selecting first: a key works on the selection, else on the range, else
              on the group at the caret. So “3 + D D” writes 4 4 4.
            </p>
            <div className="keys">
              <section>
                <h4>Write</h4>
                <dl>
                  <dt>
                    <kbd>1–9</kbd>
                  </dt>
                  <dd>write a group at the caret</dd>
                  <dt>
                    <kbd>⇧ + 1 2</kbd>
                  </dt>
                  <dd>a group of two digits (12): hold ⇧, type both digits</dd>
                  <dt>
                    <kbd>C</kbd>
                  </dt>
                  <dd>a chord over the tile (Enter or Tab goes on to the next tile)</dd>
                  <dt>
                    <kbd>+ −</kbd>
                  </dt>
                  <dd>the group just written (or the selection) a pulse longer / shorter</dd>
                  <dt>
                    <kbd>D</kbd>
                  </dt>
                  <dd>the same again: the group at the caret, the selection or the range</dd>
                  <dt>
                    <kbd>S</kbd> <kbd>M</kbd>
                  </dt>
                  <dd>split · merge</dd>
                  <dt>
                    <kbd>⇧R</kbd>
                  </dt>
                  <dd>backwards</dd>
                  <dt>
                    <kbd>\</kbd>
                  </dt>
                  <dd>section end: a double bar line at the caret, or after the selection</dd>
                  <dt>
                    <kbd>R</kbd>
                  </dt>
                  <dd>repeat signs around the selection, |: and :| at once (again: off)</dd>
                  <dt>
                    <kbd>X</kbd>
                  </dt>
                  <dd>
                    swap: marks the selection, then swaps it with the next one you select (X or
                    Enter)
                  </dd>
                  <dt>
                    <kbd>⌫</kbd> <kbd>Del</kbd>
                  </dt>
                  <dd>remove the group before / after the caret; empty a range</dd>
                  <dt>
                    <kbd>⇧⌫</kbd>
                  </dt>
                  <dd>remove the bar</dd>
                </dl>
              </section>
              <section>
                <h4>Move about</h4>
                <dl>
                  <dt>
                    <kbd>← →</kbd>
                  </dt>
                  <dd>the caret by a pulse (selected groups move instead)</dd>
                  <dt>
                    <kbd>↑ ↓</kbd>
                  </dt>
                  <dd>the caret to the row above / below</dd>
                  <dt>
                    <kbd>⌥← ⌥→</kbd>
                  </dt>
                  <dd>from group to group (selected groups: trim the end; with ⇧ the start)</dd>
                  <dt>
                    <kbd>⌘← ⌘→</kbd>
                  </dt>
                  <dd>to the bar line before / after</dd>
                  <dt>
                    <kbd>Home</kbd> <kbd>End</kbd>
                  </dt>
                  <dd>to the very start / end</dd>
                </dl>
              </section>
              <section>
                <h4>Select</h4>
                <dl>
                  <dt>
                    <kbd>⇧ + any of those</kbd>
                  </dt>
                  <dd>select like text</dd>
                  <dt>
                    <kbd>⌘A</kbd> or <kbd>⇧A</kbd>
                  </dt>
                  <dd>every group</dd>
                  <dt>
                    <kbd>Esc</kbd>
                  </dt>
                  <dd>let go: range → caret → nothing</dd>
                  <dt>
                    <kbd>⌘C ⌘X ⌘V</kbd>
                  </dt>
                  <dd>copy, cut, paste</dd>
                </dl>
              </section>
              <section>
                <h4>Listen</h4>
                <dl>
                  <dt>
                    <kbd>Space</kbd>
                  </dt>
                  <dd>play / stop (a selection loops)</dd>
                  <dt>
                    <kbd>⇧Space</kbd>
                  </dt>
                  <dd>loop the selection, or play from the caret</dd>
                  <dt>
                    <kbd>⌥↑ ⌥↓</kbd>
                  </dt>
                  <dd>tempo one faster / slower (with ⇧: five)</dd>
                  <dt>
                    <kbd>K</kbd>
                  </dt>
                  <dd>the metronome: practice, click pattern, mix</dd>
                </dl>
              </section>
              <section>
                <h4>Shape the piece</h4>
                <dl>
                  <dt>
                    <kbd>⇧F</kbd>
                  </dt>
                  <dd>fill: browse ways to fill the stretch</dd>
                  <dt>
                    <kbd>L</kbd>
                  </dt>
                  <dd>land a pattern</dd>
                  <dt>
                    <kbd>⇧V</kbd>
                  </dt>
                  <dd>vary</dd>
                  <dt>
                    <kbd>B</kbd>
                  </dt>
                  <dd>subdivision of the beats here</dd>
                  <dt>
                    <kbd>T</kbd>
                  </dt>
                  <dd>modulate</dd>
                  <dt>
                    <kbd>Enter</kbd>
                  </dt>
                  <dd>line break</dd>
                  <dt>
                    <kbd>P</kbd> <kbd>⇧P</kbd>
                  </dt>
                  <dd>phrase mark · name it</dd>
                  <dt>
                    <kbd>G</kbd>
                  </dt>
                  <dd>total</dd>
                  <dt>
                    <kbd>U</kbd>
                  </dt>
                  <dd>mute: nothing sounds there</dd>
                  <dt>
                    <kbd>O</kbd>
                  </dt>
                  <dd>outline: the statements, and where each lands</dd>
                  <dt>
                    <kbd>[ ]</kbd>
                  </dt>
                  <dd>repeat signs (+ − on an end sign: times)</dd>
                  <dt>
                    <kbd>V</kbd>
                  </dt>
                  <dd>ending</dd>
                </dl>
              </section>
              <section>
                <h4>Everything else</h4>
                <dl>
                  <dt>
                    <kbd>Z</kbd> <kbd>Y</kbd>
                  </dt>
                  <dd>undo · redo (also ⌘Z, ⇧⌘Z)</dd>
                  <dt>
                    <kbd>⌥= ⌥− ⌥0</kbd>
                  </dt>
                  <dd>zoom in, out, the whole piece</dd>
                  <dt>
                    <kbd>F</kbd>
                  </dt>
                  <dd>stage</dd>
                  <dt>
                    <kbd>⇧F10</kbd>
                  </dt>
                  <dd>the menu for what is selected</dd>
                  <dt>
                    <kbd>?</kbd>
                  </dt>
                  <dd>these keys</dd>
                </dl>
              </section>
            </div>
          </details>
          <details className="help-topic">
            <summary>Screen readers</summary>
            <p>
              After the score there is a list of groups. Each one can be focused and selected; the
              selection bar then acts on it.
            </p>
          </details>
        </div>
        <div className="legend" aria-hidden="true">
          <span>
            <i className="lg snd" />
            sound
          </span>
          <span>
            <i className="lg rst" />
            silence (just empty time)
          </span>
          <span>
            <i className="lg opn" />
            open space
          </span>
          <span>
            <i className="lg sl" />
            selected
          </span>
        </div>
      </div>
    </details>
  );
}
