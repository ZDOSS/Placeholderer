// e2e: run the CLI's generate flow against a real manifest and
// assert the produced ZIP's contents. Skipped automatically when
// the @napi-rs/canvas native binary is unavailable.

import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';

let canRun = true;
let generateJob: typeof import('@placeholderer/core').generateJob;
let nodeCanvasBackend: typeof import('../src/canvas.js').nodeCanvasBackend;

beforeAll(async () => {
  try {
    const core = await import('@placeholderer/core');
    const cli = await import('../src/canvas.js');
    generateJob = core.generateJob;
    nodeCanvasBackend = cli.nodeCanvasBackend;
    // Smoke-test the backend by drawing a 1x1 canvas.
    const h = nodeCanvasBackend.createCanvas(1, 1);
    await h.encode('image/png');
  } catch (err: any) {
    canRun = false;
    console.warn(`[cli e2e] skipping: ${err?.message ?? err}`);
  }
});

describe.skipIf(!canRun)('CLI generate (e2e)', () => {
  it('produces a spec-compliant ZIP from a real manifest', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'placeholderer-cli-e2e-'));
    try {
      const manifestPath = join(dir, 'manifest.json');
      const zipPath = join(dir, 'out.zip');

      const manifest = {
        schemaVersion: 1,
        job: { name: 'cli_e2e_pack' },
        requests: [{
          name: 'core',
          folders: ['art/ui/panels', 'art/ui/icons', 'art/sprites/enemies'],
          assets: [
            {
              kind: 'ui_panel',
              name: 'dialog_box_large',
              output_path: 'art/ui/panels',
              width: 128, height: 32, format: 'png',
            },
            {
              kind: 'sprite_sheet',
              name: 'slime_idle',
              output_path: 'art/sprites/enemies',
              width: 64, height: 32, format: 'png',
              frame_width: 32, frame_height: 32, rows: 1, columns: 2,
            },
          ],
        }],
      };
      writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await generateJob(manifest, nodeCanvasBackend);
      expect(result.success).toBe(true);
      expect(result.zip).toBeDefined();
      expect(result.suggestedName).toBe('cli_e2e_pack.zip');

      writeFileSync(zipPath, result.zip!);

      // Re-open the ZIP and inspect its contents.
      const zipBytes = readFileSync(zipPath);
      const zip = await JSZip.loadAsync(zipBytes);

      // Every requested asset should be in the archive.
      expect(zip.file('art/ui/panels/dialog_box_large.png')).toBeDefined();
      expect(zip.file('art/sprites/enemies/slime_idle.png')).toBeDefined();

      // Empty declared folder materialized with .gitkeep.
      expect(zip.file('art/ui/icons/.gitkeep')).toBeDefined();

      // Manifest report must be present and well-formed.
      const reportEntry = zip.file('_placeholderer/manifest-report.json');
      expect(reportEntry).toBeDefined();
      const report = JSON.parse(await reportEntry!.async('text'));
      expect(report.jobName).toBe('cli_e2e_pack');
      expect(report.totalAssets).toBe(2);
      expect(report.successful).toBe(2);
      expect(report.failed).toBe(0);
      expect(report.createdFolders).toEqual(expect.arrayContaining([
        'art', 'art/sprites', 'art/sprites/enemies',
        'art/ui', 'art/ui/icons', 'art/ui/panels',
      ]));
      expect(report.createdFiles).toEqual(expect.arrayContaining([
        'art/ui/panels/dialog_box_large.png',
        'art/sprites/enemies/slime_idle.png',
      ]));
      expect(report.errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a bad manifest at validation time', async () => {
    const bad = { schemaVersion: 2, requests: [] };
    // The CLI's runValidate would throw CliError(1); here we just
    // test that the core validator surfaces the issue.
    const core = await import('@placeholderer/core');
    const result = core.validateManifest(bad);
    expect(result.valid).toBe(false);
  });
});
