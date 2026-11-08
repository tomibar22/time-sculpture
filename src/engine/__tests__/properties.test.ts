import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildGrid } from '../grid';
import { checkInvariants, group, isSpace, syncSpace } from '../doc';
import * as E from '../index';
import type { Doc, Item, OpResult } from '../types';
import { SPACE_ID } from '../types';

const meterArb = fc
  .record({ b: fc.integer({ min: 3, max: 13 }), c: fc.integer({ min: 1, max: 4 }) })
  .chain(({ b, c }) =>
    fc
      .array(fc.integer({ min: 1, max: 8 }), { minLength: b * c, maxLength: b * c })
      .map((subdivision) => ({
        beatsPerCycle: b,
        cycles: c,
        subdivision,
      })),
  );

const docArb: fc.Arbitrary<Doc> = meterArb.chain((meter) => {
  const TS = buildGrid(meter).TS;
  return fc
    .record({
      sizes: fc.array(fc.record({ n: fc.integer({ min: 1, max: 9 }), rest: fc.boolean() }), {
        maxLength: 14,
      }),
      spaceAt: fc.nat(),
    })
    .map(({ sizes, spaceAt }) => {
      const items: Item[] = [];
      let sum = 0;
      let id = 1;
      for (const s of sizes) {
        if (sum + s.n > TS) break;
        sum += s.n;
        items.push(group(`g${id++}`, s.n, s.rest ? 'rest' : 'sound'));
      }
      items.splice(spaceAt % (items.length + 1), 0, { id: SPACE_ID, kind: 'space', n: 0 });
      return { meter, items: syncSpace(items, TS), nextId: id };
    });
});

type Op = (d: Doc) => OpResult;
const pick = (d: Doc, i: number) => {
  const groups = d.items.filter((x) => !isSpace(x));
  return groups.length ? [groups[i % groups.length]!.id] : [];
};
const pickRun = (d: Doc, i: number, len: number) => {
  const groups = d.items.filter((x) => !isSpace(x));
  if (!groups.length) return [];
  const si = d.items.findIndex(isSpace);
  const start = i % groups.length;
  const startIdx = d.items.findIndex((x) => x.id === groups[start]!.id);
  const out: string[] = [];
  for (let k = startIdx; k < d.items.length && out.length < len; k++) {
    if (k === si) break;
    out.push(d.items[k]!.id);
  }
  return out;
};
const tray = [2, 3, 4, 5, 7];

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc
    .record({
      n: fc.integer({ min: 1, max: 12 }),
      rest: fc.boolean(),
      at: fc.oneof(
        fc.constant('start' as const),
        fc.constant('end' as const),
        fc.nat().map((index) => ({ index })),
      ),
    })
    .map(
      ({ n, rest, at }) =>
        (d: Doc) =>
          E.add(
            d,
            n,
            rest ? 'rest' : 'sound',
            typeof at === 'string' ? at : { index: at.index % (d.items.length + 1) },
          ),
    ),
  fc.record({ i: fc.nat(), n: fc.integer({ min: -3, max: 20 }) }).map(({ i, n }) => (d: Doc) => {
    const id = pick(d, i)[0];
    return id ? E.reshapeLine(d, id, n) : { doc: d, report: E.fail('nothing-selected') };
  }),
  fc.record({ i: fc.nat(), n: fc.integer({ min: -3, max: 30 }) }).map(({ i, n }) => (d: Doc) => {
    const id = pick(d, i)[0];
    return id ? E.stretchEdge(d, id, n) : { doc: d, report: E.fail('nothing-selected') };
  }),
  fc.nat().map((i) => (d: Doc) => E.split(d, pick(d, i))),
  fc.record({ i: fc.nat(), len: fc.integer({ min: 2, max: 4 }) }).map(
    ({ i, len }) =>
      (d: Doc) =>
        E.merge(d, pickRun(d, i, len)),
  ),
  fc.nat().map((i) => (d: Doc) => E.duplicate(d, pick(d, i))),
  fc.nat().map((i) => (d: Doc) => E.remove(d, pick(d, i))),
  fc.nat().map((i) => (d: Doc) => E.toggleKind(d, pick(d, i))),
  fc.record({ i: fc.nat(), k: fc.nat() }).map(
    ({ i, k }) =>
      (d: Doc) =>
        E.reorderAtPulse(d, pick(d, i), k % (buildGrid(d.meter).TS + 1)),
  ),
  fc.record({ i: fc.nat(), right: fc.boolean() }).map(
    ({ i, right }) =>
      (d: Doc) =>
        E.reorderStep(d, pick(d, i), right ? 1 : -1),
  ),
  fc
    .record({
      i: fc.nat(),
      len: fc.integer({ min: 1, max: 3 }),
      dlt: fc.integer({ min: -20, max: 20 }),
    })
    .map(
      ({ i, len, dlt }) =>
        (d: Doc) =>
          E.slide(d, pickRun(d, i, len), dlt),
    ),
  fc
    .record({ i: fc.nat(), right: fc.boolean(), beat: fc.boolean() })
    .map(({ i, right, beat }) => (d: Doc) => {
      const ids = pick(d, i);
      return E.slide(d, ids, E.stepDelta(d, ids, right ? 1 : -1, beat ? 'beat' : 'pulse'));
    }),
  fc
    .record({
      beats: fc.array(fc.nat(), { minLength: 1, maxLength: 6 }),
      sd: fc.integer({ min: 1, max: 8 }),
    })
    .map(
      ({ beats, sd }) =>
        (d: Doc) =>
          E.setSubdivision(
            d,
            beats.map((b) => b % d.meter.subdivision.length),
            sd,
          ),
    ),
  fc
    .record({
      b: fc.integer({ min: 3, max: 13 }),
      c: fc.integer({ min: 1, max: 4 }),
      fill: fc.integer({ min: 1, max: 8 }),
    })
    .map(
      ({ b, c, fill }) =>
        (d: Doc) =>
          E.resizeMeter(d, b, c, fill),
    ),
  fc.integer().map((seed) => (d: Doc) => {
    let s = Math.abs(seed) + 1;
    return E.fillWithPieces(d, tray, () => (s = (s * 16807) % 2147483647) / 2147483647);
  }),
  fc.constant((d: Doc) => E.fillWithSilence(d)),
  fc.constant((d: Doc) => E.clear(d)),
);

describe('engine invariants (property-based)', () => {
  it('generated documents are valid', () => {
    fc.assert(
      fc.property(docArb, (d) => {
        expect(checkInvariants(d)).toEqual([]);
      }),
    );
  });

  it('every operation sequence keeps the invariants and never reuses ids', () => {
    fc.assert(
      fc.property(docArb, fc.array(opArb, { maxLength: 25 }), (d0, ops) => {
        let d = d0;
        const everSeen = new Set(d.items.map((x) => x.id));
        for (const op of ops) {
          const before = d;
          const { doc, report } = op(d);
          expect(checkInvariants(doc)).toEqual([]);
          if (!report.ok) expect(doc).toBe(before);
          expect(doc.nextId).toBeGreaterThanOrEqual(before.nextId);
          const beforeIds = new Set(before.items.map((x) => x.id));
          for (const x of doc.items) {
            // an id is either carried over or brand new (never resurrected)
            if (!beforeIds.has(x.id)) {
              expect(everSeen.has(x.id)).toBe(false);
              expect(report.created).toContain(x.id);
            }
            everSeen.add(x.id);
          }
          d = doc;
        }
      }),
      { numRuns: 300 },
    );
  });

  it('slides keep the block and preserve the total', () => {
    fc.assert(
      fc.property(
        docArb,
        fc.nat(),
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: -30, max: 30 }),
        (d, i, len, dlt) => {
          const ids = pickRun(d, i, len);
          const r = E.slide(d, ids, dlt);
          if (!r.report.ok) return;
          const before = ids.map((id) => d.items.find((x) => x.id === id)!.n);
          const after = ids.map((id) => r.doc.items.find((x) => x.id === id)?.n);
          expect(after).toEqual(before);
          const at = r.doc.items.findIndex((x) => x.id === ids[0]);
          expect(r.doc.items.slice(at, at + ids.length).map((x) => x.id)).toEqual(ids);
          const s0 = E.startOf(
            d.items,
            d.items.findIndex((x) => x.id === ids[0]),
          );
          expect(E.startOf(r.doc.items, at)).toBe(s0 + E.clampSlide(d, ids, dlt));
        },
      ),
      { numRuns: 300 },
    );
  });

  it('subdivision changes keep surviving items in order and boundaries within half a pulse', () => {
    fc.assert(
      fc.property(
        docArb,
        fc.array(fc.nat(), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 1, max: 8 }),
        (d, beats, sd) => {
          const r = E.setSubdivision(
            d,
            beats.map((b) => b % d.meter.subdivision.length),
            sd,
          );
          const order = (doc: Doc) => doc.items.map((x) => x.id);
          const kept = order(d).filter((id) => r.doc.items.some((x) => x.id === id));
          expect(order(r.doc)).toEqual(kept);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('meter resizes keep the sizes of surviving groups', () => {
    fc.assert(
      fc.property(
        docArb,
        fc.integer({ min: 3, max: 13 }),
        fc.integer({ min: 1, max: 4 }),
        (d, b, c) => {
          const r = E.resizeMeter(d, b, c, 4);
          for (const x of r.doc.items)
            if (!isSpace(x)) expect(x.n).toBe(d.items.find((y) => y.id === x.id)!.n);
        },
      ),
    );
  });

  it('tray states agree with counting', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 12 }), { minLength: 1, maxLength: 6 }),
        (R, S) => {
          const st = E.trayStates(R, S);
          for (const s of S) {
            const want = s > R ? 'big' : E.countWays(R - s, S) > 0n ? 'fits' : 'dead';
            expect(st.get(s)).toBe(want);
          }
          const total = S.reduce((a, s) => a + (s <= R ? E.countWays(R - s, S) : 0n), 0n);
          if (R > 0) expect(E.countWays(R, S)).toBe(total);
        },
      ),
    );
  });
});
