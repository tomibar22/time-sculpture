export function Help() {
  return (
    <details className="disclosure">
      <summary>How to use it</summary>
      <div className="dbody">
        <dl className="help">
          <dt>Select</dt>
          <dd>
            Tap a group. Shift-click selects a range, Ctrl or ⌘-click adds one. On a phone, press
            and hold a group, or turn on “Select several”, then tap more. ⌘A selects all, Esc
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
          <dt>Split</dt>
          <dd>Double-tap a group, or press S.</dd>
          <dt>Subdivision</dt>
          <dd>
            Pick 1:1 to 8:1, then tap or drag along the dotted lane above a row. Groups keep their
            moments in time and snap to the nearest new pulse; you can undo.
          </dd>
          <dt>Write</dt>
          <dd>
            Tap a line between groups, or the open space, to place a caret, like in a text editor.
            Type a number (1–9) to insert a group of that length there (Shift+number inserts a
            silence), or tap a piece in the tray. Typing over selected groups replaces them.
            Backspace and Delete remove the group before or after the caret.
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
            Space play · ⇧Space play from the caret · ← → move the selection or the caret · ⇧← ⇧→
            select like text · Home / End caret to the start or end · 1–9 type · Delete remove · M
            merge · S split · R silence · D duplicate · + − resize · ⇧R reverse · Z undo · Y or ⇧⌘Z
            redo · Esc clear
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
