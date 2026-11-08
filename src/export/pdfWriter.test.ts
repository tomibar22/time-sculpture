import { describe, expect, it } from 'vitest';
import { buildPdf } from './pdfWriter';

const text = (b: Uint8Array) => new TextDecoder('latin1').decode(b);

describe('pdf writer', () => {
  it('writes a valid single-image PDF with a working xref', async () => {
    const rgb = new Uint8Array(4 * 2 * 3).fill(255);
    const pdf = await buildPdf(
      [
        { rgb, width: 4, height: 2 },
        { rgb, width: 4, height: 2 },
      ],
      { title: 'שלום Phrase' },
    );
    const s = text(pdf);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(s).toContain('/Count 2');
    // startxref points at the xref table
    const at = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(at, at + 4)).toBe('xref');
    // every xref entry points at "n 0 obj"
    const entries = [...s.slice(at).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries.length).toBe(9);
    entries.forEach((off, i) =>
      expect(s.slice(off, off + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`)),
    );
    // the title is UTF-16BE hex
    expect(s).toContain('/Title <FEFF05E905DC05D505DD');
  });
});
