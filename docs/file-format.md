# The Time Sculpture file (version 2)

A composition saved from **Library → Save as a file → JSON** is a small, plain JSON file
(`<title>.timesculpture.json`). It is meant to be easy to read by people and by other programs.

```json
{
  "format": "time-sculpture",
  "version": 2,
  "title": "First phrase",
  "tempo": 72,
  "beatsPerCycle": 4,
  "cycles": 2,
  "subdivision": [4, 4, 4, 4, 4, 4, 4, 4],
  "start": [{ "pulses": 2, "rest": true }, { "pulses": 3 }, { "pulses": 3 }, { "pulses": 2 }],
  "ending": [
    { "pulses": 3 },
    { "pulses": 1, "rest": true },
    { "pulses": 3 },
    { "pulses": 2 },
    { "pulses": 4 }
  ],
  "layout": { "cyclesPerRow": 1, "breaks": [] },
  "sounds": [
    { "at": 0.5, "length": 0.75, "pulses": 3 },
    { "at": 1.25, "length": 0.75, "pulses": 3 }
  ]
}
```

| field               | meaning                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`, `version` | Always `"time-sculpture"` and `2`.                                                                                                                                                                                                                                                                                                                                                                                  |
| `title`             | The composition's name.                                                                                                                                                                                                                                                                                                                                                                                             |
| `tempo`             | Beats per minute (40–160). A beat always lasts the same time; only the pulse density changes.                                                                                                                                                                                                                                                                                                                       |
| `beatsPerCycle`     | 3–13 beats in a cycle (no denominator).                                                                                                                                                                                                                                                                                                                                                                             |
| `cycles`            | 1–32 cycles.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `subdivision`       | Pulses per beat (1–8), **one number for every beat** of the piece (`beatsPerCycle × cycles` numbers).                                                                                                                                                                                                                                                                                                               |
| `start`             | The phrase written from the top, as groups.                                                                                                                                                                                                                                                                                                                                                                         |
| `ending`            | The phrase written backwards from the end; it always ends exactly on the next beat 1.                                                                                                                                                                                                                                                                                                                               |
| group               | `{ "pulses": n }` is a sounding group of n pulses; `"rest": true` makes it silence.                                                                                                                                                                                                                                                                                                                                 |
| `layout`            | How the score is shown: `cyclesPerRow`, and `rows` (cycles in each row from the top, optional).                                                                                                                                                                                                                                                                                                                     |
| `repeats`           | Optional. `starts`: times in beats of start-repeat signs (`\|:`). `ends`: `{ atBeat, times }` end-repeat signs (`:\|`); `times` = how often the passage is played in all (2–12). An end sign without a start repeats from the previous end sign or from the top. `endings`: `{ fromBeat, toBeat, passes }` brackets ("voltas") over a stretch, played only on the listed passes (`[1]` = "1.", `[1, 2]` = "1. 2."). |
| `phraseStarts`      | Optional. Times in beats where a phrase starts (phrase marks).                                                                                                                                                                                                                                                                                                                                                      |
| `phraseNames`       | Optional. One name per phrase mark, in the same order (`""` = no name).                                                                                                                                                                                                                                                                                                                                             |
| `totals`            | Optional. `{ fromBeat, toBeat, pulses }` brackets under the score that show how many pulses a run of groups holds (`pulses` is derived).                                                                                                                                                                                                                                                                            |
| `sounds`            | _Derived, for other programs; ignored when the file is opened._ Every sounding group in time: `at` = onset in beats of the main tempo from the very start (0-based), `length` in main beats, `pulses`. With modulations these are real times, already converted.                                                                                                                                                    |
| `playOrder`         | _Derived, for other programs; ignored when the file is opened. Only with repeats._ The order the piece is heard in: `{ fromBeat, toBeat }` stretches of written time, with every repeat and ending played out.                                                                                                                                                                                                      |

The time between the start and the ending is the **open space**: total pulses minus all the
groups. Total pulses = the sum of `subdivision`. A file is valid when every group has at least
one pulse and the groups fit (the open space is never negative).

To turn the phrase into time yourself: pulse _j_ of beat _b_ (with _d_ pulses) starts at beat
`b + j/d`. Walk the `start` groups from pulse 0, and the `ending` groups backwards from the last
pulse; `sounds` already does this for you.

Version 1 files (from before this format) still open.

## Other files the app writes

- **Library backup** (`Time Sculpture library YYYY-MM-DD.json`): every composition in one file.

  ```json
  {
    "format": "time-sculpture-library",
    "version": 1,
    "saved": "2026-11-09T20:00:00.000Z",
    "pieces": [
      { "id": "c…", "updated": 1794000000000, "piece": { "format": "time-sculpture", "…": "…" } }
    ]
  }
  ```

  Each `piece` is a composition file as described above. Opening a backup in the app adds its
  pieces to the library; pieces that are already there unchanged are skipped, and nothing is
  replaced.

- **MusicXML** (`.musicxml`): the piece as written, for notation programs. One staff, every
  sounding group on the pitch B4 (ready to be given notes), a beat is a quarter note; beats of 3,
  5, 6 or 7 pulses are tuplets, groups that cross a beat are tied, silences and the open space
  are rests. Bars follow the meter (and each modulation's bar size, with its tempo); repeat signs
  and endings are written when they sit on bar lines; named phrase marks become rehearsal marks.

- **MIDI** (`.mid`, format 0, 840 ticks per beat): the piece as heard, with repeats and endings
  played out. One note per sounding group, from its onset to its end, pitched by its size as in
  the app (longer = lower). A modulation is a tempo change with its bar size as the time
  signature.
