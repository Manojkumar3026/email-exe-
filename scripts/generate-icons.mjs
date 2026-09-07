// Generates simple placeholder PNG icons (solid brand-color square with a lighter
// envelope glyph) at the sizes Chrome requires. No external image deps.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/icons');

const BRAND = [0x36, 0x60, 0xff]; // #3660ff
const GLYPH = [0xff, 0xff, 0xff]; // white

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function isEnvelopeGlyph(x, y, size) {
  // Simple envelope outline within an inset square.
  const inset = Math.round(size * 0.2);
  const w = size - inset * 2;
  const h = Math.round(w * 0.7);
  const top = inset + Math.round((size - inset * 2 - h) / 2);
  const left = inset;
  const right = inset + w;
  const bottom = top + h;
  if (x < left || x >= right || y < top || y >= bottom) return false;
  const border = Math.max(1, Math.round(size * 0.035));
  const onBorder =
    x < left + border || x >= right - border || y < top + border || y >= bottom - border;
  // flap: two diagonal lines from top corners to top-center
  const midX = (left + right) / 2;
  const flapHeight = h * 0.55;
  const progress = (x - left) / (right - left); // 0..1
  const flapY = top + Math.abs(progress - 0.5) * 2 * flapHeight;
  const onFlap = Math.abs(y - flapY) < border * 1.2 && y < top + flapHeight + border;
  return onBorder || onFlap;
}

function generatePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const glyph = isEnvelopeGlyph(x, y, size);
      const [r, g, b] = glyph ? GLYPH : BRAND;
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(raw);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 32, 48, 128]) {
  const png = generatePng(size);
  writeFileSync(path.join(outDir, `${size}.png`), png);
  console.log(`wrote public/icons/${size}.png (${png.length} bytes)`);
}
