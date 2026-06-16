// validate <file> — validate a manifest against the JSON schema.

import { readFile } from 'node:fs/promises';
import { validateManifest, type ValidationError } from '@placeholderer/core';
import { isJsonMode, printError, printHuman, printJson } from './output.js';
import { CliError, ExitCode } from './errors.js';

export interface ValidateFlags {
  json?: boolean;
  quiet?: boolean;
}

export async function runValidate(file: string, flags: ValidateFlags): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (err: any) {
    printError({ json: !!flags.json, quiet: !!flags.quiet },
      `cannot read ${file}`, err?.message);
    throw new CliError(ExitCode.IO, `cannot read ${file}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: any) {
    printError({ json: !!flags.json, quiet: !!flags.quiet },
      `${file} is not valid JSON`, err?.message);
    throw new CliError(ExitCode.Validation, `${file} is not valid JSON`);
  }

  const result = validateManifest(parsed);

  if (result.valid) {
    if (isJsonMode(flags)) {
      printJson({ valid: true, file });
    } else {
      printHuman({ json: false, quiet: !!flags.quiet }, `✓ ${file} is a valid Placeholderer manifest`);
    }
    return;
  }

  // Invalid
  if (isJsonMode(flags)) {
    printJson({
      valid: false,
      file,
      errors: result.errors.map((e: ValidationError) => ({
        path: e.path || '/',
        message: e.message,
      })),
    });
  } else {
    printError({ json: false, quiet: false },
      `${file} failed validation`,
      formatErrors(result.errors));
  }
  throw new CliError(ExitCode.Validation, `${file} failed validation`);
}

function formatErrors(errors: ValidationError[]): string {
  return errors
    .map((e) => `  ${e.path || '/'}: ${e.message}`)
    .join('\n');
}
