import { useState } from 'react';

export default function MessageBubble({ message }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar">
        {isUser ? 'U' : 'AI'}
      </div>
      <div className="message-body">
        <div className="message-content">
          {message.content}
          {message.isStreaming && <span className="streaming-cursor">|</span>}
        </div>

        {!isUser && !message.isStreaming && message.sources && message.sources.length > 0 && (
          <div className="sources-section">
            <button
              className="sources-toggle"
              onClick={() => setShowSources(!showSources)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {showSources ? 'Hide' : 'Show'} {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
            </button>

            {showSources && (
              <div className="sources-list">
                {message.sources.map((source, i) => (
                  <div key={i} className="source-chunk">
                    <div className="source-header">
                      Chunk {i + 1}
                      {source.metadata?.filename && (
                        <span className="source-doc">{source.metadata.filename}</span>
                      )}
                      {source.metadata?.page_number != null && (
                        <span className="source-page">Page {source.metadata.page_number}</span>
                      )}
                    </div>
                    <div className="source-text">{source.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
