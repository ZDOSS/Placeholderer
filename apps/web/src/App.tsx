import { useState, useRef, useCallback, useEffect } from 'react';
import {
  validateManifest,
  generateJob,
  encodeBmp,
  encodeGif,
  parseCsvToManifest,
  type CanvasBackend,
  type Canvas2D,
  type GenerationReport,
  type CsvAssetKind,
} from '@placeholderer/core';
import type { Manifest, Asset, SafeAdjustment, NumberingStyle, LabelPosition } from '@placeholderer/schemas';
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

const AI_MODE_KEY = 'placeholderer:ai-mode';

function readAiMode(): boolean {
  try {
    return window.localStorage.getItem(AI_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

function App() {
  const [view, setView] = useState<View>('home');
  const [job, setJob] = useState<Manifest | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<{ requestIndex: number; assetIndex: number; asset: Asset } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{ index: number; total: number; name: string } | null>(null);
  const [importMode, setImportMode] = useState<'json' | 'csv'>('json');
  const [jsonText, setJsonText] = useState('');
  const [lastReport, setLastReport] = useState<{ success: boolean; errors?: string[]; cancelled?: boolean } | null>(null);
  const [manifestReport, setManifestReport] = useState<GenerationReport | null>(null);
  const [aiMode, setAiMode] = useState(readAiMode);
  const [dragOver, setDragOver] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_MODE_KEY, aiMode ? '1' : '0');
    } catch {
      // ignore
    }
  }, [aiMode]);

  const acceptManifest = useCallback((parsed: Manifest) => {
    setManifestReport(null);
    setLastReport(null);
    setJob(parsed);
    setView('overview');
    setError(null);
    setExpandedRequests(new Set([0]));
  }, []);

  const handleJsonImport = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const result = validateManifest(parsed);

      if (result.valid) {
        acceptManifest(parsed as Manifest);
      } else {
        setError(JSON.stringify(result.errors, null, 2));
      }
    } catch {
      setError('Failed to parse JSON');
    }
  };

  const handleCSVImport = (data: Manifest) => {
    setError(null);
    acceptManifest(data);
  };

  const importFileText = async (file: File) => {
    const text = await file.text();
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv') || importMode === 'csv') {
      setImportMode('csv');
      // Default kind for dropped CSV is image; CSVImport will re-validate
      // when the user clicks Import, but auto-import drop with kind=image.
      const parsed = parseCsvToManifest(text, 'image' as CsvAssetKind);
      if (!parsed.ok) {
        setError(parsed.error + ' — open CSV mode, pick the correct type, and paste the file contents.');
        setJsonText('');
        return;
      }
      const result = validateManifest(parsed.manifest);
      if (!result.valid) {
        setError(
          'CSV failed validation (kind may be wrong). Switch to CSV, choose the asset type, paste the file, and Import.\n' +
          JSON.stringify(result.errors, null, 2)
        );
        return;
      }
      acceptManifest(parsed.manifest);
      return;
    }
    setImportMode('json');
    setJsonText(text);
    handleJsonImport(text);
  };

  const onFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importFileText(file);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
    e.target.value = '';
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      await importFileText(file);
    } catch (err: any) {
      setError(err?.message ?? String(err));
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
    setGenProgress(null);
    setError(null);
    // Drop any report from a previous successful generation so the
    // user can't see stale folders/files when the new generation
    // fails or produces a different job.
    setManifestReport(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await generateJob(job, webCanvasBackend, {
        signal: controller.signal,
        onProgress: (p) => setGenProgress(p),
      });
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
      } else if (result.zip && result.cancelled) {
        setManifestReport(null);
        setError('Generation cancelled. Partial ZIP was not downloaded.');
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
      setGenProgress(null);
      abortRef.current = null;
    }
  };

  const handleCancelGenerate = () => {
    abortRef.current?.abort();
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
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Placeholderer</h1>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setView('home')} style={navButtonStyle(view === 'home')}>Manifest</button>
            <button onClick={() => setView('templates')} style={navButtonStyle(view === 'templates')}>Templates</button>
            <button onClick={() => setView('builder')} style={navButtonStyle(view === 'builder')}>UI Builder</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              color: colors.textMuted,
              cursor: 'pointer',
              padding: '0.35rem 0.6rem',
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              background: colors.bgInset,
            }}
            title="Persist AI-driven mode preference and show prompt copy helpers on Templates"
          >
            <input
              type="checkbox"
              checked={aiMode}
              onChange={(e) => setAiMode(e.target.checked)}
            />
            AI-driven mode
          </label>
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
      </div>

      <div style={{ maxWidth: contentMaxWidth, margin: '0 auto', padding: contentPadding }}>
        {/* HOME VIEW */}
        {view === 'home' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '0.5rem 1rem',
                    background: colors.bgInset,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  Upload file…
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,application/json,text/csv,text/plain"
                  style={{ display: 'none' }}
                  onChange={onFileInput}
                />
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                style={{
                  borderRadius: '8px',
                  border: dragOver ? `2px dashed ${colors.accent}` : `2px dashed transparent`,
                  padding: dragOver ? '0.25rem' : 0,
                }}
              >
                {importMode === 'json' && (
                  <>
                    <h2 style={{ marginTop: 0 }}>Import Manifest</h2>
                    <p style={{ color: colors.textMuted, fontSize: '0.9rem' }}>
                      Paste JSON below, or drag-and-drop a <code>.json</code> file. Import only runs when you click the button
                      (or drop a file) so partial typing does not spam validation errors.
                    </p>
                    <textarea
                      placeholder="Paste your JSON manifest here..."
                      value={jsonText}
                      onChange={(e) => setJsonText(e.target.value)}
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
                    />
                    <button
                      onClick={() => handleJsonImport(jsonText)}
                      disabled={!jsonText.trim()}
                      style={{
                        marginTop: '1rem',
                        padding: '0.6rem 1.5rem',
                        background: colors.accent,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: jsonText.trim() ? 'pointer' : 'not-allowed',
                        opacity: jsonText.trim() ? 1 : 0.6,
                      }}
                    >
                      Import JSON
                    </button>
                  </>
                )}

                {importMode === 'csv' && (
                  <CSVImport
                    onImport={handleCSVImport}
                    onError={(msg) => setError(msg)}
                  />
                )}
              </div>
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
                onClick={() => {
                  setView('home');
                  setJob(null);
                  setLastReport(null);
                  setManifestReport(null);
                  setError(null);
                }}
                style={{ padding: '0.5rem 1rem', background: colors.bgInset, color: colors.text, border: 'none', borderRadius: '6px' }}
              >
                New Job
              </button>
            </div>

            {job.requests.map((request, rIndex) => {
              const kinds = [...new Set(request.assets.map((a) => a.kind))];
              const previewAssets = request.assets.slice(0, 3);
              return (
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
                        {kinds.length > 0 && ` · ${kinds.join(', ')}`}
                      </span>
                    </div>
                    <span style={{ color: colors.textDim }}>{expandedRequests.has(rIndex) ? '−' : '+'}</span>
                  </div>

                  {/* Preview strip — 2–3 representative assets */}
                  {previewAssets.length > 0 && (
                    <div style={{
                      display: 'flex',
                      gap: '0.75rem',
                      padding: '0.75rem 1.25rem',
                      borderBottom: expandedRequests.has(rIndex) ? `1px solid ${colors.border}` : 'none',
                      overflowX: 'auto',
                    }}>
                      {previewAssets.map((asset, i) => (
                        <div
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            openAssetDetail(rIndex, i);
                          }}
                          style={{
                            cursor: 'pointer',
                            flex: '0 0 auto',
                            textAlign: 'center',
                          }}
                          title={asset.name}
                        >
                          <AssetPreview asset={asset} maxWidth={96} maxHeight={72} />
                          <div style={{ fontSize: '0.7rem', color: colors.textMuted, marginTop: '0.25rem', maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {asset.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

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
              );
            })}

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                style={{
                  padding: '0.75rem 2.5rem',
                  background: colors.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: isGenerating ? 'wait' : 'pointer',
                  opacity: isGenerating ? 0.85 : 1,
                }}
              >
                {isGenerating ? 'Generating…' : 'Generate & Download ZIP'}
              </button>
              {isGenerating && (
                <button
                  onClick={handleCancelGenerate}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: colors.bgInset,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            {isGenerating && genProgress && (
              <div style={{ marginTop: '1rem', maxWidth: 480 }}>
                <div style={{ fontSize: '0.85rem', color: colors.textMuted, marginBottom: '0.35rem' }}>
                  {genProgress.index + 1} / {genProgress.total} — {genProgress.name}
                </div>
                <div style={{
                  height: 8,
                  background: colors.bgInset,
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: `1px solid ${colors.border}`,
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round(((genProgress.index + 1) / Math.max(1, genProgress.total)) * 100)}%`,
                    background: colors.accent,
                    transition: 'width 0.15s ease',
                  }} />
                </div>
              </div>
            )}

            {error && view === 'overview' && (
              <pre style={{
                marginTop: '1rem',
                background: colors.errorBg,
                color: colors.errorText,
                padding: '1rem',
                borderRadius: '8px',
                border: `1px solid ${colors.errorBorder}`,
              }}>
                {error}
              </pre>
            )}

            {lastReport && (
              <div style={{
                marginTop: '2rem',
                padding: '1.25rem',
                background: lastReport.success ? colors.successBg : colors.errorBg,
                border: `1px solid ${lastReport.success ? colors.successBorder : colors.errorBorder}`,
                borderRadius: '8px'
              }}>
                <strong>
                  {lastReport.cancelled
                    ? 'Generation cancelled'
                    : lastReport.success
                      ? '✓ Generation successful'
                      : '✕ Generation had errors'}
                </strong>
                {lastReport.errors && lastReport.errors.length > 0 && (
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
          <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
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
                    onChange={(e) => applySafeAdjustment({ numbering_style: e.target.value as NumberingStyle })}
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
                    onChange={(e) => applySafeAdjustment({ label_position: e.target.value as LabelPosition })}
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
                    Show Panel Guides
                  </label>
                )}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 280 }}>
              <h3>Preview</h3>
              <AssetPreview asset={selectedAsset.asset} />
            </div>
          </div>
        )}

        {/* OTHER VIEWS */}
        {view === 'builder' && <UIBuilder />}
        {view === 'templates' && <Templates aiMode={aiMode} />}
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
    const sr = asset.sample_rate ?? 44100;
    return `${asset.duration}s @ ${sr}Hz`;
  }
  return `${asset.width}×${asset.height}`;
}

export default App;
