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

    const ctx = canvas.getContext('2d')!;
    canvas.width = Math.min(asset.width, 400);
    canvas.height = Math.min(asset.height, 300);

    const scale = Math.min(canvas.width / asset.width, canvas.height / asset.height);
    const w = asset.width * scale;
    const h = asset.height * scale;

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