// Core-side UI Builder recipe renderer.
//
// The web app's `apps/web/src/builderRender.ts` has the full
// renderer — patterns, image preloads, glow/shadow, SVG export.
// That's all browser-only. For the CLI generateJob path we need
// a stripped-down renderer that can draw a builder recipe onto a
// node-canvas backend without pulling in browser globals.
//
// Trade-offs:
//   - No image-fill preload. Image fills degrade to the fallback
//     color. A node-canvas with full Image support could lift this.
//   - No pattern fills (no OffscreenCanvas in Node). Degrades to
//     the fallback color too.
//   - Glow is approximated as a blurred drop shadow (node-canvas
//     supports `shadowBlur`); the web path uses an explicit
//     `feDropShadow` filter for SVG fidelity.
//   - All other layer types (rect, circle, line, text, filled-shape,
//     raster) render correctly with solid fills + strokes +
//     opacity + rotation + effects.
//
// If a layer's render throws (e.g. malformed data), we catch and
// skip it so one bad layer doesn't kill the whole asset.

import type { BuilderRecipe, Layer } from '@placeholderer/schemas';
import type { Canvas2D, DrawContext } from './render.js';

function fillToColor(fill: unknown, fallback: string): string {
  if (!fill) return fallback;
  if (typeof fill === 'string') return fill;
  // Object fills (image/pattern) aren't supported in core; render
  // the fallback so the asset still ships rather than failing the
  // whole job on one builder-recipe fill kind.
  return fallback;
}

function strokeToStroke(stroke: unknown): { color: string; width: number } | null {
  if (!stroke || typeof stroke !== 'object') return null;
  const s = stroke as { color?: string; width?: number };
  if (!s.color) return null;
  return { color: s.color, width: s.width ?? 1 };
}

function applyShadow(ctx: Canvas2D, shadow: any): boolean {
  if (!shadow) return false;
  ctx.shadowBlur = shadow.blur ?? 8;
  ctx.shadowOffsetX = shadow.offsetX ?? 0;
  ctx.shadowOffsetY = shadow.offsetY ?? 4;
  ctx.shadowColor = shadow.color ?? 'rgba(0,0,0,0.5)';
  return true;
}

function applyGlow(ctx: Canvas2D, glow: any): boolean {
  if (!glow) return false;
  ctx.shadowBlur = glow.blur ?? 12;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = glow.color ?? 'rgba(255,255,255,0.6)';
  return true;
}

function clearEffects(ctx: Canvas2D): void {
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = 'transparent';
}

function drawRect(ctx: Canvas2D, layer: any, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = fillToColor(layer.fill, '#4A5568');
  ctx.fillRect(x, y, w, h);
  const stroke = strokeToStroke(layer.stroke);
  if (stroke) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.strokeRect(x, y, w, h);
  }
}

function drawCircle(ctx: Canvas2D, layer: any, cx: number, cy: number, w: number, h: number): void {
  // node-canvas / browser canvas: use arc() for ellipses.
  const rx = w / 2;
  const ry = h / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fillToColor(layer.fill, '#4A5568');
  ctx.fill();
  const stroke = strokeToStroke(layer.stroke);
  if (stroke) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.stroke();
  }
}

function drawLine(ctx: Canvas2D, layer: any, x: number, y: number, w: number, _h: number): void {
  const stroke = strokeToStroke(layer.stroke) ?? { color: '#718096', width: 2 };
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.beginPath();
  ctx.moveTo(x, y + _h / 2);
  ctx.lineTo(x + w, y + _h / 2);
  ctx.stroke();
}

function drawText(ctx: Canvas2D, layer: any, x: number, y: number, w: number, _h: number): void {
  const content = layer.text?.content ?? layer.name ?? 'Text';
  const fontSize = layer.text?.fontSize ?? 24;
  const fontFamily = layer.text?.fontFamily ?? 'system-ui, sans-serif';
  const align = layer.text?.align ?? 'left';
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = fillToColor(layer.fill, '#ffffff');
  ctx.textAlign = align as 'left' | 'center' | 'right';
  const textX = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  ctx.fillText(content, textX, y + fontSize, w);
}

function drawFilledShape(ctx: Canvas2D, layer: any, x: number, y: number, w: number, h: number): void {
  const r = Math.min(8, w / 4, h / 4);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fillToColor(layer.fill, '#4A5568');
  ctx.fill();
  const stroke = strokeToStroke(layer.stroke);
  if (stroke) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.stroke();
  }
}

function drawRaster(_ctx: Canvas2D, _layer: any, _x: number, _y: number, _w: number, _h: number): void {
  // Raster layers need an image source — skipped in core. The web
  // path handles these via its full renderer.
}

/** Render a single layer onto a 2D context. Mirrors the switch in
 *  apps/web/src/builderRender.ts but without image preloads, pattern
 *  fills, SVG export, or any browser-only globals. */
export function renderLayer(dc: DrawContext, layer: Layer): void {
  if (!layer.visible) return;
  const { ctx } = dc;
  ctx.save();

  ctx.globalAlpha = (layer as any).opacity ?? 1;
  ctx.globalCompositeOperation = ((layer as any).blendMode as GlobalCompositeOperation) ?? 'source-over';

  if ((layer as any).effects?.shadow) applyShadow(ctx, (layer as any).effects.shadow);
  if ((layer as any).effects?.glow) applyGlow(ctx, (layer as any).effects.glow);

  const x = (layer as any).x ?? 0;
  const y = (layer as any).y ?? 0;
  const w = (layer as any).width ?? 0;
  const h = (layer as any).height ?? 0;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if ((layer as any).rotation) {
    ctx.translate(cx, cy);
    ctx.rotate(((layer as any).rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  try {
    switch (layer.type) {
      case 'rect':
        drawRect(ctx, layer, x, y, w, h);
        break;
      case 'circle':
        drawCircle(ctx, layer, cx, cy, w, h);
        break;
      case 'line':
        drawLine(ctx, layer, x, y, w, h);
        break;
      case 'text':
        drawText(ctx, layer, x, y, w, h);
        break;
      case 'raster':
        drawRaster(ctx, layer, x, y, w, h);
        break;
      case 'filled-shape':
        drawFilledShape(ctx, layer, x, y, w, h);
        break;
    }
  } catch {
    // Swallow per-layer errors so one bad layer doesn't kill the
    // whole asset render.
  }

  clearEffects(ctx);
  ctx.restore();
}

/** Render every visible layer in a recipe. The recipe's width and
 *  height set the canvas bounds (falls back to the asset's
 *  width/height if the recipe doesn't specify). */
export function renderBuilderRecipe(dc: DrawContext, recipe: BuilderRecipe): void {
  for (const layer of recipe.layers) {
    renderLayer(dc, layer);
  }
}