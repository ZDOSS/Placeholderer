import { useState } from 'react';
import {
  parseCsvToManifest,
  validateManifest,
  type CsvAssetKind,
} from '@placeholderer/core';
import type { Manifest } from '@placeholderer/schemas';
import { colors } from './colors';

interface Props {
  onImport: (data: Manifest) => void;
  onError?: (message: string) => void;
  /** Pre-filled CSV text (e.g. from a file drop). */
  initialText?: string;
}

const ASSET_KINDS: { value: CsvAssetKind; label: string }[] = [
  { value: 'image', label: 'Image' },
  { value: 'sprite_sheet', label: 'Sprite Sheet' },
  { value: 'tileset', label: 'Tileset' },
  { value: 'ui_panel', label: 'UI Panel' },
  { value: 'audio', label: 'Audio' },
];

export function CSVImport({ onImport, onError, initialText = '' }: Props) {
  const [assetType, setAssetType] = useState<CsvAssetKind>('image');
  const [csvText, setCsvText] = useState(initialText);

  const parseCSV = () => {
    const parsed = parseCsvToManifest(csvText, assetType);
    if (!parsed.ok) {
      onError?.(parsed.error);
      return;
    }

    const result = validateManifest(parsed.manifest);
    if (!result.valid) {
      onError?.(JSON.stringify(result.errors, null, 2));
      return;
    }

    onImport(parsed.manifest);
  };

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>CSV Import</h3>
      <p style={{ color: colors.textMuted, fontSize: '0.9rem' }}>
        Select the asset type first (one kind per CSV), then paste rows or drop a file.
        Headers must match schema field names. The import is validated strictly before opening the job.
      </p>

      <select
        value={assetType}
        onChange={(e) => setAssetType(e.target.value as CsvAssetKind)}
        style={{
          padding: '0.5rem',
          background: colors.bgElevated,
          color: colors.text,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: '6px',
        }}
      >
        {ASSET_KINDS.map((k) => (
          <option key={k.value} value={k.value}>{k.label}</option>
        ))}
      </select>

      <textarea
        placeholder={
          assetType === 'audio'
            ? 'name,format,output_path,frequency,duration'
            : assetType === 'sprite_sheet'
              ? 'name,width,height,format,output_path,frame_width,frame_height,rows,columns'
              : assetType === 'tileset'
                ? 'name,width,height,format,output_path,tile_width,tile_height'
                : 'name,width,height,format,output_path'
        }
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        style={{
          width: '100%',
          height: 200,
          marginTop: '1rem',
          fontFamily: 'monospace',
          background: colors.bgElevated,
          color: colors.text,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: '6px',
          padding: '0.75rem',
        }}
      />

      <button
        onClick={parseCSV}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1.25rem',
          background: colors.accent,
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Import CSV
      </button>
    </div>
  );
}
