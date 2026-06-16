import JSZip from 'jszip';
import type {
  Manifest,
  Asset,
  Format,
  ImageAsset,
  SpriteSheetAsset,
  TilesetAsset,
  UiPanelAsset,
  AudioAsset,
} from '@placeholderer/schemas';
import { sanitizePath, sanitizeFilename } from './path.js';
import {
  drawImageAsset,
  drawSpriteSheetAsset,
  drawTilesetAsset,
  drawUiPanelAsset,
  type DrawContext,
} from './render.js';
import type { CanvasBackend } from './canvas.js';
import { buildReport, type GenerationReport } from './report.js';
import { generateAudio } from './audio.js';

export interface GenerateResult {
  success: boolean;
  zip?: Uint8Array;
  /** Sanitized filename suggested for the ZIP (job.name with .zip). */
  suggestedName?: string;
  errors: string[];
}

const REPORT_DIR = '_placeholderer';

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

/**
 * Build a sanitized ZIP filename from the job name. Falls back to
 * 'placeholders' if the manifest has no name or the name is empty
 * after sanitization.
 */
function buildSuggestedName(job: Manifest): string {
  const raw = (job.job?.name ?? '').trim();
  const safe = raw ? sanitizeFilename(raw) : 'placeholders';
  return `${safe || 'placeholders'}.zip`;
}

export async function generateJob(
  job: Manifest,
  backend: CanvasBackend
): Promise<GenerateResult> {
  const zip = new JSZip();
  const errors: string[] = [];
  const createdFiles: string[] = [];
  const declaredFolders = new Set<string>();
  let totalAssets = 0;
  let successful = 0;

  for (const request of job.requests ?? []) {
    // Collect declared folders so we can materialize empty ones later.
    for (const folder of request.folders ?? []) {
      try {
        declaredFolders.add(sanitizePath(folder));
      } catch (err: any) {
        errors.push(`folder "${folder}": ${err?.message ?? String(err)}`);
      }
    }

    for (const asset of request.assets ?? []) {
      totalAssets++;
      try {
        const safePath = asset.output_path ? sanitizePath(asset.output_path) : '';
        const safeName = sanitizeFilename(asset.name);
        // Audio files use the format field for the container extension
        // (wav by default). Image-style assets fall back to png.
        const defaultExt = asset.kind === 'audio' ? 'wav' : 'png';
        const ext = (asset.format || defaultExt).toLowerCase();
        const filename = `${safeName}.${ext}`;
        const fullPath = safePath ? `${safePath}/${filename}` : filename;

        if (createdFiles.includes(fullPath)) {
          errors.push(`${asset.name}: duplicate output path "${fullPath}"`);
          continue;
        }
        createdFiles.push(fullPath);

        let bytes: Uint8Array;
        if (asset.kind === 'audio') {
          bytes = generateAudio(asset as AudioAsset);
        } else {
          const handle = backend.createCanvas(asset.width, asset.height);
          drawAsset(asset, {
            ctx: handle.ctx,
            width: asset.width,
            height: asset.height,
          });
          bytes = await handle.encode(formatToMime(asset.format));
        }
        zip.file(fullPath, bytes);
        successful++;
      } catch (err: any) {
        errors.push(`${asset.name}: ${err?.message ?? String(err)}`);
      }
    }
  }

  // Materialize declared folders that ended up empty (no asset landed
  // in them). We add a .gitkeep inside so the folder survives in any
  // ZIP tool that drops bare folder entries.
  for (const folder of declaredFolders) {
    if (createdFiles.some((f) => f === folder || f.startsWith(`${folder}/`))) {
      continue;
    }
    zip.file(`${folder}/.gitkeep`, '');
  }

  // Always emit a manifest report, even on partial failure, so the
  // caller can see what landed and what didn't.
  const report: GenerationReport = buildReport({
    jobName: job.job?.name ?? '',
    totalAssets,
    successful,
    failed: totalAssets - successful,
    createdFolders: collectFolders(createdFiles, declaredFolders),
    createdFiles,
    errors: errors.map((e) => parseError(e)),
  });
  zip.file(
    `${REPORT_DIR}/manifest-report.json`,
    JSON.stringify(report, null, 2)
  );

  // Error report only if there were errors.
  if (errors.length > 0) {
    zip.file(
      `${REPORT_DIR}/error-report.json`,
      JSON.stringify({ errors: report.errors }, null, 2)
    );
  }

  const zipBytes = await zip.generateAsync({ type: 'uint8array' });
  return {
    success: errors.length === 0,
    zip: zipBytes,
    suggestedName: buildSuggestedName(job),
    errors,
  };
}

function collectFolders(files: string[], declared: Set<string>): string[] {
  const set = new Set<string>(declared);
  for (const f of files) {
    const idx = f.lastIndexOf('/');
    if (idx <= 0) continue;
    let prefix = f.slice(0, idx);
    while (prefix) {
      set.add(prefix);
      const next = prefix.lastIndexOf('/');
      if (next < 0) break;
      prefix = prefix.slice(0, next);
    }
  }
  return [...set].sort();
}

function parseError(message: string): { asset: string; message: string } {
  const idx = message.indexOf(': ');
  if (idx <= 0) return { asset: '<unknown>', message };
  return { asset: message.slice(0, idx), message: message.slice(idx + 2) };
}
