import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

// Helper to create uncompressed/deflated raw PNG files without external dependencies
function createPng(size, colorPrimary, colorAccent) {
  const width = size;
  const height = size;
  const buffer = Buffer.alloc(width * height * 4);

  const radius = size / 2;
  const center = size / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded squircle / circle background
      if (dist <= radius - 1) {
        // Base color (Discord Blurple: #5865F2 -> 88, 101, 242)
        let r = colorPrimary[0];
        let g = colorPrimary[1];
        let b = colorPrimary[2];
        let a = 255;

        // Anti-aliasing border
        if (dist > radius - 2) {
          a = Math.floor(255 * (radius - 1 - dist));
        }

        // Draw a globe/translation symbol in white/accent
        // Draw cross lines (latitudes / longitudes or "ES" / "A 文")
        const isGlobeCenter = Math.abs(dx) < size * 0.12 && Math.abs(dy) < size * 0.35;
        const isGlobeRing = Math.abs(dist - size * 0.28) < Math.max(1, size * 0.06);
        const isEquator = Math.abs(dy) < Math.max(1, size * 0.05) && Math.abs(dx) < size * 0.35;
        const isMeridian = Math.abs(dx * dx * 2.5 + dy * dy - (size * 0.28) ** 2) < (size * 1.5);

        if (isGlobeRing || isEquator || isGlobeCenter) {
          r = colorAccent[0];
          g = colorAccent[1];
          b = colorAccent[2];
        }

        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = a;
      } else {
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }

  // Generate PNG file format
  return buildPng(width, height, buffer);
}

function buildPng(width, height, rgbaBuffer) {
  // Scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const scanlineOffset = y * (width * 4 + 1);
    scanlines[scanlineOffset] = 0; // Filter type 0 (None)
    rgbaBuffer.copy(scanlines, scanlineOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const deflated = zlib.deflateSync(scanlines);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

// CRC32 table & function
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xFF];
  }
  return (c ^ (-1)) >>> 0;
}

const iconsDir = path.resolve('icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const blurple = [88, 101, 242];
const white = [255, 255, 255];

for (const size of [16, 32, 48, 128]) {
  const png = createPng(size, blurple, white);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png`);
}
