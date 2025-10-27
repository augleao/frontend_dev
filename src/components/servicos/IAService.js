import { apiURL } from '../../config';

// Service to call the backend IA endpoint (Gemini 1.5 Flash)
// POST /api/ia/analise-mandado (multipart/form-data)
export async function analisarMandado(file, metadata = {}) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);
  if (metadata && Object.keys(metadata).length > 0) {
    formData.append('metadata', JSON.stringify(metadata));
  }

  // apiURL already includes '/api'
  const resp = await fetch(`${apiURL}/ia/analise-mandado`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token || ''}`
    },
    body: formData
  });

  if (!resp.ok) {
    let errorText = 'Falha na análise do mandado';
    try {
      const err = await resp.json();
      errorText = err?.message || JSON.stringify(err);
    } catch (_) {
      // ignore JSON parse error
    }
    const e = new Error(errorText);
    e.status = resp.status;
    throw e;
  }

  return resp.json();
}
