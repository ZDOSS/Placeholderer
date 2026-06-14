import { useState } from 'react';

const engines = ['Godot', 'Unity', 'RPG Maker', 'GameMaker', 'Unreal', 'GDevelop', 'O3DE'];

const templates: Record<string, string> = {
  Godot: `{
  "schemaVersion": 1,
  "job": { "name": "godot_placeholders" },
  "requests": [{
    "name": "ui",
    "assets": [{
      "kind": "ui_panel",
      "name": "dialog",
      "width": 480,
      "height": 240,
      "format": "png",
      "output_path": "res://assets/ui"
    }]
  }]
}`,
  Unity: `{
  "schemaVersion": 1,
  "job": { "name": "unity_placeholders" },
  "requests": [{
    "name": "sprites",
    "assets": [{
      "kind": "sprite_sheet",
      "name": "enemy_idle",
      "width": 256,
      "height": 128,
      "format": "png",
      "output_path": "Assets/Sprites",
      "frame_width": 64,
      "frame_height": 64,
      "rows": 2,
      "columns": 4
    }]
  }]
}`,
  'RPG Maker': `{
  "schemaVersion": 1,
  "job": { "name": "rpgmaker_placeholders" },
  "requests": [{
    "name": "tiles",
    "assets": [{
      "kind": "tileset",
      "name": "world_tiles",
      "width": 512,
      "height": 512,
      "format": "png",
      "output_path": "img/tilesets",
      "tile_width": 48,
      "tile_height": 48
    }]
  }]
}`,
};

export function Templates() {
  const [selected, setSelected] = useState('Godot');
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(templates[selected] || '{}');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Templates</h2>
      
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {engines.map(e => (
          <button 
            key={e}
            onClick={() => setSelected(e)}
            style={{ 
              background: selected === e ? '#2a2a3a' : '#1f1f2e',
              border: selected === e ? '1px solid #63b3ed' : '1px solid #444'
            }}
          >
            {e}
          </button>
        ))}
      </div>

      <pre style={{ 
        background: '#111', 
        padding: '1.5rem', 
        borderRadius: 6,
        fontSize: '0.85rem',
        overflow: 'auto'
      }}>
        {templates[selected] || 'Template coming soon for this engine.'}
      </pre>

      <button onClick={copy} style={{ marginTop: '1rem' }}>
        {copied ? 'Copied!' : 'Copy JSON'}
      </button>
    </div>
  );
}