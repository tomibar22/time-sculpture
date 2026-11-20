# Study 1 — Yati 5 → 7 → 9 (recorded Indian composition)

Source: a rhythmic composition by an Indian player, transcribed by Tomer from a recording.
File: `yati-5-7-9.timesculpture.json` (4 beats × 8 bars, 6 pulses a beat, ♩160).
Test: `src/engine/__tests__/yati.test.ts` — Land gives this piece back from its middle cell.

## The shape (Tomer's reading)

The 6 that follows the X's closes each cell; the last cell's closing 6 is the 1 after the
piece (not in the file).

```
6 6 | 5 3 5 5 3 5 5 5 6 | 6 6 | 7 3 7 7 3 7 7 7 6 | 6 6 | 9 3 9 9 3 9 9 9 [6 = the 1]
```

| unit           | beats           |
| -------------- | --------------- |
| `6 6` + cell 5 | 9               |
| `6 6` + cell 7 | 11              |
| `6 6` + cell 9 | 13              |
| total          | 33 = 32 + the 1 |

## What it does

1. **A cell with a variable**: `X 3 X X 3 X X X 6`. The 3s (half a beat, "ta-ki-ta") and the
   closing 6 stay; only X changes: 5, 7, 9 = khanda, misra, sankeerna jati.
2. **It always lands on a beat, whatever X is**: six X's in a beat of six pulses, so the cell is
   (X + 2) beats. It crosses inside and is aligned at the seams. `X 3 X X` is exactly half, so
   the second 3 always falls on a beat — a hidden anchor in the middle of each cell.
3. **Balance**: 5 + 7 + 9 = 3 × 7, so it lands exactly where the plain tihai of the 7s would.
   Any three sizes with the same mean do: widening (srotovaha), narrowing (gopuccha), swelling
   (mridanga, m−d m+2d m−d), pinched (damaru, m+d m−2d m+d).
4. **No remainder**: the opening `6 6` equals the gaps — the piece is three units of
   `6 6 + cell`. With 8 bars of 4 and the last stroke on the 1, 3·(m + 4) − 1 = 32 forces
   m = 7: the misra in the middle comes from the length.
5. **Growth at two levels**: inside the cell X, XX, XXX (1, 2, 3) with a 3 between; across the
   piece 5 → 7 → 9 with `6 6` between.
6. **The small landings make an arc**: cell 5 closes on the 1 of bar 3 (a foretaste), cell 7 on
   beat 4 of bar 5 (displaced, tension), cell 9 on the real 1.
7. **It grows clearer**: 5 and 7 fall off the half-beat grid; 9 = 1½ beats puts every onset of
   the last cell on a half beat (hemiola), with the longest, deepest strokes.

## In the app

- **Land → Yati** (engine/yati.ts, `yatiWays` in land.ts): enter the cell (`7 3 7 7 3 7 7 7 6`),
  turn on "Last tile on the 1": "Widening 5 → 7 → 9 · 6 6 before each · fills it exactly".

## Still to learn from it

- Vary: a plain tihai (A gap A gap A) → widening / narrowing / swelling / pinched, same length.
- Browse: a Yati family, and a measure "crosses inside, aligned at the seams".
- Recognition: `shapeOf` naming a written passage as a yati of a template.
