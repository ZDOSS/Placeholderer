// CSV → Manifest conversion.
//
// Spec rules:
//   - One asset kind per import (caller selects the kind first).
//   - One row per asset; flat headers only.
//   - Strict validation is the caller's job (validateManifest).
//
// This module only parses and shapes rows. Quoted fields and escaped
// quotes are supported; commas inside quotes do not split columns.

import type { AssetKind, Manifest } from '@placeholderer/schemas';

export type CsvAssetKind = Exclude<AssetKind, never>;

const NUMERIC_FIELDS = new Set([
  'width',
  'height',
  'frame_width',
  'frame_height',
  'rows',
  'columns',
  'tile_width',
  'tile_height',
  'frame_duration_ms',
  'frequency',
  'duration',
  'sample_rate',
  'amplitude',
]);

const BOOLEAN_FIELDS = new Set([
  'label_enabled',
  'show_grid',
  'panel_guides',
  'export_panel_metadata',
]);

export interface CsvParseSuccess {
  ok: true;
  manifest: Manifest;
}

export interface CsvParseFailure {
  ok: false;
  error: string;
}

export type CsvParseResult = CsvParseSuccess | CsvParseFailure;

/** Split a single CSV line, honoring double-quoted fields. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function coerceValue(header: string, raw: string): unknown {
  if (raw === '') return undefined;

  if (BOOLEAN_FIELDS.has(header)) {
    const lower = raw.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
    return raw;
  }

  if (NUMERIC_FIELDS.has(header)) {
    const n = Number(raw);
    if (!Number.isNaN(n)) return n;
    return raw;
  }

  // Generic numeric coercion for unknown headers (legacy behavior).
  if (!Number.isNaN(Number(raw)) && raw.trim() !== '' && /^-?\d+(\.\d+)?$/.test(raw.trim())) {
    return Number(raw);
  }

  return raw;
}

/**
 * Parse a CSV string into a single-request Manifest for the given kind.
 * Does not validate against the JSON schema — call validateManifest next.
 */
export function parseCsvToManifest(csv: string, kind: CsvAssetKind): CsvParseResult {
  const text = csv.replace(/^\uFEFF/, '').trim();
  if (!text) {
    return { ok: false, error: 'CSV is empty' };
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, error: 'CSV needs a header row and at least one data row' };
  }

  const headers = parseCsvLine(lines[0]);
  if (headers.length === 0 || headers.every((h) => !h)) {
    return { ok: false, error: 'CSV header row is empty' };
  }

  // Reject an explicit kind column that disagrees with the selector —
  // the type selector is the source of truth per the spec.
  const kindIdx = headers.findIndex((h) => h === 'kind');
  const assets: Record<string, unknown>[] = [];

  for (let row = 1; row < lines.length; row++) {
    const values = parseCsvLine(lines[row]);
    if (values.every((v) => v === '')) continue;

    if (kindIdx >= 0 && values[kindIdx] && values[kindIdx] !== kind) {
      return {
        ok: false,
        error: `row ${row + 1}: kind "${values[kindIdx]}" does not match selected type "${kind}"`,
      };
    }

    const obj: Record<string, unknown> = { kind };
    headers.forEach((h, i) => {
      if (!h || h === 'kind') return;
      const coerced = coerceValue(h, values[i] ?? '');
      if (coerced !== undefined) obj[h] = coerced;
    });
    assets.push(obj);
  }

  if (assets.length === 0) {
    return { ok: false, error: 'CSV has no data rows' };
  }

  const manifest: Manifest = {
    schemaVersion: 1,
    job: { name: `csv_${kind}` },
    requests: [
      {
        name: 'csv_import',
        assets: assets as unknown as Manifest['requests'][0]['assets'],
      },
    ],
  };

  return { ok: true, manifest };
}
