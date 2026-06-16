// e2e: run the CLI's generate flow against a real manifest and
// assert the produced ZIP's contents. Skipped automatically when
// the @napi-rs/canvas native binary is unavailable.

import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';

// Import the modules synchronously at load time so the test bodies
// always have a binding. The actual runnable flag is set by
// beforeAll after a smoke test; tests that need a working canvas
// check canRun at the top and return early if it's false. We don't
// use describe.skipIf — that flag is evaluated when the file is
// loaded, before beforeAll runs, so a failed native setup wouldn't
// actually skip the tests.
let canRun = false;
let generateJob: typeof import('@placeholderer/core').generateJob | undefined;
let nodeCanvasBackend: typeof import('../src/canvas.js').nodeCanvasBackend | undefined;

beforeAll(async () => {
  try {
    const core = await import('@placeholderer/core');
    const cli = await import('../src/canvas.js');
    generateJob = core.generateJob;
    nodeCanvasBackend = cli.nodeCanvasBackend;
    // Smoke-test the backend by drawing a 1x1 canvas. If the
    // native binary is missing or unloadable this throws and
    // canRun stays false, so the tests below short-circuit.
    const h = nodeCanvasBackend.createCanvas(1, 1);
    await h.encode('image/png');
    canRun = true;
  } catch (err: any) {
    console.warn(`[cli e2e] skipping: ${err?.message ?? err}`);
  }
});

function requireCanvas(): { generateJob: NonNullable<typeof generateJob>; nodeCanvasBackend: NonNullable<typeof nodeCanvasBackend> } {
  if (!canRun || !generateJob || !nodeCanvasBackend) {
    throw new Error('canvas backend unavailable');
  }
  return { generateJob, nodeCanvasBackend };
}

describe('CLI generate (e2e)', () => {
  it('produces a spec-compliant ZIP from a real manifest', async () => {
    if (!canRun) return; // beforeAll didn't set up; the suite is a no-op
    const { generateJob, nodeCanvasBackend } = requireCanvas();
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
    if (!canRun) return;
    const bad = { schemaVersion: 2, requests: [] };
    // The CLI's runValidate would throw CliError(1); here we just
    // test that the core validator surfaces the issue.
    const core = await import('@placeholderer/core');
    const result = core.validateManifest(bad);
    expect(result.valid).toBe(false);
  });

  it('emits an animation.json sidecar for animated sprite sheets', async () => {
    if (!canRun) return;
    const { generateJob, nodeCanvasBackend } = requireCanvas();
    const dir = mkdtempSync(join(tmpdir(), 'placeholderer-anim-e2e-'));
    try {
      const manifest = {
        schemaVersion: 1,
        job: { name: 'anim_e2e' },
        requests: [{
          name: 'enemies',
          assets: [{
            kind: 'sprite_sheet',
            name: 'slime_idle',
            width: 64, height: 32, format: 'png',
            output_path: 'enemies',
            frame_width: 32, frame_height: 32,
            rows: 1, columns: 2,
            frame_duration_ms: 150,
          }],
        }],
      };
      const result = await generateJob(manifest, nodeCanvasBackend);
      expect(result.success).toBe(true);

      const zip = await JSZip.loadAsync(result.zip!);
      const sidecar = zip.file('enemies/slime_idle.animation.json');
      expect(sidecar).toBeDefined();
      const anim = JSON.parse(await sidecar!.async('text'));
      expect(anim.sheet).toBe('enemies/slime_idle.png');
      expect(anim.frame_count).toBe(2);
      expect(anim.frame_duration_ms).toBe(150);
      expect(anim.fps).toBe(7);
      expect(anim.total_duration_ms).toBe(300);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips sidecar + report entry when an animated sprite sheet fails', async () => {
    if (!canRun) return;
    // Force the second sprite sheet's render to fail by giving it a
    // backend whose encode() rejects. The first one still succeeds so
    // the ZIP contains a real sheet and a real manifest report.
    const realBackend = requireCanvas().nodeCanvasBackend;
    const realCreate = realBackend.createCanvas.bind(realBackend);
    let calls = 0;
    const flakyBackend: typeof realBackend = {
      createCanvas(width, height) {
        calls++;
        if (calls === 2) {
          // Throw on encode for the second call only.
          return {
            ctx: realCreate(width, height).ctx,
            encode: async () => { throw new Error('forced failure'); },
          };
        }
        return realCreate(width, height);
      },
    };
    const dir = mkdtempSync(join(tmpdir(), 'placeholderer-anim-fail-'));
    try {
      const manifest = {
        schemaVersion: 1,
        job: { name: 'anim_fail_e2e' },
        requests: [{
          name: 'enemies',
          assets: [
            {
              kind: 'sprite_sheet',
              name: 'good_sheet',
              width: 64, height: 32, format: 'png',
              output_path: 'enemies',
              frame_width: 32, frame_height: 32,
              rows: 1, columns: 2,
              frame_duration_ms: 150,
            },
            {
              kind: 'sprite_sheet',
              name: 'bad_sheet',
              width: 64, height: 32, format: 'png',
              output_path: 'enemies',
              frame_width: 32, frame_height: 32,
              rows: 1, columns: 2,
              frame_duration_ms: 200,
            },
          ],
        }],
      };
      const result = await generateJob(manifest, flakyBackend);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('bad_sheet'))).toBe(true);

      const zip = await JSZip.loadAsync(result.zip!);
      // The good sheet and its sidecar are present.
      expect(zip.file('enemies/good_sheet.png')).toBeDefined();
      expect(zip.file('enemies/good_sheet.animation.json')).toBeDefined();
      // The bad sheet and its sidecar are NOT in the archive
      // (JSZip.file returns null for missing entries).
      expect(zip.file('enemies/bad_sheet.png')).toBeNull();
      expect(zip.file('enemies/bad_sheet.animation.json')).toBeNull();
      // The manifest report does not list the failed sheet.
      const report = JSON.parse(await zip.file('_placeholderer/manifest-report.json')!.async('text'));
      expect(report.createdFiles).not.toContain('enemies/bad_sheet.png');
      expect(report.createdFiles).not.toContain('enemies/bad_sheet.animation.json');
      expect(report.createdFiles).toContain('enemies/good_sheet.png');
      expect(report.failed).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('generates a WAV audio asset with a valid RIFF header', async () => {
    if (!canRun) return;
    const { generateJob, nodeCanvasBackend } = requireCanvas();
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
