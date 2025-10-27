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
  const asyncResp = await fetch(`${apiURL}/ia/analise-mandado-async`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData
  });
  if (asyncResp.ok) {
    return asyncResp.json();
  }
  // Fallback: se o backend não tiver a rota assíncrona (404), tentar a síncrona
  if (asyncResp.status === 404) {
    const syncResp = await fetch(`${apiURL}/ia/analise-mandado`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: formData
    });
    if (!syncResp.ok) {
      let msg = 'Falha ao analisar (rota síncrona)';
      try { const err = await syncResp.json(); msg = err?.error || err?.message || msg; } catch (_) {}
      const e = new Error(msg); e.status = syncResp.status; throw e;
    }
    const data = await syncResp.json();
    return { jobId: null, result: data };
  }
  let msg = 'Falha ao iniciar análise';
  try { const err = await asyncResp.json(); msg = err?.error || err?.message || msg; } catch (_) {}
  const e = new Error(msg); e.status = asyncResp.status; throw e;
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
