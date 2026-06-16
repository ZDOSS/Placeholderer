// Stable exit codes for the CLI. Documented so AI agents and scripts
// can branch on them reliably.
//
//   0  success
//   1  validation error
//   2  generation error
//   3  IO / filesystem error
//   4  usage error (bad arguments, missing files, etc)

export const ExitCode = {
  Success: 0,
  Validation: 1,
  Generation: 2,
  IO: 3,
  Usage: 4,
} as const;

export class CliError extends Error {
  constructor(
    public readonly exitCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'CliError';
  }
}
