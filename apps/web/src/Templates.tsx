import { useState } from 'react';
import {
  ALL_ENGINES,
  V1_ENGINES,
  V1_1_ENGINES,
  TEMPLATE_TYPES,
  getGuide,
  buildStarterManifest,
  type TemplateType,
} from '@placeholderer/core';

type AssetType = TemplateType;

export function Templates() {
  const [selectedEngine, setSelectedEngine] = useState(V1_ENGINES[0]);
  const [selectedType, setSelectedType] = useState<AssetType>('mixed');
  const [copied, setCopied] = useState(false);

  const guide = getGuide(selectedEngine);
  const jobName = `${selectedEngine.toLowerCase()}_placeholders`;
  const manifest = buildStarterManifest({
    engine: selectedEngine,
    type: selectedType,
    guide: guide!,
    jobName,
  });
  const currentTemplate = JSON.stringify(manifest, null, 2);

  const copy = () => {
    navigator.clipboard.writeText(currentTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Templates</h2>
      <p style={{ color: '#94a3b8' }}>
        Choose an engine, then select the asset type. Each engine produces
        starter content with its preferred folder root, naming convention,
        and sizing notes.
      </p>

      {/* Engine Selection — v1 first, then v1.1 */}
      <div style={{ margin: '1.5rem 0 1rem' }}>
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>Engine (v1)</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {V1_ENGINES.map(engine => (
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
        <div style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.75rem 0 0.5rem' }}>Engine (v1.1)</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {V1_1_ENGINES.map(engine => (
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

      {/* Engine guidance */}
      {guide && (
        <div style={{
          margin: '1rem 0',
          padding: '0.75rem 1rem',
          background: '#1e2937',
          border: '1px solid #334155',
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: '#cbd5e1',
        }}>
          <div><strong>Default path:</strong> <code style={{ color: '#93c5fd' }}>{guide.defaultPath}</code></div>
          <div><strong>Naming:</strong> {guide.namingConvention}</div>
          <div><strong>Sizing:</strong> {guide.sizingNotes}</div>
        </div>
      )}

      {/* Asset Type Selection */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>Asset Type</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {TEMPLATE_TYPES.map(type => (
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
