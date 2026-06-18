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
    case 'bmp':
      return 'image/bmp';
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

  // Sidecar reservations for animated sprite sheets. Tracked
  // separately from committed files so a sprite sheet can still
  // be written when only its sidecar path collides with a prior
  // asset (the primary sheet path is what blocks generation).
  const reservedSidecars = new Set<string>();

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

        // Animated sprite sheets emit a sidecar. Note its path
        // here so the sidecar pass can decide whether to write
        // (it's skipped when the sidecar path was already taken
        // by a prior asset).
        let sidecarPath: string | null = null;
        if (asset.kind === 'sprite_sheet' && (asset as SpriteSheetAsset).frame_duration_ms != null) {
          const sidecarFile = `${safeName}.animation.json`;
          sidecarPath = safePath ? `${safePath}/${sidecarFile}` : sidecarFile;
        }

        // Duplicate check: only the primary output path can block
        // the whole asset. A collision on the optional sidecar
        // path is fine — the sheet still gets written, and the
        // sidecar pass will detect the prior commitment and skip.
        if (createdFiles.includes(fullPath)) {
          errors.push(`${asset.name}: duplicate output path "${fullPath}"`);
          continue;
        }

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
        // Commit the file to the ZIP, then to the report — only after
        // a successful write. If zip.file throws or encode rejects,
        // neither path leaks into the sidecar pass or the report.
        zip.file(fullPath, bytes);
        createdFiles.push(fullPath);
        // Reserve the sidecar path for this asset. If the path is
        // already taken (a prior asset wrote to it), we skip the
        // reservation — the sidecar pass will see the prior file
        // in createdFiles and leave it alone.
        if (sidecarPath && !createdFiles.includes(sidecarPath)) {
          reservedSidecars.add(sidecarPath);
        }
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

  // Animated sprite sheets: emit a sidecar animation.json with the
  // timing data. The sidecar sits next to the sheet so a runtime can
  // pair them by name. The main asset loop reserves the sidecar
  // path in `reservedSidecars` only when it's free, so the sidecar
  // pass skips assets whose sidecar path was already taken (an
  // explicit user file with that name wins) while still letting
  // the primary sheet land in the ZIP.
  //
  // A reservation made early in the main loop is only a soft claim:
  // a LATER asset may have written a file at the same path between
  // the reservation and now. Re-check `createdFiles` immediately
  // before writing the sidecar, and commit to `createdFiles` after
  // writing so the manifest report correctly reflects what landed.
  //
  // The sanitizePath/sanitizeFilename calls can throw for malformed
  // output_paths, but the main loop already pushed this asset's
  // errors when the sheet itself failed. A second throw here would
  // reject the whole generateJob call instead of producing a partial
  // ZIP and per-asset error report, so we wrap the sidecar in its
  // own try/catch and emit a per-asset error.
  for (const request of job.requests ?? []) {
    for (const asset of request.assets ?? []) {
      if (asset.kind !== 'sprite_sheet') continue;
      const sa = asset as SpriteSheetAsset;
      if (sa.frame_duration_ms == null) continue;
      try {
        const safePath = asset.output_path ? sanitizePath(asset.output_path) : '';
        const safeName = sanitizeFilename(asset.name);
        const sheet = `${safeName}.${(asset.format || 'png').toLowerCase()}`;
        const sheetPath = safePath ? `${safePath}/${sheet}` : sheet;
        const sidecarFile = `${safeName}.animation.json`;
        const sidecarPath = safePath ? `${safePath}/${sidecarFile}` : sidecarFile;
        // Only emit if the sheet actually rendered. createdFiles
        // holds only committed outputs (reservations live in
        // reservedSidecars), so this guards against failed sheets.
        if (!createdFiles.includes(sheetPath)) continue;
        // The main loop reserved this sidecar only when the path
        // was free. If it's not in our reservation set, a prior
        // asset already wrote a file there — leave it alone.
        if (!reservedSidecars.has(sidecarPath)) continue;
        // Re-check: a later asset in the main loop may have
        // written the sidecar path as its primary output between
        // our reservation and now. Don't overwrite — let the
        // later asset's file win.
        if (createdFiles.includes(sidecarPath)) continue;
        const totalFrames = asset.rows * asset.columns;
        const fps = Math.round(1000 / sa.frame_duration_ms);
        zip.file(
          sidecarPath,
          JSON.stringify({
            sheet: sheetPath,
            frame_width: asset.frame_width,
            frame_height: asset.frame_height,
            rows: asset.rows,
            columns: asset.columns,
            frame_count: totalFrames,
            frame_duration_ms: sa.frame_duration_ms,
            fps,
            total_duration_ms: totalFrames * sa.frame_duration_ms,
          }, null, 2)
        );
        // Commit the sidecar to createdFiles so the manifest
        // report includes it. Without this, the report lists
        // only the primary sheet and the sidecar becomes a
        // "secret" file in the ZIP.
        createdFiles.push(sidecarPath);
      } catch (err: any) {
        errors.push(`${asset.name} (sidecar): ${err?.message ?? String(err)}`);
      }
    }
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
