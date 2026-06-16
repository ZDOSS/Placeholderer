import { describe, it, expect } from 'vitest';
import { sanitizePath, sanitizeFilename } from '../src/path.js';

describe('sanitizePath', () => {
  it('accepts a simple path', () => {
    expect(sanitizePath('art/ui/panels')).toBe('art/ui/panels');
  });

  it('accepts dots for version numbers', () => {
    expect(sanitizePath('v1.0/sprites')).toBe('v1.0/sprites');
  });

  it('normalizes backslashes to forward slashes', () => {
    expect(sanitizePath('art\\ui\\panels')).toBe('art/ui/panels');
  });

  it('collapses repeated slashes', () => {
    expect(sanitizePath('art//ui///panels')).toBe('art/ui/panels');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizePath('  art/ui  ')).toBe('art/ui');
  });

  it('accepts an empty path', () => {
    expect(sanitizePath('')).toBe('');
  });

  it('rejects .. segments', () => {
    expect(() => sanitizePath('../secrets')).toThrow();
    expect(() => sanitizePath('art/../etc')).toThrow();
    expect(() => sanitizePath('a/../../b')).toThrow();
  });

  it('rejects leading slashes', () => {
    expect(() => sanitizePath('/abs')).toThrow();
  });

  it('rejects spaces', () => {
    expect(() => sanitizePath('art ui')).toThrow();
  });

  it('rejects forbidden characters', () => {
    expect(() => sanitizePath('art;rm')).toThrow();
    expect(() => sanitizePath('art$var')).toThrow();
    expect(() => sanitizePath('art`whoami`')).toThrow();
  });
});

describe('sanitizeFilename', () => {
  it('accepts a simple name', () => {
    expect(sanitizeFilename('slime_idle')).toBe('slime_idle');
  });

  it('replaces special characters with underscore', () => {
    expect(sanitizeFilename('slime idle!')).toBe('slime_idle_');
  });
});
