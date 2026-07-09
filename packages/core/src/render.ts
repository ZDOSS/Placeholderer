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
  Asset,
  ImageAsset,
  SpriteSheetAsset,
  TilesetAsset,
  UiPanelAsset,
  LabelPosition,
  NumberingStyle,
  FrameStyle,
  BaseAsset,
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
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowColor: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  beginPath(): void;
  ellipse(cx: number, cy: number, rx: number, ry: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  setLineDash?(segments: number[]): void;
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
  ctx.font = 'bold 18px system-ui, sans-serif';
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

/** Format a 1-based frame/tile index according to numbering_style. */
export function formatFrameNumber(
  n: number,
  style: NumberingStyle | undefined,
  padWidth: number
): string {
  if (style === 'none') return '';
  if (style === 'plain') return String(n);
  // zero-padded is the default (spec + schema).
  return String(n).padStart(Math.max(1, padWidth), '0');
}

/**
 * Draw the asset background. Honors background_color and fill_mode.
 *
 * custom_fill_image is accepted on the schema but actual raster image
 * loading is environment-specific (browser Image / node loadImage).
 * When fill_mode is "repeat" (or a custom_fill_image path is set),
 * we paint a procedural checker overlay so the fill intent is visible
 * even without loading an external raster. "stretch" keeps a flat fill.
 */
function drawBackground(
  ctx: Canvas2D,
  w: number,
  h: number,
  asset: Pick<BaseAsset, 'background_color' | 'fill_mode' | 'custom_fill_image'>,
  defaultColor: string
): void {
  ctx.fillStyle = asset.background_color || defaultColor;
  ctx.fillRect(0, 0, w, h);

  const wantsTile =
    asset.fill_mode === 'repeat' ||
    (asset.custom_fill_image != null && asset.custom_fill_image !== '');
  if (!wantsTile) return;

  // Procedural checker — stands in for a tiled custom fill image.
  const tile = 16;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 0; y < h; y += tile) {
    for (let x = 0; x < w; x += tile) {
      if (((x / tile) + (y / tile)) % 2 === 0) {
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }
}

export function drawImageAsset(dc: DrawContext, asset: ImageAsset): void {
  const { ctx, width: w, height: h } = dc;

  drawBackground(ctx, w, h, asset, '#4A5568');

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
  const showGrid = asset.show_grid !== false;
  const totalFrames = rows * cols;
  // Zero-padded style expects at least two digits (01, 02…) even for
  // short sheets; grow with total frame count beyond 99.
  const padWidth = Math.max(2, String(totalFrames).length);

  drawBackground(ctx, w, h, asset, '#2D3748');

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * fw;
      const y = r * fh;

      ctx.fillStyle = '#3D4F5F';
      ctx.fillRect(x + 1, y + 1, fw - 2, fh - 2);

      if (showGrid) {
        ctx.strokeStyle = '#4A5568';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, fw, fh);
      }

      if (asset.label_enabled !== false) {
        const frameNum = r * cols + c + 1;
        const label = formatFrameNumber(frameNum, asset.numbering_style, padWidth);
        if (label) {
          ctx.font = '12px system-ui, sans-serif';
          ctx.fillStyle = '#A0AEC0';
          ctx.textAlign = 'left';
          ctx.fillText(label, x + 6, y + 16);
        }
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
  const total = Math.max(1, cols * rows);
  const padWidth = Math.max(2, String(total).length);

  drawBackground(ctx, w, h, asset, '#2D3748');

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tw;
      const y = r * th;

      ctx.fillStyle = (r + c) % 2 === 0 ? '#3D4F5F' : '#2D3748';
      ctx.fillRect(x + 1, y + 1, tw - 2, th - 2);

      ctx.strokeRect(x, y, tw, th);

      if (asset.label_enabled !== false) {
        const index = r * cols + c;
        // Tilesets use 0-based indices; numbering_style still applies.
        const label = formatFrameNumber(index, asset.numbering_style, padWidth);
        if (label || asset.numbering_style === 'none') {
          // When style is none, skip. formatFrameNumber already returns ''.
          if (label) {
            ctx.font = '10px system-ui, sans-serif';
            ctx.fillStyle = '#718096';
            ctx.textAlign = 'left';
            ctx.fillText(label, x + 4, y + 13);
          }
        }
      }
    }
  }
}

function drawPanelFrame(
  ctx: Canvas2D,
  w: number,
  h: number,
  style: FrameStyle | undefined
): void {
  const frameStyle: FrameStyle = style ?? 'simple';

  if (frameStyle === 'beveled') {
    // Light top/left, dark bottom/right.
    ctx.fillStyle = '#4A5568';
    ctx.fillRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = '#A0AEC0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, h - 8);
    ctx.lineTo(8, 8);
    ctx.lineTo(w - 8, 8);
    ctx.stroke();
    ctx.strokeStyle = '#1A202C';
    ctx.beginPath();
    ctx.moveTo(w - 8, 8);
    ctx.lineTo(w - 8, h - 8);
    ctx.lineTo(8, h - 8);
    ctx.stroke();
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    return;
  }

  if (frameStyle === 'inset') {
    // Inverse of beveled: dark top/left, light bottom/right.
    ctx.fillStyle = '#1A202C';
    ctx.fillRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = '#1A202C';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, h - 8);
    ctx.lineTo(8, 8);
    ctx.lineTo(w - 8, 8);
    ctx.stroke();
    ctx.strokeStyle = '#A0AEC0';
    ctx.beginPath();
    ctx.moveTo(w - 8, 8);
    ctx.lineTo(w - 8, h - 8);
    ctx.lineTo(8, h - 8);
    ctx.stroke();
    ctx.fillStyle = '#2D3748';
    ctx.fillRect(16, 16, w - 32, h - 32);
    return;
  }

  if (frameStyle === 'outlined') {
    ctx.strokeStyle = '#A0AEC0';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.strokeStyle = '#4A5568';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    return;
  }

  // simple (default) — multi-ring frame used historically.
  ctx.strokeStyle = '#718096';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  ctx.strokeStyle = '#A0AEC0';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, w - 40, h - 40);
}

function drawPanelGuides(ctx: Canvas2D, w: number, h: number): void {
  // Nine-slice construction guides: 1/3 vertical and horizontal splits.
  const x1 = Math.round(w / 3);
  const x2 = Math.round((2 * w) / 3);
  const y1 = Math.round(h / 3);
  const y2 = Math.round((2 * h) / 3);

  ctx.save();
  ctx.strokeStyle = 'rgba(246, 224, 94, 0.7)';
  ctx.lineWidth = 1;
  if (typeof ctx.setLineDash === 'function') {
    ctx.setLineDash([4, 4]);
  }
  ctx.beginPath();
  ctx.moveTo(x1, 0); ctx.lineTo(x1, h);
  ctx.moveTo(x2, 0); ctx.lineTo(x2, h);
  ctx.moveTo(0, y1); ctx.lineTo(w, y1);
  ctx.moveTo(0, y2); ctx.lineTo(w, y2);
  ctx.stroke();
  if (typeof ctx.setLineDash === 'function') {
    ctx.setLineDash([]);
  }
  ctx.restore();
}

export function drawUiPanelAsset(dc: DrawContext, asset: UiPanelAsset): void {
  const { ctx, width: w, height: h } = dc;

  drawBackground(ctx, w, h, asset, '#2D3748');
  drawPanelFrame(ctx, w, h, asset.frame_style);

  // panel_guides are construction aids — useful in preview and when
  // the user explicitly wants them in the exported image. Spec says
  // final export is clean by default; we honor the flag when true.
  if (asset.panel_guides) {
    drawPanelGuides(ctx, w, h);
  }

  if (asset.label_enabled !== false) {
    drawLabel(ctx, asset.name, w / 2, h / 2, w - 60);
  }
}

/**
 * Dispatch to the correct draw function for any image-style asset.
 * Audio assets have no canvas representation — callers should skip them.
 */
export function drawAsset(dc: DrawContext, asset: Asset): void {
  switch (asset.kind) {
    case 'sprite_sheet':
      drawSpriteSheetAsset(dc, asset);
      return;
    case 'tileset':
      drawTilesetAsset(dc, asset);
      return;
    case 'ui_panel':
      drawUiPanelAsset(dc, asset);
      return;
    case 'image':
      drawImageAsset(dc, asset);
      return;
    case 'audio':
      // No canvas output for audio.
      return;
  }
}

/** Build the JSON payload for a ui_panel metadata sidecar. */
export function buildPanelMetadata(asset: UiPanelAsset): Record<string, unknown> {
  return {
    kind: 'ui_panel',
    name: asset.name,
    width: asset.width,
    height: asset.height,
    format: asset.format,
    frame_style: asset.frame_style ?? 'simple',
    panel_guides: asset.panel_guides ?? false,
    // Nine-slice guide positions matching drawPanelGuides.
    nine_slice: {
      left: Math.round(asset.width / 3),
      right: Math.round((2 * asset.width) / 3),
      top: Math.round(asset.height / 3),
      bottom: Math.round((2 * asset.height) / 3),
    },
  };
}
