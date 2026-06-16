// Allowed characters in a sanitized output path.
// Letters, digits, underscore, hyphen, dot, and forward slash. `..` segments
// are still rejected explicitly (below) so path traversal can't sneak in
// through a single dot character.
const ALLOWED = /^[a-zA-Z0-9_\-./]+$/;

export function sanitizePath(input: string): string {
  const p = input.trim();
  if (p.includes('..') || p.startsWith('/') || p.includes(' ')) {
    throw new Error(`Invalid path: ${input}`);
  }
  if (!ALLOWED.test(p)) {
    throw new Error(`Invalid characters in path: ${input}`);
  }
  return p.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_');
}