import axios from 'axios';
import { apiURL } from '../config';

function buildAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeListResponse(raw) {
  if (Array.isArray(raw)) {
    return { items: raw, meta: {} };
  }
  if (Array.isArray(raw?.daps)) {
    return { items: raw.daps, meta: raw.meta ?? raw.pagination ?? {} };
  }
  if (Array.isArray(raw?.resultado?.daps)) {
    return { items: raw.resultado.daps, meta: raw.resultado.meta ?? raw.meta ?? {} };
  }
  if (Array.isArray(raw?.resultado?.items)) {
    return { items: raw.resultado.items, meta: raw.resultado.meta ?? raw.meta ?? {} };
  }
  if (Array.isArray(raw?.items)) {
    return { items: raw.items, meta: raw.meta ?? {} };
  }
  if (Array.isArray(raw?.data)) {
    return { items: raw.data, meta: raw.meta ?? {} };
  }
  if (Array.isArray(raw?.rows)) {
    return { items: raw.rows, meta: raw.meta ?? { total: raw.total } };
  }
  if (Array.isArray(raw?.resultado)) {
    return { items: raw.resultado, meta: raw.meta ?? {} };
  }
  return { items: [], meta: raw?.meta ?? {} };
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

export async function getHistoricoNasOb() {
  const url = `${apiURL}/dap/historico-nas-ob`;
  const headers = buildAuthHeaders();
  const tokenPreview = headers.Authorization ? `${String(headers.Authorization).slice(0, 18)}…` : null;

  console.log('[dapService] GET /dap/historico-nas-ob', {
    url,
    hasToken: !!headers.Authorization,
    tokenPreview,
  });

  try {
    const response = await axios.get(url, { headers });
    console.log('[dapService] historico-nas-ob ok', {
      status: response.status,
      dataKeys: Object.keys(response.data || {}),
    });
    return response.data;
  } catch (error) {
    console.error('[dapService] historico-nas-ob erro', {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
    });
    throw error;
  }
}
