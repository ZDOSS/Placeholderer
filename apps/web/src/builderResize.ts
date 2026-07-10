// Pure resize geometry helpers for the UI Builder canvas.
// Kept free of React so unit tests and the builder share one path.

import type { Layer } from '@placeholderer/schemas';

/** Min pointer travel (canvas px) before a gesture counts as a drag. */
export const DRAG_THRESHOLD_PX = 3;

/** Min layer size when resizing. */
export const MIN_LAYER_SIZE = 8;

export type ResizeHandle =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se';

/**
 * Which resize handle is under the pointer (if any). Corners are
 * distinct directions (nw/ne/sw/se) — a single 'corner' token used to
 * apply left+right and top+bottom in one move, which collapsed the
 * layer to MIN_LAYER_SIZE on a shift-click without drag.
 */
export function getResizeHandle(layer: Layer, mx: number, my: number): ResizeHandle | null {
  const x = layer.x ?? 0, y = layer.y ?? 0, w = layer.width ?? 0, h = layer.height ?? 0;
  const T = 8;
  const nearLeft = Math.abs(mx - x) < T;
  const nearRight = Math.abs(mx - (x + w)) < T;
  const nearTop = Math.abs(my - y) < T;
  const nearBottom = Math.abs(my - (y + h)) < T;
  if (nearLeft && nearTop) return 'nw';
  if (nearRight && nearTop) return 'ne';
  if (nearLeft && nearBottom) return 'sw';
  if (nearRight && nearBottom) return 'se';
  if (nearLeft) return 'left';
  if (nearRight) return 'right';
  if (nearTop) return 'top';
  if (nearBottom) return 'bottom';
  return null;
}

/**
 * Compute new layer bounds for a resize gesture.
 * Always derived from the geometry at mousedown (`origin*`) so
 * intermediate snap steps don't accumulate.
 */
export function applyResizeHandle(
  handle: ResizeHandle,
  originX: number,
  originY: number,
  originW: number,
  originH: number,
  mx: number,
  my: number,
  snapFn: (n: number) => number = (n) => n,
): { x: number; y: number; width: number; height: number } {
  const right = originX + originW;
  const bottom = originY + originH;
  let x = originX;
  let y = originY;
  let width = originW;
  let height = originH;

  if (handle === 'left' || handle === 'nw' || handle === 'sw') {
    x = Math.min(snapFn(mx), right - MIN_LAYER_SIZE);
    width = right - x;
  }
  if (handle === 'right' || handle === 'ne' || handle === 'se') {
    width = Math.max(MIN_LAYER_SIZE, snapFn(mx) - originX);
    x = originX;
  }
  if (handle === 'top' || handle === 'nw' || handle === 'ne') {
    y = Math.min(snapFn(my), bottom - MIN_LAYER_SIZE);
    height = bottom - y;
  }
  if (handle === 'bottom' || handle === 'sw' || handle === 'se') {
    height = Math.max(MIN_LAYER_SIZE, snapFn(my) - originY);
    y = originY;
  }

  return { x, y, width, height };
}
