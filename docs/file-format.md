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
  "layout": { "cyclesPerRow": 1, "rows": [] },
  "sounds": [
    { "at": 0.5, "length": 0.75, "pulses": 3 },
    { "at": 1.25, "length": 0.75, "pulses": 3 }
  ]
}
```

| field               | meaning                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`, `version` | Always `"time-sculpture"` and `2`.                                                                                                                                                 |
| `title`             | The composition's name.                                                                                                                                                            |
| `tempo`             | Beats per minute (40–160). A beat always lasts the same time; only the pulse density changes.                                                                                      |
| `beatsPerCycle`     | 3–13 beats in a cycle (no denominator).                                                                                                                                            |
| `cycles`            | 1–32 cycles.                                                                                                                                                                       |
| `subdivision`       | Pulses per beat (1–8), **one number for every beat** of the piece (`beatsPerCycle × cycles` numbers).                                                                              |
| `start`             | The phrase written from the top, as groups.                                                                                                                                        |
| `ending`            | The phrase written backwards from the end; it always ends exactly on the next beat 1.                                                                                              |
| group               | `{ "pulses": n }` is a sounding group of n pulses; `"rest": true` makes it silence.                                                                                                |
| `layout`            | How the score is shown: `cyclesPerRow`, and `rows` (cycles in each row from the top, optional).                                                                                    |
| `sounds`            | _Derived, for other programs; ignored when the file is opened._ Every sounding group in time: `at` = onset in beats from beat 1 of cycle 1 (0-based), `length` in beats, `pulses`. |

The time between the start and the ending is the **open space**: total pulses minus all the
groups. Total pulses = the sum of `subdivision`. A file is valid when every group has at least
one pulse and the groups fit (the open space is never negative).

To turn the phrase into time yourself: pulse _j_ of beat _b_ (with _d_ pulses) starts at beat
`b + j/d`. Walk the `start` groups from pulse 0, and the `ending` groups backwards from the last
pulse; `sounds` already does this for you.

Version 1 files (from before this format) still open.
