// explain-schema <kind> — emit a JSON Schema (or sub-schema) for the
// given kind. Designed for AI agents that want to inspect the schema
// before generating a manifest.

import { manifestSchema, builderRecipeSchema } from '@placeholderer/schemas';
import { isJsonMode, printError, printHuman } from './output.js';
import { CliError, ExitCode } from './errors.js';

export type ExplainKind =
  | 'manifest'
  | 'builder-recipe'
  | `asset:${string}`;

export interface ExplainSchemaFlags {
  json?: boolean;
  quiet?: boolean;
}

export function runExplainSchema(kind: string, flags: ExplainSchemaFlags): void {
  const result = lookupSchema(kind);
  if (!result) {
    printError({ json: !!flags.json, quiet: !!flags.quiet },
      `unknown kind: ${kind}`,
      'available: manifest, builder-recipe, asset:<image|sprite_sheet|ui_panel|tileset>');
    throw new CliError(ExitCode.Usage, `unknown kind: ${kind}`);
  }

  // explain-schema is always JSON. --quiet just suppresses the trailing newline.
  const text = JSON.stringify(result, null, 2);
  process.stdout.write(text);
  if (!isJsonMode(flags) && !flags.quiet) process.stdout.write('\n');
}

function lookupSchema(kind: string): unknown {
  if (kind === 'manifest') return manifestSchema;
  if (kind === 'builder-recipe') return builderRecipeSchema;

  if (kind.startsWith('asset:')) {
    const name = kind.slice('asset:'.length);
    const defs = (manifestSchema as any).definitions ?? {};
    const key = `${name}Asset`;
    if (defs[key]) return defs[key];
    return null;
  }

  return null;
}
