// Tests for the core-side UI Builder recipe renderer used by
// generateJob when an asset carries a builder_recipe.

import { describe, it, expect } from 'vitest';
import { renderBuilderRecipe } from '../src/builderRender.js';
import type { BuilderRecipe, Layer } from '../src/types.js';
import type { Canvas2D, DrawContext } from '../src/render.js';

/** Build a recording canvas that captures every fillRect/fillText
 *  call so tests can assert the renderer drew what they expected. */
function makeRecordingCanvas(width: number, height: number): { dc: DrawContext; calls: string[] } {
  const calls: string[] = [];
  const ctx: Canvas2D = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowColor: 'transparent',
    fillRect: (x, y, w, h) => { calls.push(`fillRect ${x},${y} ${w}x${h} ${ctx.fillStyle}`); },
    strokeRect: (x, y, w, h) => { calls.push(`strokeRect ${x},${y} ${w}x${h} ${ctx.strokeStyle} w${ctx.lineWidth}`); },
    fillText: (text, x, y) => { calls.push(`fillText "${text}" ${x},${y} ${ctx.fillStyle}`); },
    strokeText: () => { calls.push('strokeText'); },
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    translate: () => {},
    rotate: () => {},
    beginPath: () => calls.push('beginPath'),
    ellipse: () => calls.push('ellipse'),
    arcTo: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fill: () => { calls.push(`fill ${ctx.fillStyle}`); },
    stroke: () => { calls.push(`stroke ${ctx.strokeStyle}`); },
  };
  return { dc: { ctx, width, height }, calls };
}

describe('renderBuilderRecipe', () => {
  it('renders a single rect layer', () => {
    const layer: Layer = {
      id: 'l1',
      type: 'rect',
      name: 'bg',
      visible: true,
      locked: false,
      x: 0, y: 0, width: 100, height: 50,
      fill: '#ff0000',
    };
    const recipe: BuilderRecipe = {
      canvasMode: 'compact',
      width: 100,
      height: 50,
      layers: [layer],
    };
    const { dc, calls } = makeRecordingCanvas(100, 50);
    renderBuilderRecipe(dc, recipe);
    expect(calls).toContain('fillRect 0,0 100x50 #ff0000');
  });

  it('renders a text layer with the configured content + fontSize', () => {
    const layer: Layer = {
      id: 't1',
      type: 'text',
      name: 'label',
      visible: true,
      locked: false,
      x: 10, y: 20, width: 200, height: 40,
      fill: '#ffffff',
      text: { content: 'Hello', fontSize: 24, fontFamily: 'Arial', align: 'left' },
    };
    const recipe: BuilderRecipe = { canvasMode: 'compact', width: 200, height: 50, layers: [layer] };
    const { dc, calls } = makeRecordingCanvas(200, 50);
    renderBuilderRecipe(dc, recipe);
    expect(calls.some((c) => c.startsWith('fillText "Hello"'))).toBe(true);
    expect(dc.ctx.font).toContain('24px');
    expect(dc.ctx.font).toContain('Arial');
  });

  it('applies effects (glow + shadow) before drawing, clears them after', () => {
    const layer: Layer = {
      id: 'g1',
      type: 'rect',
      name: 'glowing',
      visible: true,
      locked: false,
      x: 0, y: 0, width: 50, height: 50,
      fill: '#0000ff',
      effects: {
        shadow: { blur: 4, color: 'rgba(0,0,0,0.5)' },
        glow: { blur: 8, color: 'rgba(255,255,255,0.6)' },
      },
    };
    const recipe: BuilderRecipe = { canvasMode: 'compact', width: 50, height: 50, layers: [layer] };
    const { dc, calls } = makeRecordingCanvas(50, 50);
    renderBuilderRecipe(dc, recipe);
    // After render, shadow should be cleared (transparent).
    expect(dc.ctx.shadowColor).toBe('transparent');
    expect(dc.ctx.shadowBlur).toBe(0);
    expect(calls.some((c) => c === 'save')).toBe(true);
    expect(calls.some((c) => c === 'restore')).toBe(true);
  });

  it('skips invisible layers', () => {
    const visible: Layer = {
      id: 'v1', type: 'rect', name: 'v', visible: true, locked: false,
      x: 0, y: 0, width: 10, height: 10, fill: '#ff0000',
    };
    const hidden: Layer = {
      id: 'h1', type: 'rect', name: 'h', visible: false, locked: false,
      x: 0, y: 0, width: 10, height: 10, fill: '#00ff00',
    };
    const recipe: BuilderRecipe = { canvasMode: 'compact', width: 10, height: 10, layers: [hidden, visible] };
    const { dc, calls } = makeRecordingCanvas(10, 10);
    renderBuilderRecipe(dc, recipe);
    const rectCalls = calls.filter((c) => c.startsWith('fillRect'));
    expect(rectCalls).toHaveLength(1);
    expect(rectCalls[0]).toContain('#ff0000');
  });

  it('throws on image fill layers (no silent degradation)', () => {
    // Image fills aren't supported in the core renderer — they
    // should fail loudly so generateJob records a per-asset error
    // instead of shipping a placeholder where the image should be.
    const layer: Layer = {
      id: 'p1', type: 'rect', name: 'image-bg', visible: true, locked: false,
      x: 0, y: 0, width: 10, height: 10,
      fill: { type: 'image', src: 'a.png', mode: 'stretch' },
    };
    const recipe: BuilderRecipe = { canvasMode: 'compact', width: 10, height: 10, layers: [layer] };
    const { dc } = makeRecordingCanvas(10, 10);
    expect(() => renderBuilderRecipe(dc, recipe)).toThrow(/image fill/);
  });

  it('throws on pattern fill layers', () => {
    const layer: Layer = {
      id: 'p2', type: 'rect', name: 'pattern-bg', visible: true, locked: false,
      x: 0, y: 0, width: 10, height: 10,
      fill: { type: 'pattern', pattern: 'checkerboard' },
    };
    const recipe: BuilderRecipe = { canvasMode: 'compact', width: 10, height: 10, layers: [layer] };
    const { dc } = makeRecordingCanvas(10, 10);
    expect(() => renderBuilderRecipe(dc, recipe)).toThrow(/pattern fill/);
  });

  it('throws on raster layers (no image decoder in core)', () => {
    const layer: Layer = {
      id: 'r1', type: 'raster', name: 'img', visible: true, locked: false,
      x: 0, y: 0, width: 10, height: 10,
      rasterSrc: 'a.png',
    };
    const recipe: BuilderRecipe = { canvasMode: 'compact', width: 10, height: 10, layers: [layer] };
    const { dc } = makeRecordingCanvas(10, 10);
    expect(() => renderBuilderRecipe(dc, recipe)).toThrow(/raster layer/);
  });
});