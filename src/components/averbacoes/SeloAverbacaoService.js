import config from '../../config';

// Helper: build execucao id used by execution APIs for averbacoes
const buildExecucaoIdForAverbacao = (averbacaoId) => `AV${averbacaoId}`;

export async function listarSelosAverbacao(averbacaoId) {
  const token = localStorage.getItem('token');
  const execId = buildExecucaoIdForAverbacao(averbacaoId);
  console.log('[SeloAverbacaoService] listarSelosAverbacao: execId=', execId);
  const res = await fetch(`${config.apiURL}/selos-execucao-servico/${encodeURIComponent(execId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) {
    console.error('[SeloAverbacaoService] listarSelosAverbacao: erro resposta', { status: res.status, body: text });
    throw new Error(data.error || `Erro ao listar selos (${res.status})`);
  }
  console.log('[SeloAverbacaoService] listarSelosAverbacao: dados recebidos', data);
  // existing execution API returns { selos: [...] }
  return Array.isArray(data?.selos) ? data.selos : (Array.isArray(data) ? data : []);
}

export async function criarSeloAverbacao(averbacaoId, payload) {
  const token = localStorage.getItem('token');
  const execId = buildExecucaoIdForAverbacao(averbacaoId);
  console.log('[SeloAverbacaoService] criarSeloAverbacao: execId, payload', { execId, payload });
  // reuse same upload endpoint used by ServicoExecucao (multipart/form-data expected there)
  // if payload is JSON fields (non-file), we send JSON to the execucaoservico/:execId/selo endpoint
  const res = await fetch(`${config.apiURL}/execucaoservico/${encodeURIComponent(execId)}/selo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) {
    console.error('[SeloAverbacaoService] criarSeloAverbacao: erro resposta', { status: res.status, body: text });
    throw new Error(data.error || `Erro ao criar selo (${res.status})`);
  }
  console.log('[SeloAverbacaoService] criarSeloAverbacao: criado', data);
  return data?.selo || data;
}

export async function atualizarSeloAverbacao(averbacaoId, seloId, payload) {
  const token = localStorage.getItem('token');
  console.log('[SeloAverbacaoService] atualizarSeloAverbacao: seloId, payload', { seloId, payload });
  // reuse same PUT used in ServicoSeloService: PUT /selos-execucao-servico/:seloId
  const res = await fetch(`${config.apiURL}/selos-execucao-servico/${encodeURIComponent(seloId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) {
    console.error('[SeloAverbacaoService] atualizarSeloAverbacao: erro resposta', { status: res.status, body: text });
    throw new Error(data.error || `Erro ao atualizar selo (${res.status})`);
  }
  console.log('[SeloAverbacaoService] atualizarSeloAverbacao: atualizado', data);
  return data?.selo || data;
}

export async function excluirSeloAverbacao(averbacaoId, seloId) {
  const token = localStorage.getItem('token');
  const execId = buildExecucaoIdForAverbacao(averbacaoId);
  console.log('[SeloAverbacaoService] excluirSeloAverbacao: execId, seloId', { execId, seloId });
  // reuse same delete used in ServicoExecucao: DELETE /execucao-servico/:execId/selo/:seloId
  const res = await fetch(`${config.apiURL}/execucao-servico/${encodeURIComponent(execId)}/selo/${encodeURIComponent(seloId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    console.error('[SeloAverbacaoService] excluirSeloAverbacao: erro resposta', { status: res.status, body: text });
    throw new Error(data.error || `Erro ao excluir selo (${res.status})`);
  }
  console.log('[SeloAverbacaoService] excluirSeloAverbacao: sucesso', { seloId });
  return true;
}
