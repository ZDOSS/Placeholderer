// Environment-agnostic draw primitives.
// These functions operate on any Canvas2D-like context — both the browser's
// OffscreenCanvasRenderingContext2D and Node's @napi-rs/canvas SKRSContext2D
// satisfy this shape for the methods we use.
//
// We define our own minimal interface (rather than relying on the DOM
// CanvasRenderingContext2D) because:
//   - OffscreenCanvasRenderingContext2D doesn't expose every method on
//     the DOM type.
//   - node-canvas exposes a similar but not identical set.
//   - The DOM types (CanvasGradient, CanvasTextAlign, etc.) live in
//     lib.dom.d.ts, which is a browser-only type library that should
//     not leak into env-agnostic code.

import type {
  ImageAsset,
  SpriteSheetAsset,
  TilesetAsset,
  UiPanelAsset,
  LabelPosition,
} from '@placeholderer/schemas';

export type TextAlign = 'start' | 'end' | 'left' | 'right' | 'center';

// The DOM Canvas2D type allows fillStyle/strokeStyle to be a gradient or
// pattern object as well as a string. We don't pull those DOM-only types
// (CanvasGradient, CanvasPattern) into env-agnostic code; we only ever
// assign string hex values, so the narrower `string` type is correct.
// generate.ts uses an `as unknown as Canvas2D` cast at the call site to
// bridge the structural variance — see the comment there.
export interface Canvas2D {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: TextAlign;
  globalAlpha: number;
  globalCompositeOperation: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
}

export interface DrawContext {
  ctx: Canvas2D;
  width: number;
  height: number;
}

function drawLabel(
  ctx: Canvas2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
) {
  ctx.font = 'bold 18px system-ui';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.textAlign = 'center';
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillText(text, x, y, maxWidth);
}

function drawAssetLabel(
  ctx: Canvas2D,
  text: string,
  position: LabelPosition | undefined,
  w: number,
  h: number
) {
  const pos: LabelPosition = position ?? 'corners';
  if (pos === 'corners') {
    drawLabel(ctx, text, 30, 28, w - 60);
    drawLabel(ctx, text, w - 30, 28, w - 60);
    drawLabel(ctx, text, 30, h - 20, w - 60);
    drawLabel(ctx, text, w - 30, h - 20, w - 60);
  } else if (pos === 'top-center') {
    drawLabel(ctx, text, w / 2, 28, w - 40);
  } else if (pos === 'bottom-center') {
    drawLabel(ctx, text, w / 2, h - 20, w - 40);
  } else {
    // 'center' and any unknown future value
    drawLabel(ctx, text, w / 2, h / 2, w - 40);
  }
}

export function drawImageAsset(dc: DrawContext, asset: ImageAsset): void {
  const { ctx, width: w, height: h } = dc;

  ctx.fillStyle = asset.background_color || '#4A5568';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#718096';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  if (asset.label_enabled !== false) {
    drawAssetLabel(ctx, asset.name, asset.label_position, w, h);
  }
}

export function drawSpriteSheetAsset(dc: DrawContext, asset: SpriteSheetAsset): void {
  const { ctx, width: w, height: h } = dc;
  // Defaults are applied here (not just at the schema layer) so non-AJV
  // callers — e.g. the CSV import path — produce a usable sprite sheet
  // even when frame_width/frame_height/rows/columns are missing.
  const fw = asset.frame_width || 64;
  const fh = asset.frame_height || 64;
  const cols = asset.columns || 4;
  const rows = asset.rows || 2;

  ctx.fillStyle = asset.background_color || '#2D3748';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * fw;
      const y = r * fh;

      ctx.fillStyle = '#3D4F5F';
      ctx.fillRect(x + 1, y + 1, fw - 2, fh - 2);

      ctx.strokeRect(x, y, fw, fh);

      if (asset.label_enabled !== false) {
        const frameNum = r * cols + c + 1;
        ctx.font = '12px system-ui';
        ctx.fillStyle = '#A0AEC0';
        ctx.fillText(String(frameNum), x + 6, y + 16);
      }
    }
  }

  if (asset.label_enabled !== false) {
    drawLabel(ctx, asset.name, w / 2, h - 18, w - 40);
  }
}

export function drawTilesetAsset(dc: DrawContext, asset: TilesetAsset): void {
  const { ctx, width: w, height: h } = dc;
  const tw = asset.tile_width;
  const th = asset.tile_height;
  const cols = Math.floor(w / tw);
  const rows = Math.floor(h / th);

  ctx.fillStyle = asset.background_color || '#2D3748';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tw;
      const y = r * th;

      ctx.fillStyle = (r + c) % 2 === 0 ? '#3D4F5F' : '#2D3748';
      ctx.fillRect(x + 1, y + 1, tw - 2, th - 2);

      ctx.strokeRect(x, y, tw, th);

      const index = r * cols + c;
      ctx.font = '10px system-ui';
      ctx.fillStyle = '#718096';
      ctx.fillText(String(index), x + 4, y + 13);
    }
  }
}

export function drawUiPanelAsset(dc: DrawContext, asset: UiPanelAsset): void {
  const { ctx, width: w, height: h } = dc;

  ctx.fillStyle = asset.background_color || '#2D3748';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#718096';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  ctx.strokeStyle = '#A0AEC0';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  if (asset.label_enabled !== false) {
    drawLabel(ctx, asset.name, w / 2, h / 2, w - 60);
  }
}
