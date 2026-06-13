// App-specific types

export interface Job {
  schemaVersion: number;
  job?: {
    name?: string;
    defaults?: any;
  };
  requests: Array<{
    name?: string;
    folders?: string[];
    assets: any[];
  }>;
}