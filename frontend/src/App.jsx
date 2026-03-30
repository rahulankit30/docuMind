import { useState, useEffect, useCallback } from 'react';
import PdfUploader from './components/PdfUploader';
import ChatWindow from './components/ChatWindow';
import ImageUploader from './components/ImageUploader';
import TextPreview from './components/TextPreview';
import ComparisonView from './components/ComparisonView';
import { uploadPdf, listPdfs, deletePdf, sendMessageStream, extractTextFromImage, compareDocuments } from './api/chatApi';
import './App.css';

function App() {
  const [mode, setMode] = useState('chat');
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [compareDocA, setCompareDocA] = useState(null);
  const [compareDocB, setCompareDocB] = useState(null);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await listPdfs();
      setDocuments(docs);
    } catch (err) {
      showError('Failed to load documents: ' + err.message);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  function showError(message) {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }

  async function handleUpload(file) {
    setIsUploading(true);
    setError(null);
    try {
      const doc = await uploadPdf(file);
      setDocuments((prev) => [...prev, doc]);
      if (!multiSelect) {
        setSelectedDoc(doc);
        setMessages([]);
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  function getActiveDocIds() {
    if (multiSelect) return selectedDocs.map((d) => d.id);
    if (selectedDoc) return [selectedDoc.id];
    return [];
  }

  function getActiveDocName() {
    if (multiSelect && selectedDocs.length > 0) {
      return `${selectedDocs.length} document${selectedDocs.length !== 1 ? 's' : ''} selected`;
    }
    return selectedDoc?.filename || '';
  }

  async function handleSendMessage(question) {
    const docIds = getActiveDocIds();
    if (docIds.length === 0) return;

    const userMessage = { role: 'user', content: question };
    const assistantMessage = { role: 'assistant', content: '', sources: [], isStreaming: true };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsSending(true);
    setError(null);

    try {
      await sendMessageStream(docIds, question, {
        onToken: (token) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            last.content += token;
            updated[updated.length - 1] = last;
            return updated;
          });
        },
        onSources: (sources) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            last.sources = sources;
            updated[updated.length - 1] = last;
            return updated;
          });
        },
        onDone: () => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            last.isStreaming = false;
            updated[updated.length - 1] = last;
            return updated;
          });
        },
        onError: (errorMsg) => {
          showError(errorMsg);
        },
      });
    } catch (err) {
      showError(err.message);
      setMessages((prev) => prev.slice(0, -2));
    } finally {
      setIsSending(false);
    }
  }

  async function handleDeleteDocument(id) {
    try {
      await deletePdf(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
        setMessages([]);
      }
      setSelectedDocs((prev) => prev.filter((d) => d.id !== id));
      if (compareDocA?.id === id) setCompareDocA(null);
      if (compareDocB?.id === id) setCompareDocB(null);
    } catch (err) {
      showError(err.message);
    }
  }

  function handleClearChat() {
    setMessages([]);
  }

  function handleToggleMultiSelect() {
    if (multiSelect) {
      setMultiSelect(false);
      setSelectedDocs([]);
    } else {
      setMultiSelect(true);
      if (selectedDoc) {
        setSelectedDocs([selectedDoc]);
      }
      setSelectedDoc(null);
      setMessages([]);
    }
  }

  function handleDocClick(doc) {
    if (multiSelect) {
      setSelectedDocs((prev) => {
        const exists = prev.find((d) => d.id === doc.id);
        if (exists) return prev.filter((d) => d.id !== doc.id);
        return [...prev, doc];
      });
    } else {
      setSelectedDoc(doc);
      setMessages([]);
    }
  }

  async function handleImageUpload(file) {
    setIsExtracting(true);
    setError(null);
    try {
      const result = await extractTextFromImage(file);
      setOcrResult(result);
    } catch (err) {
      showError(err.message);
    } finally {
      setIsExtracting(false);
    }
  }

  function handleOcrReset() {
    setOcrResult(null);
  }

  function handleCompareDocSelect(doc, slot) {
    if (slot === 'A') setCompareDocA(doc);
    else setCompareDocB(doc);
  }

  const hasActiveSelection = multiSelect ? selectedDocs.length > 0 : !!selectedDoc;

  function isDocSelected(doc) {
    if (mode === 'compare') return doc.id === compareDocA?.id || doc.id === compareDocB?.id;
    if (multiSelect) return selectedDocs.some((d) => d.id === doc.id);
    return selectedDoc?.id === doc.id;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>
            <div className="logo-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            DocuMind
            <span className="brand-badge">AI</span>
          </h1>
        </div>

        <div className="mode-switcher">
          <button
            className={`mode-tab ${mode === 'chat' ? 'active' : ''}`}
            onClick={() => setMode('chat')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            PDF Chat
          </button>
          <button
            className={`mode-tab ${mode === 'compare' ? 'active' : ''}`}
            onClick={() => setMode('compare')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="8" height="16" rx="1" />
              <rect x="14" y="4" width="8" height="16" rx="1" />
            </svg>
            Compare
          </button>
          <button
            className={`mode-tab ${mode === 'ocr' ? 'active' : ''}`}
            onClick={() => setMode('ocr')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            Image OCR
          </button>
        </div>

        {mode === 'chat' ? (
          <>
            <PdfUploader onUpload={handleUpload} isUploading={isUploading} />

            <div className="doc-list">
              <div className="doc-list-header">
                <span>Documents</span>
                <div className="doc-list-actions">
                  <button
                    className={`multi-select-toggle ${multiSelect ? 'active' : ''}`}
                    onClick={handleToggleMultiSelect}
                    title={multiSelect ? 'Switch to single select' : 'Select multiple documents'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                    Multi
                  </button>
                  <span className="doc-count">{documents.length}</span>
                </div>
              </div>

              {documents.length === 0 && (
                <div className="doc-list-empty">No documents yet</div>
              )}

              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`doc-item ${isDocSelected(doc) ? 'active' : ''}`}
                  onClick={() => handleDocClick(doc)}
                >
                  {multiSelect && (
                    <span className={`doc-checkbox ${selectedDocs.some((d) => d.id === doc.id) ? 'checked' : ''}`}>
                      {selectedDocs.some((d) => d.id === doc.id) && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  )}
                  <div className="doc-info">
                    <span className="doc-name">{doc.filename}</span>
                    <span className="doc-meta">
                      {doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''} &middot; {doc.chunkCount} chunks
                    </span>
                  </div>
                  <button
                    className="doc-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDocument(doc.id);
                    }}
                    title="Delete document"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : mode === 'compare' ? (
          <>
            <div className="compare-sidebar">
              <div className="compare-slot">
                <div className="compare-slot-label">Document A</div>
                {compareDocA ? (
                  <div className="compare-slot-doc" onClick={() => setCompareDocA(null)}>
                    <span className="compare-slot-name">{compareDocA.filename}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                ) : (
                  <div className="compare-slot-empty">Select below</div>
                )}
              </div>
              <div className="compare-slot">
                <div className="compare-slot-label">Document B</div>
                {compareDocB ? (
                  <div className="compare-slot-doc" onClick={() => setCompareDocB(null)}>
                    <span className="compare-slot-name">{compareDocB.filename}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                ) : (
                  <div className="compare-slot-empty">Select below</div>
                )}
              </div>
            </div>

            <div className="doc-list">
              <div className="doc-list-header">
                <span>Pick two documents</span>
                <span className="doc-count">{documents.length}</span>
              </div>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`doc-item ${isDocSelected(doc) ? 'active' : ''}`}
                  onClick={() => {
                    if (doc.id === compareDocA?.id) { setCompareDocA(null); return; }
                    if (doc.id === compareDocB?.id) { setCompareDocB(null); return; }
                    if (!compareDocA) handleCompareDocSelect(doc, 'A');
                    else if (!compareDocB) handleCompareDocSelect(doc, 'B');
                  }}
                >
                  <div className="doc-info">
                    <span className="doc-name">{doc.filename}</span>
                    <span className="doc-meta">
                      {doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''} &middot; {doc.chunkCount} chunks
                    </span>
                  </div>
                  {doc.id === compareDocA?.id && <span className="compare-badge">A</span>}
                  {doc.id === compareDocB?.id && <span className="compare-badge">B</span>}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <ImageUploader onUpload={handleImageUpload} isExtracting={isExtracting} />
            <div className="ocr-sidebar-info">
              <p>Extract text from images or scanned PDFs using AI vision.</p>
              <ul className="ocr-features">
                <li><span className="ocr-feature-dot" />Scanned PDFs (page by page)</li>
                <li><span className="ocr-feature-dot" />Photos of text</li>
                <li><span className="ocr-feature-dot" />Screenshots</li>
                <li><span className="ocr-feature-dot" />Handwritten notes</li>
              </ul>
            </div>
          </>
        )}
      </aside>

      <main className="main-content">
        {mode === 'chat' ? (
          hasActiveSelection ? (
            <>
              {messages.length > 0 && (
                <button className="clear-chat" onClick={handleClearChat}>
                  Clear chat
                </button>
              )}
              <ChatWindow
                messages={messages}
                onSendMessage={handleSendMessage}
                isSending={isSending}
                documentName={getActiveDocName()}
              />
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h2>Chat with your documents</h2>
              <p>Upload a PDF and ask questions about its content. AI will find the relevant sections and generate accurate answers.</p>
              <div className="empty-state-features">
                <div className="feature-card">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Upload PDF</span>
                </div>
                <div className="feature-card">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>Ask questions</span>
                </div>
                <div className="feature-card">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>Get answers</span>
                </div>
              </div>
            </div>
          )
        ) : mode === 'compare' ? (
          <ComparisonView
            docA={compareDocA}
            docB={compareDocB}
            onCompare={compareDocuments}
            showError={showError}
          />
        ) : ocrResult ? (
          <TextPreview result={ocrResult} onReset={handleOcrReset} />
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <h2>Extract text from images</h2>
            <p>Upload any image containing text and AI will read and extract it while preserving the original structure and formatting.</p>
            <div className="empty-state-features">
              <div className="feature-card">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>Upload image</span>
              </div>
              <div className="feature-card">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <span>Extract text</span>
              </div>
              <div className="feature-card">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy result</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}

export default App;
