import JSZip from 'jszip';
import type {
  Manifest,
  Asset,
  ImageAsset,
  SpriteSheetAsset,
  TilesetAsset,
  UiPanelAsset,
} from '@placeholderer/schemas';
import { sanitizePath, sanitizeFilename } from './path';

export interface GenerateResult {
  success: boolean;
  zip?: Blob;
  errors: string[];
}

type Canvas2D = OffscreenCanvasRenderingContext2D;

function drawLabel(ctx: Canvas2D, text: string, x: number, y: number, maxWidth: number) {
  ctx.font = 'bold 18px system-ui';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.textAlign = 'center';
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillText(text, x, y, maxWidth);
}

async function generateImageAsset(asset: ImageAsset): Promise<Blob> {
  const canvas = new OffscreenCanvas(asset.width, asset.height);
  const ctx = canvas.getContext('2d')!;

  const bg = asset.background_color || '#4A5568';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, asset.width, asset.height);

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

async function generateSpriteSheetAsset(asset: SpriteSheetAsset): Promise<Blob> {
  const canvas = new OffscreenCanvas(asset.width, asset.height);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = asset.background_color || '#2D3748';
  ctx.fillRect(0, 0, asset.width, asset.height);

  const fw = asset.frame_width;
  const fh = asset.frame_height;
  const cols = asset.columns;
  const rows = asset.rows;

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * fw;
      const y = r * fh;

      ctx.fillStyle = '#3D4F5F';
      ctx.fillRect(x + 1, y + 1, fw - 2, fh - 2);

      ctx.strokeRect(x, y, fw, fh);

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

async function generateTilesetAsset(asset: TilesetAsset): Promise<Blob> {
  const canvas = new OffscreenCanvas(asset.width, asset.height);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = asset.background_color || '#2D3748';
  ctx.fillRect(0, 0, asset.width, asset.height);

  const tw = asset.tile_width;
  const th = asset.tile_height;
  const cols = Math.floor(asset.width / tw);
  const rows = Math.floor(asset.height / th);

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tw;
      const y = r * th;

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

async function generateUiPanelAsset(asset: UiPanelAsset): Promise<Blob> {
  const canvas = new OffscreenCanvas(asset.width, asset.height);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = asset.background_color || '#2D3748';
  ctx.fillRect(0, 0, asset.width, asset.height);

  ctx.strokeStyle = '#718096';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, asset.width - 12, asset.height - 12);

  ctx.strokeStyle = '#4A5568';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, asset.width - 32, asset.height - 32);

  ctx.strokeStyle = '#A0AEC0';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, asset.width - 40, asset.height - 40);

  if (asset.label_enabled !== false) {
    drawLabel(ctx, asset.name, asset.width / 2, asset.height / 2, asset.width - 60);
  }

  return canvas.convertToBlob({ type: 'image/png' });
}

async function renderAsset(asset: Asset): Promise<Blob> {
  switch (asset.kind) {
    case 'sprite_sheet':
      return generateSpriteSheetAsset(asset);
    case 'tileset':
      return generateTilesetAsset(asset);
    case 'ui_panel':
      return generateUiPanelAsset(asset);
    case 'image':
    default:
      return generateImageAsset(asset);
  }
}

export async function generateJob(job: Manifest): Promise<GenerateResult> {
  const zip = new JSZip();
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const request of job.requests ?? []) {
    for (const asset of request.assets ?? []) {
      try {
        const safePath = asset.output_path ? sanitizePath(asset.output_path) : '';
        const safeName = sanitizeFilename(asset.name);
        const ext = (asset.format || 'png').toLowerCase();
        const filename = `${safeName}.${ext}`;
        const fullPath = safePath ? `${safePath}/${filename}` : filename;

        if (seen.has(fullPath)) {
          errors.push(`${asset.name}: duplicate output path "${fullPath}"`);
          continue;
        }
        seen.add(fullPath);

        const blob = await renderAsset(asset);
        zip.file(fullPath, blob);
      } catch (err: any) {
        errors.push(`${asset.name}: ${err?.message ?? String(err)}`);
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { success: true, zip: zipBlob, errors: [] };
}
