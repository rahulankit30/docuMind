const API_BASE = '/api';

export async function uploadPdf(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/pdf/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Upload failed');
  }

  return res.json();
}

export async function listPdfs() {
  const res = await fetch(`${API_BASE}/pdf/list`);
  if (!res.ok) throw new Error('Failed to load documents');
  return res.json();
}

export async function deletePdf(id) {
  const res = await fetch(`${API_BASE}/pdf/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete document');
  return res.json();
}

export async function extractTextFromImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/ocr/extract`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Text extraction failed');
  }

  return res.json();
}

export async function sendMessage(documentIds, question) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentIds, question }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Failed to get response');
  }

  return res.json();
}

export async function sendMessageStream(documentIds, question, { onToken, onSources, onError, onDone }) {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentIds, question }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Failed to get response');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneReceived = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();

    for (const part of parts) {
      if (!part.trim()) continue;
      let eventType = '';
      let eventData = '';
      for (const line of part.split('\n')) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim();
        else if (line.startsWith('data:')) eventData = line.slice(5);
      }

      switch (eventType) {
        case 'token':
          onToken?.(eventData);
          break;
        case 'sources':
          try { onSources?.(JSON.parse(eventData)); } catch { onSources?.([]); }
          break;
        case 'done':
          doneReceived = true;
          onDone?.();
          break;
        case 'error':
          onError?.(eventData);
          break;
      }
    }
  }

  if (!doneReceived) onDone?.();
}

export async function compareDocuments(docId1, docId2, focusArea, { onToken, onError, onDone }) {
  const res = await fetch(`${API_BASE}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId1: docId1, documentId2: docId2, focusArea }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'Comparison failed');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneReceived = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();

    for (const part of parts) {
      if (!part.trim()) continue;
      let eventType = '';
      let eventData = '';
      for (const line of part.split('\n')) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim();
        else if (line.startsWith('data:')) eventData = line.slice(5);
      }

      switch (eventType) {
        case 'token':
          onToken?.(eventData);
          break;
        case 'done':
          doneReceived = true;
          onDone?.();
          break;
        case 'error':
          onError?.(eventData);
          break;
      }
    }
  }

  if (!doneReceived) onDone?.();
}
