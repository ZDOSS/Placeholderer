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
import {
  drawImageAsset,
  drawSpriteSheetAsset,
  drawTilesetAsset,
  drawUiPanelAsset,
  type DrawContext,
} from './render';

export interface GenerateResult {
  success: boolean;
  zip?: Blob;
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

async function renderAssetToBlob(asset: Asset): Promise<Blob> {
  const canvas = new OffscreenCanvas(asset.width, asset.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('failed to acquire 2d context');
  drawAsset(asset, { ctx, width: asset.width, height: asset.height });
  return canvas.convertToBlob({ type: 'image/png' });
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

        const blob = await renderAssetToBlob(asset);
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
