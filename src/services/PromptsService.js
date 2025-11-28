import config from '../config';

function authHeaders() {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function listPrompts() {
  const res = await fetch(`${config.apiURL}/ia/prompts`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...authHeaders() }
  });
  if (!res.ok) throw new Error(`Falha ao carregar prompts (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function indexBy(items, key = 'indexador') {
  const map = new Map();
  for (const it of items) {
    if (it && it[key]) map.set(String(it[key]).toLowerCase(), it);
  }
  return map;
}

async function getByIndexador(indexador) {
  if (!indexador) return null;
  try {
    const res = await fetch(`${config.apiURL}/ia/prompts/${encodeURIComponent(String(indexador || '').toLowerCase())}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() }
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Falha ao carregar prompt (${res.status})`);
    }
    const data = await res.json();
    return data || null;
  } catch (e) {
    // Fallback to listing all if single lookup fails
    try {
      const all = await listPrompts();
      const map = indexBy(all);
      return map.get(String(indexador).toLowerCase()) || null;
    } catch (_) {
      return null;
    }
  }
}

async function getManyByIndexadores(indexadores = []) {
  const all = await listPrompts();
  const map = indexBy(all);
  const out = {};
  for (const idx of indexadores) {
    const key = String(idx).toLowerCase();
    out[key] = map.get(key) || null;
  }
  return out;
}

const PromptsService = { listPrompts, getByIndexador, getManyByIndexadores };
export default PromptsService;
