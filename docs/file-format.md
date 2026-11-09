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
| `sounds`            | _Derived, for other programs; ignored when the file is opened._ Every sounding group in time: `at` = onset in beats of the main tempo from the very start (0-based), `length` in main beats, `pulses`. With modulations these are real times, already converted.                                                                                                                                                    |
| `playOrder`         | _Derived, for other programs; ignored when the file is opened. Only with repeats._ The order the piece is heard in: `{ fromBeat, toBeat }` stretches of written time, with every repeat and ending played out.                                                                                                                                                                                                      |

The time between the start and the ending is the **open space**: total pulses minus all the
groups. Total pulses = the sum of `subdivision`. A file is valid when every group has at least
one pulse and the groups fit (the open space is never negative).

To turn the phrase into time yourself: pulse _j_ of beat _b_ (with _d_ pulses) starts at beat
`b + j/d`. Walk the `start` groups from pulse 0, and the `ending` groups backwards from the last
pulse; `sounds` already does this for you.

Version 1 files (from before this format) still open.
