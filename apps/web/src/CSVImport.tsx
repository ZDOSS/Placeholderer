import { useState } from 'react';
import { colors } from './colors';

interface Props {
  onImport: (data: any) => void;
}

export function CSVImport({ onImport }: Props) {
  const [assetType, setAssetType] = useState('image');
  const [csvText, setCsvText] = useState('');

  const parseCSV = () => {
    // Very basic CSV to JSON conversion for demo
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const assets = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = { kind: assetType };
      
      headers.forEach((h, i) => {
        const val = values[i];
        if (!isNaN(Number(val))) obj[h] = Number(val);
        else obj[h] = val;
      });
      
      return obj;
    });

    onImport({ schemaVersion: 1, requests: [{ name: 'csv_import', assets }] });
  };

  return (
    <div>
      <h3>CSV Import (v1)</h3>
      
      <select
        value={assetType}
        onChange={e => setAssetType(e.target.value)}
        style={{
          padding: '0.5rem',
          background: colors.bgElevated,
          color: colors.text,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: '6px',
        }}
      >
        <option value="image">Image</option>
        <option value="sprite_sheet">Sprite Sheet</option>
        <option value="ui_panel">UI Panel</option>
      </select>

      <textarea
        placeholder="name,width,height,format,output_path"
        value={csvText}
        onChange={e => setCsvText(e.target.value)}
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