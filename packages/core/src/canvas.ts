// Environment-agnostic canvas abstraction.
//
// A CanvasBackend produces CanvasHandle objects, which pair a draw
// context (compatible with the methods in render.ts) with an
// async encoder. Browser (OffscreenCanvas) and Node (@napi-rs/canvas)
// backends both implement this interface, so generateJob can run in
// either environment without caring which.

import type { Canvas2D } from './render.js';

export interface CanvasHandle {
  ctx: Canvas2D;
  encode(mimeType: string): Promise<Uint8Array>;
}

export interface CanvasBackend {
  createCanvas(width: number, height: number): CanvasHandle;
}
