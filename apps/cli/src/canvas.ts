// Node-side canvas backend.
//
// Wraps @napi-rs/canvas so generateJob can run in Node without
// knowing it's not in a browser. SKRSContext2D satisfies the
// structural Canvas2D type in @placeholderer/core/render.

import { createCanvas, type SKRSContext2D, type Canvas as NodeCanvas } from '@napi-rs/canvas';
import type { CanvasBackend, CanvasHandle, Canvas2D } from '@placeholderer/core';

export const nodeCanvasBackend: CanvasBackend = {
  createCanvas(width, height) {
    const canvas: NodeCanvas = createCanvas(width, height);
    const ctx: SKRSContext2D = canvas.getContext('2d');
    return {
      ctx: ctx as unknown as Canvas2D,
      encode: async (mime) => {
        // @napi-rs/canvas accepts the same MIME strings the browser does.
        return canvas.toBuffer(mime as any);
      },
    };
  },
};
