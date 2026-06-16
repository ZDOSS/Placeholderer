// Shared output helpers for the CLI.
// All commands accept --json and --quiet. --json switches every human
// message to structured JSON. --quiet suppresses non-error output
// (success messages, progress, etc).

export interface OutputOptions {
  json: boolean;
  quiet: boolean;
}

export function isJsonMode(flags: { json?: boolean }): boolean {
  return flags.json === true;
}

export function isQuietMode(flags: { quiet?: boolean }): boolean {
  return flags.quiet === true;
}

export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

export function printHuman(flags: OutputOptions, text: string): void {
  if (isJsonMode(flags) || isQuietMode(flags)) return;
  process.stdout.write(text + '\n');
}

export function printError(flags: OutputOptions, message: string, details?: unknown): void {
  if (isJsonMode(flags)) {
    const payload: Record<string, unknown> = { error: message };
    if (details !== undefined) payload.details = details;
    process.stderr.write(JSON.stringify(payload, null, 2) + '\n');
  } else {
    process.stderr.write(`error: ${message}\n`);
    if (details !== undefined && !isQuietMode(flags)) {
      process.stderr.write(typeof details === 'string' ? details + '\n' : JSON.stringify(details, null, 2) + '\n');
    }
  }
}
