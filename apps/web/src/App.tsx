import { useState } from 'react';
import { validateManifest, generateJob } from '@placeholderer/core';
import { Job, Request, Asset, SafeAdjustment } from './types';
import { AssetPreview } from './AssetPreview';
import { UIBuilder } from './UIBuilder';
import { Templates } from './Templates';
import { CSVImport } from './CSVImport';

type View = 'home' | 'overview' | 'detail' | 'builder' | 'templates';

const navButtonStyle = (active: boolean) => ({
  padding: '0.5rem 1rem',
  background: active ? '#2563eb' : '#1f2937',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.9rem',
});

function App() {
  const [view, setView] = useState<View>('home');
  const [job, setJob] = useState<Job | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<{ requestIndex: number; assetIndex: number; asset: Asset } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [importMode, setImportMode] = useState<'json' | 'csv'>('json');
  const [lastReport, setLastReport] = useState<any>(null);

  const handlePaste = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const result = validateManifest(parsed);
      
      if (result.valid) {
        setJob(parsed as Job);
        setView('overview');
        setError(null);
        setExpandedRequests(new Set());
      } else {
        setError(JSON.stringify(result.errors, null, 2));
      }
    } catch {
      setError('Failed to parse JSON');
    }
  };

  const handleCSVImport = (data: any) => {
    setJob(data);
    setView('overview');
  };

  const toggleRequest = (index: number) => {
    const newSet = new Set(expandedRequests);
    newSet.has(index) ? newSet.delete(index) : newSet.add(index);
    setExpandedRequests(newSet);
  };

  const openAssetDetail = (requestIndex: number, assetIndex: number) => {
    if (!job) return;
    const asset = job.requests[requestIndex].assets[assetIndex];
    setSelectedAsset({ requestIndex, assetIndex, asset: { ...asset } });
    setView('detail');
  };

  const applySafeAdjustment = (adjustment: SafeAdjustment) => {
    if (!selectedAsset || !job) return;

    const updatedJob = { ...job };
    const asset = updatedJob.requests[selectedAsset.requestIndex].assets[selectedAsset.assetIndex];

    if (adjustment.label_enabled !== undefined) asset.label_enabled = adjustment.label_enabled;
    if (adjustment.numbering_style) asset.numbering_style = adjustment.numbering_style;
    if (adjustment.label_position) asset.label_position = adjustment.label_position;
    if (adjustment.panel_guides !== undefined) asset.panel_guides = adjustment.panel_guides;

    setJob(updatedJob);
    setSelectedAsset({ ...selectedAsset, asset: { ...asset } });
  };

  const closeDetail = () => {
    setView('overview');
    setSelectedAsset(null);
  };

  const handleGenerate = async () => {
    if (!job) return;
    setIsGenerating(true);
    try {
      const result = await generateJob(job);
      setLastReport(result);
      
      if (result.success && result.zip) {
        const url = URL.createObjectURL(result.zip);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${job.job?.name || 'placeholders'}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setError(result.errors.join('\n'));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const isBuilderView = view === 'builder';
  const contentMaxWidth = isBuilderView ? '100%' : '1200px';
  const contentPadding = isBuilderView ? '1rem 2rem' : '2rem';

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0f172a', 
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Top Navigation */}
      <div style={{ 
        background: '#1e2937', 
        borderBottom: '1px solid #334155',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Placeholderer</h1>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setView('home')} style={navButtonStyle(view === 'home')}>Manifest</button>
            <button onClick={() => setView('templates')} style={navButtonStyle(view === 'templates')}>Templates</button>
            <button onClick={() => setView('builder')} style={navButtonStyle(view === 'builder')}>UI Builder</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: contentMaxWidth, margin: '0 auto', padding: contentPadding }}>
        {/* HOME VIEW */}
        {view === 'home' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button 
                  onClick={() => setImportMode('json')}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    background: importMode === 'json' ? '#3b82f6' : '#334155',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  JSON
                </button>
                <button 
                  onClick={() => setImportMode('csv')}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    background: importMode === 'csv' ? '#3b82f6' : '#334155',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  CSV
                </button>
              </div>

              {importMode === 'json' && (
                <>
                  <h2 style={{ marginTop: 0 }}>Import Manifest</h2>
                  <textarea
                    placeholder="Paste your JSON manifest here..."
                    style={{ 
                      width: '100%', 
                      height: '320px', 
                      background: '#1e2937',
                      color: '#e2e8f0',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      padding: '1rem',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      resize: 'vertical'
                    }}
                    onChange={(e) => e.target.value.trim().length > 20 && handlePaste(e.target.value)}
                  />
                </>
              )}

              {importMode === 'csv' && <CSVImport onImport={handleCSVImport} />}
            </div>

            {error && (
              <pre style={{ 
                background: '#3f1f1f', 
                color: '#fca5a5', 
                padding: '1rem', 
                borderRadius: '8px',
                border: '1px solid #7f1d1d'
              }}>
                {error}
              </pre>
            )}
          </div>
        )}

        {/* JOB OVERVIEW */}
        {view === 'overview' && job && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Job Overview — {job.job?.name || 'Unnamed Job'}</h2>
              <button 
                onClick={() => { setView('home'); setJob(null); setLastReport(null); }}
                style={{ padding: '0.5rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px' }}
              >
                New Job
              </button>
            </div>

            {job.requests.map((request, rIndex) => (
              <div key={rIndex} style={{ 
                background: '#1e2937', 
                border: '1px solid #334155', 
                borderRadius: '8px', 
                marginBottom: '1rem',
                overflow: 'hidden'
              }}>
                <div 
                  onClick={() => toggleRequest(rIndex)}
                  style={{ 
                    padding: '1rem 1.25rem', 
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#0f172a'
                  }}
                >
                  <div>
                    <strong>{request.name || `Request ${rIndex + 1}`}</strong>
                    <span style={{ color: '#94a3b8', marginLeft: '1rem' }}>
                      {request.assets.length} assets
                    </span>
                  </div>
                  <span style={{ color: '#64748b' }}>{expandedRequests.has(rIndex) ? '−' : '+'}</span>
                </div>

                {expandedRequests.has(rIndex) && (
                  <div style={{ padding: '0 1.25rem 1.25rem' }}>
                    {request.assets.map((asset, aIndex) => (
                      <div 
                        key={aIndex}
                        onClick={() => openAssetDetail(rIndex, aIndex)}
                        style={{ 
                          padding: '0.875rem 1rem', 
                          background: '#334155', 
                          marginTop: '0.5rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <strong>{asset.name}</strong>
                          <span style={{ color: '#94a3b8', marginLeft: '0.75rem' }}>
                            {asset.kind} • {asset.width}×{asset.height}
                          </span>
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{asset.output_path}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              style={{ 
                marginTop: '1.5rem',
                padding: '0.75rem 2.5rem',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              {isGenerating ? 'Generating...' : 'Generate & Download ZIP'}
            </button>

            {lastReport && (
              <div style={{ 
                marginTop: '2rem', 
                padding: '1.25rem', 
                background: lastReport.success ? '#052e16' : '#3f1f1f',
                border: `1px solid ${lastReport.success ? '#166534' : '#7f1d1d'}`,
                borderRadius: '8px'
              }}>
                <strong>{lastReport.success ? '✓ Generation successful' : '✕ Generation had errors'}</strong>
                {lastReport.errors?.length > 0 && (
                  <div style={{ marginTop: '0.75rem', color: '#fca5a5' }}>
                    {lastReport.errors.join('\n')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ITEM DETAIL */}
        {view === 'detail' && selectedAsset && (
          <div style={{ display: 'flex', gap: '3rem' }}>
            <div style={{ flex: 1 }}>
              <button 
                onClick={closeDetail} 
                style={{ marginBottom: '1.5rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                ← Back to Overview
              </button>
              <h2 style={{ marginTop: 0 }}>Edit Asset</h2>
              <h3 style={{ color: '#94a3b8', fontWeight: 'normal' }}>{selectedAsset.asset.name}</h3>

              <div style={{ display: 'grid', gap: '1.25rem', maxWidth: 420, marginTop: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedAsset.asset.label_enabled ?? true}
                    onChange={(e) => applySafeAdjustment({ label_enabled: e.target.checked })}
                  /> 
                  Show Label
                </label>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem' }}>Numbering Style</label>
                  <select 
                    value={selectedAsset.asset.numbering_style || 'zero-padded'}
                    onChange={(e) => applySafeAdjustment({ numbering_style: e.target.value as any })}
                    style={{ width: '100%', padding: '0.5rem', background: '#1e2937', color: '#fff', border: '1px solid #475569', borderRadius: '6px' }}
                  >
                    <option value="zero-padded">Zero-padded (01, 02...)</option>
                    <option value="plain">Plain (1, 2...)</option>
                    <option value="none">None</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem' }}>Label Position</label>
                  <select 
                    value={selectedAsset.asset.label_position || 'corners'}
                    onChange={(e) => applySafeAdjustment({ label_position: e.target.value as any })}
                    style={{ width: '100%', padding: '0.5rem', background: '#1e2937', color: '#fff', border: '1px solid #475569', borderRadius: '6px' }}
                  >
                    <option value="corners">Corners</option>
                    <option value="center">Center</option>
                    <option value="top-center">Top Center</option>
                    <option value="bottom-center">Bottom Center</option>
                  </select>
                </div>

                {selectedAsset.asset.kind === 'ui_panel' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="checkbox"
                      checked={selectedAsset.asset.panel_guides ?? false}
                      onChange={(e) => applySafeAdjustment({ panel_guides: e.target.checked })}
                    /> 
                    Show Panel Guides (preview)
                  </label>
                )}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <h3>Preview</h3>
              <AssetPreview asset={selectedAsset.asset} />
            </div>
          </div>
        )}

        {/* OTHER VIEWS */}
        {view === 'builder' && <UIBuilder />}
        {view === 'templates' && <Templates />}
      </div>
    </div>
  );
}

export default App;