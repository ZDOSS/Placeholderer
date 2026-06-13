import { useState } from 'react';
import { validateManifest } from '@placeholderer/core';
import type { Job } from './types';

type View = 'home' | 'overview';

function App() {
  const [view, setView] = useState<View>('home');
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());

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
        setError('Invalid manifest: ' + JSON.stringify(result.errors, null, 2));
      }
    } catch (e) {
      setError('Failed to parse JSON');
    }
  };

  const toggleRequest = (index: number) => {
    const newSet = new Set(expandedRequests);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setExpandedRequests(newSet);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '900px', margin: '0 auto' }}>
      <h1>Placeholderer</h1>
      
      {view === 'home' && (
        <div>
          <h2>Import Manifest</h2>
          <p>Paste a JSON manifest below or upload a file.</p>
          <textarea 
            placeholder="Paste JSON manifest here..."
            style={{ width: '100%', height: '250px', marginTop: '1rem', fontFamily: 'monospace' }}
            onChange={(e) => {
              if (e.target.value.trim().length > 10) {
                handlePaste(e.target.value);
              }
            }}
          />
          {error && (
            <pre style={{ color: 'red', background: '#fee', padding: '1rem', marginTop: '1rem' }}>
              {error}
            </pre>
          )}
        </div>
      )}

      {view === 'overview' && job && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Job Overview — {job.job?.name || 'Unnamed Job'}</h2>
            <button onClick={() => { setView('home'); setJob(null); }}>
              New Job
            </button>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            {job.requests.map((request, index) => (
              <div key={index} style={{ 
                border: '1px solid #ccc', 
                borderRadius: '6px', 
                marginBottom: '1rem',
                background: '#fafafa'
              }}>
                <div 
                  onClick={() => toggleRequest(index)}
                  style={{ 
                    padding: '1rem', 
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 600
                  }}
                >
                  <span>{request.name || `Request ${index + 1}`}</span>
                  <span>{request.assets?.length || 0} assets</span>
                </div>

                {expandedRequests.has(index) && (
                  <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #ddd' }}>
                    {request.assets?.map((asset: any, assetIndex: number) => (
                      <div key={assetIndex} style={{ 
                        padding: '0.75rem', 
                        background: 'white', 
                        marginTop: '0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.9rem'
                      }}>
                        <strong>{asset.name}</strong> — {asset.kind} ({asset.width}×{asset.height})
                        <div style={{ color: '#666', fontSize: '0.8rem' }}>
                          {asset.output_path}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button 
            style={{ marginTop: '1rem', padding: '0.75rem 2rem' }}
            onClick={() => alert('Generate flow coming next')}
          >
            Generate & Download
          </button>
        </div>
      )}
    </div>
  );
}

export default App;