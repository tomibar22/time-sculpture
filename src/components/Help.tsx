export function Help() {
  return (
    <details className="disclosure">
      <summary>How to use it</summary>
      <div className="dbody">
        <dl className="help">
          <dt>Select</dt>
          <dd>
            Tap a group. Shift-click selects a range, Ctrl or ⌘-click adds one. On a phone, press
            and hold a group, or turn on “Select several”, then tap more. ⌘A or ⇧A selects all, Esc
            clears.
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
            The dotted band under each row shows the pulses of every beat (a ratio badge marks beats
            that differ). Pick 1:1 to 8:1, then tap or drag along the band, or select groups and
            press B. Groups keep their moments in time and snap to the nearest new pulse; you can
            undo.
          </dd>
          <dt>Write</dt>
          <dd>
            The caret sits on any pulse, like a text caret between letters: tap a line or the open
            space to place it, ⌥-click to place it inside a tile, and move it with ← → (one pulse)
            or ⌥← ⌥→ (tile to tile). Type a number (1–9) to write a group there (Shift+number writes
            a silence). Inside the open space the gap before the caret becomes silence; inside a
            tile, the tile is split. On a phone, use the number pad (123).
          </dd>
          <dt>Rows</dt>
          <dd>
            Per row sets how many bars a row holds before the score wraps. Press Enter (or Break
            line) at the caret to start a new row there, on any pulse, even inside a beat; press it
            again at the same place to join the rows. Wrapping restarts after a break, so a phrase
            that does not start on beat 1 lines up row under row. Join rows removes every break. Fit
            rows stretches rows that end early to the full width (their beats get wider, so they no
            longer line up with full rows).
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
          <dt>Keys</dt>
          <dd>
            Space play · ⇧Space play from the caret · Enter line break · ← → move the selection or
            the caret · ⇧← ⇧→ select like text · Home / End caret to the start or end · 1–9 type ·
            Delete remove · M merge · S split · R silence · D duplicate · + − resize · ⌥← ⌥→ trim ·
            B brush · ⇧R reverse · Z undo · Y or ⇧⌘Z redo · Esc clear
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
