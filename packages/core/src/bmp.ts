// BMP encoder.
//
// Browsers don't expose `canvas.toBlob('image/bmp')`, so we serialize
// from a flat RGBA byte array ourselves. Used by both the web export
// path and the CLI encode path so PNG/JPG/JPEG/BMP/GIF all share
// the same round-trip semantics through `@placeholderer/core`.
//
// Output layout: 14-byte file header + 40-byte BITMAPINFOHEADER
// (BI_RGB, 32 bpp) + bottom-up BGRA pixel rows, each padded to a
// 4-byte boundary. This is the format every OS image viewer reads.

const FILE_HEADER_SIZE = 14;
const DIB_HEADER_SIZE = 40;
const PIXEL_OFFSET = FILE_HEADER_SIZE + DIB_HEADER_SIZE;

/** Encode an RGBA buffer as a Windows BMP. Width and height must
 *  be positive integers; the buffer length must equal width * height * 4. */
export function encodeBmp(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`encodeBmp: width/height must be positive integers (got ${width}x${height})`);
  }
  if (rgba.length !== width * height * 4) {
    throw new Error(`encodeBmp: buffer length ${rgba.length} does not match ${width}x${height}x4`);
  }

  // Each row of BGRA pixels is padded to a 4-byte boundary.
  const rowBytes = width * 4;
  const paddedRowBytes = (rowBytes + 3) & ~3;
  const pixelBytes = paddedRowBytes * height;
  const fileSize = PIXEL_OFFSET + pixelBytes;
  const out = new Uint8Array(fileSize);
  const view = new DataView(out.buffer);

  // ---- File header (14 bytes) ----
  out[0] = 0x42; // 'B'
  out[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true); // file size
  view.setUint32(6, 0, true); // reserved
  view.setUint32(10, PIXEL_OFFSET, true); // pixel data offset

  // ---- DIB header (40 bytes, BITMAPINFOHEADER) ----
  view.setUint32(14, DIB_HEADER_SIZE, true); // header size
  view.setInt32(18, width, true); // width
  view.setInt32(22, height, true); // height (positive = bottom-up)
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 32, true); // bits per pixel
  view.setUint32(30, 0, true); // BI_RGB (uncompressed)
  view.setUint32(34, pixelBytes, true); // image size (may be 0 for BI_RGB)
  view.setInt32(38, 2835, true); // x ppm (≈72 dpi)
  view.setInt32(42, 2835, true); // y ppm
  view.setUint32(46, 0, true); // colors used (0 = default)
  view.setUint32(50, 0, true); // colors important

  // ---- Pixel data, bottom-up, BGRA with row padding ----
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width; // bottom-up
    const dstRow = PIXEL_OFFSET + y * paddedRowBytes;
    for (let x = 0; x < width; x++) {
      const s = (srcRow + x) * 4;
      const d = dstRow + x * 4;
      out[d] = rgba[s + 2]; // B
      out[d + 1] = rgba[s + 1]; // G
      out[d + 2] = rgba[s]; // R
      out[d + 3] = rgba[s + 3]; // A
    }
    // Tail of the row stays zero (the Uint8Array was zero-initialized),
    // which is exactly the 4-byte pad BMP requires.
  }

  return out;
}