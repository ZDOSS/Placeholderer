// Manifest report types and builders.
//
// A manifest report is emitted into the generated ZIP at
// _placeholderer/manifest-report.json, describing the folders and
// files that were created, the asset counts, and any errors that
// didn't abort the whole job.

export interface GenerationReport {
  /** ISO 8601 timestamp. */
  generatedAt: string;
  /** Sanitized job name (used as the suggested ZIP filename). */
  jobName: string;
  /** Total number of assets across all requests. */
  totalAssets: number;
  /** Number of assets that produced output bytes. */
  successful: number;
  /** Number of assets that errored (errors appear in `errors`). */
  failed: number;
  /** Folders that ended up in the archive (output_path of any successful
   *  asset, plus any declared empty folders from request.folders). */
  createdFolders: string[];
  /** Files written into the archive, relative paths. */
  createdFiles: string[];
  /** Errors collected during the run, by asset. */
  errors: Array<{ asset: string; message: string }>;
}

export function buildReport(input: Omit<GenerationReport, 'generatedAt'>): GenerationReport {
  return {
    generatedAt: new Date().toISOString(),
    ...input,
  };
}
