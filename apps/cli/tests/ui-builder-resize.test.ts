import { describe, it, expect } from 'vitest';
import {
  getResizeHandle,
  applyResizeHandle,
  DRAG_THRESHOLD_PX,
  MIN_LAYER_SIZE,
  type ResizeHandle,
} from '../../web/src/builderResize';
import type { Layer } from '@placeholderer/schemas';

function rectLayer(x: number, y: number, width: number, height: number): Layer {
  return {
    id: 'l1',
    type: 'rect',
    name: 'R',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    x,
    y,
    width,
    height,
    fill: '#000',
  };
}

describe('getResizeHandle', () => {
  const layer = rectLayer(100, 100, 200, 100);

  it('returns distinct corner handles, not a generic corner', () => {
    expect(getResizeHandle(layer, 100, 100)).toBe('nw');
    expect(getResizeHandle(layer, 300, 100)).toBe('ne');
    expect(getResizeHandle(layer, 100, 200)).toBe('sw');
    expect(getResizeHandle(layer, 300, 200)).toBe('se');
  });

  it('returns edge handles', () => {
    expect(getResizeHandle(layer, 100, 150)).toBe('left');
    expect(getResizeHandle(layer, 300, 150)).toBe('right');
    expect(getResizeHandle(layer, 200, 100)).toBe('top');
    expect(getResizeHandle(layer, 200, 200)).toBe('bottom');
  });

  it('returns null when not near an edge', () => {
    expect(getResizeHandle(layer, 200, 150)).toBeNull();
  });
});

describe('applyResizeHandle', () => {
  const origin = { x: 100, y: 100, w: 200, h: 100 };

  it('resizes from the right edge without moving x', () => {
    const r = applyResizeHandle('right', origin.x, origin.y, origin.w, origin.h, 350, 150);
    expect(r).toEqual({ x: 100, y: 100, width: 250, height: 100 });
  });

  it('resizes from the left edge keeping the right edge fixed', () => {
    const r = applyResizeHandle('left', origin.x, origin.y, origin.w, origin.h, 120, 150);
    expect(r.x).toBe(120);
    expect(r.width).toBe(180);
    expect(r.y).toBe(100);
    expect(r.height).toBe(100);
  });

  it('nw corner only adjusts left and top (does not collapse via right/bottom)', () => {
    // Pointer still near the NW corner (click-in-place). Old 'corner'
    // logic would also run the right/bottom branches and shrink to min.
    const r = applyResizeHandle('nw', origin.x, origin.y, origin.w, origin.h, 100, 100);
    expect(r.width).toBeGreaterThan(MIN_LAYER_SIZE);
    expect(r.height).toBeGreaterThan(MIN_LAYER_SIZE);
    expect(r).toEqual({ x: 100, y: 100, width: 200, height: 100 });
  });

  it('se corner grows when pointer moves out', () => {
    const r = applyResizeHandle('se', origin.x, origin.y, origin.w, origin.h, 400, 250);
    expect(r).toEqual({ x: 100, y: 100, width: 300, height: 150 });
  });

  it('clamps to MIN_LAYER_SIZE', () => {
    const r = applyResizeHandle('right', origin.x, origin.y, origin.w, origin.h, origin.x + 2, 150);
    expect(r.width).toBe(MIN_LAYER_SIZE);
  });

  it.each([
    ['nw', 100, 100],
    ['ne', 300, 100],
    ['sw', 100, 200],
    ['se', 300, 200],
  ] as [ResizeHandle, number, number][])(
    'click-in-place on %s leaves geometry unchanged',
    (handle, mx, my) => {
      const r = applyResizeHandle(handle, origin.x, origin.y, origin.w, origin.h, mx, my);
      expect(r).toEqual({ x: 100, y: 100, width: 200, height: 100 });
    },
  );
});

describe('DRAG_THRESHOLD_PX', () => {
  it('is a small positive threshold', () => {
    expect(DRAG_THRESHOLD_PX).toBeGreaterThan(0);
    expect(DRAG_THRESHOLD_PX).toBeLessThanOrEqual(8);
  });
});
