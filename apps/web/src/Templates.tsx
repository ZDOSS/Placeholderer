import { useState } from 'react';

const engines = ['Godot', 'Unity', 'RPG Maker', 'GameMaker', 'Unreal', 'GDevelop', 'O3DE'];

type AssetType = 'image' | 'sprite_sheet' | 'ui_panel' | 'tileset' | 'mixed';

const assetTypes: AssetType[] = ['image', 'sprite_sheet', 'ui_panel', 'tileset', 'mixed'];

const getTemplate = (engine: string, type: AssetType): string => {
  const base = {
    schemaVersion: 1,
    job: { name: `${engine.toLowerCase()}_placeholders` },
    requests: [] as any[]
  };

  if (type === 'mixed') {
    base.requests = [{
      name: 'core_assets',
      assets: [
        { kind: 'ui_panel', name: 'dialog', width: 480, height: 240, format: 'png', output_path: 'assets/ui' },
        { kind: 'sprite_sheet', name: 'enemy_idle', width: 256, height: 128, format: 'png', output_path: 'assets/sprites', frame_width: 64, frame_height: 64, rows: 2, columns: 4 }
      ]
    }];
  } else {
    const asset: any = { kind: type, name: `${type}_example`, width: 256, height: 256, format: 'png', output_path: 'assets' };
    
    if (type === 'sprite_sheet') {
      asset.frame_width = 64;
      asset.frame_height = 64;
      asset.rows = 2;
      asset.columns = 4;
    }
    if (type === 'tileset') {
      asset.tile_width = 32;
      asset.tile_height = 32;
    }
    if (type === 'ui_panel') {
      asset.panel_guides = true;
    }

    base.requests = [{ name: 'assets', assets: [asset] }];
  }

  return JSON.stringify(base, null, 2);
};

export function Templates() {
  const [selectedEngine, setSelectedEngine] = useState('Godot');
  const [selectedType, setSelectedType] = useState<AssetType>('mixed');
  const [copied, setCopied] = useState(false);

  const currentTemplate = getTemplate(selectedEngine, selectedType);

  const copy = () => {
    navigator.clipboard.writeText(currentTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Templates</h2>
      <p style={{ color: '#94a3b8' }}>Choose an engine, then select the asset type you need.</p>

      {/* Engine Selection */}
      <div style={{ margin: '1.5rem 0 1rem' }}>
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>Engine</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {engines.map(engine => (
            <button
              key={engine}
              onClick={() => setSelectedEngine(engine)}
              style={{
                padding: '0.5rem 1rem',
                background: selectedEngine === engine ? '#2563eb' : '#334155',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {engine}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Type Selection */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>Asset Type</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {assetTypes.map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              style={{
                padding: '0.5rem 1rem',
                background: selectedType === type ? '#2563eb' : '#334155',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {type === 'mixed' ? 'Bundled / Mixed' : type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Template Output */}
      <pre style={{ 
        background: '#0f172a', 
        color: '#e2e8f0',
        padding: '1.5rem', 
        borderRadius: '8px',
        fontSize: '0.85rem',
        border: '1px solid #334155',
        overflow: 'auto',
        maxHeight: '420px'
      }}>
        {currentTemplate}
      </pre>

      <button 
        onClick={copy} 
        style={{ 
          marginTop: '1rem',
          padding: '0.6rem 1.5rem',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        {copied ? 'Copied to clipboard!' : 'Copy JSON'}
      </button>
    </div>
  );
}