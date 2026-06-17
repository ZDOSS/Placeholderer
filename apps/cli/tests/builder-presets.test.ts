// Regression tests for the engine-aware UI Builder presets and
// stretch-fill export. Pulls source from apps/web directly so we
// catch renderer regressions (e.g. lineLayer being horizontal-
// only, stroke being dropped for stretch fills) without a full
// web build.

import { describe, it, expect } from 'vitest';
import { PRESETS } from '../../web/src/builderPresets.js';
import { exportSVG } from '../../web/src/builderRender.js';
import type { Layer } from '@placeholderer/schemas';

describe('UI Builder presets', () => {
  it('exports an Unreal crosshair with a vertical rect arm', () => {
    // lineLayer is always horizontal (height only changes the y
    // center, not the orientation), so the vertical arm of the
    // crosshair has to be a thin rectangle or it renders as a
    // short horizontal dash.
    const crosshair = PRESETS.find((p) => p.name === 'Crosshair');
    expect(crosshair).toBeDefined();
    const v = crosshair!.layers.find((l) => l.id === 'v');
    expect(v?.type).toBe('rect');

    const svg = exportSVG(crosshair!.layers, crosshair!.width, crosshair!.height);
    expect(svg).toMatch(/<rect x="14" y="4" width="4" height="24"/);
    // No horizontal dash at the vertical-arm position.
    expect(svg).not.toMatch(/<line[^>]*x1="14"[^>]*x2="18"/);
  });
});

describe('exportSVG', () => {
  it('keeps the stroke on stretch image fills', () => {
    // Regression for Greptile round 7: a rect layer with a stretch
    // image fill and a stroke used to export the clipped image but
    // silently drop the border. The fix adds a stroked, unfilled
    // shape inside the same clip-path group so the border is
    // preserved.
    const layer: Layer = {
      id: 'l1',
      type: 'rect',
      name: 'frame',
      visible: true,
      locked: false,
      x: 10, y: 20, width: 100, height: 50,
      fill: { type: 'image', src: 'a.png', mode: 'stretch' },
      stroke: { color: '#FF0000', width: 3 },
    };
    const svg = exportSVG([layer], 200, 200);

    expect(svg).toMatch(/<image[^>]*href="a\.png"/);
    // The same layer's stroke must be exported as a stroke-bearing
    // (but fill="none") rect on top of the clipped image.
    expect(svg).toMatch(/fill="none" stroke="#FF0000" stroke-width="3"/);
  });
});