import JSZip from 'jszip';

export interface GenerateResult {
  success: boolean;
  zip?: Blob;
  errors: string[];
}

function drawLabel(ctx: OffscreenCanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  ctx.font = 'bold 20px system-ui';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.textAlign = 'center';
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillText(text, x, y, maxWidth);
}

async function generateImageAsset(asset: any): Promise<Blob> {
  const canvas = new OffscreenCanvas(asset.width, asset.height);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = asset.background_color || '#4A5568';
  ctx.fillRect(0, 0, asset.width, asset.height);

  if (asset.label_enabled !== false) {
    const labelText = asset.name;
    const pos = asset.label_position || 'corners';
    const w = asset.width;
    const h = asset.height;

    if (pos === 'corners') {
      drawLabel(ctx, labelText, 35, 35, w - 70);
      drawLabel(ctx, labelText, w - 35, 35, w - 70);
      drawLabel(ctx, labelText, 35, h - 25, w - 70);
      drawLabel(ctx, labelText, w - 35, h - 25, w - 70);
    } else if (pos === 'center') {
      drawLabel(ctx, labelText, w / 2, h / 2, w - 40);
    }
  }

  return canvas.convertToBlob({ type: 'image/png' });
}

async function generateSpriteSheetAsset(asset: any): Promise<Blob> {
  const canvas = new OffscreenCanvas(asset.width, asset.height);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = asset.background_color || '#3D4F5F';
  ctx.fillRect(0, 0, asset.width, asset.height);

  const fw = asset.frame_width || 64;
  const fh = asset.frame_height || 64;
  const cols = asset.columns || 4;
  const rows = asset.rows || 2;

  ctx.strokeStyle = '#718096';
  ctx.lineWidth = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * fw;
      const y = r * fh;
      ctx.strokeRect(x, y, fw, fh);

      if (asset.label_enabled !== false) {
        const frameNum = r * cols + c + 1;
        ctx.font = '12px system-ui';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(frameNum), x + 8, y + 18);
      }
    }
  }

  if (asset.label_enabled !== false) {
    drawLabel(ctx, asset.name, asset.width / 2, asset.height - 20, asset.width - 40);
  }

  return canvas.convertToBlob({ type: 'image/png' });
}

async function generateTilesetAsset(asset: any): Promise<Blob> {
  const canvas = new OffscreenCanvas(asset.width, asset.height);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = asset.background_color || '#2D3748';
  ctx.fillRect(0, 0, asset.width, asset.height);

  const tw = asset.tile_width || 32;
  const th = asset.tile_height || 32;
  const cols = Math.floor(asset.width / tw);
  const rows = Math.floor(asset.height / th);

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.strokeRect(c * tw, r * th, tw, th);
      const index = r * cols + c;
      ctx.font = '11px system-ui';
      ctx.fillStyle = '#A0AEC0';
      ctx.fillText(String(index), c * tw + 4, r * th + 14);
    }
  }

  return canvas.convertToBlob({ type: 'image/png' });
}

async function generateUiPanelAsset(asset: any): Promise<Blob> {
  const canvas = new OffscreenCanvas(asset.width, asset.height);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = asset.background_color || '#2D3748';
  ctx.fillRect(0, 0, asset.width, asset.height);

  ctx.strokeStyle = '#718096';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, asset.width - 16, asset.height - 16);

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, asset.width - 36, asset.height - 36);

  if (asset.label_enabled !== false) {
    drawLabel(ctx, asset.name, asset.width / 2, asset.height / 2, asset.width - 60);
  }

  return canvas.convertToBlob({ type: 'image/png' });
}

export async function generateJob(job: any): Promise<GenerateResult> {
  const zip = new JSZip();
  const errors: string[] = [];

  for (const request of job.requests || []) {
    for (const asset of request.assets || []) {
      try {
        let blob: Blob;

        switch (asset.kind) {
          case 'ui_panel':
            blob = await generateUiPanelAsset(asset);
            break;
          case 'sprite_sheet':
            blob = await generateSpriteSheetAsset(asset);
            break;
          case 'tileset':
            blob = await generateTilesetAsset(asset);
            break;
          default:
            blob = await generateImageAsset(asset);
        }

        const filename = `${asset.name}.${asset.format || 'png'}`;
        const fullPath = asset.output_path ? `${asset.output_path}/${filename}` : filename;
        zip.file(fullPath, blob);
      } catch (err: any) {
        errors.push(`${asset.name}: ${err.message}`);
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { success: true, zip: zipBlob, errors: [] };
}