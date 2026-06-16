#!/usr/bin/env node
// Placeholderer CLI entry point.

import { Command } from 'commander';
import { CliError, ExitCode } from './errors.js';
import { runValidate } from './validate.js';
import { runGenerate } from './generate.js';
import { runInitTemplate } from './init-template.js';
import { runListTemplates } from './list-templates.js';
import { runExplainSchema } from './explain-schema.js';

const program = new Command();

program
  .name('placeholderer')
  .description('Placeholderer CLI — generate placeholder assets from a manifest.')
  .version('0.1.0');

program
  .command('validate')
  .description('Validate a manifest file against the JSON schema.')
  .argument('<file>', 'path to manifest')
  .option('--json', 'emit machine-readable JSON output')
  .option('--quiet', 'suppress non-error output')
  .action(async (file: string, opts: { json?: boolean; quiet?: boolean }) => {
    await runValidate(file, { json: opts.json, quiet: opts.quiet });
  });

program
  .command('generate')
  .description('Generate a ZIP of placeholder assets from a manifest.')
  .requiredOption('--in <file>', 'path to manifest')
  .requiredOption('--out <file>', 'path to output ZIP')
  .option('--json', 'emit machine-readable JSON output')
  .option('--quiet', 'suppress non-error output')
  .action(async (opts: { in: string; out: string; json?: boolean; quiet?: boolean }) => {
    await runGenerate({
      in: opts.in,
      out: opts.out,
      json: opts.json,
      quiet: opts.quiet,
    });
  });

program
  .command('init-template')
  .description('Write a starter manifest for the given engine and asset type.')
  .argument('<engine>', `engine name (${'see'} 'list-templates')`)
  .argument('<type>', "asset type: image | sprite_sheet | ui_panel | tileset | mixed")
  .option('--out <file>', 'output path (default: ./<engine>_<type>.json)')
  .option('--json', 'emit machine-readable JSON output')
  .option('--quiet', 'suppress non-error output')
  .action(async (engine: string, type: string, opts: { out?: string; json?: boolean; quiet?: boolean }) => {
    await runInitTemplate(engine, type, { out: opts.out, json: opts.json, quiet: opts.quiet });
  });

program
  .command('list-templates')
  .description('List available engine templates and asset types.')
  .option('--json', 'emit machine-readable JSON output')
  .option('--quiet', 'suppress non-error output')
  .action((opts: { json?: boolean; quiet?: boolean }) => {
    runListTemplates({ json: opts.json, quiet: opts.quiet });
  });

program
  .command('explain-schema')
  .description('Emit the JSON Schema (or sub-schema) for a given kind.')
  .argument('<kind>', "manifest | builder-recipe | asset:<image|sprite_sheet|ui_panel|tileset>")
  .option('--json', 'emit machine-readable JSON output')
  .option('--quiet', 'suppress non-error output')
  .action((kind: string, opts: { json?: boolean; quiet?: boolean }) => {
    runExplainSchema(kind, { json: opts.json, quiet: opts.quiet });
  });

// Run. Map CliError to the documented exit code; anything else is a 1.
program.parseAsync().catch((err: unknown) => {
  if (err instanceof CliError) {
    process.exit(err.exitCode);
  }
  // Unexpected: surface it and exit non-zero.
  process.stderr.write(`unexpected error: ${(err as Error)?.message ?? String(err)}\n`);
  process.exit(ExitCode.Generation);
});
