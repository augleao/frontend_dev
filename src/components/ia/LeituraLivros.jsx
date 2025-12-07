import React, { useEffect, useRef, useState } from 'react';
import ServentiaService from '../../services/ServentiaService';
import LeituraLivrosService from '../../services/LeituraLivrosService';
import PromptsService from '../../services/PromptsService';
import { useNavigate } from 'react-router-dom';
import { identificarTipo } from '../servicos/IAWorkflowService';
import { apiURL } from '../../config';

function renderFormattedText(text) {
  if (!text) return null;
  // suporta tags tipo [title], [success], [error], [info], [warning]
  const parts = text.split(/(\[[a-z]+\])/i);
  return parts.map((p, i) => {
    const m = p.match(/^\[([a-z]+)\]$/i);
    if (m) {
      const tag = m[1].toLowerCase();
      const style = {
        title: { color: '#ff4d4f', fontWeight: 800 },
        success: { color: '#27ae60' },
        error: { color: '#e74c3c' },
        info: { color: '#3498db' },
        warning: { color: '#f39c12' }
      }[tag] || { color: '#999' };
      return <span key={i} style={style}>{`[${tag}]`}</span>;
    }
    return <span key={i} style={{ color: '#ccc' }}>{p}</span>;
  });
}

export default function LeituraLivros() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('upload'); // 'folder' or 'upload', padrão: upload
  const [folderPath, setFolderPath] = useState('');
  const [files, setFiles] = useState([]);
  // const extractInputRef = useRef(null);
  const [extractedFiles, setExtractedFiles] = useState([]); // { filename, blob, contentType }
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [consoleLines, setConsoleLines] = useState([]);
  const consoleRef = useRef(null);
  const consoleBlockRef = useRef(null);
  const [jobId, setJobId] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [showRawResults, setShowRawResults] = useState(false);
  const pollRef = useRef(null);
  const didMountTestRef = useRef(false);
  const lastProgressRef = useRef(0);
  const lastStatusRef = useRef('');
  const jobStartTimeRef = useRef(null);
  const lastMsgIndexRef = useRef(0);
  const rowRef = useRef(null);
  const [rightColOffset, setRightColOffset] = useState(0);
  // Gap entre os dois cards superiores (Parâmetros e Modo)
  const headerRowGap = 14; // ajuste único: widths calculadas usam este valor para somar 100%
  // Parâmetros CRC Nacional
  const [versao, setVersao] = useState('2.6');
  const [acao, setAcao] = useState('CARGA'); // por ora apenas CARGA
  const [cns, setCns] = useState('');
  const [tipoRegistro, setTipoRegistro] = useState('NASCIMENTO'); // NASCIMENTO | CASAMENTO | OBITO
  const [maxPorArquivo, setMaxPorArquivo] = useState(2500);
  const [numeroLivro, setNumeroLivro] = useState('');

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleLines]);

  // Mantém a coluna direita (Resumo/Registros) alinhada pelo topo do Console
  useEffect(() => {
    const recompute = () => {
      try {
        const row = rowRef.current;
        const block = consoleBlockRef.current;
        if (!row || !block) return;
        const rowTop = row.getBoundingClientRect().top + window.pageYOffset;
        const consoleTop = block.getBoundingClientRect().top + window.pageYOffset;
        const delta = Math.max(0, Math.round(consoleTop - rowTop));
        setRightColOffset(delta);
      } catch (_) {}
    };
    const raf = requestAnimationFrame(recompute);
    window.addEventListener('resize', recompute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', recompute);
    };
  }, [mode, versao, acao, tipoRegistro, maxPorArquivo, folderPath, files.length]);

  function pushConsole(line) {
    setConsoleLines(prev => [...prev, typeof line === 'string' ? line : JSON.stringify(line)]);
  }

  function clearConsole() {
    setConsoleLines([]);
  }

  // Handler para extrair imagens de arquivos .p7s via backend
  async function handleExtractP7s(filesList) {
    try {
      const arr = Array.from(filesList || []);
      if (!arr.length) return;
      logTitle('Extrair Imagens (.p7s)');
      logInfo(`Enviando ${arr.length} arquivo(s) para extração...`);
      const resp = await LeituraLivrosService.extractP7s(arr);
      // resposta pode ser { blob } ou JSON
      const filesToShow = [];
      if (resp && resp.blob) {
        // único blob retornado (assume payload único)
        const ct = resp.contentType || 'application/octet-stream';
        const filename = 'payload' + extFromContentType(ct);
        filesToShow.push({ filename, blob: resp.blob, contentType: ct });
      } else if (resp && Array.isArray(resp)) {
        for (let i = 0; i < resp.length; i++) {
          const it = resp[i];
          if (it && it.buffer && it.buffer.data) {
            const u8 = new Uint8Array(it.buffer.data);
            const blob = new Blob([u8], { type: it.contentType || '' });
            filesToShow.push({ filename: it.filename || `payload_${i + 1}` + extFromContentType(it.contentType), blob, contentType: it.contentType || '' });
            continue;
          }
          if (it && it.base64) {
            const bin = atob(it.base64);
            const len = bin.length;
            const u8 = new Uint8Array(len);
            for (let j = 0; j < len; j++) u8[j] = bin.charCodeAt(j);
            const blob = new Blob([u8], { type: it.contentType || '' });
            filesToShow.push({ filename: it.filename || `payload_${i + 1}` + extFromContentType(it.contentType), blob, contentType: it.contentType || '' });
            continue;
          }
          logWarning(`Resposta inesperada para item ${i}: ${JSON.stringify(it).slice(0,200)}`);
        }
      } else if (resp && typeof resp === 'object') {
        const it = resp;
        if (it.buffer && it.buffer.data) {
          const u8 = new Uint8Array(it.buffer.data);
          const blob = new Blob([u8], { type: it.contentType || '' });
          filesToShow.push({ filename: it.filename || 'payload' + extFromContentType(it.contentType), blob, contentType: it.contentType || '' });
        } else if (it.base64) {
          const bin = atob(it.base64);
          const len = bin.length;
          const u8 = new Uint8Array(len);
          for (let j = 0; j < len; j++) u8[j] = bin.charCodeAt(j);
          const blob = new Blob([u8], { type: it.contentType || '' });
          filesToShow.push({ filename: it.filename || 'payload' + extFromContentType(it.contentType), blob, contentType: it.contentType || '' });
        }
      }
      if (filesToShow.length) {
        setExtractedFiles(filesToShow);
        setShowExtractModal(true);
        logSuccess(`Extraídos ${filesToShow.length} arquivo(s). Escolha o destino para salvar.`);
      } else {
        // Se o serviço retornou debugText (blob->text), logue para diagnóstico
        if (resp && resp.debugText) {
          logWarning('Resposta de extração não continha payloads reconhecíveis. Debug: ' + String(resp.debugText).slice(0,1000));
        } else {
          logWarning('Resposta de extração não continha payloads reconhecíveis.');
        }
      }
    } catch (e) {
      logError('Falha ao extrair .p7s: ' + (e.message || e));
    }
  }

  function extFromContentType(ct) {
    if (!ct) return '';
    if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
    if (ct.includes('png')) return '.png';
    if (ct.includes('tiff') || ct.includes('tif')) return '.tif';
    if (ct.includes('pdf')) return '.pdf';
    return '';
  }

  // Helpers para mapear campos dos registros extraídos para colunas da tabela
  function getField(record, keys) {
    if (!record) return '';
    // procura nas chaves fornecidas no objeto raiz e também em record.campos (caso o backend retorne assim)
    for (const k of keys) {
      if (!k) continue;
      // 1) direto no registro
      let v = record[k];
      // 2) procurar em record.campos (com chaves originais e em maiúsculas)
      if ((v === undefined || v === null || String(v).toString().trim() === '') && record.campos) {
        v = record.campos[k] ?? record.campos[String(k).toUpperCase()];
      }
      // 3) tentar chave maiúscula no objeto raiz (alguns registros vêm com chaves em MAIÚSCULAS)
      if ((v === undefined || v === null || String(v).toString().trim() === '') && typeof k === 'string') {
        v = record[String(k).toUpperCase()];
      }
      if (v !== undefined && v !== null && String(v).toString().trim() !== '') return v;
    }
    // como fallback, se record.campos existir, tente algumas chaves comuns em MAIÚSCULAS
    if (record.campos && typeof record.campos === 'object') {
      const common = ['NOMEREGISTRADO', 'DATAREGISTRO', 'DATANASCIMENTO', 'SEXO'];
      for (const c of common) {
        if (record.campos[c]) return record.campos[c];
      }
    }
    return '';
  }

  function getFiliacao(record, idx) {
    if (!record) return '';
    // 1) array 'filiacao' ou 'filiacoes'
    const arr = record.filiacao || record.filiacoes;
    if (Array.isArray(arr) && arr[idx]) {
      const f = arr[idx];
      if (typeof f === 'string') return f;
      if (f && (f.NOME || f.nome || f.name)) return f.NOME || f.nome || f.name;
    }
    // 2) campos dentro de record.campos (ex.: PAI, MAE, FILIACAO1)
    if (record.campos && typeof record.campos === 'object') {
      if (idx === 0) return record.campos['PAI'] || record.campos['FILIACAO1'] || record.campos['FILIACAO_1'] || '';
      return record.campos['MAE'] || record.campos['FILIACAO2'] || record.campos['FILIACAO_2'] || '';
    }
    // 3) alternativas no topo do objeto
    if (idx === 0) return record.filiacao1 || record.filiacao_1 || record.pai || record.mae || '';
    return record.filiacao2 || record.filiacao_2 || record.mae || record.pai || '';
  }

  // Busca restrita para campos que não devem ter fallback (Livro, Folha, Termo)
  function getExactField(record, keys) {
    if (!record) return '';
    for (const k of keys) {
      if (!k) continue;
      // check root
      if (record[k] !== undefined && record[k] !== null && String(record[k]).trim() !== '') return record[k];
      // check uppercase variant on root
      if (typeof k === 'string' && record[String(k).toUpperCase()] !== undefined && record[String(k).toUpperCase()] !== null && String(record[String(k).toUpperCase()]).trim() !== '') return record[String(k).toUpperCase()];
      // check record.campos exact key and uppercase
      if (record.campos) {
        if (record.campos[k] !== undefined && record.campos[k] !== null && String(record.campos[k]).trim() !== '') return record.campos[k];
        if (typeof k === 'string' && record.campos[String(k).toUpperCase()] !== undefined && record.campos[String(k).toUpperCase()] !== null && String(record.campos[String(k).toUpperCase()]).trim() !== '') return record.campos[String(k).toUpperCase()];
      }
    }
    return '';
  }

  // Atualiza um campo editável do registro em results
  function updateRecordField(idx, fieldId, value) {
    setResults(prev => {
      const copy = Array.isArray(prev) ? [...prev] : [];
      const rec = Object.assign({}, copy[idx] || {});
      // normalize campos object
      if (!rec.campos || typeof rec.campos !== 'object') rec.campos = rec.campos || {};
      switch (fieldId) {
        case 'livro':
          // prefer guardar em rec.campos em maiúscula
          rec.campos['LIVRO'] = value;
          break;
        case 'folha':
          rec.campos['FOLHA'] = value;
          break;
        case 'termo':
          rec.campos['TERMO'] = value;
          break;
        case 'dataRegistro':
          rec.campos['DATAREGISTRO'] = value;
          break;
        case 'nome':
          rec.campos['NOMEREGISTRADO'] = value;
          break;
        case 'sexo':
          rec.campos['SEXO'] = value;
          break;
        case 'dataNascimento':
          rec.campos['DATANASCIMENTO'] = value;
          break;
        case 'filiacao1':
          if (!Array.isArray(rec.filiacao)) rec.filiacao = [{ NOME: '' }, { NOME: '' }];
          if (!rec.filiacao[0]) rec.filiacao[0] = { NOME: '' };
          if (typeof rec.filiacao[0] === 'string') rec.filiacao[0] = { NOME: rec.filiacao[0] };
          rec.filiacao[0].NOME = value;
          break;
        case 'filiacao2':
          if (!Array.isArray(rec.filiacao)) rec.filiacao = [{ NOME: '' }, { NOME: '' }];
          if (!rec.filiacao[1]) rec.filiacao[1] = { NOME: '' };
          if (typeof rec.filiacao[1] === 'string') rec.filiacao[1] = { NOME: rec.filiacao[1] };
          rec.filiacao[1].NOME = value;
          break;
        default:
          // noop
      }
      copy[idx] = rec;
      return copy;
    });
  }

  function escapeXml(s) {
    if (s === undefined || s === null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function serializeResultsToXml(arr) {
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<REGISTROS>'];
    (arr || []).forEach((r) => {
      lines.push('  <REGISTRO>');
      if (r.matricula) {
        lines.push(`    <MATRICULA>${escapeXml(r.matricula)}</MATRICULA>`);
      }
      lines.push(`    <TIPO>${escapeXml(r.tipo || '')}</TIPO>`);
      const livro = getExactField(r, ['numeroLivro', 'numero_livro', 'livro', 'LIVRO', 'NROLIVRO', 'NUM_LIVRO', 'NUMEROLIVRO']);
      const folha = getExactField(r, ['numeroFolha', 'folha', 'page', 'FOLHA', 'NRO_FOLHA', 'NUM_FOLHA']);
      const termo = getExactField(r, ['numeroTermo', 'termo', 'term', 'TERMO', 'NRO_TERMO', 'NUM_TERMO', 'ATO']);
      lines.push(`    <LIVRO>${escapeXml(livro)}</LIVRO>`);
      lines.push(`    <FOLHA>${escapeXml(folha)}</FOLHA>`);
      lines.push(`    <TERMO>${escapeXml(termo)}</TERMO>`);
      const dataReg = getField(r, ['dataRegistro', 'data', 'registroData', 'date']);
      lines.push(`    <DATAREGISTRO>${escapeXml(dataReg)}</DATAREGISTRO>`);
      const nome = getField(r, ['nome', 'name', 'registrado']);
      lines.push(`    <NOMEREGISTRADO>${escapeXml(nome)}</NOMEREGISTRADO>`);
      const sexo = getField(r, ['sexo', 'sex', 'genero']);
      lines.push(`    <SEXO>${escapeXml(sexo)}</SEXO>`);
      const nasc = getField(r, ['dataNascimento', 'nascimento', 'birthDate', 'datanascimento']);
      lines.push(`    <DATANASCIMENTO>${escapeXml(nasc)}</DATANASCIMENTO>`);
      const f1 = getFiliacao(r, 0);
      const f2 = getFiliacao(r, 1);
      lines.push(`    <FILIACAO1>${escapeXml(f1)}</FILIACAO1>`);
      lines.push(`    <FILIACAO2>${escapeXml(f2)}</FILIACAO2>`);
      // include origens if present
      if (Array.isArray(r.origens) && r.origens.length) {
        lines.push('    <ORIGENS>');
        r.origens.forEach(o => lines.push(`      <ORIGEM>${escapeXml(o)}</ORIGEM>`));
        lines.push('    </ORIGENS>');
      }
      lines.push('  </REGISTRO>');
    });
    lines.push('</REGISTROS>');
    return lines.join('\n');
  }

  async function handleSaveChangesAsXml() {
    try {
      // Before generating XML, request matriculas from backend for each record
      const toSend = (results || []).map((r) => {
        const livro = getExactField(r, ['numeroLivro', 'numero_livro', 'livro', 'LIVRO', 'NROLIVRO', 'NUM_LIVRO', 'NUMEROLIVRO']);
        const folha = getExactField(r, ['numeroFolha', 'folha', 'page', 'FOLHA', 'NRO_FOLHA', 'NUM_FOLHA']);
        const termo = getExactField(r, ['numeroTermo', 'termo', 'term', 'TERMO', 'NRO_TERMO', 'NUM_TERMO', 'ATO']);
        // extract year from dataRegistro if possible
        let dataReg = getField(r, ['dataRegistro', 'data', 'registroData', 'date']);
        let ano = '';
        try {
          if (dataReg) {
            const d = new Date(dataReg);
            if (!Number.isNaN(d.getFullYear())) ano = String(d.getFullYear());
            else {
              const m = String(dataReg).match(/(\d{4})/);
              if (m) ano = m[1];
            }
          }
        } catch (_) { }

        // map tipoRegistro textual to numeric tipoLivro code. Adjust mapping as needed.
        const tipoMap = { 'NASCIMENTO': '01', 'CASAMENTO': '02', 'OBITO': '03' };
        const tipoLivroCode = tipoMap[String(tipoRegistro || '').toUpperCase()] || '00';

        return {
          cns: String(cns || ''),
          acervo: '00',
          servico: '00',
          ano: ano || String(new Date().getFullYear()),
          tipoLivro: tipoLivroCode,
          livro: livro || String(numeroLivro || ''),
          folha: folha || '',
          termo: termo || ''
        };
      });

      let enriched = Array.isArray(results) ? [...results] : [];
      if (toSend.length) {
        try {
          logInfo('Solicitando matrícula(s) ao backend...');
          const resp = await fetch('/api/matriculas/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ records: toSend })
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data && Array.isArray(data.results)) {
              data.results.forEach((rRes, idx) => {
                if (rRes && rRes.matricula) {
                  if (!enriched[idx]) enriched[idx] = {};
                  enriched[idx].matricula = rRes.matricula;
                }
              });
              logSuccess(`Recebidas ${data.results.filter(it => it && it.matricula).length} matriculas do backend.`);
            } else if (data && data.result && data.result.matricula) {
              // single-result response
              if (!enriched[0]) enriched[0] = {};
              enriched[0].matricula = data.result.matricula;
              logSuccess('Matrícula recebida do backend.');
            } else {
              logWarning('Resposta inesperada do backend de matriculas (sem resultados). Gerando XML sem matriculas.');
            }
          } else {
            const text = await resp.text().catch(() => '');
            logWarning('Falha ao obter matriculas: ' + resp.status + ' ' + text);
          }
        } catch (e) {
          logWarning('Erro ao chamar /api/matriculas/generate: ' + (e.message || e));
        }
      }

      const xml = serializeResultsToXml(enriched || results || []);
      const blob = new Blob([xml], { type: 'application/xml' });
      const filename = `crc_alterado_${jobId || 'manual'}_${Date.now()}.xml`;
      downloadBlobAs(blob, filename);
      logSuccess('XML gerado e download iniciado.');
    } catch (e) {
      logError('Falha ao gerar XML: ' + (e.message || e));
    }
  }

  function downloadBlobAs(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  function handleDownloadSingle(idx) {
    const it = extractedFiles[idx];
    if (!it) return;
    downloadBlobAs(it.blob, it.filename);
    logSuccess(`Iniciado download: ${it.filename}`);
  }

  async function handleDownloadAll() {
    for (let i = 0; i < extractedFiles.length; i++) {
      handleDownloadSingle(i);
      await sleep(200); // pequeno espaçamento para não travar alguns navegadores
    }
    setShowExtractModal(false);
  }

  // Escolher pasta local (File System Access API) e salvar arquivos lá. Fallback: downloads individuais.
  async function handleChooseFolderAndSave() {
    if (!extractedFiles.length) return;
    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        for (const f of extractedFiles) {
          try {
            const fileHandle = await dirHandle.getFileHandle(f.filename, { create: true });
            const writable = await fileHandle.createWritable();
            // write as ArrayBuffer
            const arrayBuf = await f.blob.arrayBuffer();
            await writable.write(arrayBuf);
            await writable.close();
            logSuccess(`Salvo: ${f.filename}`);
          } catch (e) {
            logWarning(`Falha ao salvar ${f.filename}: ${e.message || e}`);
          }
        }
        setShowExtractModal(false);
      } catch (e) {
        logWarning('Operação de escolha de pasta cancelada ou não permitida.');
      }
    } else {
      // fallback para navegadores sem File System Access API
      logWarning('API de pastas não suportada pelo navegador; iniciando downloads individuais.');
      await handleDownloadAll();
    }
  }

  // Utils para controle de tempo
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const withTimeout = (promise, ms, label = '') => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout após ${ms}ms${label ? ` em ${label}` : ''}`)), ms);
    });
    return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
  };

  // Helpers de log com horário e níveis
  const nowHHMMSS = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const logInfo = (msg) => pushConsole(`[info] ${nowHHMMSS()} - ${msg}`);
  const logTitle = (msg) => pushConsole(`[title] ${msg}`);
  const logSuccess = (msg) => pushConsole(`[success] ${nowHHMMSS()} - ${msg}`);
  const logWarning = (msg) => pushConsole(`[warning] ${nowHHMMSS()} - ${msg}`);
  const logError = (msg) => pushConsole(`[error] ${nowHHMMSS()} - ${msg}`);

  // Exibir prompt no momento do envio ao backend (com truncamento seguro)
  const logPromptSend = (label, text) => {
    if (!text || typeof text !== 'string') return;
    const maxChars = 4000;
    const preview = text.length > maxChars
      ? `${text.slice(0, maxChars)}\n[warning] ... (prompt truncado; ${text.length - maxChars} caracteres ocultos) [/warning]`
      : text;
    logTitle(label);
    pushConsole(preview);
  };

  // Pré-teste simples do agente de IA na montagem da tela (não bloqueante)
  useEffect(() => {
    if (didMountTestRef.current) return;
    didMountTestRef.current = true;

    (async () => {
      try {
        logTitle('Checando disponibilidade do agente de IA');
        const maxTentativas = 2;
        let ok = false;
        for (let i = 1; i <= maxTentativas; i++) {
          try {
            logInfo(`Tentativa ${i}/${maxTentativas}...`);
            const resp = await withTimeout(
              identificarTipo('Ping do leitor de livros na abertura da tela.'),
              8000,
              'teste on-mount'
            );
            if (resp && typeof resp === 'object') {
              ok = true;
              break;
            }
            throw new Error('Resposta inválida no teste on-mount.');
          } catch (err) {
            logWarning(`⚠ Falha no teste on-mount: ${err.message}`);
            if (i < maxTentativas) await sleep(800);
          }
        }
        if (ok) {
          logSuccess('✓ Agente online');
          // Fetch provider health to show the resolved model name (agent) used
          (async () => {
            try {
              const h = await fetch(`${apiURL}/ia/health`);
              if (h.ok) {
                const jd = await h.json();
                const modelName = jd && (jd.resolvedModel || jd.provider) ? (jd.resolvedModel || jd.provider) : null;
                if (modelName) logInfo(`Agente IA: ${modelName}`);
              }
            } catch (_) {
              // ignore health fetch errors
            }
          })();
        } else {
          logWarning('⚠ Agente possivelmente indisponível. Tente reenviar ou verificar conexão.');
        }
      } catch (e) {
        // Falha silenciosa: apenas informa no console visual
        logWarning(`⚠ Erro ao executar pré-teste on-mount: ${e.message}`);
      }
    })();
  }, []);

  // Prefill CNS: tenta rota backend /minha-serventia-cns, cai para localStorage se não houver
  useEffect(() => {
    (async () => {
      // 1) Tenta backend se disponível
      try {
        const data = await ServentiaService.getMinhaServentiaCns();
        if (data && data.cns) {
          setCns(String(data.cns));
          logSuccess(`CNS detectado automaticamente: ${data.cns}`);
          return;
        }
      } catch (e) {
        // Silencioso se rota ainda não existir (404) ou sem auth
      }
      // 2) Fallback: localStorage
      try {
        const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || '{}');
        const localCns = usuarioLocal?.cns || usuarioLocal?.serventiaCns || usuarioLocal?.serventia_cns;
        if (localCns) {
          setCns(String(localCns));
          logSuccess(`CNS detectado do perfil local: ${localCns}`);
        } else {
          logInfo('CNS não presente; informe manualmente.');
        }
      } catch (_) {
        // silencioso
      }
    })();
  }, []);

  // Limpa polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function startProcessing() {
    // Ao iniciar, rola a tela para centralizar o console/terminal na viewport (método robusto)
    try {
      const el = consoleRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const elHeight = rect.height || el.offsetHeight || 0;
        const absoluteTop = rect.top + window.pageYOffset;
        const targetTop = Math.max(0, absoluteTop - (window.innerHeight / 2) + (elHeight / 2));
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    } catch (e) {
      // Fallback discreto caso window.scrollTo não esteja disponível
      try {
        if (consoleRef.current && typeof consoleRef.current.scrollIntoView === 'function') {
          consoleRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
      } catch (_) {}
    }

    setResults([]);
    setConsoleLines([]);
    setRunning(true);
    setProgress(0);
    lastProgressRef.current = 0;
    lastStatusRef.current = '';
    lastMsgIndexRef.current = 0;
    jobStartTimeRef.current = new Date();
    try {
      if (!cns.trim()) { logError('Informe o CNS do cartório.'); setRunning(false); return; }
      if (!versao.trim()) { logError('Informe a VERSAO do XML.'); setRunning(false); return; }
      if (!acao.trim()) { logError('Informe a ACAO (ex.: CARGA).'); setRunning(false); return; }
      logTitle('Preparando processamento para CRC Nacional');
      logInfo(`Parâmetros: VERSAO=${versao}, ACAO=${acao}, CNS=${cns}, TIPO=${tipoRegistro}, MAX_POR_ARQUIVO=${maxPorArquivo}`);
      logInfo('O XML será gerado com tags em MAIÚSCULAS, Inclusões antes de Alterações, e grupos FILIACAONASCIMENTO e DOCUMENTOS agrupados.');
      let resp;
      if (mode === 'folder') {
        if (!folderPath.trim()) { logError('Informe o caminho da pasta no servidor.'); setRunning(false); return; }
        logInfo(`Solicitando processamento da pasta: ${folderPath}`);
        // Busca prompts (mesma lógica do Assistente, via /ia/prompts)
        logInfo('Carregando prompts de IA: tipo_escrita, leitura_manuscrito, leitura_digitado...');
        const pMap = await PromptsService.getManyByIndexadores(['tipo_escrita', 'leitura_manuscrito', 'leitura_digitado']);
        const pTipo = pMap['tipo_escrita'];
        const pManu = pMap['leitura_manuscrito'];
        const pDigi = pMap['leitura_digitado'];
        if (!pTipo) logWarning('Prompt tipo_escrita não encontrado.'); else logSuccess('Prompt tipo_escrita OK');
        if (!pManu) logWarning('Prompt leitura_manuscrito não encontrado.'); else logSuccess('Prompt leitura_manuscrito OK');
        if (!pDigi) logWarning('Prompt leitura_digitado não encontrado.'); else logSuccess('Prompt leitura_digitado OK');

  // Note: do not show the IA prompt content in the console for privacy/security

        resp = await LeituraLivrosService.startFolderProcessing(folderPath.trim(), {
          versao, acao, cns, tipoRegistro, maxPorArquivo, inclusaoPrimeiro: true,
          promptTipoEscritaIndexador: 'tipo_escrita',
          promptTipoEscrita: pTipo?.prompt || ''
        });
      } else {
        if (!files || files.length === 0) { logError('Selecione arquivos para upload.'); setRunning(false); return; }
        logInfo(`Enviando ${files.length} arquivo(s) para processamento...`);
        let totalSize = 0;
        files.forEach((f, idx) => {
          totalSize += f.size || 0;
          const kb = f.size != null ? `${Math.round(f.size / 1024)}KB` : 'tamanho n/d';
          logInfo(`Arquivo ${idx + 1}: ${f.name} (${kb}, ${f.type || 'tipo n/d'})`);
        });
        if (totalSize > 0) {
          const mb = (totalSize / (1024 * 1024)).toFixed(2);
          logInfo(`Tamanho total do upload: ${mb}MB`);
        }
        // Busca prompts (mesma lógica do Assistente, via /ia/prompts)
        logInfo('Carregando prompts de IA: tipo_escrita, leitura_manuscrito, leitura_digitado...');
        const pMap = await PromptsService.getManyByIndexadores(['tipo_escrita', 'leitura_manuscrito', 'leitura_digitado']);
        const pTipo = pMap['tipo_escrita'];
        const pManu = pMap['leitura_manuscrito'];
        const pDigi = pMap['leitura_digitado'];
        if (!pTipo) logWarning('Prompt tipo_escrita não encontrado.'); else logSuccess('Prompt tipo_escrita OK');
        if (!pManu) logWarning('Prompt leitura_manuscrito não encontrado.'); else logSuccess('Prompt leitura_manuscrito OK');
        if (!pDigi) logWarning('Prompt leitura_digitado não encontrado.'); else logSuccess('Prompt leitura_digitado OK');

        // Deixa a classificação manuscrito/digitado a cargo do backend usando o prompt tipo_escrita.
        logInfo('Classificação manuscrito/digitado será executada no backend com base no prompt tipo_escrita.');

  // Note: do not show the IA prompt content in the console for privacy/security

        resp = await LeituraLivrosService.uploadFiles(files, {
          versao, acao, cns, tipoRegistro, maxPorArquivo, inclusaoPrimeiro: true,
          promptTipoEscritaIndexador: 'tipo_escrita',
          promptTipoEscrita: pTipo?.prompt || ''
        });
      }
      if (!resp || !resp.jobId) {
        logError('Falha ao iniciar o processamento (resposta inválida).');
        setRunning(false);
        return;
      }
      setJobId(resp.jobId);
      logTitle(`Job iniciado: ${resp.jobId}`);
      // comece a pollar
      pollRef.current = setInterval(async () => {
        try {
          const status = await LeituraLivrosService.getStatus(resp.jobId);
          if (status) {
            // Mensagens incrementais do backend (evita duplicar em cada poll)
            if (Array.isArray(status.messages) && status.messages.length) {
              const startIdx = Math.max(0, lastMsgIndexRef.current);
              for (let i = startIdx; i < status.messages.length; i++) {
                pushConsole(status.messages[i]);
              }
              lastMsgIndexRef.current = status.messages.length;
            }

            const newProgress = status.progress || 0;
            setProgress(newProgress);

            // Log de mudança de status
            if (status.status && status.status !== lastStatusRef.current) {
              logInfo(`Status: ${status.status}` + (status.phase ? ` | Fase: ${status.phase}` : '') + (status.currentFile ? ` | Arquivo: ${status.currentFile}` : ''));
              lastStatusRef.current = status.status;
            }

            // Log quando progresso avança
            if (newProgress > lastProgressRef.current) {
              const elapsedMs = jobStartTimeRef.current ? (Date.now() - jobStartTimeRef.current.getTime()) : 0;
              const eta = (newProgress > 0) ? Math.max(0, (elapsedMs * (100 - newProgress)) / newProgress) : 0;
              const fmt = (ms) => {
                const s = Math.round(ms / 1000);
                const m = Math.floor(s / 60); const ss = s % 60;
                return `${m}m${String(ss).padStart(2, '0')}s`;
              };
              let extra = ` (decorrido: ${fmt(elapsedMs)}`;
              if (newProgress > 0) extra += `, ETA: ${fmt(eta)}`;
              extra += ')';
              const counts = (status.processed != null && status.total != null) ? ` | Itens: ${status.processed}/${status.total}` : '';
              logInfo(`Progresso: ${newProgress}%${counts}${extra}`);
              lastProgressRef.current = newProgress;
            }

            if (status.status === 'done') {
              clearInterval(pollRef.current);
              setRunning(false);
              logSuccess('Processamento concluído. Buscando resultados...');
              const res = await LeituraLivrosService.getResult(resp.jobId);
              setResults(res.records || res || []);
              const count = (res?.records && Array.isArray(res.records)) ? res.records.length : (Array.isArray(res) ? res.length : 0);
              logTitle(`Resultados carregados (${count}).`);
            } else if (status.status === 'failed') {
              clearInterval(pollRef.current);
              setRunning(false);
              const msg = status.error || 'Processamento falhou.';
              logError(msg);
            }
          }
        } catch (e) {
          logWarning('Erro ao consultar status do job.');
        }
      }, 2000);
    } catch (e) {
      logError('Erro ao iniciar processamento: ' + (e.message || e));
      setRunning(false);
    }
  }

  async function handleDownloadXml() {
    if (!jobId) return;
    try {
      logInfo('Solicitando download do XML...');
      const blob = await LeituraLivrosService.getResultXml(jobId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const tipo = (tipoRegistro || 'REGISTRO').toLowerCase();
      a.download = `crc_${tipo}_${acao.toLowerCase()}_${jobId}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      logSuccess('XML baixado com sucesso.');
    } catch (e) {
      logError('Falha ao baixar XML: ' + (e.message || e));
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: 24, fontFamily: 'Inter, Arial, sans-serif', background: 'linear-gradient(180deg,#f5f7fb 0%, #eef1f6 100%)' }}>
      {/* Header */}
      {/* Cabeçalho removido: título 'Leitura de Livros de Registro' */}

      {/* Modal: escolher destino para arquivos extraídos */}
      {showExtractModal && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ width: '720px', maxWidth: '95%', background: '#fff', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800 }}>Salvar arquivos extraídos</div>
              <button onClick={() => setShowExtractModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ maxHeight: '50vh', overflow: 'auto', marginBottom: 12 }}>
              {extractedFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 40, height: 28, background: '#f8fafc', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#64748b' }}>{f.contentType ? f.contentType.split('/')[1] : 'bin'}</div>
                    <div style={{ fontSize: 14, color: '#0f172a' }}>{f.filename}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleDownloadSingle(i)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', cursor: 'pointer' }}>Salvar</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowExtractModal(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }}>Fechar</button>
              <button onClick={handleChooseFolderAndSave} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#059669,#10b981)', color: '#fff' }}>Escolher pasta e salvar</button>
              <button onClick={handleDownloadAll} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff' }}>Download todos</button>
            </div>
          </div>
        </div>
      )}

  {/* Parâmetros + Modo agora ocupam 50% da página cada, acima das colunas */}
  <div style={{ display: 'flex', gap: headerRowGap, alignItems: 'stretch', flexWrap: 'wrap', marginBottom: 14 }}>
    {/* Parâmetros da Carga CRC */}
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(6, minmax(110px, 1fr))', gap: 10,
      background: '#ffffff', padding: 16, borderRadius: 16,
      boxShadow: '0 10px 26px rgba(32,50,73,0.08)',
      flex: '1 1 0', width: `calc((100% - ${headerRowGap}px)/2)`, minWidth: 320, maxWidth: '100%'
    }}>
    {/* Campo VERSAO removido conforme solicitado */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>ACAO</label>
      <select value={acao} onChange={e => setAcao(e.target.value)}
        style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14 }}>
        <option value="CARGA">CARGA</option>
      </select>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>CNS</label>
      <div
        title="Valor preenchido automaticamente a partir do cadastro da serventia"
        style={{
          border: '1.5px solid #d0d7de',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 14,
          background: '#f9fafb',
          color: '#111827',
          fontWeight: 700,
          // Removido minHeight para igualar altura aos selects/inputs
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {cns ? String(cns) : '—'}
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>TIPO</label>
      <select value={tipoRegistro} onChange={e => setTipoRegistro(e.target.value)}
        style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14 }}>
        <option value="NASCIMENTO">NASCIMENTO</option>
        <option value="CASAMENTO">CASAMENTO</option>
        <option value="OBITO">ÓBITO</option>
      </select>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>MAX/ARQUIVO</label>
      <input type="number" min={1} value={maxPorArquivo}
        onChange={e => setMaxPorArquivo(Number(e.target.value || 2500))}
        style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14 }} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>Nº do LIVRO</label>
      <input type="text" inputMode="numeric" pattern="[0-9]*" value={numeroLivro}
        onChange={e => setNumeroLivro(String(e.target.value || '').replace(/\D/g, ''))}
        placeholder="somente números"
        style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14 }} />
    </div>
    </div>

    {/* Mode selector & actions */}
    <div style={{ background: '#ffffff', borderRadius: 16, padding: 16, boxShadow: '0 10px 26px rgba(32,50,73,0.08)', flex: '1 1 0', width: `calc((100% - ${headerRowGap}px)/2)`, minWidth: 260, maxWidth: '100%' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 800, color: '#1f2937', fontSize: 13 }}>Modo</span>
        <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
          <button onClick={() => setMode('folder')} disabled={mode === 'folder'}
            style={{
              padding: '8px 14px', borderRadius: 10, border: 'none', cursor: mode === 'folder' ? 'default' : 'pointer',
              background: mode === 'folder' ? '#ffffff' : 'transparent', color: mode === 'folder' ? '#111827' : '#64748b', fontWeight: 700
            }}>Pasta no servidor</button>
          <button onClick={() => setMode('upload')} disabled={mode === 'upload'}
            style={{
              padding: '8px 14px', borderRadius: 10, border: 'none', cursor: mode === 'upload' ? 'default' : 'pointer',
              background: mode === 'upload' ? '#ffffff' : 'transparent', color: mode === 'upload' ? '#111827' : '#64748b', fontWeight: 700
            }}>Upload de arquivos</button>
        </div>
      </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={clearConsole}
            style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#374151', padding: '8px 12px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Limpar console</button>
          <button onClick={() => handleExtractP7s(files)} disabled={running || files.length === 0}
            title={files.length === 0 ? 'Selecione arquivos primeiro' : 'Extrair imagens dos arquivos selecionados'}
            style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#374151', padding: '8px 12px', borderRadius: 10, fontWeight: 700, cursor: running || files.length === 0 ? 'not-allowed' : 'pointer' }}>Extrair Imagem</button>
        <button onClick={startProcessing} disabled={running || (mode === 'upload' && files.length === 0)}
          style={{ background: running ? '#94a3b8' : 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff',
            border: 'none', padding: '10px 16px', borderRadius: 10, fontWeight: 800, cursor: running ? 'not-allowed' : 'pointer' }}>
          {running ? 'Processando…' : (mode === 'folder' ? 'Iniciar' : 'Enviar e Processar')}
        </button>
      </div>
    </div>

    {mode === 'folder' ? (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="text" placeholder="Caminho da pasta no servidor (ex: /data/livros)" value={folderPath}
          onChange={e => setFolderPath(e.target.value)}
          style={{ flex: 1, border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14 }} />
      </div>
    ) : (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{
          flex: 1, border: '2px dashed #cbd5e1', borderRadius: 12, padding: 16, textAlign: 'center', color: '#475569',
          background: '#f8fafc'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Selecione arquivos</div>
          <div style={{ fontSize: 12, marginBottom: 12 }}>Imagens (jpg, png, tif), PDFs e .p7s assinados</div>
          <input
            type="file"
            multiple
            accept="image/*,.p7s,application/pdf"
            title="Aceita imagens (jpg, png, tif...), PDFs e arquivos .p7s"
            onChange={e => setFiles(Array.from(e.target.files || []))}
          />
        </div>
      </div>
    )}
    </div>
  </div>

  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Console (full width) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#0b1220', borderRadius: 16, boxShadow: '0 16px 36px rgba(2,6,23,0.5)', overflow: 'hidden', width: '100%', maxWidth: '100%' }} ref={consoleBlockRef}>
            <div style={{ padding: '10px 14px', color: '#cbd5e1', borderBottom: '1px solid #111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>Console</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{consoleLines.length} linhas</div>
            </div>
            <div style={{ color: '#94a3b8', padding: 14, minHeight: 260, maxHeight: '60vh', overflow: 'auto' }} ref={consoleRef}>
              {consoleLines.map((line, idx) => (
                <div key={idx} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', marginBottom: 6 }}>{renderFormattedText(line)}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Resultados (abaixo do console, full width) */}
        <div style={{ width: '100%' }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 16, boxShadow: '0 10px 26px rgba(32,50,73,0.08)', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h4 style={{ marginTop: 0, color: '#1f2937', marginBottom: 0 }}>Registros extraídos</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={handleDownloadXml} disabled={!jobId} style={{
                  padding: '8px 12px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: jobId ? 'pointer' : 'not-allowed',
                  background: jobId ? 'linear-gradient(135deg,#10b981,#059669)' : '#cbd5e1', color: '#fff'
                }}>Baixar XML</button>
                <button onClick={() => setShowRawResults(s => !s)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                  {showRawResults ? 'Ocultar JSON' : 'Mostrar JSON'}
                </button>
                <button onClick={handleSaveChangesAsXml} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', cursor: 'pointer' }}>
                  Salvar alterações
                </button>
              </div>
            </div>
            {results.length === 0 ? (
              <div style={{ color: '#64748b' }}>Nenhum registro extraído ainda.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                {showRawResults && (
                  <div style={{ marginBottom: 12 }}>
                    <pre style={{ maxHeight: 240, overflow: 'auto', background: '#0f172a', color: '#e6eef6', padding: 12, borderRadius: 8 }}>{JSON.stringify(results.slice(0, 5), null, 2)}</pre>
                  </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Número do livro</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Número da folha</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Número do termo</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Data do registro</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Nome do registrado</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Sexo</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Data de nascimento</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Filiação 1</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Filiação 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <input value={getExactField(r, ['numeroLivro', 'numero_livro', 'livro', 'LIVRO', 'NROLIVRO', 'NUM_LIVRO', 'NUMEROLIVRO']) || ''}
                            onChange={e => updateRecordField(i, 'livro', e.target.value)}
                            style={{ width: 120, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <input value={getExactField(r, ['numeroFolha', 'folha', 'page', 'FOLHA', 'NRO_FOLHA', 'NUM_FOLHA']) || ''}
                            onChange={e => updateRecordField(i, 'folha', e.target.value)}
                            style={{ width: 100, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <input value={getExactField(r, ['numeroTermo', 'termo', 'term', 'TERMO', 'NRO_TERMO', 'NUM_TERMO', 'ATO']) || ''}
                            onChange={e => updateRecordField(i, 'termo', e.target.value)}
                            style={{ width: 100, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <input value={getField(r, ['dataRegistro', 'data', 'registroData', 'date']) || ''}
                            onChange={e => updateRecordField(i, 'dataRegistro', e.target.value)}
                            style={{ width: 140, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <input value={getField(r, ['nome', 'name', 'registrado']) || ''}
                            onChange={e => updateRecordField(i, 'nome', e.target.value)}
                            style={{ width: 220, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <select value={getField(r, ['sexo', 'sex', 'genero']) || ''} onChange={e => updateRecordField(i, 'sexo', e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                            <option value="">-</option>
                            <option value="M">M</option>
                            <option value="F">F</option>
                          </select>
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <input value={getField(r, ['dataNascimento', 'nascimento', 'birthDate', 'datanascimento']) || ''}
                            onChange={e => updateRecordField(i, 'dataNascimento', e.target.value)}
                            style={{ width: 140, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <input value={getFiliacao(r, 0) || ''} onChange={e => updateRecordField(i, 'filiacao1', e.target.value)} style={{ width: 220, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <input value={getFiliacao(r, 1) || ''} onChange={e => updateRecordField(i, 'filiacao2', e.target.value)} style={{ width: 220, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
