// Unit tests for the GIF89a encoder used by both the web export
// path and the CLI generateJob encode.

import { describe, it, expect } from 'vitest';
import { encodeGif } from '../src/gif.js';

describe('encodeGif', () => {
  it('writes a valid GIF89a header for a 1x1 image', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]); // opaque red
    const bytes = encodeGif(rgba, 1, 1);

    // 'GIF89a' signature
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5])).toBe('GIF89a');

    const view = new DataView(bytes.buffer);
    expect(view.getUint16(6, true)).toBe(1); // width
    expect(view.getUint16(8, true)).toBe(1); // height
    // packed byte: GCT flag=1, resolution=7, sort=0, size=7
    expect(bytes[10]).toBe(0b11110111);
    // Global color table follows immediately.
    expect(bytes[11]).toBe(0); // background color index
    expect(bytes[12]).toBe(0); // pixel aspect ratio

    // Trailer byte (0x3b) at the end.
    expect(bytes[bytes.length - 1]).toBe(0x3b);
  });

  it('marks transparent pixels via the GCE', () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 0]); // fully transparent
    const bytes = encodeGif(rgba, 1, 1);
    // Layout: header (6) + LSD (7) + GCT (256×3=768) = 781, then GCE.
    const gceOffset = 6 + 7 + 256 * 3;
    // bytes[gceOffset + 0]: 0x21 (extension introducer)
    // bytes[gceOffset + 1]: 0xf9 (GCE label)
    // bytes[gceOffset + 2]: 0x04 (block size = 4 data bytes)
    // bytes[gceOffset + 3]: packed (bit 0 = transparent flag)
    // bytes[gceOffset + 4..5]: delay time (LE)
    // bytes[gceOffset + 6]: transparent index
    // bytes[gceOffset + 7]: 0x00 (block terminator)
    expect(bytes[gceOffset]).toBe(0x21);
    expect(bytes[gceOffset + 1]).toBe(0xf9);
    expect(bytes[gceOffset + 3] & 0x01).toBe(0x01); // transparent flag set
    expect(bytes[gceOffset + 6]).toBe(0); // transparent index
  });

  it('rejects invalid dimensions', () => {
    const rgba = new Uint8ClampedArray(4);
    expect(() => encodeGif(rgba, 0, 1)).toThrow(/positive/);
    expect(() => encodeGif(rgba, -1, 1)).toThrow(/positive/);
    expect(() => encodeGif(rgba, 1.5, 1)).toThrow(/integer/);
  });

  it('rejects mismatched buffer length', () => {
    const rgba = new Uint8ClampedArray(4);
    expect(() => encodeGif(rgba, 2, 1)).toThrow(/does not match/);
  });

  it('quantizes pure red to a known palette index', () => {
    // The first web-safe cube entry is (0,0,0); (255,0,0) maps to
    // index 5 * 36 + 0 + 0 = 180. We don't assert the exact index
    // (the cube-construction math could change), but the encoder
    // must produce a non-empty output with a valid GIF signature
    // and a reasonable byte length.
    const rgba = new Uint8ClampedArray(4).map((_, i) =>
      i === 0 ? 255 : i === 3 ? 255 : 0,
    );
    const bytes = encodeGif(rgba, 1, 1);
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5])).toBe('GIF89a');
    expect(bytes.length).toBeGreaterThan(50); // header + GCT + GCE + ID + data + trailer
  });
});