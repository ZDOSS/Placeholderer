import { useEffect, useRef } from 'react';
import type { Asset } from '@placeholderer/schemas';
import {
  drawAsset,
  type Canvas2D,
} from '@placeholderer/core';
import { colors } from './colors';

interface Props {
  asset: Asset;
  /** Optional max display width (default 400). */
  maxWidth?: number;
  /** Optional max display height (default 300). */
  maxHeight?: number;
}

/**
 * Live preview that calls the same core draw path as generateJob.
 * Preview and ZIP output stay aligned for image-style assets.
 */
export function AssetPreview({ asset, maxWidth = 400, maxHeight = 300 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Audio assets are dimensionless; show a small waveform-style
    // placeholder instead of calling drawAsset (which is a no-op).
    if (asset.kind === 'audio') {
      canvas.width = 200;
      canvas.height = 80;
      ctx.fillStyle = asset.background_color || '#4A5568';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 8, canvas.height / 2 - 12);
      ctx.lineTo(canvas.width / 2 - 8, canvas.height / 2 + 12);
      ctx.lineTo(canvas.width / 2 + 12, canvas.height / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillText(asset.name, canvas.width / 2, canvas.height - 14);
      return;
    }

    const aw = asset.width ?? 1;
    const ah = asset.height ?? 1;

    // Draw at native size into an offscreen buffer, then scale down
    // for display so labels and grid lines match the real render.
    const off = document.createElement('canvas');
    off.width = aw;
    off.height = ah;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;

    drawAsset(
      {
        ctx: offCtx as unknown as Canvas2D,
        width: aw,
        height: ah,
      },
      asset,
    );

    const scale = Math.min(1, maxWidth / aw, maxHeight / ah);
    canvas.width = Math.max(1, Math.round(aw * scale));
    canvas.height = Math.max(1, Math.round(ah * scale));
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }, [asset, maxWidth, maxHeight]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        maxWidth: '100%',
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        background: colors.bgInset,
      }}
    />
  );
}
