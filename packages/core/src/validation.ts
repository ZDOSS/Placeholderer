// Validation layer - uses AJV + schemas from @placeholderer/schemas

export interface ValidationResult {
  valid: boolean;
  errors: any[];
}

export function validateManifest(data: unknown): ValidationResult {
  // Real AJV validation will be wired after dependencies are installed
  // and schema loading is resolved.
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ message: 'Manifest must be an object' }] };
  }

  // Basic structural check for now
  const manifest = data as any;
  if (!manifest.requests || !Array.isArray(manifest.requests)) {
    return { valid: false, errors: [{ message: 'Missing required "requests" array' }] };
  }

  return { valid: true, errors: [] };
}

export function validateBuilderRecipe(data: unknown): ValidationResult {
  return { valid: true, errors: [] };
}