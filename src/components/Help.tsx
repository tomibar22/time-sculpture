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
            <b>Shape.</b> Drag groups, drag the lines between them, select and press the buttons
            above the pad. Fill the open space, or vary a passage.
          </li>
          <li>
            <b>Listen.</b> Space plays. ⇧Space loops what is selected.
          </li>
        </ol>
        <div className="help">
          <details className="help-topic">
            <summary>Select</summary>
            <p>
              Tap a group. Shift-click selects a range, Ctrl or ⌘-click adds one. On a phone, press
              and hold a group, or turn on “Select several”, then tap more. ⌘A or ⇧A (or Select all)
              selects every group; Esc clears the selection. On a phone, swipe up and down over the
              score to scroll; drags that start sideways move and shape tiles.
            </p>
          </details>
          <details className="help-topic">
            <summary>Move</summary>
            <p>
              With <b>Pulse</b> or <b>Beat</b>, a dragged group (or a run of selected groups) slides
              along the grid in those steps. Whatever it runs into gives way: open space and
              silences shrink, sounding groups are shortened, and the time it leaves behind becomes
              silence. With <b>Place</b>, dragging reorders groups instead and the others make room.
              The arrow keys follow the same choice.
            </p>
          </details>
          <details className="help-topic">
            <summary>Reshape</summary>
            <p>
              Drag the line between two groups. Drag a green edge into the open space to stretch. To
              merge, select neighbouring groups and press Merge.
            </p>
          </details>
          <details className="help-topic">
            <summary>Trim</summary>
            <p>
              Select one group: grips appear on its edges. Drag a grip to make the group longer or
              shorter on that side; its other edge stays put. Whatever it runs into gives way, and
              time it lets go of becomes silence. Keys: ⌥← ⌥→ move the end edge, ⌥⇧← ⌥⇧→ the start
              edge (by a pulse, or by a beat in Beat mode).
            </p>
          </details>
          <details className="help-topic">
            <summary>Split</summary>
            <p>Double-tap a group, or press S.</p>
          </details>
          <details className="help-topic">
            <summary>Subdivision</summary>
            <p>
              The dotted band under each row shows the pulses of every beat (beats that differ are
              tinted, and each change of ratio is named once, in the band). Pick 1:1 to 8:1, then
              tap or drag along the band, or select groups and press B. Groups keep their moments in
              time and snap to the nearest new pulse; you can undo. Right where you work:
              Subdivision… (in the bar above the number pad) gives the beats under the selection,
              range or caret a ratio, and you can try one after another. On a phone, the brush (with
              beats, bars and drag mode) is in the line above the score.
            </p>
          </details>
          <details className="help-topic">
            <summary>Write</summary>
            <p>
              The caret sits on any pulse, like a text caret between letters: tap a line or the open
              space to place it, ⌥-click to place it inside a tile, and move it with ← → (one pulse)
              or ⌥← ⌥→ (tile to tile). Type a number (1–9) to write a group there. Inside the open
              space the gap before the caret becomes silence; inside a tile, the tile is split. On a
              phone, use the number pad (123). Tap the very start or end of the score, or use ⇤ and
              ⇥ on the pad, to put the caret there. To write an opening before what is already
              there, put the caret at the very start and tap Bar before (or + Bar at the start in
              the settings): an open bar is added in front, and what was written moves on with it,
              still landing on 1. To go on after the end, put the caret at the very end (End) and
              tap Bar after (or + Bar at the end): what was written stays where it is and the new
              bar is open to write in. (The Bars stepper adds bars in the middle, in the open
              space.)
            </p>
          </details>
          <details className="help-topic">
            <summary>Listen and loop</summary>
            <p>
              Space plays from the top; with tiles or a range selected, only the selection plays.
              The group that sounds lights up as it goes. Select tiles (or a range) and press
              ⇧Space, or ↻ Loop: that stretch plays round and round, to hear it or practise over it;
              change it while it loops and you hear the change. Tap the tempo number for exact steps
              and <b>Tap the beat</b>. In Options you can turn off the click on the beats (the 1
              always sounds) and the subdivision ticks.
            </p>
          </details>
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
              they no longer line up with full rows).
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
            <summary>Modulation</summary>
            <p>
              Put the caret on a beat line (mid-bar is fine) and press T (or Modulate…): choose the
              pulse equation, e.g. 2:1 = 3:1 (a pulse of 2:1 before equals a pulse of 3:1 after, so
              ♩ 72 becomes 48), and the bars after it. Beats keep their width on screen; the new
              section starts a new row, an amber marker names it, and dashed red lines show where
              the main tempo's bar lines fall. The status says whether the piece ends on 1 of the
              main tempo and offers whole beats to add or cut at the end. Click a marker to edit or
              remove it. With modulations, Beats regroups the main bars and Bars adds or cuts a bar
              at the end.
            </p>
          </details>
          <details className="help-topic">
            <summary>Select time</summary>
            <p>
              ⇧← ⇧→ (or ⇧-click, or Select ⇥ on a phone) select a range of pulses, whether it is
              empty, full or part of a tile. Typing over it writes there and silences the rest;
              Backspace silences it; copy, cut and paste work on it too.
            </p>
          </details>
          <details className="help-topic">
            <summary>Fill</summary>
            <p>
              Fill randomly or Browse fills work on the selected range or tiles (or on the open
              space): choose the sizes, then roll, or browse every way to fill it, sorted by tiles,
              the beat, syncopation, variety or evenness. Pointing at an option previews it. Browse
              opens on fills with a shape: repeats, growing patterns, pyramids, refrains, even
              spreads, cadences, mirrors, and the <b>tihai</b>: a phrase said three times with the
              same tile between, so the third time ends exactly on the 1.
            </p>
          </details>
          <details className="help-topic">
            <summary>Vary</summary>
            <p>
              Select a run of groups (or a range) and press Vary… (⇧V): the same stretch of time
              said another way. Backwards, starting from another group, growing or shrinking, halves
              swapped, joined in pairs, every group halved, only the attacks, every other one
              silent, or shuffled. Pointing at one previews it; everything around the passage stays
              where it is, so it still lands on 1. A tap tries a variation in the score; Use writes
              it. From here varies what is there now.
            </p>
          </details>
          <details className="help-topic">
            <summary>Copy &amp; paste</summary>
            <p>
              ⌘C / ⌘X copy or cut the selection, ⌘V pastes at the caret or over a selection. Copies
              are also plain text such as “3 (2) 4”, so you can paste a phrase typed in Notes. Copy
              as text (in the Library) copies the whole phrase that way.
            </p>
          </details>
          <details className="help-topic">
            <summary>Shape</summary>
            <p>
              + / − make the selected groups a pulse longer or shorter (the open space gives or
              takes it). Reverse (⇧R) plays a run of groups backwards.
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
          <details className="help-topic">
            <summary>Keys</summary>
            <p>
              Space play · ⇧Space loop the selection, or play from the caret · Enter line break · P
              phrase mark · T modulate · ← → move the selection or the caret · ⇧← ⇧→ select like
              text · Home / End caret to the start or end · 1–9 type · Delete remove · M merge · S
              split · D duplicate · + − resize · ⌥← ⌥→ trim · B brush · [ ] repeat signs · V ending
              · ⇧V vary · ⇧R reverse · Z undo · Y or ⇧⌘Z redo · G total · ? this help · ⇧P name a
              phrase mark · F stage · Esc clear
            </p>
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
