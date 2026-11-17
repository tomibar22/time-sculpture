import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { longShortOf, lsLandings, parseLS, realizeLS, type LS } from '../longshort';

const P = (t: string) => parseLS(t)!;

describe('long and short', () => {
  it('reads a typed shape', () => {
    expect(parseLS('L S S')).toEqual(['L', 'S', 'S']);
    expect(parseLS('lss')).toEqual(['L', 'S', 'S']);
    expect(parseLS('long, short short')).toEqual(['L', 'S', 'S']);
    expect(parseLS('— · ·')).toEqual(['L', 'S', 'S']);
    expect(parseLS('א ק ק')).toEqual(['L', 'S', 'S']);
    expect(parseLS('3 2')).toBeNull();
    expect(parseLS('  ')).toBeNull();
  });

  it('finds the shape of a passage at its widest step', () => {
    expect(longShortOf([3, 3, 2])).toEqual(['L', 'L', 'S']);
    expect(longShortOf([2, 3, 6])).toEqual(['S', 'S', 'L']);
    expect(longShortOf([1, 2, 4])).toEqual(['S', 'L', 'L']);
    expect(longShortOf([4, 4])).toBeNull();
  });

  it('even realizations first, the ratio nearest 2 : 1 first', () => {
    const r = realizeLS(P('L S S'), 8);
    expect(r[0]).toMatchObject({ sizes: [4, 2, 2], even: true, label: '4 : 2' });
    expect(r.filter((x) => x.even).map((x) => x.key)).toEqual(['4 2 2', '6 1 1']);
    expect(r.some((x) => x.key === '4 3 1' && x.label === 'L 4 · S 1–3')).toBe(true);
    expect(r.some((x) => x.key === '5 2 1')).toBe(true);
  });

  it('every realization keeps every long longer than every short and adds up', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<LS>('L', 'S'), { minLength: 1, maxLength: 7 }),
        fc.integer({ min: 1, max: 40 }),
        (p, total) => {
          for (const r of realizeLS(p, total, { limit: 200 })) {
            expect(r.sizes.reduce((a, n) => a + n, 0)).toBe(total);
            const longs = r.sizes.filter((_, i) => p[i] === 'L');
            const shorts = r.sizes.filter((_, i) => p[i] === 'S');
            if (longs.length && shorts.length)
              expect(Math.min(...longs)).toBeGreaterThan(Math.max(...shorts));
            expect(r.sizes.every((n) => n >= 1 && n <= 16)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('near: the sizes closest to the passage first', () => {
    const r = realizeLS(P('L L S'), 8, { near: [3, 3, 2] });
    expect(r[0]!.key).toBe('3 3 2');
    expect(r[1]!.key).toMatch(/^(4 2 2|2 4 2|4 3 1|3 4 1)$/);
  });

  it('lands: even ways said as often as fit, then free ways that fill it once', () => {
    const ls = lsLandings(16, P('L S S'));
    expect(ls[0]).toMatchObject({ kind: 'even', name: '2 : 1', times: 4, lead: 0 });
    expect(ls[1]).toMatchObject({ kind: 'even', name: '4 : 2', times: 2, lead: 0 });
    expect(ls.every((l) => l.sizes.reduce((a, n) => a + n, 0) + l.lead === 16)).toBe(true);
    const free = ls.filter((l) => l.kind === 'free');
    expect(free.length).toBeGreaterThan(0);
    expect(free.every((l) => l.lead === 0 && l.sizes.length === 3)).toBe(true);
  });

  it('lands with the last tile on the 1: it is not written', () => {
    const ls = lsLandings(14, P('L S S'), { on1: true });
    // 4 2 2 4 2 + (2 on the 1)
    const w = ls.find((l) => l.name === '4 : 2')!;
    expect(w).toMatchObject({ sizes: [4, 2, 2, 4, 2], lead: 0, on1: 2, times: 2 });
    for (const l of ls) expect(l.sizes.reduce((a, n) => a + n, 0) + l.lead).toBe(14);
  });
});

describe('vary: the same long and short', () => {
  it('offers other sizes with the shape of the passage, the nearest first', async () => {
    const { variations } = await import('../vary');
    const S = (n: number) => ({ n, kind: 'sound' as const });
    const vs = variations([S(3), S(3), S(2)]).filter((v) => v.kind === 'longshort');
    expect(vs.length).toBeGreaterThan(2);
    for (const v of vs) {
      const [a, b, c] = v.groups.map((g) => g.n) as [number, number, number];
      expect(a + b + c).toBe(8);
      expect(Math.min(a, b)).toBeGreaterThan(c);
    }
    expect(vs.map((v) => v.key)).not.toContain('3 3 2');
  });
});

describe('room for one more tile', () => {
  it('a long takes at least 2 once there are shorts, a short 1; the last on the 1 is free', async () => {
    const { lsMinLength, lsRoomFor } = await import('../longshort');
    expect(lsMinLength(P('L S S'))).toBe(4);
    expect(lsMinLength(P('L L'))).toBe(2);
    expect(lsMinLength(P('L S S'), true)).toBe(3);
    expect(lsRoomFor(P('L S S'), 'S', 5)).toBe(true);
    expect(lsRoomFor(P('L S S'), 'L', 5)).toBe(false);
    // whenever there is room, some sizing really exists
    for (const t of ['L S', 'L S S S', 'S L L', 'L L L S']) {
      const p = P(t);
      const R = lsMinLength(p);
      expect(lsLandings(R, p).length).toBeGreaterThan(0);
    }
  });
});
