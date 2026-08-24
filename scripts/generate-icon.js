const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = 512;
const OUT_PATH = path.join(__dirname, '..', 'build', 'icon.png');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
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

// pixel colors
const bg1 = [0x12, 0x14, 0x1a]; // dark bg
const bg2 = [0x7c, 0x9c, 0xff]; // accent
const white = [0xe9, 0xeb, 0xf1];

const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (1 + SIZE * 4);
  raw[rowStart] = 0; // filter type none
  for (let x = 0; x < SIZE; x++) {
    const px = rowStart + 1 + x * 4;
    // rounded-rect-ish card background gradient diagonal
    const t = (x + y) / (SIZE * 2);
    let r = Math.round(bg1[0] + (bg2[0] - bg1[0]) * t);
    let g = Math.round(bg1[1] + (bg2[1] - bg1[1]) * t);
    let b = Math.round(bg1[2] + (bg2[2] - bg1[2]) * t);

    // draw a simple "grid/table" glyph: a rounded card with two horizontal bars (rows) and a checkmark-ish accent
    const cx = SIZE / 2, cy = SIZE / 2;
    const cardW = 300, cardH = 220;
    const left = cx - cardW / 2, right = cx + cardW / 2;
    const top = cy - cardH / 2, bottom = cy + cardH / 2;

    let a = 255;
    // rounded corners approx via simple margin (skip true rounding for simplicity)
    if (x > left && x < right && y > top && y < bottom) {
      r = white[0]; g = white[1]; b = white[2];
      // header bar
      if (y < top + 46) {
        r = bg2[0]; g = bg2[1]; b = bg2[2];
      } else {
        // row separators
        const rowH = (cardH - 46) / 3;
        const rel = (y - (top + 46)) % rowH;
        if (rel < 6) { r = 0xd7; g = 0xdc; b = 0xea; }
      }
    }

    raw[px] = r;
    raw[px + 1] = g;
    raw[px + 2] = b;
    raw[px + 3] = a;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const idat = zlib.deflateSync(raw, { level: 9 });

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0))
]);

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, png);
console.log('wrote', OUT_PATH, png.length, 'bytes');
