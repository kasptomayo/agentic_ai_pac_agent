import { useState } from 'react';
import PdfUploader from './components/PdfUploader';

function App() {
  const [pdfText, setPdfText] = useState('');
  const [rego, setRego] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateRego = async () => {
    setLoading(true);
    setError('');
    setRego('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}/api/generate-rego`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfText }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || 'Failed to generate REGO');
      }

      const data = await response.json();
      setRego(data.rego || 'No REGO returned from agent.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header>
        <h1>Agentnic UI</h1>
        <p>Transform bank loan rules into OPA REGO policies using intelligent agent technology</p>
      </header>

      <main>
        <PdfUploader onTextExtracted={setPdfText} />

        <section className="controls">
          <button onClick={generateRego} disabled={!pdfText || loading}>
            {loading ? '⏳ Generating REGO…' : '→ Generate REGO Policy'}
          </button>
          {pdfText && (
            <button onClick={() => setPdfText('')} style={{ background: '#666' }}>
              ✕ Clear PDF
            </button>
          )}
        </section>

        {pdfText && (
          <section className="panel">
            <h2>Extracted Bank Loan Rules</h2>
            <textarea readOnly value={pdfText} rows={12} placeholder="PDF content appears here..." />
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '8px' }}>
              {pdfText.length.toLocaleString()} characters extracted
            </p>
          </section>
        )}

        {rego && (
          <section className="panel">
            <h2>Generated OPA REGO Policy</h2>
            <textarea readOnly value={rego} rows={20} placeholder="REGO policy will appear here..." />
            <button 
              onClick={() => {
                navigator.clipboard.writeText(rego);
                alert('REGO policy copied to clipboard!');
              }}
              style={{ marginTop: '12px', background: '#00B4E4', color: '#002346' }}
            >
              📋 Copy to Clipboard
            </button>
          </section>
        )}

        {error && (
          <div className="error">
            <strong>⚠ Error:</strong> {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
