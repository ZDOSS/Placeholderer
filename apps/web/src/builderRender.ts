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
  PatternKind,
} from '@placeholderer/schemas';

export interface BuilderCtx {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

const PATTERN_TILE = 16;

/** Build a tile-sized pattern of the given kind using an
 *  OffscreenCanvas as the source. Returns null on environments
 *  without OffscreenCanvas (e.g. Node without a polyfill). */
function buildPattern(ctx: CanvasRenderingContext2D, kind: PatternKind, color: string): CanvasPattern | null {
  if (typeof OffscreenCanvas === 'undefined') return null;
  try {
    const source = new OffscreenCanvas(PATTERN_TILE, PATTERN_TILE);
    const sctx = source.getContext('2d');
    if (!sctx) return null;
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, PATTERN_TILE, PATTERN_TILE);
    sctx.fillStyle = color;
    sctx.strokeStyle = color;
    sctx.lineWidth = 1;
    if (kind === 'checkerboard') {
      sctx.fillRect(0, 0, PATTERN_TILE / 2, PATTERN_TILE / 2);
      sctx.fillRect(PATTERN_TILE / 2, PATTERN_TILE / 2, PATTERN_TILE / 2, PATTERN_TILE / 2);
    } else if (kind === 'stripes') {
      for (let y = 0; y < PATTERN_TILE; y += 4) sctx.fillRect(0, y, PATTERN_TILE, 2);
    } else if (kind === 'diagonal') {
      for (let i = -PATTERN_TILE; i < PATTERN_TILE * 2; i += 4) {
        sctx.beginPath();
        sctx.moveTo(i, PATTERN_TILE);
        sctx.lineTo(i + PATTERN_TILE, 0);
        sctx.stroke();
      }
    }
    return ctx.createPattern(source, 'repeat');
  } catch {
    return null;
  }
  return null;
}

/** Resolve a FillSpec to a usable fill. Returns the string for solid
 *  colors, a CanvasPattern for pattern fills (built from a tile
 *  OffscreenCanvas), or a string color for image fills (the image
 *  itself is loaded via preloadFillImages). Pattern creation can fail
 *  on environments without OffscreenCanvas; the fallback color is
 *  returned in that case. */
export function resolveFill(fill: FillSpec | undefined, fallback: string, ctx: CanvasRenderingContext2D): string | CanvasPattern {
  if (!fill) return fallback;
  if (typeof fill === 'string') return fill;
  if (fill.type === 'pattern') {
    return buildPattern(ctx, fill.pattern, fallback) ?? fallback;
  }
  // Image fills: the image is preloaded separately; the actual draw
  // path uses a cached HTMLImageElement. Return the fallback color
  // here so ctx.fillStyle has something assignable; the caller
  // uses drawImage with the cached image over the top.
  return fallback;
}

/** Preload every image fill referenced by the layer stack. Returns
 *  a promise that resolves once every image is loaded. */
export function preloadFillImages(layers: Layer[]): Promise<void> {
  const sources = new Set<string>();
  for (const l of layers) {
    const fill: any = l.fill;
    if (fill && typeof fill === 'object' && fill.type === 'image' && fill.src) {
      sources.add(fill.src);
    }
  }
  const promises: Promise<void>[] = [];
  for (const src of sources) {
    if (rasterCache.has(src)) continue;
    promises.push(new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { rasterCache.set(src, img); resolve(); };
      img.onerror = () => resolve();
      img.src = src;
    }));
  }
  return Promise.all(promises).then(() => undefined);
}

/** Resolve a FillSpec to a string color, falling back to a default.
 *  Used for layer fill inputs that don't need pattern/image support
 *  (text color, shadow color, etc.). */
export function fillToColor(fill: FillSpec | undefined, fallback: string): string {
  if (!fill) return fallback;
  if (typeof fill === 'string') return fill;
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
  const fill = resolveFill(layer.fill, '#4A5568', ctx);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  drawImageFillOverlay(ctx, layer, x, y, w, h);
  const stroke = strokeToStroke(layer.stroke);
  if (stroke) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.strokeRect(x, y, w, h);
  }
}

function drawImageFillOverlay(ctx: CanvasRenderingContext2D, layer: any, x: number, y: number, w: number, h: number): void {
  const fill: any = layer.fill;
  if (!fill || typeof fill === 'string' || fill.type !== 'image' || !fill.src) return;
  const img = rasterCache.get(fill.src);
  // Only draw if the image has actually finished loading. The
  // preload effect only inserts fully-loaded Images into the cache,
  // but a render that fires while the load is still in flight would
  // otherwise hit drawImage/createPattern with a half-loaded
  // bitmap. Falling through here keeps the fallback fill visible.
  if (!img || !img.complete || img.naturalWidth === 0) return;
  if (fill.mode === 'stretch') {
    ctx.drawImage(img, x, y, w, h);
  } else {
    const pat = ctx.createPattern(img, 'repeat');
    if (pat) {
      ctx.save();
      ctx.fillStyle = pat;
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawCircle(ctx: CanvasRenderingContext2D, layer: any, cx: number, cy: number, w: number, h: number): void {
  const rx = w / 2;
  const ry = h / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = resolveFill(layer.fill, '#4A5568', ctx);
  ctx.fill();
  // Image fills must be clipped to the ellipse path, otherwise the
  // overlay draws a full rectangle around the circle. Restore so the
  // stroke below isn't clipped.
  const fill: any = layer.fill;
  if (fill && typeof fill === 'object' && fill.type === 'image' && fill.src) {
    ctx.save();
    ctx.clip();
    drawImageFillOverlay(ctx, layer, cx - rx, cy - ry, w, h);
    ctx.restore();
  }
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

// Cache for raster/image-fill sources so the on-screen render and the
// export path can both await a fully-loaded image before drawing.
export const rasterCache = new Map<string, HTMLImageElement>();

/** Preload all raster sources referenced by the layer stack (raster
 *  layers and image fills). The export path awaits this so PNG/JPG
 *  outputs include the imported raster layers and image fills
 *  instead of silently omitting them. */
export function preloadRasterImages(layers: Layer[]): Promise<void> {
  const sources = new Set<string>();
  for (const l of layers) {
    if (l.type === 'raster' && l.rasterSrc) sources.add(l.rasterSrc);
    const fill: any = l.fill;
    if (fill && typeof fill === 'object' && fill.type === 'image' && fill.src) sources.add(fill.src);
  }
  const promises: Promise<void>[] = [];
  for (const src of sources) {
    const cached = rasterCache.get(src);
    if (cached && cached.complete && cached.naturalWidth > 0) continue;
    promises.push(new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { rasterCache.set(src, img); resolve(); };
      img.onerror = () => resolve();
      img.src = src;
    }));
  }
  return Promise.all(promises).then(() => undefined);
}

function drawRaster(dc: BuilderCtx, layer: any, x: number, y: number, w: number, h: number): void {
  const src = layer.rasterSrc;
  if (!src) return;
  const cached = rasterCache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    dc.ctx.drawImage(cached, x, y, w, h);
    return;
  }
  const img = new Image();
  img.onload = () => {
    rasterCache.set(src, img);
    dc.ctx.drawImage(img, x, y, w, h);
  };
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
  const visible = layers.filter((l) => l.visible);
  const rendered = visible.map((l) => layerToSVG(l));
  const body = rendered.map((r) => r.markup).join('\n');
  const defs = rendered
    .map((r) => r.filter?.def ?? '')
    .filter(Boolean)
    .join('\n  ');
  const defsBlock = defs ? `\n  <defs>\n  ${defs}\n  </defs>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defsBlock}
${body}
</svg>`;
}

function layerToSVG(layer: Layer): { markup: string; filter: FilterSpec | null } {
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
  const filterAttr = filter?.ref ?? '';

  switch (layer.type) {
    case 'rect': {
      const markup = `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${strokeAttr}${opacity}${transform}${filterAttr}/>`;
      return { markup, filter };
    }
    case 'circle': {
      const markup = `  <ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}"${strokeAttr}${opacity}${transform}${filterAttr}/>`;
      return { markup, filter };
    }
    case 'line': {
      const strokeDef = stroke ?? { color: '#718096', width: 2 };
      const markup = `  <line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${strokeDef.color}" stroke-width="${strokeDef.width}"${opacity}${transform}/>`;
      return { markup, filter: null };
    }
    case 'text': {
      const content = escapeXML(layer.text?.content ?? layer.name ?? 'Text');
      const fontSize = layer.text?.fontSize ?? 24;
      const fontFamily = layer.text?.fontFamily ?? 'system-ui, sans-serif';
      const align = layer.text?.align ?? 'left';
      const textAnchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      const textX = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
      const markup = `  <text x="${textX}" y="${y + fontSize}" fill="${fill}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="bold" text-anchor="${textAnchor}"${opacity}${transform}>${content}</text>`;
      return { markup, filter: null };
    }
    case 'raster': {
      const markup = layer.rasterSrc
        ? `  <image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXML(layer.rasterSrc)}"${opacity}${transform}/>`
        : '';
      return { markup, filter: null };
    }
    case 'filled-shape': {
      const r = Math.min(8, w / 4, h / 4);
      const markup = `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}"${strokeAttr}${opacity}${transform}${filterAttr}/>`;
      return { markup, filter };
    }
  }
}

interface FilterSpec {
  id: string;
  def: string;
  ref: string;
}

/** Build a filter (definition + reference) for a layer, if it has
 *  effects. Returns null when the layer has no filter. */
function buildSVGFilter(layer: Layer): FilterSpec | null {
  if (layer.effects?.shadow) {
    const s = layer.effects.shadow;
    const id = `f-${layer.id}-shadow`;
    const def = `<filter id="${id}"><feDropShadow dx="${s.offsetX ?? 0}" dy="${s.offsetY ?? 4}" stdDeviation="${(s.blur ?? 8) / 2}" flood-color="${s.color ?? 'rgba(0,0,0,0.5)'}"/></filter>`;
    return { id, def, ref: ` filter="url(#${id})"` };
  }
  if (layer.effects?.glow) {
    const g = layer.effects.glow;
    const id = `f-${layer.id}-glow`;
    const def = `<filter id="${id}"><feGaussianBlur stdDeviation="${(g.blur ?? 12) / 2}"/></filter>`;
    return { id, def, ref: ` filter="url(#${id})"` };
  }
  return null;
}

function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
