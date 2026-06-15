import JSZip from 'jszip';

export interface GenerateResult {
  success: boolean;
  zip?: Blob;
  errors: string[];
}

function drawLabel(ctx: OffscreenCanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  ctx.font = 'bold 18px system-ui';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.textAlign = 'center';
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillText(text, x, y, maxWidth);
}

async function generateImageAsset(asset: any): Promise<Blob> {
  const canvas = new OffscreenCanvas(asset.width, asset.height);
  const ctx = canvas.getContext('2d')!;

  // Background with subtle gradient
  const bg = asset.background_color || '#4A5568';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, asset.width, asset.height);

  // Subtle inner border
  ctx.strokeStyle = '#718096';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, asset.width - 8, asset.height - 8);

  if (asset.label_enabled !== false) {
    const labelText = asset.name;
    const pos = asset.label_position || 'corners';
    const w = asset.width;
    const h = asset.height;

    if (pos === 'corners') {
      drawLabel(ctx, labelText, 30, 28, w - 60);
      drawLabel(ctx, labelText, w - 30, 28, w - 60);
      drawLabel(ctx, labelText, 30, h - 20, w - 60);
      drawLabel(ctx, labelText, w - 30, h - 20, w - 60);
    } else if (pos === 'center') {
      drawLabel(ctx, labelText, w / 2, h / 2, w - 40);
    }
  }

  return canvas.convertToBlob({ type: 'image/png' });
}

async function generateSpriteSheetAsset(asset: any): Promise<Blob> {
  const canvas = new OffscreenCanvas(asset.width, asset.height);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = asset.background_color || '#2D3748';
  ctx.fillRect(0, 0, asset.width, asset.height);

  const fw = asset.frame_width || 64;
  const fh = asset.frame_height || 64;
  const cols = asset.columns || 4;
  const rows = asset.rows || 2;

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * fw;
      const y = r * fh;
      
      // Frame background
      ctx.fillStyle = '#3D4F5F';
      ctx.fillRect(x + 1, y + 1, fw - 2, fh - 2);
      
      // Frame border
      ctx.strokeRect(x, y, fw, fh);

      // Frame number
      if (asset.label_enabled !== false) {
        const frameNum = r * cols + c + 1;
        ctx.font = '12px system-ui';
        ctx.fillStyle = '#A0AEC0';
        ctx.fillText(String(frameNum), x + 6, y + 16);
      }
    }
  }

  if (asset.label_enabled !== false) {
    drawLabel(ctx, asset.name, asset.width / 2, asset.height - 18, asset.width - 40);
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
      const x = c * tw;
      const y = r * th;
      
      // Tile background variation
      ctx.fillStyle = (r + c) % 2 === 0 ? '#3D4F5F' : '#2D3748';
      ctx.fillRect(x + 1, y + 1, tw - 2, th - 2);
      
      ctx.strokeRect(x, y, tw, th);

      const index = r * cols + c;
      ctx.font = '10px system-ui';
      ctx.fillStyle = '#718096';
      ctx.fillText(String(index), x + 4, y + 13);
    }
  }

  return canvas.convertToBlob({ type: 'image/png' });
}

async function generateUiPanelAsset(asset: any): Promise<Blob> {
  const canvas = new OffscreenCanvas(asset.width, asset.height);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = asset.background_color || '#2D3748';
  ctx.fillRect(0, 0, asset.width, asset.height);

  // Outer frame
  ctx.strokeStyle = '#718096';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, asset.width - 12, asset.height - 12);

  // Inner frame
  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, asset.width - 32, asset.height - 32);

  // Subtle inner highlight
  ctx.strokeStyle = '#A0AEC0';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, asset.width - 40, asset.height - 40);

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