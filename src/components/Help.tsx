export function Help() {
  return (
    <details className="disclosure">
      <summary>How to use it</summary>
      <div className="dbody">
        <dl className="help">
          <dt>Select</dt>
          <dd>
            Tap a group. Shift-click selects a range, Ctrl or ⌘-click adds one. On a phone, press
            and hold a group, or turn on “Select several”, then tap more. ⌘A or ⇧A (or Select all)
            selects every group, Esc clear · ⌥− ⌥= zoom · ⌥0 everythings. On a phone, swipe up and
            down over the score to scroll; drags that start sideways move and shape tiles.
          </dd>
          <dt>Move</dt>
          <dd>
            With <b>Pulse</b> or <b>Beat</b>, a dragged group (or a run of selected groups) slides
            along the grid in those steps. Whatever it runs into gives way: open space and silences
            shrink, sounding groups are shortened, and the time it leaves behind becomes silence.
            With <b>Place</b>, dragging reorders groups instead and the others make room. The arrow
            keys follow the same choice.
          </dd>
          <dt>Reshape</dt>
          <dd>
            Drag the line between two groups. Drag a green edge into the open space to stretch. To
            merge, select neighbouring groups and press Merge.
          </dd>
          <dt>Trim</dt>
          <dd>
            Select one group: grips appear on its edges. Drag a grip to make the group longer or
            shorter on that side; its other edge stays put. Whatever it runs into gives way, and
            time it lets go of becomes silence. Keys: ⌥← ⌥→ move the end edge, ⌥⇧← ⌥⇧→ the start
            edge (by a pulse, or by a beat in Beat mode).
          </dd>
          <dt>Split</dt>
          <dd>Double-tap a group, or press S.</dd>
          <dt>Subdivision</dt>
          <dd>
            The dotted band under each row shows the pulses of every beat (beats that differ are
            tinted, and each change of ratio is named once, in the band). Pick 1:1 to 8:1, then tap
            or drag along the band, or select groups and press B. Groups keep their moments in time
            and snap to the nearest new pulse; you can undo. Right where you work: Subdivision… (in
            the bar above the number pad) gives the beats under the selection, range or caret a
            ratio, and you can try one after another. On a phone, the brush (with beats, bars and
            drag mode) is in the line above the score.
          </dd>
          <dt>Write</dt>
          <dd>
            The caret sits on any pulse, like a text caret between letters: tap a line or the open
            space to place it, ⌥-click to place it inside a tile, and move it with ← → (one pulse)
            or ⌥← ⌥→ (tile to tile). Type a number (1–9) to write a group there (Shift+number writes
            a silence). Inside the open space the gap before the caret becomes silence; inside a
            tile, the tile is split. On a phone, use the number pad (123). Tap the very start or end
            of the score, or use ⇤ and ⇥ on the pad, to put the caret there. To write an opening
            before what is already there, put the caret at the very start and tap Bar before (or +
            Bar at the start in the settings): an open bar is added in front, and what was written
            moves on with it, still landing on 1. To go on after the end, put the caret at the very
            end (End) and tap Bar after (or + Bar at the end): what was written stays where it is
            and the new bar is open to write in. (The Bars stepper adds bars in the middle, in the
            open space.)
          </dd>
          <dt>Zoom</dt>
          <dd>
            Zoom sets how much a row holds: from 1 beat (wide beats, for fine work) to 8 bars. Pinch
            the score, use − and + above it, ⌥− and ⌥=, or ⌘/Ctrl + scroll (pinch on a trackpad).
            The score reflows like text and keeps what you are working on where it is. ⤢ (or ⌥0)
            shows the whole piece at once; tap a place in it to zoom back in there (Esc goes back
            too). The zoom is saved with the piece and the PDF prints its rows; the overview is only
            a look.
          </dd>
          <dt>Rows</dt>
          <dd>
            The zoom sets how much a row holds before the score wraps. Press Enter (or Break line)
            at the caret to start a new row there, on any pulse, even inside a beat; press it again
            at the same place to join the rows. Wrapping restarts after a break, so a phrase that
            does not start on beat 1 lines up row under row. Join rows removes every break. Fit rows
            stretches rows that end early to the full width (their beats get wider, so they no
            longer line up with full rows).
          </dd>
          <dt>Phrase marks</dt>
          <dd>
            Press P (or Phrase mark) at the caret to flag where a phrase starts, on any pulse. The
            flag shows how far it is from the previous mark, in beats, so a phrase repeating every
            3½ beats reads at a glance. P again removes it. Marks print in the PDF too.
          </dd>
          <dt>Repeats</dt>
          <dd>
            Put the caret where a repeat starts and press [ (or |: Start repeat), then where it ends
            and press ] (or :| End repeat): the passage plays twice. On the end sign, + and − (or
            the ×2 stepper) play it up to 12 times; the count shows above the sign. An end sign with
            no start before it repeats from the top, or from the previous end sign.
          </dd>
          <dt>Endings</dt>
          <dd>
            Select the stretch of a 1st ending (tiles, or a range with ⇧ arrows) and press V (or
            Ending…): pick the passes it is played on, e.g. 1. before the end sign and 2. right
            after it, or 1. 2. and 3. for a passage played three times. Tap a bracket to change or
            remove it. Playback follows the repeats and endings; the PDF and the file keep them.
          </dd>
          <dt>Modulation</dt>
          <dd>
            Put the caret on a beat line (mid-bar is fine) and press T (or Modulate…): choose the
            pulse equation, e.g. 2:1 = 3:1 (a pulse of 2:1 before equals a pulse of 3:1 after, so ♩
            72 becomes 48), and the bars after it. Beats keep their width on screen; the new section
            starts a new row, an amber marker names it, and dashed red lines show where the main
            tempo's bar lines fall. The status says whether the piece ends on 1 of the main tempo
            and offers whole beats to add or cut at the end. Click a marker to edit or remove it.
            With modulations, Beats regroups the main bars and Bars adds or cuts a bar at the end.
          </dd>
          <dt>Select time</dt>
          <dd>
            ⇧← ⇧→ (or ⇧-click, or Select ⇥ on a phone) select a range of pulses, whether it is
            empty, full or part of a tile. Typing over it writes there and silences the rest;
            Backspace silences it; copy, cut and paste work on it too.
          </dd>
          <dt>Fill</dt>
          <dd>
            Fill randomly or Browse fills work on the selected range or tiles (or on the open
            space): choose the sizes, then roll, or browse every way to fill it, sorted by tiles,
            the beat, syncopation, variety or evenness. Pointing at an option previews it.
          </dd>
          <dt>Copy &amp; paste</dt>
          <dd>
            ⌘C / ⌘X copy or cut the selection, ⌘V pastes at the caret or over a selection. Copies
            are also plain text such as “3 (2) 4”, so you can paste a phrase typed in Notes.
          </dd>
          <dt>Shape</dt>
          <dd>
            + / − make the selected groups a pulse longer or shorter (the open space gives or takes
            it). Reverse (⇧R) plays a run of groups backwards.
          </dd>
          <dt>Stage</dt>
          <dd>
            For filming a performance (F). The score alone, full screen: it follows the music, the
            sounding group lights up and played ones fade back. Count in a bar or two, choose what
            is heard (all, the click only, or nothing), and play once (it stops when it lands on 1)
            or loop. The controls fade while playing; tap to bring them back. Esc leaves.
          </dd>
          <dt>Keys</dt>
          <dd>
            Space play · ⇧Space play from the caret · Enter line break · P phrase mark · T modulate
            · ← → move the selection or the caret · ⇧← ⇧→ select like text · Home / End caret to the
            start or end · 1–9 type · Delete remove · M merge · S split · R silence · D duplicate ·
            + − resize · ⌥← ⌥→ trim · B brush · [ ] repeat signs · V ending · ⇧R reverse · Z undo ·
            Y or ⇧⌘Z redo · F stage · Esc clear
          </dd>
          <dt>Screen readers</dt>
          <dd>
            After the score there is a list of groups. Each one can be focused and selected; the
            selection bar then acts on it.
          </dd>
        </dl>
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
            <i className="lg edg" />
            stretch edge
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
