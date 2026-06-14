import { useState } from 'react';
import { validateManifest, generateJob } from '@placeholderer/core';
import { Job, Request, Asset, SafeAdjustment } from './types';
import { AssetPreview } from './AssetPreview';

type View = 'home' | 'overview' | 'detail';

function App() {
  const [view, setView] = useState<View>('home');
  const [job, setJob] = useState<Job | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<{ requestIndex: number; assetIndex: number; asset: Asset } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

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

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '1100px', margin: '0 auto' }}>
      <h1>Placeholderer</h1>

      {view === 'home' && (
        <div>
          <h2>Import Manifest</h2>
          <textarea
            placeholder="Paste JSON manifest here..."
            style={{ width: '100%', height: '300px', fontFamily: 'monospace', marginTop: '1rem' }}
            onChange={(e) => e.target.value.trim().length > 20 && handlePaste(e.target.value)}
          />
          {error && <pre style={{ color: 'red', background: '#fee', padding: '1rem', marginTop: '1rem' }}>{error}</pre>}
        </div>
      )}

      {view === 'overview' && job && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Job Overview — {job.job?.name || 'Unnamed'}</h2>
            <button onClick={() => { setView('home'); setJob(null); }}>New Job</button>
          </div>

          {job.requests.map((request, rIndex) => (
            <div key={rIndex} style={{ border: '1px solid #ccc', borderRadius: 6, marginTop: '1rem', background: '#fafafa' }}>
              <div 
                onClick={() => toggleRequest(rIndex)}
                style={{ padding: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}
              >
                <span>{request.name || `Request ${rIndex + 1}`}</span>
                <span>{request.assets.length} assets</span>
              </div>

              {expandedRequests.has(rIndex) && (
                <div style={{ padding: '0 1rem 1rem' }}>
                  {request.assets.map((asset, aIndex) => (
                    <div 
                      key={aIndex}
                      onClick={() => openAssetDetail(rIndex, aIndex)}
                      style={{ 
                        padding: '0.75rem', background: 'white', marginTop: '0.5rem', borderRadius: 4, cursor: 'pointer',
                        border: '1px solid #eee'
                      }}
                    >
                      <strong>{asset.name}</strong> — {asset.kind} ({asset.width}×{asset.height})
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>{asset.output_path}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button 
            onClick={handleGenerate} 
            disabled={isGenerating}
            style={{ marginTop: '2rem', padding: '0.75rem 3rem', fontSize: '1rem' }}
          >
            {isGenerating ? 'Generating...' : 'Generate & Download ZIP'}
          </button>
        </div>
      )}

      {view === 'detail' && selectedAsset && (
        <div style={{ display: 'flex', gap: '3rem' }}>
          <div style={{ flex: 1 }}>
            <button onClick={closeDetail} style={{ marginBottom: '1rem' }}>← Back to Overview</button>
            <h2>Edit: {selectedAsset.asset.name}</h2>

            <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 500 }}>
              <label>
                <input 
                  type="checkbox" 
                  checked={selectedAsset.asset.label_enabled ?? true}
                  onChange={(e) => applySafeAdjustment({ label_enabled: e.target.checked })}
                /> Show Label
              </label>

              <label>
                Numbering Style
                <select 
                  value={selectedAsset.asset.numbering_style || 'zero-padded'}
                  onChange={(e) => applySafeAdjustment({ numbering_style: e.target.value as any })}
                  style={{ display: 'block', marginTop: '0.25rem' }}
                >
                  <option value="zero-padded">Zero-padded</option>
                  <option value="plain">Plain</option>
                  <option value="none">None</option>
                </select>
              </label>

              <label>
                Label Position
                <select 
                  value={selectedAsset.asset.label_position || 'corners'}
                  onChange={(e) => applySafeAdjustment({ label_position: e.target.value as any })}
                  style={{ display: 'block', marginTop: '0.25rem' }}
                >
                  <option value="corners">Corners</option>
                  <option value="center">Center</option>
                  <option value="top-center">Top Center</option>
                  <option value="bottom-center">Bottom Center</option>
                </select>
              </label>

              {selectedAsset.asset.kind === 'ui_panel' && (
                <label>
                  <input 
                    type="checkbox"
                    checked={selectedAsset.asset.panel_guides ?? false}
                    onChange={(e) => applySafeAdjustment({ panel_guides: e.target.checked })}
                  /> Show Panel Guides
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
    </div>
  );
}

export default App;