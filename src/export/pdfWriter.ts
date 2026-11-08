/**
 * A tiny PDF writer: one full-page RGB image per page (FlateDecode, compressed with the browser's
 * CompressionStream), plus document info. Enough for crisp printed score sheets with no library.
 */

export interface PdfPage {
  /** Raw RGB pixels, width * height * 3 bytes. */
  rgb: Uint8Array;
  width: number;
  height: number;
}

const enc = new TextEncoder();

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  // 'deflate' = zlib format, which is what PDF's FlateDecode expects
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A PDF text string that survives any script (UTF-16BE with BOM, as hex). */
function pdfText(s: string): string {
  let hex = 'FEFF';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    const units =
      cp > 0xffff ? [0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff)] : [cp];
    for (const u of units) hex += u.toString(16).padStart(4, '0').toUpperCase();
  }
  return `<${hex}>`;
}

/**
 * Build a PDF. `pageSize` is in points (A4 = 595.28 × 841.89); each image is stretched to fill
 * its page, so render images with the page's aspect ratio.
 */
export async function buildPdf(
  pages: PdfPage[],
  info: { title: string; author?: string },
  pageSize = { w: 595.28, h: 841.89 },
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array | string) => {
    const bytes = typeof b === 'string' ? enc.encode(b) : b;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n: number, body: Array<Uint8Array | string>) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    for (const b of body) push(b);
    push('\nendobj\n');
  };

  push('%PDF-1.4\n%âãÏÓ\n');
  // objects: 1 catalog, 2 pages, 3 info, then 3 per page (page, contents, image)
  const pageObj = (i: number) => 4 + i * 3;
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2, [
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ]);
  obj(3, [
    `<< /Title ${pdfText(info.title)} /Creator ${pdfText(info.author ?? 'Time Sculpture')} /Producer (Time Sculpture) >>`,
  ]);
  const W = pageSize.w.toFixed(2);
  const H = pageSize.h.toFixed(2);
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]!;
    const n = pageObj(i);
    obj(n, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`,
    ]);
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(n + 1, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
    const data = await deflate(p.rgb);
    obj(n + 2, [
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${data.length} >>\nstream\n`,
      data,
      '\nendstream',
    ]);
  }
  const count = 4 + pages.length * 3;
  const xref = length;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** RGB bytes from a canvas (alpha is dropped; draw on white first). */
export function canvasRgb(canvas: HTMLCanvasElement): PdfPage {
  const { width, height } = canvas;
  const rgba = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i]!;
    rgb[j + 1] = rgba[i + 1]!;
    rgb[j + 2] = rgba[i + 2]!;
  }
  return { rgb, width, height };
}
