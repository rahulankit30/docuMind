import { useState, useRef, useEffect } from 'react';

export default function ComparisonView({ docA, docB, onCompare, showError }) {
  const [focusArea, setFocusArea] = useState('');
  const [result, setResult] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const resultRef = useRef(null);

  useEffect(() => {
    resultRef.current?.scrollTo({ top: resultRef.current.scrollHeight, behavior: 'smooth' });
  }, [result]);

  async function handleCompare() {
    if (!docA || !docB) return;
    setResult('');
    setIsComparing(true);

    try {
      await onCompare(docA.id, docB.id, focusArea || null, {
        onToken: (token) => {
          setResult((prev) => prev + token);
        },
        onError: (msg) => {
          showError(msg);
        },
        onDone: () => {
          setIsComparing(false);
        },
      });
    } catch (err) {
      showError(err.message);
      setIsComparing(false);
    }
  }

  if (!docA || !docB) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="4" width="8" height="16" rx="1" />
            <rect x="14" y="4" width="8" height="16" rx="1" />
          </svg>
        </div>
        <h2>Compare two documents</h2>
        <p>Select two documents from the sidebar to compare their content. AI will identify similarities, differences, and unique content.</p>
        <div className="empty-state-features">
          <div className="feature-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>Pick Doc A</span>
          </div>
          <div className="feature-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>Pick Doc B</span>
          </div>
          <div className="feature-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span>Get analysis</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="comparison-view">
      <div className="comparison-header">
        <div className="comparison-docs">
          <div className="comparison-doc-card doc-a">
            <span className="comparison-doc-badge">A</span>
            <span className="comparison-doc-name">{docA.filename}</span>
          </div>
          <div className="comparison-vs">vs</div>
          <div className="comparison-doc-card doc-b">
            <span className="comparison-doc-badge">B</span>
            <span className="comparison-doc-name">{docB.filename}</span>
          </div>
        </div>

        <div className="comparison-controls">
          <input
            type="text"
            className="comparison-focus-input"
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            placeholder="Focus area (optional, e.g. pricing, methodology)"
            disabled={isComparing}
          />
          <button
            className="comparison-run-btn"
            onClick={handleCompare}
            disabled={isComparing}
          >
            {isComparing ? (
              <>
                <div className="spinner-sm" />
                Comparing...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Compare
              </>
            )}
          </button>
        </div>
      </div>

      <div className="comparison-result" ref={resultRef}>
        {result ? (
          <div className="comparison-result-inner">
            <div className="comparison-result-text">
              {result}
              {isComparing && <span className="streaming-cursor">|</span>}
            </div>
          </div>
        ) : !isComparing ? (
          <div className="comparison-ready">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <p>Click Compare to analyze both documents</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
