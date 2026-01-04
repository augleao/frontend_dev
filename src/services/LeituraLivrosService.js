import config from '../config';

async function withAuthFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  return res;
}

export default {
  async startFolderProcessing(folderPath, opts = {}) {
    const res = await withAuthFetch(`${config.apiURL}/leitura-livros/process-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folderPath,
        versao: opts.versao,
        acao: opts.acao,
        cns: opts.cns,
        tipoRegistro: opts.tipoRegistro,
        inclusaoPrimeiro: opts.inclusaoPrimeiro,
        // Prompts de IA (indexadores e conteúdos)
        promptTipoEscritaIndexador: opts.promptTipoEscritaIndexador,
        promptTipoEscrita: opts.promptTipoEscrita,
        promptLeituraManuscritoIndexador: opts.promptLeituraManuscritoIndexador,
        promptLeituraManuscrito: opts.promptLeituraManuscrito,
        promptLeituraDigitadoIndexador: opts.promptLeituraDigitadoIndexador,
        promptLeituraDigitado: opts.promptLeituraDigitado
      })
    });
    if (!res.ok) throw new Error('Falha ao iniciar processamento');
    return res.json();
  },
  async uploadFiles(files, opts = {}) {
    const fd = new FormData();
    files.forEach((f, i) => fd.append('files', f, f.name || `file${i}`));
    if (opts.versao) fd.append('versao', opts.versao);
    if (opts.acao) fd.append('acao', opts.acao);
    if (opts.cns) fd.append('cns', opts.cns);
    if (opts.tipoRegistro) fd.append('tipoRegistro', opts.tipoRegistro);
    // maxPorArquivo removed — server defaults to 2500
    if (opts.inclusaoPrimeiro != null) fd.append('inclusaoPrimeiro', String(!!opts.inclusaoPrimeiro));
    if (opts.tipoEscrita) fd.append('tipoEscrita', opts.tipoEscrita);
    // Prompts de IA (indexadores e conteúdos)
    if (opts.promptTipoEscritaIndexador) fd.append('promptTipoEscritaIndexador', opts.promptTipoEscritaIndexador);
    if (opts.promptTipoEscrita) fd.append('promptTipoEscrita', opts.promptTipoEscrita);
    if (opts.promptLeituraManuscritoIndexador) fd.append('promptLeituraManuscritoIndexador', opts.promptLeituraManuscritoIndexador);
    if (opts.promptLeituraManuscrito) fd.append('promptLeituraManuscrito', opts.promptLeituraManuscrito);
    if (opts.promptLeituraDigitadoIndexador) fd.append('promptLeituraDigitadoIndexador', opts.promptLeituraDigitadoIndexador);
    if (opts.promptLeituraDigitado) fd.append('promptLeituraDigitado', opts.promptLeituraDigitado);
    const res = await withAuthFetch(`${config.apiURL}/leitura-livros/upload`, {
      method: 'POST',
      body: fd
    });
    if (!res.ok) throw new Error('Falha ao enviar arquivos');
    return res.json();
  },
  async extractP7s(files) {
    const fd = new FormData();
    files.forEach((f, i) => fd.append('files', f, f.name || `file${i}`));
    const res = await withAuthFetch(`${config.apiURL}/leitura-livros/extract-p7s`, {
      method: 'POST',
      body: fd
    });
    if (!res.ok) {
      let text = null;
      try { text = await res.text(); } catch (_) {}
      throw new Error(`Falha ao extrair payloads de .p7s (${res.status} ${res.statusText}): ${text ? text.slice(0,500) : ''}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    // fallback: return blob for binary responses plus debug text (first KB)
    const blob = await res.blob();
    let debugText = null;
    try { debugText = await blob.slice(0, 2048).text(); } catch (_) { debugText = null; }
    return { blob, contentType: ct, debugText };
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
  async getFullText(jobId) {
    const res = await withAuthFetch(`${config.apiURL}/leitura-livros/fulltext/${encodeURIComponent(jobId)}`);
    if (!res.ok) throw new Error('Falha ao baixar inteiro teor');
    return res.text();
  },
  async getFullTextByPath(downloadPath) {
    if (!downloadPath) throw new Error('Caminho de download inválido');
    const url = downloadPath.startsWith('http') ? downloadPath : `${config.apiURL}${downloadPath.startsWith('/') ? '' : '/'}${downloadPath}`;
    const res = await withAuthFetch(url);
    if (!res.ok) throw new Error('Falha ao baixar inteiro teor');
    return res.text();
  },
  // removed getResultXml: XML is now generated client-side from edited records
  
};
