// Node-side canvas backend.
//
// Wraps @napi-rs/canvas so generateJob can run in Node without
// knowing it's not in a browser. SKRSContext2D satisfies the
// structural Canvas2D type in @placeholderer/core/render.

import { createCanvas, type SKRSContext2D, type Canvas as NodeCanvas } from '@napi-rs/canvas';
import { encodeBmp, encodeGif, type CanvasBackend, type CanvasHandle, type Canvas2D } from '@placeholderer/core';

export const nodeCanvasBackend: CanvasBackend = {
  createCanvas(width, height) {
    const canvas: NodeCanvas = createCanvas(width, height);
    const ctx: SKRSContext2D = canvas.getContext('2d');
    return {
      ctx: ctx as unknown as Canvas2D,
      encode: async (mime) => {
        // BMP and GIF aren't supported by @napi-rs/canvas's toBuffer,
        // so we read the RGBA pixel data and run our own encoders.
        if (mime === 'image/bmp') {
          const data = ctx.getImageData(0, 0, width, height);
          return encodeBmp(data.data, width, height);
        }
        if (mime === 'image/gif') {
          const data = ctx.getImageData(0, 0, width, height);
          return encodeGif(data.data, width, height);
        }
        // @napi-rs/canvas accepts the same MIME strings the browser does.
        return canvas.toBuffer(mime as any);
      },
    };
  },
};
