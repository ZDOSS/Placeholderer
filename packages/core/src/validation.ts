import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import { manifestSchema, builderRecipeSchema } from '@placeholderer/schemas';

export interface ValidationError {
  /** JSON-pointer-ish path to the failing node, e.g. "/requests/0/assets/2/width". */
  path: string;
  message: string;
  keyword?: string;
  params?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });

const manifestValidator: ValidateFunction = ajv.compile(manifestSchema);
const builderRecipeValidator: ValidateFunction = ajv.compile(builderRecipeSchema);

function toValidationErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors) return [];
  return errors.map((err) => ({
    path: err.instancePath || '',
    message: err.message ?? 'invalid',
    keyword: err.keyword,
    params: err.params as Record<string, unknown> | undefined,
  }));
}

function validate(validator: ValidateFunction, data: unknown): ValidationResult {
  if (data === null || typeof data !== 'object') {
    return {
      valid: false,
      errors: [{ path: '', message: 'Input must be a JSON object' }],
    };
  }
  const ok = validator(data);
  if (ok) return { valid: true, errors: [] };
  return { valid: false, errors: toValidationErrors(validator.errors) };
}

export function validateManifest(data: unknown): ValidationResult {
  return validate(manifestValidator, data);
}

export function validateBuilderRecipe(data: unknown): ValidationResult {
  return validate(builderRecipeValidator, data);
}
