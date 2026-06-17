// Regression tests for the engine-aware UI Builder presets.
// Pulls source from apps/web directly so we can catch renderer
// regressions (e.g. lineLayer being horizontal-only) without a
// full web build.

import { describe, it, expect } from 'vitest';
import { PRESETS } from '../../web/src/builderPresets.js';
import { exportSVG } from '../../web/src/builderRender.js';

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