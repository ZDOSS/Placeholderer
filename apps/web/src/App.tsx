import { useState } from 'react';
import { validateManifest, generateJob, encodeBmp, encodeGif, type CanvasBackend, type Canvas2D, type GenerationReport } from '@placeholderer/core';
import type { Manifest, Asset, SafeAdjustment } from '@placeholderer/schemas';
import { AssetPreview } from './AssetPreview';
import { UIBuilder } from './UIBuilder';
import { Templates } from './Templates';
import { CSVImport } from './CSVImport';
import { useTheme } from './useTheme';
import { colors } from './colors';
import { readZipEntry } from './zipParser';

// Browser canvas backend: wraps OffscreenCanvas so the shared core
// can run without knowing it's in a browser.
const webCanvasBackend: CanvasBackend = {
  createCanvas(width, height) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('failed to acquire 2d context');
    return {
      ctx: ctx as unknown as Canvas2D,
      encode: async (mime) => {
        // BMP and GIF aren't supported by OffscreenCanvas.convertToBlob,
        // so we read the RGBA pixel data and run our own encoders.
        if (mime === 'image/bmp') {
          const data = ctx.getImageData(0, 0, width, height);
          return encodeBmp(data.data, width, height);
        }
        if (mime === 'image/gif') {
          const data = ctx.getImageData(0, 0, width, height);
          return encodeGif(data.data, width, height);
        }
        const blob = await canvas.convertToBlob({ type: mime });
        return new Uint8Array(await blob.arrayBuffer());
      },
    };
  },
};

type View = 'home' | 'overview' | 'detail' | 'builder' | 'templates';

function App() {
  const [view, setView] = useState<View>('home');
  const [job, setJob] = useState<Manifest | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<{ requestIndex: number; assetIndex: number; asset: Asset } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [importMode, setImportMode] = useState<'json' | 'csv'>('json');
  const [lastReport, setLastReport] = useState<any>(null);
  const [manifestReport, setManifestReport] = useState<GenerationReport | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  const handlePaste = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const result = validateManifest(parsed);

      if (result.valid) {
        // Clear any report from the previous job so the user
        // doesn't see stale folders/files alongside the new
        // manifest's overview.
        setManifestReport(null);
        setJob(parsed as Manifest);
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
    setManifestReport(null);
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
    if (adjustment.panel_guides !== undefined && asset.kind === 'ui_panel') {
      asset.panel_guides = adjustment.panel_guides;
    }

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
    // Drop any report from a previous successful generation so the
    // user can't see stale folders/files when the new generation
    // fails or produces a different job.
    setManifestReport(null);
    try {
      const result = await generateJob(job, webCanvasBackend);
      setLastReport(result);

      if (result.success && result.zip) {
        // Copy into a fresh Uint8Array so the Blob constructor's stricter
        // ArrayBuffer (not SharedArrayBuffer) typing is satisfied.
        const bytes = new Uint8Array(result.zip);
        const blob = new Blob([bytes], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.suggestedName ?? 'placeholders.zip';
        a.click();
        URL.revokeObjectURL(url);

        // Pull the embedded manifest report out of the ZIP so the
        // user can see what was produced. The decoder is a small
        // standalone helper in ./zipParser.
        try {
          const entry = readZipEntry(bytes, '_placeholderer/manifest-report.json');
          if (entry) {
            const text = new TextDecoder().decode(entry.bytes);
            setManifestReport(JSON.parse(text) as GenerationReport);
          }
        } catch {
          // Manifest is best-effort.
        }
      } else {
        // Surface the new error but also wipe any stale report so
        // the user can't see the previous job's folders/files
        // alongside the new error state.
        setManifestReport(null);
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

  const navButtonStyle = (active: boolean) => ({
    padding: '0.5rem 1rem',
    background: active ? colors.accent : colors.bgInset,
    color: colors.text,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer' as const,
    fontSize: '0.9rem',
  });

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
      {/* Top Navigation */}
      <div style={{
        background: colors.bgElevated,
        borderBottom: `1px solid ${colors.border}`,
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

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          style={{
            padding: '0.4rem 0.8rem',
            background: colors.bgInset,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          {theme === 'dark' ? '☀' : '☾'} {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
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
                    background: importMode === 'json' ? colors.accent : colors.bgInset,
                    border: 'none',
                    color: colors.text,
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
                    background: importMode === 'csv' ? colors.accent : colors.bgInset,
                    border: 'none',
                    color: colors.text,
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
                      background: colors.bgElevated,
                      color: colors.text,
                      border: `1px solid ${colors.borderStrong}`,
                      borderRadius: '8px',
                      padding: '1rem',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      resize: 'vertical' as const
                    }}
                    onChange={(e) => e.target.value.trim().length > 20 && handlePaste(e.target.value)}
                  />
                </>
              )}

              {importMode === 'csv' && <CSVImport onImport={handleCSVImport} />}
            </div>

            {error && (
              <pre style={{
                background: colors.errorBg,
                color: colors.errorText,
                padding: '1rem',
                borderRadius: '8px',
                border: `1px solid ${colors.errorBorder}`
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
                onClick={() => { setView('home'); setJob(null); setLastReport(null); setManifestReport(null); }}
                style={{ padding: '0.5rem 1rem', background: colors.bgInset, color: colors.text, border: 'none', borderRadius: '6px' }}
              >
                New Job
              </button>
            </div>

            {job.requests.map((request, rIndex) => (
              <div key={rIndex} style={{
                background: colors.bgElevated,
                border: `1px solid ${colors.border}`,
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
                    background: colors.bgInset
                  }}
                >
                  <div>
                    <strong>{request.name || `Request ${rIndex + 1}`}</strong>
                    <span style={{ color: colors.textMuted, marginLeft: '1rem' }}>
                      {request.assets.length} assets
                    </span>
                  </div>
                  <span style={{ color: colors.textDim }}>{expandedRequests.has(rIndex) ? '−' : '+'}</span>
                </div>

                {expandedRequests.has(rIndex) && (
                  <div style={{ padding: '0 1.25rem 1.25rem' }}>
                    {request.assets.map((asset, aIndex) => (
                      <div
                        key={aIndex}
                        onClick={() => openAssetDetail(rIndex, aIndex)}
                        style={{
                          padding: '0.875rem 1rem',
                          background: colors.bgInset,
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
                          <span style={{ color: colors.textMuted, marginLeft: '0.75rem' }}>
                            {asset.kind} • {describeAssetSize(asset)}
                          </span>
                        </div>
                        <div style={{ color: colors.textDim, fontSize: '0.85rem' }}>{asset.output_path}</div>
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
                background: colors.accent,
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
                background: lastReport.success ? colors.successBg : colors.errorBg,
                border: `1px solid ${lastReport.success ? colors.successBorder : colors.errorBorder}`,
                borderRadius: '8px'
              }}>
                <strong>{lastReport.success ? '✓ Generation successful' : '✕ Generation had errors'}</strong>
                {lastReport.errors?.length > 0 && (
                  <div style={{ marginTop: '0.75rem', color: colors.errorText }}>
                    {lastReport.errors.join('\n')}
                  </div>
                )}
              </div>
            )}

            {manifestReport && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1.25rem',
                background: colors.bgElevated,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <strong>Manifest report</strong>
                  <button
                    onClick={() => setManifestReport(null)}
                    style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <Stat label="Job" value={manifestReport.jobName || '(unnamed)'} />
                  <Stat label="Total" value={String(manifestReport.totalAssets)} />
                  <Stat label="Successful" value={String(manifestReport.successful)} />
                  <Stat label="Failed" value={String(manifestReport.failed)} />
                </div>
                {manifestReport.createdFolders.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: colors.textMuted, marginBottom: '0.25rem' }}>Folders ({manifestReport.createdFolders.length})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {manifestReport.createdFolders.map((f: string) => (
                        <code key={f} style={{ padding: '0.15rem 0.4rem', background: colors.bgInset, borderRadius: '4px', fontSize: '0.75rem' }}>{f}</code>
                      ))}
                    </div>
                  </div>
                )}
                {manifestReport.createdFiles.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: colors.textMuted, marginBottom: '0.25rem' }}>Files ({manifestReport.createdFiles.length})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {manifestReport.createdFiles.map((f: string) => (
                        <code key={f} style={{ padding: '0.15rem 0.4rem', background: colors.bgInset, borderRadius: '4px', fontSize: '0.75rem' }}>{f}</code>
                      ))}
                    </div>
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
                style={{ marginBottom: '1.5rem', background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}
              >
                ← Back to Overview
              </button>
              <h2 style={{ marginTop: 0 }}>Edit Asset</h2>
              <h3 style={{ color: colors.textMuted, fontWeight: 'normal' }}>{selectedAsset.asset.name}</h3>

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
                    style={{ width: '100%', padding: '0.5rem', background: colors.bgElevated, color: colors.text, border: `1px solid ${colors.borderStrong}`, borderRadius: '6px' }}
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
                    style={{ width: '100%', padding: '0.5rem', background: colors.bgElevated, color: colors.text, border: `1px solid ${colors.borderStrong}`, borderRadius: '6px' }}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 500, color: colors.text }}>{value}</div>
    </div>
  );
}

/** Compact size/duration label for the job overview asset row.
 *  Image-style assets show width×height; audio is dimensionless
 *  so we surface duration + sample rate instead of printing
 *  "undefined×undefined". */
function describeAssetSize(asset: Asset): string {
  if (asset.kind === 'audio') {
    const sr = (asset as any).sample_rate ?? 44100;
    return `${asset.duration}s @ ${sr}Hz`;
  }
  return `${asset.width}×${asset.height}`;
}

export default App;
