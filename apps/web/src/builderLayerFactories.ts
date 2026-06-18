// Re-exported layer factory helpers for use by the preset library and
// anywhere else that needs to construct a layer with sensible defaults.

import type {
  RectLayer,
  CircleLayer,
  LineLayer,
  TextLayer,
  RasterLayer,
  FilledShapeLayer,
} from '@placeholderer/schemas';

let factoryCounter = 1;
function uid(): string {
  return `layer-${factoryCounter++}-${Math.random().toString(36).slice(2, 6)}`;
}

type Base = Partial<RectLayer> & { name: string; x: number; y: number; width: number; height: number; fill?: string };

export function rectLayer(opts: Base): RectLayer {
  return {
    id: uid(),
    type: 'rect',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    fill: opts.fill ?? '#4A5568',
    ...opts,
  };
}

type CircleBase = Partial<CircleLayer> & { name: string; x: number; y: number; width: number; height: number; fill?: string };
export function circleLayer(opts: CircleBase): CircleLayer {
  return {
    id: uid(),
    type: 'circle',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    fill: opts.fill ?? '#4A5568',
    ...opts,
  };
}

type LineBase = Partial<LineLayer> & { name: string; x: number; y: number; width: number; height: number };
export function lineLayer(opts: LineBase): LineLayer {
  return {
    id: uid(),
    type: 'line',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    stroke: { color: '#718096', width: 1 },
    ...opts,
  };
}

type TextBase = Partial<TextLayer> & { name: string; x: number; y: number; width: number; height: number; content: string };
export function textLayer(opts: TextBase): TextLayer {
  return {
    id: uid(),
    type: 'text',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    fill: '#ffffff',
    text: { content: opts.content, fontSize: 24, fontFamily: 'system-ui, sans-serif', align: 'left' },
    ...opts,
  };
}

type FilledShapeBase = Partial<FilledShapeLayer> & { name: string; x: number; y: number; width: number; height: number; fill?: string };
export function filledShapeLayer(opts: FilledShapeBase): FilledShapeLayer {
  return {
    id: uid(),
    type: 'filled-shape',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    fill: opts.fill ?? '#4A5568',
    ...opts,
  };
}

type RasterBase = { name: string; x: number; y: number; width: number; height: number; rasterSrc: string };
export function rasterLayer(opts: RasterBase): RasterLayer {
  return {
    id: uid(),
    type: 'raster',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    ...opts,
  };
}
