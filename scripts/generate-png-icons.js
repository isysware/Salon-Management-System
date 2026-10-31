// scripts/generate-png-icons.js
// Pure Node.js script (zero dependencies) to generate PNG icons for Apple Touch & Android Home Screen

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const crcTable = createCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgbaBuffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    scanlines[rowOffset] = 0; // Filter: None
    rgbaBuffer.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate icon with luxury salon maroon gradient and clean scissors
function renderAppIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const r = size * 0.22; // corner radius
  const cx = size / 2;
  const cy = size / 2;

  // Colors
  const c1 = [196, 56, 114]; // #C43872
  const c2 = [184, 46, 105]; // #B82E69
  const c3 = [157, 37, 88];  // #9D2558

  function distToRoundedRect(x, y, w, h, radius) {
    const dx = Math.max(0, Math.abs(x - w / 2) - (w / 2 - radius));
    const dy = Math.max(0, Math.abs(y - h / 2) - (h / 2 - radius));
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Draw background gradient
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const d = distToRoundedRect(x, y, size, size, r);
      if (d > r) {
        // Outside rounded corners
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        continue;
      }

      // Smooth anti-aliased edge
      const edgeAlpha = Math.max(0, Math.min(1, r - d + 0.5));

      // Diagonal gradient factor [0, 1]
      const t = (x + y) / (size * 2);
      let red, green, blue;
      if (t < 0.5) {
        const factor = t * 2;
        red = Math.round(c1[0] + (c2[0] - c1[0]) * factor);
        green = Math.round(c1[1] + (c2[1] - c1[1]) * factor);
        blue = Math.round(c1[2] + (c2[2] - c1[2]) * factor);
      } else {
        const factor = (t - 0.5) * 2;
        red = Math.round(c2[0] + (c3[0] - c2[0]) * factor);
        green = Math.round(c2[1] + (c3[1] - c2[1]) * factor);
        blue = Math.round(c2[2] + (c3[2] - c2[2]) * factor);
      }

      buf[idx] = red;
      buf[idx + 1] = green;
      buf[idx + 2] = blue;
      buf[idx + 3] = Math.round(255 * edgeAlpha);
    }
  }

  // Draw Salon Scissors icon
  // Rotated -45 degrees
  const angle = -Math.PI / 4;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scale = size / 28;

  function blendPixel(px, py, pr, pg, pb, pa) {
    if (px < 0 || px >= size || py < 0 || py >= size) return;
    const i = (py * size + px) * 4;
    const bgA = buf[i + 3] / 255;
    const srcA = pa / 255;
    const outA = srcA + bgA * (1 - srcA);
    if (outA > 0) {
      buf[i] = Math.round((pr * srcA + buf[i] * bgA * (1 - srcA)) / outA);
      buf[i + 1] = Math.round((pg * srcA + buf[i + 1] * bgA * (1 - srcA)) / outA);
      buf[i + 2] = Math.round((pb * srcA + buf[i + 2] * bgA * (1 - srcA)) / outA);
      buf[i + 3] = Math.round(outA * 255);
    }
  }

  function drawThickLine(x0, y0, x1, y1, thickness) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist * 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const lx = x0 + (x1 - x0) * t;
      const ly = y0 + (y1 - y0) * t;
      const rad = thickness / 2;
      for (let oy = -Math.ceil(rad); oy <= Math.ceil(rad); oy++) {
        for (let ox = -Math.ceil(rad); ox <= Math.ceil(rad); ox++) {
          const d = Math.hypot(ox, oy);
          if (d <= rad) {
            const alpha = Math.max(0, Math.min(1, rad - d + 0.5)) * 255;
            blendPixel(Math.round(lx + ox), Math.round(ly + oy), 255, 255, 255, alpha);
          }
        }
      }
    }
  }

  function drawRing(centerX, centerY, outerR, innerR) {
    const minX = Math.floor(centerX - outerR - 1);
    const maxX = Math.ceil(centerX + outerR + 1);
    const minY = Math.floor(centerY - outerR - 1);
    const maxY = Math.ceil(centerY + outerR + 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - centerX, y - centerY);
        let alpha = 0;
        if (d <= outerR && d >= innerR) {
          alpha = 1;
        } else if (d > outerR && d < outerR + 1) {
          alpha = Math.max(0, 1 - (d - outerR));
        } else if (d < innerR && d > innerR - 1) {
          alpha = Math.max(0, 1 - (innerR - d));
        }
        if (alpha > 0) {
          blendPixel(x, y, 255, 255, 255, alpha * 255);
        }
      }
    }
  }

  function transform(x, y) {
    // Lucide scissors base coords (0-24, center 12, 12)
    const lx = (x - 12) * scale;
    const ly = (y - 12) * scale;
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;
    return [cx + rx, cy + ry];
  }

  const strokeW = scale * 2.2;
  const loopRadius = scale * 3.4;
  const loopInner = loopRadius - strokeW;

  // Upper blade: (8.12, 15.88) to (20, 4)
  const [b1x0, b1y0] = transform(8.12, 15.88);
  const [b1x1, b1y1] = transform(20, 4);
  drawThickLine(b1x0, b1y0, b1x1, b1y1, strokeW);

  // Lower blade: (8.12, 8.12) to (12, 12) and (14.8, 14.8) to (20, 20)
  const [b2x0, b2y0] = transform(8.12, 8.12);
  const [b2x1, b2y1] = transform(12, 12);
  drawThickLine(b2x0, b2y0, b2x1, b2y1, strokeW);

  const [b3x0, b3y0] = transform(14.8, 14.8);
  const [b3x1, b3y1] = transform(20, 20);
  drawThickLine(b3x0, b3y0, b3x1, b3y1, strokeW);

  // Upper ring at (6, 6)
  const [r1x, r1y] = transform(6, 6);
  drawRing(r1x, r1y, loopRadius, loopInner);

  // Lower ring at (6, 18)
  const [r2x, r2y] = transform(6, 18);
  drawRing(r2x, r2y, loopRadius, loopInner);

  return encodePng(size, size, buf);
}

// Generate the icons
const publicDir = path.resolve('frontend/public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

console.log('Generating mobile home screen PNG icons...');

// 1. apple-touch-icon.png (180x180 standard iOS)
const appleIcon = renderAppIcon(180);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);
console.log('✓ frontend/public/apple-touch-icon.png created (180x180)');

// 2. icon-192.png (Android home screen shortcut)
const icon192 = renderAppIcon(192);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
console.log('✓ frontend/public/icon-192.png created (192x192)');

// 3. icon-512.png (High-res splash / PWA)
const icon512 = renderAppIcon(512);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
console.log('✓ frontend/public/icon-512.png created (512x512)');

// 4. Also copy apple-touch-icon as favicon-32x32.png
const icon32 = renderAppIcon(32);
fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), icon32);
console.log('✓ frontend/public/favicon-32x32.png created (32x32)');

console.log('All icons generated successfully!');
