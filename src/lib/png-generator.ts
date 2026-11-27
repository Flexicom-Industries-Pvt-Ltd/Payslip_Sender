import zlib from 'zlib';

// Precomputed CRC32 table for valid PNG chunks
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [37, 99, 235];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Generates a valid crisp rounded-square PNG emblem in pure Node.js (zero native dependencies)
 * so every tenant workspace always has a valid 192x192 / 512x512 PNG for Windows PWA installability.
 */
export function generateSolidRoundedPng(size: number, primaryHex: string): Buffer {
  const [r, g, b] = parseHexRgb(primaryHex);
  const radius = Math.round(size * 0.22);
  const innerRadius = Math.round(size * 0.14);
  const rowSize = 1 + size * 4;
  const raw = Buffer.alloc(rowSize * size);

  const center = size / 2;

  for (let y = 0; y < size; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0; // filter type 0

    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4;

      // Distance check for rounded outer corners
      const dxEdge = Math.max(radius - x, x - (size - 1 - radius), 0);
      const dyEdge = Math.max(radius - y, y - (size - 1 - radius), 0);
      const outside = dxEdge * dxEdge + dyEdge * dyEdge > radius * radius;

      if (outside) {
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0;
        continue;
      }

      // Subtle crisp white inner ring emblem for clear visual distinction
      const distCenter = Math.hypot(x - center, y - center);
      const inWhiteRing =
        distCenter >= innerRadius * 1.15 && distCenter <= innerRadius * 1.65;

      if (inWhiteRing) {
        raw[px] = 255;
        raw[px + 1] = 255;
        raw[px + 2] = 255;
        raw[px + 3] = 240;
      } else {
        raw[px] = r;
        raw[px + 1] = g;
        raw[px + 2] = b;
        raw[px + 3] = 255;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}
