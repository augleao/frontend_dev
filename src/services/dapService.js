import axios from 'axios';
import { apiURL } from '../config';

function buildAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeListResponse(raw) {
  if (Array.isArray(raw)) {
    return { items: normalizeDapItems(raw), meta: {} };
  }
  if (Array.isArray(raw?.daps)) {
    return { items: normalizeDapItems(raw.daps), meta: raw.meta ?? raw.pagination ?? {} };
  }
  if (Array.isArray(raw?.resultado?.daps)) {
    return { items: normalizeDapItems(raw.resultado.daps), meta: raw.resultado.meta ?? raw.meta ?? {} };
  }
  if (Array.isArray(raw?.resultado?.items)) {
    return { items: normalizeDapItems(raw.resultado.items), meta: raw.resultado.meta ?? raw.meta ?? {} };
  }
  if (Array.isArray(raw?.items)) {
    return { items: normalizeDapItems(raw.items), meta: raw.meta ?? {} };
  }
  if (Array.isArray(raw?.data)) {
    return { items: normalizeDapItems(raw.data), meta: raw.meta ?? {} };
  }
  if (Array.isArray(raw?.rows)) {
    return { items: normalizeDapItems(raw.rows), meta: raw.meta ?? { total: raw.total } };
  }
  if (Array.isArray(raw?.resultado)) {
    return { items: normalizeDapItems(raw.resultado), meta: raw.meta ?? {} };
  }
  return { items: [], meta: raw?.meta ?? {} };
}

function normalizeDapItems(items) {
  return items.map((item) => ({
    ...item,
    // Normaliza campos snake_case para camelCase quando necessário
    ano: item.ano,
    mes: item.mes,
    retificadora: item.retificadora ?? false,
    dataTransmissao: item.data_transmissao ?? item.dataTransmissao,
    nomeServentia: item.nome_serventia ?? item.nomeServentia,
    codigoServentia: item.codigo_serventia ?? item.codigoServentia,
    // Mantém compatibilidade com campos antigos
    data_transmissao: item.data_transmissao ?? item.dataTransmissao,
    nome_serventia: item.nome_serventia ?? item.nomeServentia,
    codigo_serventia: item.codigo_serventia ?? item.codigoServentia,
  }));
}

export async function listDaps(filters = {}) {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'string' && value.toLowerCase() === 'todos') return;
    params[key] = value;
  });

  const response = await axios.get(`${apiURL}/dap`, {
    params,
    headers: buildAuthHeaders(),
  });

  // Ajuda a diagnosticar formatos diferentes vindos do backend
  // eslint-disable-next-line no-console
  console.debug('listDaps response', response.data);

  return normalizeListResponse(response.data);
}

export async function getDapById(id) {
  if (!id) throw new Error('ID da DAP não informado.');
  const response = await axios.get(`${apiURL}/dap/${id}`, {
    headers: buildAuthHeaders(),
  });
  return response.data;
}

export async function deleteDap(id) {
  if (!id) throw new Error('ID da DAP não informado.');
  const response = await axios.delete(`${apiURL}/dap/${id}`, {
    headers: buildAuthHeaders(),
  });
  return response.data;
}

export async function updateDap(id, payload) {
  if (!id) throw new Error('ID da DAP não informado.');
  const response = await axios.put(`${apiURL}/dap/${id}`, payload, {
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
  });
  return response.data;
}

export async function createDap(payload) {
  const response = await axios.post(`${apiURL}/dap`, payload, {
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
  });
  return response.data;
}

export async function uploadDap({ file, metadata } = {}) {
  if (!file) throw new Error('Arquivo da DAP não informado.');

  const formData = new FormData();
  formData.append('file', file);
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata));
  }

  const response = await axios.post(`${apiURL}/dap/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...buildAuthHeaders(),
    },
  });

  return response.data;
}
