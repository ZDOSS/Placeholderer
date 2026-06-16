// generate --in <manifest> --out <zip> — produce a ZIP of placeholder assets.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateManifest, generateJob } from '@placeholderer/core';
import type { Manifest } from '@placeholderer/schemas';
import { nodeCanvasBackend } from './canvas.js';
import { isJsonMode, isQuietMode, printError, printHuman, printJson } from './output.js';
import { CliError, ExitCode } from './errors.js';

export interface GenerateFlags {
  in: string;
  out?: string;
  json?: boolean;
  quiet?: boolean;
}

export async function runGenerate(flags: GenerateFlags): Promise<void> {
  if (!flags.in) {
    printError({ json: !!flags.json, quiet: !!flags.quiet }, 'missing --in <file>');
    throw new CliError(ExitCode.Usage, 'missing --in');
  }

  const inPath = resolve(flags.in);

  let raw: string;
  try {
    raw = await readFile(inPath, 'utf8');
  } catch (err: any) {
    printError({ json: !!flags.json, quiet: !!flags.quiet },
      `cannot read ${inPath}`, err?.message);
    throw new CliError(ExitCode.IO, `cannot read ${inPath}`);
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err: any) {
    printError({ json: !!flags.json, quiet: !!flags.quiet },
      `${inPath} is not valid JSON`, err?.message);
    throw new CliError(ExitCode.Validation, `${inPath} is not valid JSON`);
  }

  const valid = validateManifest(manifest);
  if (!valid.valid) {
    if (isJsonMode(flags)) {
      printJson({ ok: false, stage: 'validation', errors: valid.errors });
    } else {
      printError({ json: false, quiet: false },
        `manifest failed validation`,
        valid.errors.map((e) => `  ${e.path || '/'}: ${e.message}`).join('\n'));
    }
    throw new CliError(ExitCode.Validation, 'manifest validation failed');
  }

  if (!isQuietMode(flags) && !isJsonMode(flags)) {
    printHuman({ json: false, quiet: false }, `generating ${countAssets(manifest)} assets...`);
  }

  const result = await generateJob(manifest, nodeCanvasBackend);

  if (!result.success || !result.zip) {
    if (isJsonMode(flags)) {
      printJson({ ok: false, stage: 'generation', errors: result.errors });
    } else {
      printError({ json: false, quiet: false },
        'generation failed',
        result.errors.join('\n'));
    }
    throw new CliError(ExitCode.Generation, 'generation failed');
  }

  // Default to the core's suggested name (sanitized job.name + .zip).
  const outPath = flags.out
    ? resolve(flags.out)
    : resolve(result.suggestedName ?? 'placeholders.zip');

  try {
    await writeFile(outPath, result.zip);
  } catch (err: any) {
    printError({ json: !!flags.json, quiet: !!flags.quiet },
      `cannot write ${outPath}`, err?.message);
    throw new CliError(ExitCode.IO, `cannot write ${outPath}`);
  }

  if (isJsonMode(flags)) {
    printJson({ ok: true, output: outPath, suggestedName: result.suggestedName });
  } else if (!isQuietMode(flags)) {
    printHuman({ json: false, quiet: false }, `✓ wrote ${outPath}`);
  }
}

function countAssets(manifest: Manifest): number {
  return (manifest.requests ?? []).reduce(
    (sum, r) => sum + (r.assets?.length ?? 0),
    0
  );
}
