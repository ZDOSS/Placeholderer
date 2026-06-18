// Minimal GIF89a encoder.
//
// Browsers don't expose `canvas.toBlob('image/gif')`, so we serialize
// from a flat RGBA byte array ourselves. Used by both the web export
// path and the CLI encode path.
//
// Trade-offs vs. a "real" GIF encoder:
// - 6x6x6 web-safe palette (216 colors) + 40 grayscale steps. This
//   covers most placeholder content well enough and keeps the
//   quantizer to a single O(N) pass. NeuQuant / median-cut would
//   give better fidelity, but for placeholder-grade UI the web-safe
//   cube is plenty.
// - Single-frame, no animation. The spec only requires v1 export of
//   the still, and animation would drag in palette-per-frame + delay
//   timing + disposal — bigger surface than tier 4 needs.
// - LZW compression uses a 12-bit code ceiling (max 4096 codes) and
//   resets when the dictionary fills. Acceptable for placeholder
//   sizes; most v1 outputs are well under 4096 unique pixel runs.
//
// Output: a complete GIF89a byte stream.

const PALETTE_SIZE = 256;
// 6 channels per axis × 6^3 = 216 web-safe colors. The remaining 40
// entries are evenly distributed greyscale shades from 0..255.
function buildPalette(): Uint8ClampedArray {
  const out = new Uint8ClampedArray(PALETTE_SIZE * 3);
  let i = 0;
  // Web-safe cube.
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        out[i++] = r === 0 ? 0 : r * 51;
        out[i++] = g === 0 ? 0 : g * 51;
        out[i++] = b === 0 ? 0 : b * 51;
      }
    }
  }
  // Greyscale ramp filling 216..255.
  for (let k = 0; k < 40; k++) {
    const v = Math.round((k * 255) / 39);
    out[i++] = v;
    out[i++] = v;
    out[i++] = v;
  }
  return out;
}

// Map an RGB triplet to the nearest palette index using squared
// distance in RGB space. The web-safe cube has uniform spacing, so
// the nearest cube entry is found by quantizing each channel to
// 6 levels (0..5) — a single O(1) lookup instead of an O(PALETTE_SIZE)
// scan. Greyscale entries get the same treatment.
function rgbToIndex(r: number, g: number, b: number): number {
  // Quantize each channel to the nearest web-safe cube step.
  const rq = r === 0 ? 0 : Math.round(r / 51);
  const gq = g === 0 ? 0 : Math.round(g / 51);
  const bq = b === 0 ? 0 : Math.round(b / 51);
  return rq * 36 + gq * 6 + bq;
}

/** Write a 16-bit little-endian value. */
function writeU16(out: number[], v: number): void {
  out.push(v & 0xff, (v >> 8) & 0xff);
}

/** Encode an RGBA buffer as a single-frame GIF89a image. Width and
 *  height must be positive integers; buffer length must be
 *  width * height * 4. Alpha < 128 is treated as transparent
 *  (palette index 0 is reserved as transparent). */
export function encodeGif(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`encodeGif: width/height must be positive integers (got ${width}x${height})`);
  }
  if (rgba.length !== width * height * 4) {
    throw new Error(`encodeGif: buffer length ${rgba.length} does not match ${width}x${height}x4`);
  }

  const palette = buildPalette();
  const pixels = new Uint8Array(width * height);

  // Quantize RGBA → palette index. Alpha < 128 → transparent (0).
  // Palette index 0 is the first web-safe black entry; we overwrite
  // it with the transparent entry.
  const transparentIndex = 0;
  for (let i = 0; i < pixels.length; i++) {
    const s = i * 4;
    if (rgba[s + 3] < 128) {
      pixels[i] = transparentIndex;
    } else {
      pixels[i] = rgbToIndex(rgba[s], rgba[s + 1], rgba[s + 2]);
    }
  }
  // Set the transparent entry to black (0,0,0) so the GIF's
  // transparency-mask lines up with our transparent pixels.
  palette[0] = palette[1] = palette[2] = 0;

  // ---- LZW compression ----
  const minCodeSize = 8; // palette size 256 → min code size 8
  const clearCode = 1 << minCodeSize; // 256
  const endCode = clearCode + 1; // 257
  // First data code = endCode + 1.
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  // Threshold at which we bump codeSize: when nextCode reaches
  // 2^codeSize, the next emit needs an extra bit.
  let nextBumpThreshold = 1 << codeSize;

  // Bit-stream writer.
  const dataBytes: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  const writeBits = (value: number, bits: number): void => {
    bitBuffer |= value << bitCount;
    bitCount += bits;
    while (bitCount >= 8) {
      dataBytes.push(bitBuffer & 0xff);
      bitBuffer >>>= 8;
      bitCount -= 8;
    }
  };

  // Dictionary: prefix-code → entry. Keys are prefix codes
  // concatenated with the new pixel byte. The map's string key
  // would be inefficient; use a Map<number, number> keyed by
  // (prefixCode << 8) | byte.
  const dict = new Map<number, number>();
  const dictKey = (prefix: number, b: number): number => (prefix << 8) | b;

  writeBits(clearCode, codeSize);

  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i];
    const entry = dict.get(dictKey(prefix, k));
    if (entry !== undefined) {
      prefix = entry;
    } else {
      writeBits(prefix, codeSize);
      dict.set(dictKey(prefix, k), nextCode);
      nextCode++;
      // Bump codeSize at the threshold (standard GIF behavior).
      if (nextCode === nextBumpThreshold && codeSize < 12) {
        codeSize++;
        nextBumpThreshold = 1 << codeSize;
      }
      // Reset dictionary when full (4096 entries).
      if (nextCode === 4096) {
        writeBits(clearCode, codeSize);
        dict.clear();
        codeSize = minCodeSize + 1;
        nextCode = endCode + 1;
        nextBumpThreshold = 1 << codeSize;
      }
      prefix = k;
    }
  }
  // Emit the final prefix.
  writeBits(prefix, codeSize);
  writeBits(endCode, codeSize);
  // Flush remaining bits.
  if (bitCount > 0) {
    dataBytes.push(bitBuffer & 0xff);
  }

  // ---- Wrap into GIF89a byte stream ----
  const out: number[] = [];

  // Header
  for (const c of 'GIF89a') out.push(c.charCodeAt(0));

  // Logical Screen Descriptor
  writeU16(out, width);
  writeU16(out, height);
  // packed: global color table flag = 1, color resolution = 7
  // (8 bits per channel), sort = 0, GCT size = 7 (2^(7+1) = 256 entries)
  out.push(0b11110111);
  out.push(0); // background color index
  out.push(0); // pixel aspect ratio

  // Global Color Table (256 * 3 = 768 bytes)
  for (let i = 0; i < palette.length; i++) out.push(palette[i]);

  // Graphics Control Extension — declare palette entry 0 as transparent.
  out.push(0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, transparentIndex, 0x00);

  // Image Descriptor
  out.push(0x2c);
  writeU16(out, 0); // left
  writeU16(out, 0); // top
  writeU16(out, width);
  writeU16(out, height);
  out.push(0); // packed: no local color table, no interlace

  // Image data: LZW minimum code size, then sub-blocks.
  out.push(minCodeSize);
  let dataOffset = 0;
  while (dataOffset < dataBytes.length) {
    const blockSize = Math.min(255, dataBytes.length - dataOffset);
    out.push(blockSize);
    for (let i = 0; i < blockSize; i++) out.push(dataBytes[dataOffset + i]);
    dataOffset += blockSize;
  }
  out.push(0); // block terminator

  // Trailer
  out.push(0x3b);

  return new Uint8Array(out);
}