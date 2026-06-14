import { useState } from 'react';

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
      
      <select value={assetType} onChange={e => setAssetType(e.target.value)}>
        <option value="image">Image</option>
        <option value="sprite_sheet">Sprite Sheet</option>
        <option value="ui_panel">UI Panel</option>
      </select>

      <textarea
        placeholder="name,width,height,format,output_path"
        value={csvText}
        onChange={e => setCsvText(e.target.value)}
        style={{ width: '100%', height: 200, marginTop: '1rem', fontFamily: 'monospace' }}
      />

      <button onClick={parseCSV} style={{ marginTop: '1rem' }}>
        Import CSV
      </button>
    </div>
  );
}