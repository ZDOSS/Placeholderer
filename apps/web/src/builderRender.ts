// Pure canvas rendering for the UI Builder. Operates on the schema's
// Layer discriminated union so the runtime type matches the persisted
// recipe format. The exported helpers are also used by the SVG
// serializer and the PNG/JPG canvas export.

import type {
  Layer,
  LayerType,
  FillSpec,
  StrokeSpec,
  ShadowEffect,
  GlowEffect,
} from '@placeholderer/schemas';

export interface BuilderCtx {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

/** Resolve a FillSpec to a string color, falling back to a default. */
export function fillToColor(fill: FillSpec | undefined, fallback: string): string {
  if (!fill) return fallback;
  if (typeof fill === 'string') return fill;
  // Image and pattern fills are not yet implemented in the v1 render
  // path; fall back to the default color.
  return fallback;
}

/** Resolve a StrokeSpec to a usable stroke (color + width). */
export function strokeToStroke(stroke: StrokeSpec | undefined): { color: string; width: number } | null {
  if (!stroke) return null;
  const width = stroke.width ?? 1;
  if (!stroke.color) return null;
  return { color: stroke.color, width };
}

/** Apply shadow effect to the context. */
export function applyShadow(ctx: CanvasRenderingContext2D, shadow: ShadowEffect | undefined): boolean {
  if (!shadow) return false;
  ctx.shadowBlur = shadow.blur ?? 8;
  ctx.shadowOffsetX = shadow.offsetX ?? 0;
  ctx.shadowOffsetY = shadow.offsetY ?? 4;
  ctx.shadowColor = shadow.color ?? 'rgba(0,0,0,0.5)';
  return true;
}

/** Apply glow effect to the context. */
export function applyGlow(ctx: CanvasRenderingContext2D, glow: GlowEffect | undefined): boolean {
  if (!glow) return false;
  ctx.shadowBlur = glow.blur ?? 12;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = glow.color ?? 'rgba(255,255,255,0.6)';
  return true;
}

export function clearEffects(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = 'transparent';
}

export function renderLayer(dc: BuilderCtx, layer: Layer): void {
  if (!layer.visible) return;
  const { ctx } = dc;
  ctx.save();

  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.globalCompositeOperation = (layer.blendMode as GlobalCompositeOperation) ?? 'source-over';

  // Effects
  if (layer.effects?.shadow) applyShadow(ctx, layer.effects.shadow);
  if (layer.effects?.glow) applyGlow(ctx, layer.effects.glow);

  // Position + rotation
  const x = layer.x ?? 0;
  const y = layer.y ?? 0;
  const w = layer.width ?? 0;
  const h = layer.height ?? 0;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (layer.rotation) {
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

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
      drawRaster(dc, layer, x, y, w, h);
      break;
    case 'filled-shape':
      drawFilledShape(ctx, layer, x, y, w, h);
      break;
  }

  clearEffects(ctx);
  ctx.restore();
}

function drawRect(ctx: CanvasRenderingContext2D, layer: any, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = fillToColor(layer.fill, '#4A5568');
  ctx.fillRect(x, y, w, h);
  const stroke = strokeToStroke(layer.stroke);
  if (stroke) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.strokeRect(x, y, w, h);
  }
}

function drawCircle(ctx: CanvasRenderingContext2D, layer: any, cx: number, cy: number, w: number, h: number): void {
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

function drawLine(ctx: CanvasRenderingContext2D, layer: any, x: number, y: number, w: number, h: number): void {
  const stroke = strokeToStroke(layer.stroke) ?? { color: '#718096', width: 2 };
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, layer: any, x: number, y: number, w: number, _h: number): void {
  const content = layer.text?.content ?? layer.name ?? 'Text';
  const fontSize = layer.text?.fontSize ?? 24;
  const fontFamily = layer.text?.fontFamily ?? 'system-ui, sans-serif';
  const align = layer.text?.align ?? 'left';
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = fillToColor(layer.fill, '#ffffff');
  ctx.textAlign = align as CanvasTextAlign;
  const textX = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  ctx.fillText(content, textX, y + fontSize);
}

function drawRaster(dc: BuilderCtx, layer: any, x: number, y: number, w: number, h: number): void {
  const src = layer.rasterSrc;
  if (!src) return;
  const img = new Image();
  img.onload = () => dc.ctx.drawImage(img, x, y, w, h);
  img.src = src;
}

function drawFilledShape(ctx: CanvasRenderingContext2D, layer: any, x: number, y: number, w: number, h: number): void {
  // A simple rounded rectangle for v1; the spec keeps the exact shape
  // flexible.
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

export type SupportedExportFormat = 'png' | 'jpeg' | 'svg';

/**
 * Serialize the layer stack to an SVG document. Used by the
 * "Export SVG" button so the builder output has a real vector path
 * (per the v1 spec's required export formats).
 */
export function exportSVG(layers: Layer[], width: number, height: number): string {
  const body = layers
    .filter((l) => l.visible)
    .map((l) => layerToSVG(l))
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${body}
</svg>`;
}

function layerToSVG(layer: Layer): string {
  const x = layer.x ?? 0;
  const y = layer.y ?? 0;
  const w = layer.width ?? 0;
  const h = layer.height ?? 0;
  const fill = fillToColor(layer.fill, '#4A5568');
  const stroke = strokeToStroke(layer.stroke);
  const strokeAttr = stroke ? ` stroke="${stroke.color}" stroke-width="${stroke.width}"` : '';
  const opacity = layer.opacity != null && layer.opacity !== 1 ? ` opacity="${layer.opacity}"` : '';
  const transform = layer.rotation
    ? ` transform="rotate(${layer.rotation} ${x + w / 2} ${y + h / 2})"`
    : '';
  const filter = buildSVGFilter(layer);

  switch (layer.type) {
    case 'rect':
      return `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${strokeAttr}${opacity}${transform}${filter}/>`;
    case 'circle':
      return `  <ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}"${strokeAttr}${opacity}${transform}${filter}/>`;
    case 'line': {
      const strokeDef = stroke ?? { color: '#718096', width: 2 };
      return `  <line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${strokeDef.color}" stroke-width="${strokeDef.width}"${opacity}${transform}/>`;
    }
    case 'text': {
      const content = escapeXML(layer.text?.content ?? layer.name ?? 'Text');
      const fontSize = layer.text?.fontSize ?? 24;
      const fontFamily = layer.text?.fontFamily ?? 'system-ui, sans-serif';
      const align = layer.text?.align ?? 'left';
      const textAnchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      const textX = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
      return `  <text x="${textX}" y="${y + fontSize}" fill="${fill}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="bold" text-anchor="${textAnchor}"${opacity}${transform}>${content}</text>`;
    }
    case 'raster':
      return layer.rasterSrc
        ? `  <image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXML(layer.rasterSrc)}"${opacity}${transform}/>`
        : '';
    case 'filled-shape': {
      const r = Math.min(8, w / 4, h / 4);
      return `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}"${strokeAttr}${opacity}${transform}${filter}/>`;
    }
  }
}

function buildSVGFilter(layer: Layer): string {
  const parts: string[] = [];
  if (layer.effects?.shadow) {
    const s = layer.effects.shadow;
    parts.push(
      `<filter id="f-${layer.id}-shadow"><feDropShadow dx="${s.offsetX ?? 0}" dy="${s.offsetY ?? 4}" stdDeviation="${(s.blur ?? 8) / 2}" flood-color="${s.color ?? 'rgba(0,0,0,0.5)'}"/></filter>`
    );
  }
  if (layer.effects?.glow) {
    const g = layer.effects.glow;
    parts.push(
      `<filter id="f-${layer.id}-glow"><feGaussianBlur stdDeviation="${(g.blur ?? 12) / 2}"/></filter>`
    );
  }
  if (parts.length === 0) return '';
  return ` filter="url(#f-${layer.id}-${layer.effects?.shadow ? 'shadow' : 'glow'})"`;
}

function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
