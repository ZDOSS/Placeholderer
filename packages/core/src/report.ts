export interface GenerationReport {
  jobName: string;
  totalAssets: number;
  successful: number;
  failed: number;
  createdFolders: string[];
  errors: Array<{ asset: string; message: string }>;
}

export function createEmptyReport(jobName: string): GenerationReport {
  return {
    jobName,
    totalAssets: 0,
    successful: 0,
    failed: 0,
    createdFolders: [],
    errors: []
  };
}