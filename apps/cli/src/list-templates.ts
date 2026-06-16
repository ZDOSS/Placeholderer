// list-templates — print the available engines and supported types.

import { ALL_ENGINES, V1_ENGINES, V1_1_ENGINES, TEMPLATE_TYPES } from './templates.js';
import { isJsonMode, printHuman, printJson } from './output.js';

export interface ListTemplatesFlags {
  json?: boolean;
  quiet?: boolean;
}

export function runListTemplates(flags: ListTemplatesFlags): void {
  const data = {
    v1: V1_ENGINES,
    v11: V1_1_ENGINES,
    types: TEMPLATE_TYPES,
  };

  if (isJsonMode(flags)) {
    printJson(data);
    return;
  }

  if (flags.quiet) return;

  const lines: string[] = [];
  lines.push('Engines (v1):');
  for (const e of V1_ENGINES) lines.push(`  - ${e}`);
  lines.push('Engines (v1.1):');
  for (const e of V1_1_ENGINES) lines.push(`  - ${e}`);
  lines.push('Asset types:');
  for (const t of TEMPLATE_TYPES) lines.push(`  - ${t}`);
  lines.push('');
  lines.push(`Total: ${ALL_ENGINES.length} engines, ${TEMPLATE_TYPES.length} types`);

  printHuman({ json: false, quiet: false }, lines.join('\n'));
}
