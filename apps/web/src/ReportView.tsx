import { GenerateResult } from '@placeholderer/core';

interface Props {
  result: GenerateResult;
  onClose: () => void;
}

export function ReportView({ result, onClose }: Props) {
  return (
    <div style={{ padding: '2rem', background: '#111', borderRadius: 8 }}>
      <h2>Generation Report</h2>
      
      {result.success ? (
        <p style={{ color: '#68d391' }}>Successfully generated {result.files?.length || 0} files.</p>
      ) : (
        <div>
          <p style={{ color: '#fc8181' }}>Generation completed with errors.</p>
          <pre style={{ color: '#fc8181', background: '#2d1f1f', padding: '1rem' }}>
            {result.errors?.join('\n')}
          </pre>
        </div>
      )}

      <button onClick={onClose} style={{ marginTop: '1.5rem' }}>Close</button>
    </div>
  );
}