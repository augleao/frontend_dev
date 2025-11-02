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
        maxPorArquivo: opts.maxPorArquivo,
        inclusaoPrimeiro: opts.inclusaoPrimeiro,
        // Flags de debug/eco (backend pode ignorar se não suportar)
        debugIA: opts.debugIA === true,
        echoPrompts: opts.echoPrompts === true,
        echoRespostas: opts.echoRespostas === true,
        promptMarker: opts.promptMarker || '[IA-PROMPT]',
        responseMarker: opts.responseMarker || '[IA-RESPONSE]',
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
    if (opts.maxPorArquivo != null) fd.append('maxPorArquivo', String(opts.maxPorArquivo));
    if (opts.inclusaoPrimeiro != null) fd.append('inclusaoPrimeiro', String(!!opts.inclusaoPrimeiro));
    // Flags de debug/eco (backend pode ignorar se não suportar)
    fd.append('debugIA', String(opts.debugIA === true));
    fd.append('echoPrompts', String(opts.echoPrompts === true));
    fd.append('echoRespostas', String(opts.echoRespostas === true));
    if (opts.promptMarker) fd.append('promptMarker', opts.promptMarker); else fd.append('promptMarker', '[IA-PROMPT]');
    if (opts.responseMarker) fd.append('responseMarker', opts.responseMarker); else fd.append('responseMarker', '[IA-RESPONSE]');
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
