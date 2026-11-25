import { describe, expect, it } from 'vitest';
import { outlineOf, whereWords } from '../outline';
import { makeMeter } from '../doc';

const spans = (t: number[]) =>
  outlineOf(t).map((s) => `${s.depth}${s.kind === 'yati' ? 'y' : ''}:${s.a}-${s.b}`);

describe('the outline of a passage', () => {
  it('a tihai: three statements, the gaps between them left out', () => {
    expect(spans([3, 3, 2, 4, 3, 3, 2, 4, 3, 3, 2])).toEqual(['0:0-8', '0:12-20', '0:24-32']);
    expect(spans([4, 1, 4, 1, 4])).toEqual(['0:0-4', '0:5-9', '0:10-14']);
  });
  it('a cut tihai lands where its last tile would begin: the end', () => {
    expect(spans([3, 2, 1, 3, 2, 1, 3])).toEqual(['0:0-5', '0:6-11', '0:12-15']);
  });
  it('a tihai of tihais: the inner statements under each', () => {
    const n = [4, 1, 4, 1, 4];
    const o = spans([...n, 3, ...n, 3, ...n]);
    expect(o.filter((s) => s.startsWith('0'))).toEqual(['0:0-14', '0:17-31', '0:34-48']);
    expect(o.filter((s) => s.startsWith('1')).length).toBe(9);
  });
  it('a korvai: the yati, then the mora', () => {
    expect(spans([6, 5, 4, 3, 2, 1, 3, 1, 3, 1, 3])).toEqual([
      '0y:0-21',
      '0:21-24',
      '0:25-28',
      '0:29-32',
    ]);
  });
  it('a yati (5 7 9) is read too', () => {
    const cell = (x: number) => [x, 3, x, x, 3, x, x, x, 6];
    expect(spans([6, 6, ...cell(5), 6, 6, ...cell(7), 6, 6, ...cell(9).slice(0, -1)]).length).toBe(
      3,
    );
  });
  it('nothing to read in a plain passage', () => {
    expect(spans([3, 5, 2, 7])).toEqual([]);
  });
  it('where a pulse is: on 1, on a beat, before or after the nearest beat line', () => {
    const m = makeMeter(4, 2, 4);
    expect(whereWords(m, 0)).toBe('on 1');
    expect(whereWords(m, 8)).toBe('on beat 3');
    expect(whereWords(m, 14)).toBe('2 before 1');
    expect(whereWords(m, 17)).toBe('1 after 1');
    expect(whereWords(m, 32)).toBe('on 1');
  });
});
