// init-template <engine> <type> [--out <path>] — write a starter manifest.

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isValidEngine, isValidType, renderStarterManifest, type TemplateType } from './templates.js';
import { isJsonMode, isQuietMode, printError, printHuman, printJson } from './output.js';
import { CliError, ExitCode } from './errors.js';

export interface InitTemplateFlags {
  out?: string;
  json?: boolean;
  quiet?: boolean;
}

export async function runInitTemplate(
  engine: string,
  type: string,
  flags: InitTemplateFlags
): Promise<void> {
  if (!engine || !type) {
    printError({ json: !!flags.json, quiet: !!flags.quiet },
      'usage: placeholderer init-template <engine> <type> [--out <path>]');
    throw new CliError(ExitCode.Usage, 'missing engine or type');
  }
  if (!isValidEngine(engine)) {
    printError({ json: !!flags.json, quiet: !!flags.quiet },
      `unknown engine: ${engine}`,
      'run `placeholderer list-templates` to see available engines');
    throw new CliError(ExitCode.Usage, `unknown engine: ${engine}`);
  }
  if (!isValidType(type)) {
    printError({ json: !!flags.json, quiet: !!flags.quiet },
      `unknown type: ${type}`,
      'run `placeholderer list-templates` to see available types');
    throw new CliError(ExitCode.Usage, `unknown type: ${type}`);
  }

  const manifest = renderStarterManifest(engine, type as TemplateType);

  if (isJsonMode(flags) && !flags.out) {
    // Emit to stdout so the caller can pipe it to validate or use as-is.
    process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
    return;
  }

  const outPath = resolve(flags.out ?? `./${engine.toLowerCase()}_${type}.json`);
  try {
    await writeFile(outPath, JSON.stringify(manifest, null, 2));
  } catch (err: any) {
    printError({ json: !!flags.json, quiet: !!flags.quiet },
      `cannot write ${outPath}`, err?.message);
    throw new CliError(ExitCode.IO, `cannot write ${outPath}`);
  }

  if (isJsonMode(flags)) {
    printJson({ ok: true, output: outPath });
  } else if (!isQuietMode(flags)) {
    printHuman({ json: false, quiet: false }, `✓ wrote starter manifest to ${outPath}`);
  }
}
