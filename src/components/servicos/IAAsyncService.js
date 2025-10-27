import { apiURL } from '../../config';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Inicia análise assíncrona e retorna { jobId }
export async function iniciarAnalise(file, metadata = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (metadata && Object.keys(metadata).length > 0) {
    formData.append('metadata', JSON.stringify(metadata));
  }
  const resp = await fetch(`${apiURL}/ia/analise-mandado-async`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData
  });
  if (!resp.ok) {
    let msg = 'Falha ao iniciar análise';
    try { const err = await resp.json(); msg = err?.error || err?.message || msg; } catch (_) {}
    const e = new Error(msg); e.status = resp.status; throw e;
  }
  return resp.json();
}

// Obtém status atual do job
export async function obterStatus(jobId) {
  const resp = await fetch(`${apiURL}/ia/status/${jobId}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() }
  });
  if (!resp.ok) {
    let msg = 'Falha ao consultar status';
    try { const err = await resp.json(); msg = err?.error || err?.message || msg; } catch (_) {}
    const e = new Error(msg); e.status = resp.status; throw e;
  }
  return resp.json();
}
