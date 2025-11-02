import config from '../config';

async function withAuthFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  return res;
}

export default {
  async startFolderProcessing(folderPath) {
    const res = await withAuthFetch(`${config.apiURL}/leitura-livros/process-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath })
    });
    if (!res.ok) throw new Error('Falha ao iniciar processamento');
    return res.json();
  },
  async uploadFiles(files) {
    const fd = new FormData();
    files.forEach((f, i) => fd.append('files', f, f.name || `file${i}`));
    const res = await withAuthFetch(`${config.apiURL}/leitura-livros/upload`, {
      method: 'POST',
      body: fd
    });
    if (!res.ok) throw new Error('Falha ao enviar arquivos');
    return res.json();
  },
  async getStatus(jobId) {
    const res = await withAuthFetch(`${config.apiURL}/leitura-livros/status/${encodeURIComponent(jobId)}`);
    if (!res.ok) throw new Error('Falha ao consultar status');
    return res.json();
  },
  async getResult(jobId) {
    const res = await withAuthFetch(`${config.apiURL}/leitura-livros/result/${encodeURIComponent(jobId)}`);
    if (!res.ok) throw new Error('Falha ao obter resultado');
    return res.json();
  },
  async getResultXml(jobId) {
    const res = await withAuthFetch(`${config.apiURL}/leitura-livros/result/${encodeURIComponent(jobId)}/xml`);
    if (!res.ok) throw new Error('Falha ao obter XML');
    return res.blob();
  }
};
