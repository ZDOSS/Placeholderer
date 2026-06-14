export interface ValidationResult {
  valid: boolean;
  errors: any[];
}

export function validateManifest(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ message: 'Manifest must be an object' }] };
  }

  const manifest = data as any;

  if (!manifest.requests || !Array.isArray(manifest.requests)) {
    return { valid: false, errors: [{ message: 'Missing required "requests" array' }] };
  }

  return { valid: true, errors: [] };
}

export function validateBuilderRecipe(data: unknown): ValidationResult {
  return { valid: true, errors: [] };
}