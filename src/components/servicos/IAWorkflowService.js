import { apiURL } from '../../config';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function extrairTexto(file) {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await fetch(`${apiURL}/ia/extrair-texto`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData
  });
  if (!resp.ok) {
    let msg = 'Falha ao extrair texto do PDF';
    try { const err = await resp.json(); msg = err?.error || err?.message || msg; } catch (_) {}
    const e = new Error(msg); e.status = resp.status; throw e;
  }
  return resp.json();
}

export async function identificarTipo(text) {
  const resp = await fetch(`${apiURL}/ia/identificar-tipo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text })
  });
  if (!resp.ok) {
    let msg = 'Falha ao identificar tipo do mandado';
    try { const err = await resp.json(); msg = err?.error || err?.message || msg; } catch (_) {}
    const e = new Error(msg); e.status = resp.status; throw e;
  }
  return resp.json();
}

export async function analisarExigencia({ text, legislacao, tipo }) {
  const resp = await fetch(`${apiURL}/ia/analisar-exigencia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text, legislacao, tipo })
  });
  if (!resp.ok) {
    let msg = 'Falha ao analisar exigência';
    try { const err = await resp.json(); msg = err?.error || err?.message || msg; } catch (_) {}
    const e = new Error(msg); e.status = resp.status; throw e;
  }
  return resp.json();
}

export async function gerarTextoAverbacao({ text, legislacao, tipo }) {
  const resp = await fetch(`${apiURL}/ia/gerar-texto-averbacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text, legislacao, tipo })
  });
  if (!resp.ok) {
    let msg = 'Falha ao gerar texto da averbação';
    try { const err = await resp.json(); msg = err?.error || err?.message || msg; } catch (_) {}
    const e = new Error(msg); e.status = resp.status; throw e;
  }
  return resp.json();
}
