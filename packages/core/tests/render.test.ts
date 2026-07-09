import { describe, it, expect, vi } from 'vitest';
import {
  formatFrameNumber,
  drawSpriteSheetAsset,
  drawUiPanelAsset,
  drawImageAsset,
  buildPanelMetadata,
  type Canvas2D,
  type DrawContext,
} from '../src/render.js';
import type { SpriteSheetAsset, UiPanelAsset, ImageAsset } from '@placeholderer/schemas';

function mockCtx(): Canvas2D & { calls: string[] } {
  const calls: string[] = [];
  const ctx = {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left' as const,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowColor: '',
    fillRect: vi.fn((...a: unknown[]) => { calls.push(`fillRect:${a.join(',')}`); }),
    strokeRect: vi.fn((...a: unknown[]) => { calls.push(`strokeRect:${a.join(',')}`); }),
    fillText: vi.fn((t: string) => { calls.push(`fillText:${t}`); }),
    strokeText: vi.fn((t: string) => { calls.push(`strokeText:${t}`); }),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(() => { calls.push('beginPath'); }),
    ellipse: vi.fn(),
    arcTo: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(() => { calls.push('stroke'); }),
    setLineDash: vi.fn((s: number[]) => { calls.push(`setLineDash:${s.join(',')}`); }),
  };
  return ctx as unknown as Canvas2D & { calls: string[] };
}

describe('formatFrameNumber', () => {
  it('zero-pads by default', () => {
    expect(formatFrameNumber(3, undefined, 2)).toBe('03');
    expect(formatFrameNumber(3, 'zero-padded', 2)).toBe('03');
  });
  it('supports plain and none', () => {
    expect(formatFrameNumber(3, 'plain', 2)).toBe('3');
    expect(formatFrameNumber(3, 'none', 2)).toBe('');
  });
});

describe('drawSpriteSheetAsset', () => {
  const base: SpriteSheetAsset = {
    kind: 'sprite_sheet',
    name: 'idle',
    width: 128,
    height: 64,
    format: 'png',
    output_path: 'art',
    frame_width: 64,
    frame_height: 64,
    rows: 1,
    columns: 2,
  };

  it('draws grid by default and zero-padded numbers', () => {
    const ctx = mockCtx();
    const dc: DrawContext = { ctx, width: 128, height: 64 };
    drawSpriteSheetAsset(dc, base);
    expect(ctx.calls.some((c) => c.startsWith('strokeRect:'))).toBe(true);
    expect(ctx.calls).toContain('fillText:01');
    expect(ctx.calls).toContain('fillText:02');
  });

  it('honors show_grid: false', () => {
    const ctx = mockCtx();
    const dc: DrawContext = { ctx, width: 128, height: 64 };
    // Background may still stroke; frame cells should not get per-cell stroke
    // when show_grid is false. Count strokeRect calls after the initial fill.
    drawSpriteSheetAsset(dc, { ...base, show_grid: false });
    const cellStrokes = ctx.calls.filter((c) => c.startsWith('strokeRect:0,') || c.startsWith('strokeRect:64,'));
    expect(cellStrokes.length).toBe(0);
  });

  it('honors numbering_style plain', () => {
    const ctx = mockCtx();
    drawSpriteSheetAsset({ ctx, width: 128, height: 64 }, { ...base, numbering_style: 'plain' });
    expect(ctx.calls).toContain('fillText:1');
    expect(ctx.calls).toContain('fillText:2');
  });

  it('skips frame numbers when numbering_style is none', () => {
    const ctx = mockCtx();
    drawSpriteSheetAsset({ ctx, width: 128, height: 64 }, { ...base, numbering_style: 'none' });
    expect(ctx.calls.filter((c) => c.startsWith('fillText:') && /^fillText:\d+$/.test(c))).toHaveLength(0);
  });
});

describe('drawUiPanelAsset', () => {
  const base: UiPanelAsset = {
    kind: 'ui_panel',
    name: 'dialog',
    width: 200,
    height: 100,
    format: 'png',
    output_path: 'ui',
  };

  it('draws panel guides when panel_guides is true', () => {
    const ctx = mockCtx();
    drawUiPanelAsset({ ctx, width: 200, height: 100 }, { ...base, panel_guides: true });
    expect(ctx.calls.some((c) => c.startsWith('setLineDash:'))).toBe(true);
  });

  it('skips guides by default', () => {
    const ctx = mockCtx();
    drawUiPanelAsset({ ctx, width: 200, height: 100 }, base);
    expect(ctx.calls.some((c) => c.startsWith('setLineDash:'))).toBe(false);
  });
});

describe('drawImageAsset fill_mode', () => {
  it('draws checker overlay when fill_mode is repeat', () => {
    const ctx = mockCtx();
    const asset: ImageAsset = {
      kind: 'image',
      name: 'tile',
      width: 32,
      height: 32,
      format: 'png',
      output_path: 'art',
      fill_mode: 'repeat',
    };
    drawImageAsset({ ctx, width: 32, height: 32 }, asset);
    // Background + checker cells → more fillRect than stretch mode alone.
    const stretchCtx = mockCtx();
    drawImageAsset({ ctx: stretchCtx, width: 32, height: 32 }, { ...asset, fill_mode: 'stretch' });
    expect(ctx.calls.filter((c) => c.startsWith('fillRect:')).length)
      .toBeGreaterThan(stretchCtx.calls.filter((c) => c.startsWith('fillRect:')).length);
  });
});

describe('buildPanelMetadata', () => {
  it('includes nine-slice positions', () => {
    const meta = buildPanelMetadata({
      kind: 'ui_panel',
      name: 'p',
      width: 300,
      height: 150,
      format: 'png',
      output_path: 'ui',
      frame_style: 'beveled',
    });
    expect(meta.frame_style).toBe('beveled');
    expect(meta.nine_slice).toEqual({ left: 100, right: 200, top: 50, bottom: 100 });
  });
});
