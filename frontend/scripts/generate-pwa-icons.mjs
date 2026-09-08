/**
 * PWA icon generator — zero-dependency, pure Node.
 *
 * Draws the RideShare car mark on an orange gradient and writes real PNGs to
 * frontend/public/icons/. Run with:
 *
 *   node scripts/generate-pwa-icons.mjs
 *
 * Outputs:
 *   icon-192.png            (192×192, rounded corners — "any" purpose)
 *   icon-512.png            (512×512, rounded corners — "any" purpose)
 *   icon-maskable-192.png   (192×192, full-bleed — "maskable" purpose)
 *   icon-maskable-512.png   (512×512, full-bleed — "maskable" purpose)
 *   apple-touch-icon.png    (180×180, full-bleed, no transparency)
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// ── Minimal PNG encoder ──────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
};

const encodePng = (width, height, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type 6 = RGBA

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// ── Drawing helpers ──────────────────────────────────────────────────────────
const newCanvas = (size) => Buffer.alloc(size * size * 4);

const setPx = (buf, size, x, y, [r, g, b, a = 255]) => {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
};

const inRoundRect = (px, py, x0, y0, x1, y1, r) => {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const rx = Math.min(r, (x1 - x0) / 2);
  const ry = Math.min(r, (y1 - y0) / 2);
  const cx0 = x0 + rx, cy0 = y0 + ry, cx1 = x1 - rx, cy1 = y1 - ry;
  if (px >= cx0 && px <= cx1) return true;
  if (py >= cy0 && py <= cy1) return true;
  const dx = px < cx0 ? cx0 - px : px - cx1;
  const dy = py < cy0 ? cy0 - py : py - cy1;
  return dx * dx + dy * dy <= rx * rx;
};

const fillRoundRect = (buf, size, x0, y0, x1, y1, r, color) => {
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(size - 1, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(size - 1, Math.ceil(x1)); x++) {
      if (inRoundRect(x, y, x0, y0, x1, y1, r)) setPx(buf, size, x, y, color);
    }
  }
};

const fillCircle = (buf, size, cx, cy, rad, color) => {
  for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(size - 1, Math.ceil(cy + rad)); y++) {
    for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(size - 1, Math.ceil(cx + rad)); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) setPx(buf, size, x, y, color);
    }
  }
};

/**
 * Draw the RideShare car mark.
 * @param {number} size canvas size
 * @param {boolean} maskable full-bleed background (no rounded transparent corners)
 */
const drawIcon = (size, maskable) => {
  const buf = newCanvas(size);
  const s = size;

  // Orange gradient background (#F59E0B → #EA580C)
  const bgTop = [245, 158, 11];
  const bgBot = [234, 88, 12];
  const cornerR = maskable ? 0 : s * 0.2;
  for (let y = 0; y < s; y++) {
    const t = y / s;
    const r = Math.round(bgTop[0] + (bgBot[0] - bgTop[0]) * t);
    const g = Math.round(bgTop[1] + (bgBot[1] - bgTop[1]) * t);
    const b = Math.round(bgTop[2] + (bgBot[2] - bgTop[2]) * t);
    for (let x = 0; x < s; x++) {
      if (maskable || inRoundRect(x, y, 0, 0, s - 1, s - 1, cornerR)) setPx(buf, s, x, y, [r, g, b]);
    }
  }

  // Car body (white)
  fillRoundRect(buf, s, s * 0.14, s * 0.48, s * 0.86, s * 0.8, s * 0.09, [255, 255, 255, 255]);
  // Cabin / roof
  fillRoundRect(buf, s, s * 0.3, s * 0.32, s * 0.7, s * 0.54, s * 0.07, [255, 255, 255, 255]);
  // Windows (light blue)
  fillRoundRect(buf, s, s * 0.34, s * 0.36, s * 0.66, s * 0.5, s * 0.04, [219, 234, 254, 255]);
  // Windshield divider
  fillRoundRect(buf, s, s * 0.485, s * 0.36, s * 0.515, s * 0.5, s * 0.02, [147, 197, 253, 255]);
  // Headlights
  fillRoundRect(buf, s, s * 0.14, s * 0.55, s * 0.2, s * 0.62, s * 0.02, [253, 230, 138, 255]);
  fillRoundRect(buf, s, s * 0.8, s * 0.55, s * 0.86, s * 0.62, s * 0.02, [253, 230, 138, 255]);
  // Wheels (dark) + hubs (orange)
  fillCircle(buf, s, s * 0.3, s * 0.8, s * 0.085, [31, 41, 55, 255]);
  fillCircle(buf, s, s * 0.7, s * 0.8, s * 0.085, [31, 41, 55, 255]);
  fillCircle(buf, s, s * 0.3, s * 0.8, s * 0.035, [245, 158, 11, 255]);
  fillCircle(buf, s, s * 0.7, s * 0.8, s * 0.035, [245, 158, 11, 255]);

  return encodePng(s, s, buf);
};

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

for (const t of targets) {
  const out = resolve(OUT_DIR, t.file);
  writeFileSync(out, drawIcon(t.size, t.maskable));
  console.log(`✅ ${t.file} (${t.size}×${t.size})`);
}