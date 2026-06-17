import { useEffect, useRef } from 'react';
import type { Asset } from '@placeholderer/schemas';
import { colors } from './colors';

interface Props {
  asset: Asset;
}

export function AssetPreview({ asset }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Audio assets are dimensionless; show a small placeholder
    // canvas with a "play" arrow and the asset name instead of
    // trying to scale zero-sized dimensions.
    if (asset.kind === 'audio') {
      const ctx = canvas.getContext('2d')!;
      canvas.width = 200;
      canvas.height = 80;
      ctx.fillStyle = '#4A5568';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Simple triangle "play" indicator.
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 8, canvas.height / 2 - 12);
      ctx.lineTo(canvas.width / 2 - 8, canvas.height / 2 + 12);
      ctx.lineTo(canvas.width / 2 + 12, canvas.height / 2);
      ctx.closePath();
      ctx.fill();
      return;
    }

    const ctx = canvas.getContext('2d')!;
    // Image-style assets always carry width/height (schema requires
    // them for image/sprite_sheet/tileset/ui_panel).
    const aw = asset.width ?? 1;
    const ah = asset.height ?? 1;
    canvas.width = Math.min(aw, 400);
    canvas.height = Math.min(ah, 300);

    const scale = Math.min(canvas.width / aw, canvas.height / ah);
    const w = aw * scale;
    const h = ah * scale;

    ctx.fillStyle = asset.background_color || '#4A5568';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    if (asset.label_enabled !== false) {
      ctx.font = 'bold 16px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';

      const text = asset.name;
      const pos = asset.label_position || 'corners';

      if (pos === 'corners') {
        ctx.strokeText(text, 25, 25);
        ctx.fillText(text, 25, 25);
        ctx.strokeText(text, canvas.width - 25, 25);
        ctx.fillText(text, canvas.width - 25, 25);
        ctx.strokeText(text, 25, canvas.height - 15);
        ctx.fillText(text, 25, canvas.height - 15);
        ctx.strokeText(text, canvas.width - 25, canvas.height - 15);
        ctx.fillText(text, canvas.width - 25, canvas.height - 15);
      } else {
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
      }
    }
  }, [asset]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ border: `1px solid ${colors.borderStrong}`, background: colors.bgInset }}
      />
      <div style={{ fontSize: '0.8rem', color: colors.textMuted, marginTop: '0.5rem' }}>
        Preview (scaled)
      </div>
    </div>
  );
}