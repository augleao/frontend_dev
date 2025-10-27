import { apiURL } from '../../config';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listarLegislacao({ search = '', indexador = '', ativo } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (indexador) params.set('indexador', indexador);
  if (typeof ativo === 'boolean') params.set('ativo', String(ativo));

  // apiURL already includes '/api'
  const resp = await fetch(`${apiURL}/legislacao?${params.toString()}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() }
  });
  if (!resp.ok) throw new Error('Falha ao listar legislação');
  return resp.json();
}

export async function criarLegislacao(payload) {
  const resp = await fetch(`${apiURL}/legislacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error('Falha ao criar legislação');
  return resp.json();
}

export async function atualizarLegislacao(id, payload) {
  const resp = await fetch(`${apiURL}/legislacao/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error('Falha ao atualizar legislação');
  return resp.json();
}

export async function excluirLegislacao(id) {
  const resp = await fetch(`${apiURL}/legislacao/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() }
  });
  if (!resp.ok) throw new Error('Falha ao excluir legislação');
  return resp.json();
}
