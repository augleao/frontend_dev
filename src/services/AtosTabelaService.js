import config from '../config';

const buildAuthHeaders = (hasJson = true) => {
  const token = localStorage.getItem('token');
  const headers = {
    Authorization: `Bearer ${token}`
  };
  if (hasJson) headers['Content-Type'] = 'application/json';
  return headers;
};

const handleResponse = async (resp, defaultError) => {
  let payload = null;
  try {
    payload = await resp.json();
  } catch (_) {
    payload = null;
  }
  if (!resp.ok) {
    const message = payload?.message || payload?.error || defaultError;
    throw new Error(message);
  }
  return payload;
};

const AtosTabelaService = {
  async listVersions() {
    const resp = await fetch(`${config.apiURL}/atos/versoes`, {
      headers: buildAuthHeaders(false)
    });
    return handleResponse(resp, 'Falha ao listar versões das tabelas TJMG.');
  },

  async previewVersion(origem) {
    const resp = await fetch(`${config.apiURL}/atos/versoes/${encodeURIComponent(origem)}`, {
      headers: buildAuthHeaders(false)
    });
    return handleResponse(resp, 'Falha ao carregar prévia da versão selecionada.');
  },

  async snapshotCurrent({ origem, overwrite } = {}) {
    const resp = await fetch(`${config.apiURL}/atos/versoes/snapshot`, {
      method: 'POST',
      headers: buildAuthHeaders(true),
      body: JSON.stringify({ origem, overwrite })
    });
    return handleResponse(resp, 'Falha ao salvar a versão atual da tabela TJMG.');
  },

  async importVersion({ origem, registros }) {
    const resp = await fetch(`${config.apiURL}/atos/versoes`, {
      method: 'POST',
      headers: buildAuthHeaders(true),
      body: JSON.stringify({ origem, registros })
    });
    return handleResponse(resp, 'Falha ao importar registros para a nova versão.');
  },

  async importVersionPdf({ origem, arquivo, aliquota, taxa_fiscal, overwrite }) {
    const form = new FormData();
    form.append('origem', origem);
    if (aliquota != null) form.append('aliquota', aliquota);
    if (taxa_fiscal != null) form.append('taxa_fiscal', taxa_fiscal);
    if (overwrite != null) form.append('overwrite', overwrite ? 'true' : 'false');
    form.append('file', arquivo);

    const headers = buildAuthHeaders(false); // apenas Authorization; FormData define o boundary
    const resp = await fetch(`${config.apiURL}/atos/versoes/import/pdf`, {
      method: 'POST',
      headers,
      body: form
    });
    return handleResponse(resp, 'Falha ao importar PDF para nova versão.');
  },

  async updateRecord(origem, codigo, payload) {
    const resp = await fetch(`${config.apiURL}/atos/versoes/${encodeURIComponent(origem)}/${encodeURIComponent(codigo)}`, {
      method: 'PUT',
      headers: buildAuthHeaders(true),
      body: JSON.stringify(payload)
    });
    return handleResponse(resp, 'Falha ao atualizar o registro solicitado.');
  },

  async activateVersion(origem) {
    const resp = await fetch(`${config.apiURL}/atos/versoes/${encodeURIComponent(origem)}/ativar`, {
      method: 'POST',
      headers: buildAuthHeaders(true)
    });
    return handleResponse(resp, 'Falha ao ativar a versão selecionada.');
  },

  async deleteVersion(origem) {
    const resp = await fetch(`${config.apiURL}/atos/versoes/${encodeURIComponent(origem)}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(false)
    });
    return handleResponse(resp, 'Falha ao remover a versão selecionada.');
  }
};

export default AtosTabelaService;
