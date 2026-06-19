// Unit tests for the BMP encoder used by both the web export
// path and the CLI generateJob encode.

import { describe, it, expect } from 'vitest';
import { encodeBmp } from '../src/bmp.js';

describe('encodeBmp', () => {
  it('writes a valid BMP file header for a 1x1 image', () => {
    // Input is RGBA: R=10, G=20, B=30, A=255
    const rgba = new Uint8ClampedArray([10, 20, 30, 255]);
    const bytes = encodeBmp(rgba, 1, 1);

    // 'BM' signature
    expect(bytes[0]).toBe(0x42);
    expect(bytes[1]).toBe(0x4d);

    const view = new DataView(bytes.buffer);
    // File size = 14 (file header) + 40 (DIB) + 4 (1x1 BGRA, padded to 4)
    expect(view.getUint32(2, true)).toBe(58);
    expect(view.getUint32(10, true)).toBe(54); // pixel data offset

    // BITMAPINFOHEADER
    expect(view.getUint32(14, true)).toBe(40); // header size
    expect(view.getInt32(18, true)).toBe(1); // width
    expect(view.getInt32(22, true)).toBe(1); // height
    expect(view.getUint16(28, true)).toBe(32); // 32 bpp
    expect(view.getUint32(30, true)).toBe(0); // BI_RGB

    // Pixel data at bytes[54..57] — BMP uses BGRA order on disk.
    // Input RGBA = (R=10, G=20, B=30, A=255) → output BGRA = (B=30, G=20, R=10, A=255).
    expect(bytes[54]).toBe(30); // B
    expect(bytes[55]).toBe(20); // G
    expect(bytes[56]).toBe(10); // R
    expect(bytes[57]).toBe(255); // A
  });

  it('encodes the bottom row first (BMP is bottom-up)', () => {
    // 1x2 image: src[0] = top (R=255), src[1] = bottom (B=255).
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 255, // top of image
      0, 0, 255, 255, // bottom of image
    ]);
    const bytes = encodeBmp(rgba, 1, 2);
    const pixelStart = 14 + 40;

    // Row 0 of the BMP file is the BOTTOM of the image, so blue
    // (R=0, G=0, B=255) should appear first.
    expect(bytes[pixelStart + 0]).toBe(255); // B
    expect(bytes[pixelStart + 1]).toBe(0); // G
    expect(bytes[pixelStart + 2]).toBe(0); // R
    expect(bytes[pixelStart + 3]).toBe(255); // A

    // Row 1 (next 4 bytes) is the TOP of the image, so red
    // (R=255, G=0, B=0) should appear here.
    const row2 = pixelStart + 4;
    expect(bytes[row2 + 0]).toBe(0); // B
    expect(bytes[row2 + 1]).toBe(0); // G
    expect(bytes[row2 + 2]).toBe(255); // R
    expect(bytes[row2 + 3]).toBe(255); // A
  });

  it('pads each row to a 4-byte boundary', () => {
    // 3x1 image: row has 3 BGRA pixels = 12 bytes; row already a
    // multiple of 4 so padding is zero.
    const rgba = new Uint8ClampedArray([
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
    ]);
    const bytes = encodeBmp(rgba, 3, 1);
    expect(bytes.length).toBe(14 + 40 + 12);

    // 5x1 image: row has 5 BGRA pixels = 20 bytes, pad to 20; still 20.
    const rgba4 = new Uint8ClampedArray(Array(20).fill(0));
    const bytes4 = encodeBmp(rgba4, 5, 1);
    expect(bytes4.length).toBe(14 + 40 + 20);
  });

  it('pads short rows to 4 bytes', () => {
    // 2x1 image: row has 2 BGRA pixels = 8 bytes; 8 is already a
    // multiple of 4 so the file size = header + 8.
    const rgba = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]);
    const bytes = encodeBmp(rgba, 2, 1);
    expect(bytes.length).toBe(14 + 40 + 8);
    // Pixel bytes (BGRA): input RGBA = (1,2,3,4), (5,6,7,8)
    expect(bytes[54]).toBe(3); // B from first pixel
    expect(bytes[55]).toBe(2); // G
    expect(bytes[56]).toBe(1); // R
    expect(bytes[57]).toBe(4); // A
  });

  it('rejects invalid dimensions', () => {
    const rgba = new Uint8ClampedArray(4);
    expect(() => encodeBmp(rgba, 0, 1)).toThrow(/positive/);
    expect(() => encodeBmp(rgba, -1, 1)).toThrow(/positive/);
    expect(() => encodeBmp(rgba, 1.5, 1)).toThrow(/integer/);
  });

  it('rejects mismatched buffer length', () => {
    // 2x1 image expects 8 bytes, but only 4 supplied.
    const rgba = new Uint8ClampedArray(4);
    expect(() => encodeBmp(rgba, 2, 1)).toThrow(/does not match/);
    // And 1x1 image expects 4 bytes, but 8 supplied.
    expect(() => encodeBmp(new Uint8ClampedArray(8), 1, 1)).toThrow(/does not match/);
  });
});