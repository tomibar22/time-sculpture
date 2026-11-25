# Studies 3–6 — Long forms from the literature

Source: Tomer's research report on long rhythmic phrases in Carnatic and Hindustani music
(statement + gap; threefold repetition, ordered change of size, a kept sum). Four examples the
report takes from documented sources were written into files the app gives back. Tests:
`src/engine/__tests__/studies.test.ts`. The engine is `src/engine/longforms.ts` (Land) and
`src/engine/outline.ts` (the outline in the score).

Convention (Nelson): a gap is a tile of its own, and it sounds (nothing is written as silence in
the app); a statement lands where the stroke after it begins.

## Study 3 — a mora with eduppu (U. Shrinivas, after Field 2018)

`mora-shrinivas.timesculpture.json`: rupaka, 3 beats of 4 pulses, 2 cycles (24 pulses).

```
[1] 3 [7] 3 [7] 3 → 1
```

23 pulses do not fill 24: the mora starts on the second pulse (the eduppu). Land: pattern `3` →
Tihai · gap 7, "from bar 1, beat 1 +1/4". The outline shows the three short statements and where
each lands.

## Study 4 — the tail korvai (Palani Subramania Pillai, after Nelson)

`tail-pillai.timesculpture.json`: adi, 8 beats of 4, 3 cycles (96 pulses).

```
10 4 4 3 | 10 4 4 3 | 10 4 4 3 | 4 4 3 | 4 4 3 | 4 3 | 4 → 1
```

abcd ×3, bcd ×2, cd, c: 3a + 5b + 7c + 6d = 96. Land → Tail (`tailWays`): as written when it
fits, and every way to stretch or shorten the phrases so that it fills the stretch, the fewest
changes first. In 112 pulses (misra) it finds Nelson's "a+2 b+2".

## Study 5 — kuraippu 8 4 2 1 (T. Viswanathan, after Nelson)

`kuraippu-viswanathan.timesculpture.json`: adi, 8 cycles (256 pulses).

```
[8] 3 3 3 5 3 3 3 5 3 3 3 5 7 7   (×2)
[4]               3 3 3 5 7 7     (×2)
[2]                       7 7     (×2)
[1]                         7     (×4)
```

Each stage is the last half of the one before and its eduppu halves too, so every stage takes
half the time (64 → 32 → 16 → 8): two drummers trading. Land → Halving (`halvingWays`): once
each, or traded (twice each, the last four times). The eduppu before a later stage rings on
from the stroke before it (a silence after a stroke sounds like a longer one), so the 7 before
"[4]" is written 11; the first eduppu is the lead.

## Study 6 — a compound mora (after Nelson)

`compound-mora.timesculpture.json`: adi, 4 cycles (128 pulses).

```
2 2 3 1 2 3 1 3 3   ×3                                  (60)
4 [3] 4 [3] 4 [7] 4 [3] 4 [3] 4 [7] 4 [3] 4 [3] 4 → 1   (68)
```

A mora whose statements are moras: nine small landings grouped in threes. Land → Tihai of
tihais (`nestedWays`, pattern `4`, 68 pulses, 3 inside and 7 between): the row says where the
inner tihais land. The outline draws both levels.

## Also from the report, in the app

- Korvai (T7, T8): Land → Korvai, a yati of strokes into a mora; ×3 when only the third lands.
- Chain of tihais (T14): Land → Chain, statements shrink while the gaps grow (one every 6).
- Farmaishi (T12): a tihai of tihais whose inner landings fall on the 1 along the diagonal is
  marked "Farmaishi" and listed first.
- Gati (T17): Land → Gati, the same strokes at three speeds of the beat (subdivisions change).
- Anagat / atit / an imagined bar (T4, X2): Land → Lands ‹ › « »: early (air after it), late.
- Woven yatis (T16): Browse → Woven, pairs of the same sum, one growing, one shrinking.
- Hidden beat (T18): the practice popover's Click page, a click every N pulses.
- Kaida's rhyme (T6): Vary → Keep the ending.
- The silent 1 (X7): the practice popover's Practice page.
