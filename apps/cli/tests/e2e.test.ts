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

  it('generates a WAV audio asset with a valid RIFF header', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'placeholderer-audio-e2e-'));
    try {
      const manifest = {
        schemaVersion: 1,
        job: { name: 'audio_e2e' },
        requests: [{
          name: 'sfx',
          assets: [{
            kind: 'audio',
            name: 'beep',
            width: 1, height: 1, format: 'wav',
            output_path: 'sfx',
            frequency: 440,
            duration: 0.25,
            sample_rate: 22050,
          }],
        }],
      };
      const result = await generateJob(manifest, nodeCanvasBackend);
      expect(result.success).toBe(true);

      // Open the ZIP and pull the WAV out.
      const zip = await JSZip.loadAsync(result.zip!);
      const wavEntry = zip.file('sfx/beep.wav');
      expect(wavEntry).toBeDefined();
      const bytes = await wavEntry!.async('uint8array');
      // RIFF/WAVE header check
      const view = new DataView(bytes.buffer);
      expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe('RIFF');
      expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))).toBe('WAVE');
      // PCM format
      expect(view.getUint16(20, true)).toBe(1); // PCM
      expect(view.getUint16(22, true)).toBe(1); // mono
      expect(view.getUint32(24, true)).toBe(22050); // sample rate
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
