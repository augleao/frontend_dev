import config from '../../config';

export async function listarSelosAverbacao(averbacaoId) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(averbacaoId)}/selos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) throw new Error(data.error || `Erro ao listar selos (${res.status})`);
  return Array.isArray(data?.selos) ? data.selos : (Array.isArray(data) ? data : []);
}

export async function criarSeloAverbacao(averbacaoId, payload) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(averbacaoId)}/selos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) throw new Error(data.error || `Erro ao criar selo (${res.status})`);
  return data?.selo || data;
}

export async function atualizarSeloAverbacao(averbacaoId, seloId, payload) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(averbacaoId)}/selos/${encodeURIComponent(seloId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) throw new Error(data.error || `Erro ao atualizar selo (${res.status})`);
  return data?.selo || data;
}

export async function excluirSeloAverbacao(averbacaoId, seloId) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(averbacaoId)}/selos/${encodeURIComponent(seloId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    throw new Error(data.error || `Erro ao excluir selo (${res.status})`);
  }
  return true;
}
