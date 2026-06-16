// Allowed characters in a sanitized output path.
// Letters, digits, underscore, hyphen, dot, and forward slash. `..` segments
// are still rejected explicitly (below) so path traversal can't sneak in
// through a single dot character.
const ALLOWED = /^[a-zA-Z0-9_\-./]+$/;

export function sanitizePath(input: string): string {
  const p = input.trim();
  if (p === '') return '';
  // Normalize backslashes to forward slashes BEFORE the regex check,
  // so a Windows-style path is accepted and cleaned. Also strip a
  // trailing slash so concatenation with a filename doesn't produce
  // a double slash.
  const normalized = p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  if (normalized.includes('..') || normalized.startsWith('/') || normalized.includes(' ')) {
    throw new Error(`Invalid path: ${input}`);
  }
  if (!ALLOWED.test(normalized)) {
    throw new Error(`Invalid characters in path: ${input}`);
  }
  return normalized;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_');
}