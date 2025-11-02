import config from '../config';

async function withAuthFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  return res;
}

const ServentiaService = {
  async getMinhaServentiaCns() {
    const res = await withAuthFetch(`${config.apiURL}/minha-serventia-cns`);
    if (!res.ok) throw new Error(`Falha ao obter CNS (status ${res.status})`);
    // Aceita { cns } ou corpo vazio
    try {
      const data = await res.json();
      return data;
    } catch (_) {
      return {};
    }
  }
};

export default ServentiaService;
