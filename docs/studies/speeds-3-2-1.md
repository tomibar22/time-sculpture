# Study 2 — Speeds 3 → 2 → 1 (Harikumar phrase 1)

Source: a rhythmic phrase transcribed by Tomer. File: `speeds-3-2-1.timesculpture.json` (4 beats
× 9 bars, 3 pulses a beat, ♩99; rows broken by Tomer at beats 11 and 22, one statement a row).
Test: `src/engine/__tests__/speeds.test.ts`. Land gives it back from `3 3 3 3 3`.

## The shape

```
3 3 3 3 3 · 2 2 2 2 2 · 1 1 1 1 1 · 3   (11 beats)
3 3 3 3 3 · 2 2 2 2 2 · 1 1 1 1 1 · 3   (11 beats)
3 3 3 3 3 · 2 2 2 2 2 · 1 1 1 1 1 · [3 = the 1 of bar 9]
```

## What it does

1. **One phrase at three speeds** (laykari): five strokes (the khanda count) at 1, 1½ and 3
   strokes a beat — sizes 3, 2, 1 in a beat of 3. Their durations, 15 · 10 · 5 pulses, narrow
   (gopuccha) at the run level: every statement accelerates, then a closing 3.
2. **Crosses inside, meets the beat at the seams, again**: the 2s go across the beat (two
   against three), and the run of 2s ends a third of a beat off it; the 1s bring it back, since
   2 + 1 = 3: the 2s and the 1s together are exactly 5 beats.
3. **The same arithmetic as study 1**: each statement is 11 beats, and 3 × 11 − 1 = 32: three
   statements whose last closing stroke is the 1 after 8 bars of 4. Study 1's units were
   9 · 11 · 13 (mean 11, a yati); here 11 · 11 · 11 (the plain tihai). Two players, the same count.
4. **A countdown**: the closing strokes fall on beat 3 of bar 3, beat 2 of bar 6, beat 1 of
   bar 9. 11 ≡ −1 (mod 4), so each statement lands a beat earlier in the bar until it lands on 1.
5. **The other side of study 1's inside**: there the size stays and the count grows (X · XX ·
   XXX); here the count stays and the size shrinks (5×3 · 5×2 · 5×1). Both keep a sum, so both can
   be shared out again without moving the landing.

## In the app

- **Land → Speeds** (`speedWays` in land.ts): the pattern `3 3 3 3 3`, "Last tile on the 1", 8
  bars: "Speeds 3 → 2 → 1 (faster and faster) · three times · 3 3 3 3 3 at 3 speeds, 3
  closing", fills it exactly.
- **Browse → Speeds** (`speedFills`, `speedsLabel`): ladders in simple ratios (a unit × 1–6:
  3 2 1, 4 2 1, 6 4 3 …), 3–8 strokes a speed, once or three times; named "Speeds 3 → 2 → 1
  (faster and faster), 5 each, 3 closing · ×3".
- **Vary → Balanced** (`speedBalances`): the speeds shared out again with the same sum and the
  same strokes: 1 → 2 → 3 (slower and slower), 2 → 2 → 2 (one speed), 1 → 4 → 1.
