import JSZip from 'jszip';
import type {
  Manifest,
  Asset,
  Format,
  ImageAsset,
  SpriteSheetAsset,
  TilesetAsset,
  UiPanelAsset,
} from '@placeholderer/schemas';
import { sanitizePath, sanitizeFilename } from './path.js';
import {
  drawImageAsset,
  drawSpriteSheetAsset,
  drawTilesetAsset,
  drawUiPanelAsset,
  type DrawContext,
} from './render.js';
import type { CanvasBackend, CanvasHandle } from './canvas.js';

export interface GenerateResult {
  success: boolean;
  zip?: Uint8Array;
  errors: string[];
}

function drawAsset(asset: Asset, dc: DrawContext): void {
  switch (asset.kind) {
    case 'sprite_sheet':
      drawSpriteSheetAsset(dc, asset as SpriteSheetAsset);
      return;
    case 'tileset':
      drawTilesetAsset(dc, asset as TilesetAsset);
      return;
    case 'ui_panel':
      drawUiPanelAsset(dc, asset as UiPanelAsset);
      return;
    case 'image':
    default:
      drawImageAsset(dc, asset as ImageAsset);
  }
}

function formatToMime(format: Format): string {
  switch (format) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'png':
    default:
      return 'image/png';
  }
}

export async function generateJob(
  job: Manifest,
  backend: CanvasBackend
): Promise<GenerateResult> {
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

        const handle = backend.createCanvas(asset.width, asset.height);
        drawAsset(asset, {
          ctx: handle.ctx,
          width: asset.width,
          height: asset.height,
        });
        const bytes = await handle.encode(formatToMime(asset.format));
        zip.file(fullPath, bytes);
      } catch (err: any) {
        errors.push(`${asset.name}: ${err?.message ?? String(err)}`);
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const zipBytes = await zip.generateAsync({ type: 'uint8array' });
  return { success: true, zip: zipBytes, errors: [] };
}
