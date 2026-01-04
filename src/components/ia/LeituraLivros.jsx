import React, { useEffect, useRef, useState } from 'react';
import ServentiaService from '../../services/ServentiaService';
import LeituraLivrosService from '../../services/LeituraLivrosService';
import PromptsService from '../../services/PromptsService';
import { useNavigate } from 'react-router-dom';
// importar identificarTipo removido — não precisamos chamar /identificar-tipo a partir deste componente
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
  const [fullTextPreview, setFullTextPreview] = useState('');
  const [fullTextInline, setFullTextInline] = useState('');
  const [fullTextAvailable, setFullTextAvailable] = useState(false);
  const [fullTextDownloadUrl, setFullTextDownloadUrl] = useState('');
  const [fullTextContent, setFullTextContent] = useState('');
  const [fullTextLoading, setFullTextLoading] = useState(false);
  const [fullTextError, setFullTextError] = useState('');
  const [fullTextRequested, setFullTextRequested] = useState(false);
  const [fullTextJobId, setFullTextJobId] = useState(null);
  const [fullTextCopied, setFullTextCopied] = useState(false);
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
  // código do tipo de livro a ser usado no sistema/geração de matrícula (valor sem zero à esquerda)
  const [tipoLivroCode, setTipoLivroCode] = useState('1');
  const [maxPorArquivo, setMaxPorArquivo] = useState(2500);
  const [numeroLivro, setNumeroLivro] = useState('');
  const [acervoGlobal, setAcervoGlobal] = useState('01');
  const [tipoEscrita, setTipoEscrita] = useState('digitado');

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleLines]);

  // Debug: log no DevTools assim que o componente monta (estado inicial importante)
  useEffect(() => {
    try {
      console.debug('LeituraLivros mounted', {
        mode, versao, acao, cns, tipoRegistro, tipoLivroCode, numeroLivro
      });
    } catch (_) {}
  }, []);

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
  }, [mode, versao, acao, tipoRegistro, folderPath, files.length]);

  function pushConsole(line) {
    setConsoleLines(prev => [...prev, typeof line === 'string' ? line : JSON.stringify(line)]);
  }

  async function fetchFullTextContent(downloadPathOverride = '', jobIdOverride = null) {
    const effectiveJobId = jobIdOverride || fullTextJobId || jobId;
    const downloadPath = downloadPathOverride || fullTextDownloadUrl;
    if (!downloadPath && !effectiveJobId) {
      logWarning('Nenhum job ativo para baixar o inteiro teor.');
      return;
    }
    setFullTextLoading(true);
    setFullTextError('');
    try {
      const text = downloadPath
        ? await LeituraLivrosService.getFullTextByPath(downloadPath)
        : await LeituraLivrosService.getFullText(effectiveJobId);
      setFullTextContent(text || '');
      logSuccess('Inteiro teor carregado.');
    } catch (e) {
      const msg = e?.message || 'Falha ao baixar inteiro teor';
      setFullTextError(msg);
      logError(msg);
    } finally {
      setFullTextLoading(false);
    }
  }

  async function handleCopyFullText() {
    try {
      const hasContent = !!(fullTextContent || fullTextInline || fullTextPreview);
      if (!hasContent && fullTextAvailable) {
        await fetchFullTextContent(fullTextDownloadUrl || '', fullTextJobId || jobId);
      }
      const text = fullTextContent || fullTextInline || fullTextPreview || '';
      if (!text.trim()) {
        logWarning('Nenhum conteúdo do inteiro teor disponível para copiar.');
        return;
      }
      const copy = async (t) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(t);
        } else {
          const ta = document.createElement('textarea');
          ta.value = t;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
      };
      await copy(text);
      logSuccess('Inteiro teor copiado para a área de transferência.');
      setFullTextCopied(true);
      setTimeout(() => setFullTextCopied(false), 2000);
    } catch (e) {
      const msg = e?.message || 'Falha ao copiar inteiro teor';
      logError(msg);
    }
  }

  // Handler para extrair imagens de arquivos .p7s via backend
  async function handleExtractP7s(filesList) {
    try {
      const arr = Array.from(filesList || []);
      if (!arr.length) return;
      logTitle('Extrair Imagens (.p7s)');
      logInfo(`Iniciando extração de ${arr.length} arquivo(s) .p7s...`);

      const filesToShow = [];

      // helper para processar resposta e empilhar blobs
      const pushFromResp = (resp, baseName) => {
        try { console.debug('backend:extractP7s response', resp); } catch (_) {}
        if (!resp) return;
        if (resp.blob) {
          const ct = resp.contentType || 'application/octet-stream';
          const filename = (baseName || 'payload') + extFromContentType(ct);
          filesToShow.push({ filename, blob: resp.blob, contentType: ct });
          return;
        }
        if (Array.isArray(resp)) {
          for (let i = 0; i < resp.length; i++) {
            const it = resp[i];
            if (it && it.buffer && it.buffer.data) {
              const u8 = new Uint8Array(it.buffer.data);
              const blob = new Blob([u8], { type: it.contentType || '' });
              filesToShow.push({ filename: (it.filename || `${baseName || 'payload'}_${i + 1}`) + extFromContentType(it.contentType), blob, contentType: it.contentType || '' });
              continue;
            }
            if (it && it.base64) {
              const bin = atob(it.base64);
              const len = bin.length;
              const u8 = new Uint8Array(len);
              for (let j = 0; j < len; j++) u8[j] = bin.charCodeAt(j);
              const blob = new Blob([u8], { type: it.contentType || '' });
              filesToShow.push({ filename: (it.filename || `${baseName || 'payload'}_${i + 1}`) + extFromContentType(it.contentType), blob, contentType: it.contentType || '' });
              continue;
            }
            logWarning(`Resposta inesperada para item ${i}: ${JSON.stringify(it).slice(0,200)}`);
          }
          return;
        }
        if (typeof resp === 'object') {
          const it = resp;
          if (it.buffer && it.buffer.data) {
            const u8 = new Uint8Array(it.buffer.data);
            const blob = new Blob([u8], { type: it.contentType || '' });
            filesToShow.push({ filename: (it.filename || baseName || 'payload') + extFromContentType(it.contentType), blob, contentType: it.contentType || '' });
          } else if (it.base64) {
            const bin = atob(it.base64);
            const len = bin.length;
            const u8 = new Uint8Array(len);
            for (let j = 0; j < len; j++) u8[j] = bin.charCodeAt(j);
            const blob = new Blob([u8], { type: it.contentType || '' });
            filesToShow.push({ filename: (it.filename || baseName || 'payload') + extFromContentType(it.contentType), blob, contentType: it.contentType || '' });
          }
        }
      };

      // Se houver mais de um arquivo, processe sequencialmente chamando o serviço para cada um
      if (arr.length > 1) {
        for (let idx = 0; idx < arr.length; idx++) {
          const single = arr[idx];
          try {
            logInfo(`Extraindo arquivo ${idx + 1}/${arr.length}: ${single.name || 'file'}`);
            const resp = await LeituraLivrosService.extractP7s([single]);
            pushFromResp(resp, single.name ? single.name.replace(/\.p7s$/i, '') : `payload_${idx + 1}`);
            // leve uma pequena pausa para não sobrecarregar o backend
            await new Promise(res => setTimeout(res, 120));
          } catch (e) {
            logWarning(`Falha ao extrair ${single.name || ('item ' + (idx + 1))}: ${e?.message || e}`);
          }
        }
      } else {
        // único arquivo: mantenha compatibilidade com comportamento anterior
        logInfo(`Enviando 1 arquivo para extração...`);
        const resp = await LeituraLivrosService.extractP7s(arr);
        pushFromResp(resp, arr[0] && arr[0].name ? arr[0].name.replace(/\.p7s$/i, '') : 'payload');
      }

      if (filesToShow.length) {
        setExtractedFiles(filesToShow);
        setShowExtractModal(true);
        logSuccess(`Extraídos ${filesToShow.length} arquivo(s). Escolha o destino para salvar.`);
      } else {
        logWarning('Resposta de extração não continha payloads reconhecíveis.');
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
      // 4) fallback em record.dados (novo payload mantém os campos nesse objeto)
      if ((v === undefined || v === null || String(v).toString().trim() === '') && record.dados) {
        const dadosVal = record.dados[k] ?? record.dados[String(k).toUpperCase()];
        if (dadosVal !== undefined && dadosVal !== null && String(dadosVal).toString().trim() !== '') v = dadosVal;
      }
      if (v !== undefined && v !== null && String(v).toString().trim() !== '') return v;
    }
    // Não usar fallback genérico aqui — retornos incorretos (ex.: data no lugar do nome)
    // Caso nada seja encontrado nos caminhos testados acima, devolve string vazia.
    return '';
  }

  function getFiliacao(record, idx) {
    if (!record) return '';
    // 1) array 'filiacao' ou 'filiacoes'
    const arr = record.filiacao || record.filiacoes || record?.dados?.filiacao;
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
      // check root (and handle object-shaped values like { numero: '1' })
      const rootVal = record[k];
      if (rootVal !== undefined && rootVal !== null) {
        if (typeof rootVal === 'object') {
          const cand = rootVal.numero ?? rootVal.number ?? rootVal.value ?? rootVal.nro ?? rootVal.num ?? rootVal.text;
          if (cand !== undefined && cand !== null && String(cand).trim() !== '') return cand;
        }
        if (String(rootVal).trim() !== '') return rootVal;
      }
      // check uppercase variant on root
      if (typeof k === 'string') {
        const up = record[String(k).toUpperCase()];
        if (up !== undefined && up !== null) {
          if (typeof up === 'object') {
            const cand = up.numero ?? up.number ?? up.value ?? up.nro ?? up.num ?? up.text;
            if (cand !== undefined && cand !== null && String(cand).trim() !== '') return cand;
          }
          if (String(up).trim() !== '') return up;
        }
      }
      // check record.campos exact key and uppercase (and unwrap objects)
      if (record.campos) {
        const cVal = record.campos[k];
        if (cVal !== undefined && cVal !== null) {
          if (typeof cVal === 'object') {
            const cand = cVal.numero ?? cVal.number ?? cVal.value ?? cVal.nro ?? cVal.num ?? cVal.text;
            if (cand !== undefined && cand !== null && String(cand).trim() !== '') return cand;
          }
          if (String(cVal).trim() !== '') return cVal;
        }
        if (typeof k === 'string') {
          const cUp = record.campos[String(k).toUpperCase()];
          if (cUp !== undefined && cUp !== null) {
            if (typeof cUp === 'object') {
              const cand = cUp.numero ?? cUp.number ?? cUp.value ?? cUp.nro ?? cUp.num ?? cUp.text;
              if (cand !== undefined && cand !== null && String(cand).trim() !== '') return cand;
            }
            if (String(cUp).trim() !== '') return cUp;
          }
        }
      }
      if (record.dados) {
        const dVal = record.dados[k] ?? record.dados[String(k).toUpperCase()];
        if (dVal !== undefined && dVal !== null) {
          if (typeof dVal === 'object') {
            const cand = dVal.numero ?? dVal.number ?? dVal.value ?? dVal.nro ?? dVal.num ?? dVal.text;
            if (cand !== undefined && cand !== null && String(cand).trim() !== '') return cand;
          }
          if (String(dVal).trim() !== '') return dVal;
        }
      }
    }
    return '';
  }

  // Helper: tentativa robusta para extrair um valor de campos em várias localizações e formatos
  function extractValueFromRecord(record, keyNames) {
    if (!record) return '';
    const tryUnwrap = (v) => {
      if (v === undefined || v === null) return '';
      if (typeof v === 'object') {
        return v.numero ?? v.number ?? v.value ?? v.nro ?? v.num ?? v.text ?? '';
      }
      return String(v || '');
    };

    for (const k of keyNames) {
      if (!k) continue;
      // direct
      const direct = record[k];
      const d = tryUnwrap(direct);
      if (d && String(d).trim() !== '') return String(d);
      // uppercase variant
      if (typeof k === 'string') {
        const up = record[String(k).toUpperCase()];
        const u = tryUnwrap(up);
        if (u && String(u).trim() !== '') return String(u);
      }
      // record.campos
      if (record.campos) {
        const c = record.campos[k] ?? record.campos[String(k).toUpperCase()];
        const cv = tryUnwrap(c);
        if (cv && String(cv).trim() !== '') return String(cv);
      }
      // nested in dados
      if (record.dados) {
        const d1 = record.dados[k] ?? record.dados[String(k).toUpperCase()];
        const dv = tryUnwrap(d1);
        if (dv && String(dv).trim() !== '') return String(dv);
      }
    }
    return '';
  }

  function normalizeFiliacaoList(source) {
    if (!Array.isArray(source) || !source.length) return undefined;
    return source.map((item) => {
      if (!item) return { NOME: '' };
      if (typeof item === 'string') return { NOME: item };
      const normalized = Object.assign({}, item);
      if (!normalized.NOME) normalized.NOME = item.nome || item.name || '';
      return normalized;
    });
  }

  function hydrateRecordWithStandardFields(record, livroOverride) {
    const copy = Object.assign({}, record || {});
    const campos = Object.assign({}, copy.campos || {});
    copy.campos = campos;

    const assignCampo = (key, value) => {
      if (!value && value !== 0) return;
      const str = String(value);
      if (!str.trim()) return;
      campos[key] = str;
    };

    if (livroOverride) {
      assignCampo('LIVRO', livroOverride);
      if (!copy.numeroLivro) copy.numeroLivro = livroOverride;
    }

    const folhaVal = extractValueFromRecord(record, ['folha', 'numeroFolha', 'numero_folha', 'FOLHA']);
    if (folhaVal) {
      assignCampo('FOLHA', folhaVal);
      copy.folha = folhaVal;
      if (!copy.numeroFolha) copy.numeroFolha = folhaVal;
    }

    const termoVal = extractValueFromRecord(record, ['termo', 'numeroTermo', 'term', 'TERMO']);
    if (termoVal) {
      assignCampo('TERMO', termoVal);
      copy.termo = termoVal;
      if (!copy.numeroTermo) copy.numeroTermo = termoVal;
    }

    const dataRegistroVal = extractValueFromRecord(record, ['dataRegistro', 'data', 'registroData', 'date']);
    if (dataRegistroVal) {
      assignCampo('DATAREGISTRO', dataRegistroVal);
      copy.dataRegistro = dataRegistroVal;
    }

    const nomeRegistradoVal = extractValueFromRecord(record, ['nomeRegistrado', 'nome', 'name', 'registrado']);
    if (nomeRegistradoVal) {
      assignCampo('NOMEREGISTRADO', nomeRegistradoVal);
      copy.nomeRegistrado = nomeRegistradoVal;
    }

    const sexoVal = extractValueFromRecord(record, ['sexo', 'sex', 'genero']);
    if (sexoVal) {
      assignCampo('SEXO', sexoVal);
      copy.sexo = sexoVal;
    }

    const dataNascimentoVal = extractValueFromRecord(record, ['dataNascimento', 'nascimento', 'birthDate', 'datanascimento']);
    if (dataNascimentoVal) {
      assignCampo('DATANASCIMENTO', dataNascimentoVal);
      copy.dataNascimento = dataNascimentoVal;
    }

    const filiacaoList = normalizeFiliacaoList(record?.filiacao || record?.dados?.filiacao || copy?.filiacao);
    if (filiacaoList) {
      copy.filiacao = filiacaoList;
    }

    return copy;
  }

  // Normalize an array of backend records/registros into the table format (fill LIVRO/FOLHA/TERMO)
  function normalizeRecordsArray(arr) {
    const numeroLivroFormatted = numeroLivro ? String(Number(numeroLivro)) : '';
    return (Array.isArray(arr) ? arr : []).map((r) => hydrateRecordWithStandardFields(r, numeroLivroFormatted));
  }

  // Attempt to find an embedded JSON object in text that contains `registros` or `records`
  function extractJsonFromText(text) {
    if (!text || typeof text !== 'string') return null;
    // Try to locate a JSON object that contains "registros" or "records"
    const patterns = [/\{[\s\S]*?"registros"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/m, /\{[\s\S]*?"records"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/m];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m && m[0]) {
        try {
          return JSON.parse(m[0]);
        } catch (e) {
          try {
            // attempt to be lenient by trimming trailing commas
            const cleaned = m[0].replace(/,\s*\]/g, ']');
            return JSON.parse(cleaned);
          } catch (_) {
            return null;
          }
        }
      }
    }
    return null;
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
          // também atualize chaves no nível raiz para que getExactField retorne o novo valor
          rec.numeroLivro = value;
          rec.livro = value;
          break;
        case 'folha':
          rec.campos['FOLHA'] = value;
          rec.numeroFolha = value;
          rec.folha = value;
          break;
        case 'termo':
          rec.campos['TERMO'] = value;
          rec.numeroTermo = value;
          rec.termo = value;
          break;
        case 'dataRegistro':
          rec.campos['DATAREGISTRO'] = value;
          rec.dataRegistro = value;
          break;
        case 'nome':
          rec.campos['NOMEREGISTRADO'] = value;
          rec.nomeRegistrado = value;
          break;
        case 'sexo':
          rec.campos['SEXO'] = value;
          break;
        case 'dataNascimento':
          rec.campos['DATANASCIMENTO'] = value;
          rec.dataNascimento = value;
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
        case 'acervo':
          rec.campos['ACERVO'] = value;
          break;
        default:
          // noop
      }
      copy[idx] = rec;
      return copy;
    });
  }

  function removeRecord(idx) {
    setResults(prev => (Array.isArray(prev) ? prev.filter((_, i) => i !== idx) : []));
  }

  function insertRecordAt(index, record) {
    setResults(prev => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      const newRec = record || hydrateRecordWithStandardFields({}, (numeroLivro ? String(Number(numeroLivro)) : ''));
      arr.splice(index, 0, newRec);
      return arr;
    });
  }

  function insertRecordAbove(idx) {
    insertRecordAt(idx, hydrateRecordWithStandardFields({}, (numeroLivro ? String(Number(numeroLivro)) : '')));
  }

  function insertRecordBelow(idx) {
    insertRecordAt(idx + 1, hydrateRecordWithStandardFields({}, (numeroLivro ? String(Number(numeroLivro)) : '')));
  }

  // Helper: pad left with zeros; strip non-digits first
  function padLeftDigits(input, length) {
    const s = String(input || '').replace(/\D/g, '');
    if (!s) return '0'.repeat(length);
    if (s.length >= length) return s.slice(-length);
    return s.padStart(length, '0');
  }

  // Build payload fields formatted to required masks for /api/matriculas/generate
  function buildMatriculaPayloadFromRecord(rec) {
    const livroRaw = getExactField(rec, ['numeroLivro', 'numero_livro', 'livro', 'LIVRO', 'NROLIVRO', 'NUM_LIVRO', 'NUMEROLIVRO']) || '';
    const folhaRaw = getExactField(rec, ['numeroFolha', 'folha', 'page', 'FOLHA', 'NRO_FOLHA', 'NUM_FOLHA']) || '';
    const termoRaw = getExactField(rec, ['numeroTermo', 'termo', 'term', 'TERMO', 'NRO_TERMO', 'NUM_TERMO', 'ATO']) || '';
    const dataReg = getField(rec, ['dataRegistro', 'data', 'registroData', 'date']);
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
    } catch (_) {}

    // Acervo: prefer rec.campos.ACERVO, then try common keys, default '01'
    const acervoRaw = (acervoGlobal && String(acervoGlobal).trim() !== '') ? String(acervoGlobal) : ((rec && rec.campos && (rec.campos.ACERVO || rec.campos.acervo)) || getField(rec, ['acervo', 'ACERVO']) || '01');

    // CNS (Código da serventia) must be 6 digits
    const cnsDigits = padLeftDigits(cns || '', 6);
    // RCPN fixed to 55 (2 digits)
    const rcpn = padLeftDigits('55', 2);
    // tipoLivro: single digit (use tipoLivroCode, fallback '1') — keep last digit
    const tipoLivroDigit = String(tipoLivroCode || '1').replace(/\D/g, '').slice(-1) || '1';

    return {
      cns: cnsDigits,
      acervo: padLeftDigits(acervoRaw, 2),
      servico: rcpn,
      ano: padLeftDigits(ano || String(new Date().getFullYear()), 4),
      tipoLivro: tipoLivroDigit,
      livro: padLeftDigits(livroRaw || (numeroLivro ? String(Number(numeroLivro)) : ''), 5),
      folha: padLeftDigits(folhaRaw || '', 3),
      termo: padLeftDigits(termoRaw || '', 7)
    };
  }

  // Build an ordered payload object with the exact property sequence required by backend
  function buildOrderedPayload(defaults, rec) {
    const formatted = buildMatriculaPayloadFromRecord(rec || {});
    // prefer formatted values, fall back to defaults
    return {
      cns: formatted.cns || (defaults && defaults.cns) || '',
      acervo: formatted.acervo || (defaults && defaults.acervo) || '',
      servico: formatted.servico || (defaults && defaults.servico) || '',
      ano: formatted.ano || (defaults && defaults.ano) || '',
      tipoLivro: formatted.tipoLivro || (defaults && defaults.tipoLivro) || '',
      livro: formatted.livro || (defaults && defaults.livro) || '',
      folha: formatted.folha || (defaults && defaults.folha) || '',
      termo: formatted.termo || (defaults && defaults.termo) || ''
    };
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

  // Normalize model/resource keys (strip provider prefixes and cosmetic suffixes)
  function normalizeModelKey(name) {
    if (!name) return '';
    let s = String(name).trim();
    s = s.replace(/^projects\/[^^\/]+\/locations\/[^^\/]+\/models\//i, '');
    s = s.replace(/^projects\/[^^\/]+\/models\//i, '');
    s = s.replace(/^models\//i, '');
    s = s.replace(/-latest$/i, '');
    s = s.replace(/-v?\d+(?:\.\d+)?$/i, '');
    s = s.replace(/[\s_\/]+/g, '-').replace(/[^a-z0-9\-\.]/gi, '');
    return s.toLowerCase();
  }

  // Formata datas para exibição na tabela: DD-MM-AAAA
  function formatDateDisplay(v) {
    if (v === undefined || v === null) return '';
    const s = String(v).trim();
    if (!s) return '';
    const pad = (n) => String(n).padStart(2, '0');

    // Tenta criar Date a partir de string (aceita ISO e timestamps)
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    }

    // dd/mm/yyyy ou dd-mm-yyyy
    const m1 = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;

    // yyyy-mm-dd ou yyyy/mm/dd
    const m2 = s.match(/^(\d{4})[\/-](\d{2})[\/-](\d{2})$/);
    if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;

    // fallback: retorna a string original
    return s;
  }

  function serializeNascimentoXml(arr) {
    const cnsDigits = padLeftDigits(cns || '', 6);
    const lines = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<CARGAREGISTROS>',
      `  <VERSAO>${escapeXml(versao || '')}</VERSAO>`,
      `  <ACAO>${escapeXml(acao || '')}</ACAO>`,
      `  <CNS>${escapeXml(cnsDigits)}</CNS>`,
      '  <MOVIMENTONASCIMENTOTN>'
    ];

    (arr || []).forEach((r, idx) => {
      const indice = idx + 1;
      const nome = getField(r, ['nomeRegistrado', 'nome', 'name', 'registrado']) || '';
      const cpf = getField(r, ['cpfRegistrado', 'cpf', 'CPF']) || '';
      const matriculaVal = r && r.matricula ? r.matricula : '';
      const dataRegistro = getField(r, ['dataRegistro', 'data', 'registroData', 'date']) || '';
      const dnv = getField(r, ['dnv', 'DNV']) || '';
      const dataNasc = getField(r, ['dataNascimento', 'nascimento', 'birthDate', 'datanascimento']) || '';
      const horaNasc = getField(r, ['horaNascimento', 'hora_nascimento', 'horanascimento']) || '';
      const localNasc = getField(r, ['localNascimento', 'local_nascimento']) || '';
      const sexoVal = getField(r, ['sexo', 'sex', 'genero']) || '';

      lines.push('    <REGISTRONASCIMENTOINCLUSAO>');
      lines.push(`      <INDICEREGISTRO>${indice}</INDICEREGISTRO>`);
      lines.push(`      <NOMEREGISTRADO>${escapeXml(nome)}</NOMEREGISTRADO>`);
      lines.push(`      <CPFREGISTRADO>${escapeXml(cpf)}</CPFREGISTRADO>`);
      lines.push(`      <MATRICULA>${escapeXml(matriculaVal || '')}</MATRICULA>`);
      lines.push(`      <DATAREGISTRO>${escapeXml(dataRegistro)}</DATAREGISTRO>`);
      lines.push(`      <DNV>${escapeXml(dnv)}</DNV>`);
      lines.push(`      <DATANASCIMENTO>${escapeXml(dataNasc)}</DATANASCIMENTO>`);
      lines.push(`      <HORANASCIMENTO>${escapeXml(horaNasc)}</HORANASCIMENTO>`);
      lines.push(`      <LOCALNASCIMENTO>${escapeXml(localNasc)}</LOCALNASCIMENTO>`);
      lines.push(`      <SEXO>${escapeXml(sexoVal)}</SEXO>`);
      lines.push('      <POSSUIGEMEOS></POSSUIGEMEOS>');
      lines.push('      <NUMEROGEMEOS></NUMEROGEMEOS>');
      lines.push('      <CODIGOIBGEMUNNASCIMENTO></CODIGOIBGEMUNNASCIMENTO>');
      lines.push('      <PAISNASCIMENTO></PAISNASCIMENTO>');
      lines.push('      <NACIONALIDADE></NACIONALIDADE>');
      lines.push('      <TEXTONACIONALIDADEESTRANGEIRO></TEXTONACIONALIDADEESTRANGEIRO>');

      const parents = [getFiliacao(r, 0), getFiliacao(r, 1)].filter(p => p !== undefined && p !== null && String(p).trim() !== '');
      parents.forEach((p, pIdx) => {
        lines.push('      <FILIACAONASCIMENTO>');
        lines.push(`        <INDICEREGISTRO>${indice}</INDICEREGISTRO>`);
        lines.push(`        <INDICEFILIACAO>${pIdx + 1}</INDICEFILIACAO>`);
        lines.push(`        <NOME>${escapeXml(p)}</NOME>`);
        lines.push('        <SEXO></SEXO>');
        lines.push('        <CPF></CPF>');
        lines.push('        <DATANASCIMENTO></DATANASCIMENTO>');
        lines.push('        <IDADE></IDADE>');
        lines.push('        <IDADE_DIAS_MESES_ANOS></IDADE_DIAS_MESES_ANOS>');
        lines.push('        <CODIGOIBGEMUNLOGRADOURO></CODIGOIBGEMUNLOGRADOURO>');
        lines.push('        <LOGRADOURO></LOGRADOURO>');
        lines.push('        <NUMEROLOGRADOURO></NUMEROLOGRADOURO>');
        lines.push('        <COMPLEMENTOLOGRADOURO></COMPLEMENTOLOGRADOURO>');
        lines.push('        <BAIRRO></BAIRRO>');
        lines.push('        <NACIONALIDADE></NACIONALIDADE>');
        lines.push('        <DOMICILIOESTRANGEIRO></DOMICILIOESTRANGEIRO>');
        lines.push('        <CODIGOIBGEMUNNATURALIDADE></CODIGOIBGEMUNNATURALIDADE>');
        lines.push('        <TEXTOLIVREMUNICIPIONAT></TEXTOLIVREMUNICIPIONAT>');
        lines.push('        <CODIGOOCUPACAOSDC></CODIGOOCUPACAOSDC>');
        lines.push('      </FILIACAONASCIMENTO>');
      });

      lines.push('      <DOCUMENTOS>');
      lines.push(`        <INDICEREGISTRO>${indice}</INDICEREGISTRO>`);
      lines.push('        <INDICEFILIACAO></INDICEFILIACAO>');
      lines.push('        <DONO>FILIACAO_NASCIMENTO</DONO>');
      lines.push('        <TIPO_DOC></TIPO_DOC>');
      lines.push('        <DESCRICAO></DESCRICAO>');
      lines.push('        <NUMERO></NUMERO>');
      lines.push('        <NUMERO_SERIE></NUMERO_SERIE>');
      lines.push('        <CODIGOORGAOEMISSOR></CODIGOORGAOEMISSOR>');
      lines.push('        <UF_EMISSAO></UF_EMISSAO>');
      lines.push('        <DATA_EMISSAO></DATA_EMISSAO>');
      lines.push('      </DOCUMENTOS>');
      lines.push('      <ORGAOEMISSOREXTERIOR></ORGAOEMISSOREXTERIOR>');
      lines.push('      <INFORMACOESCONSULADO></INFORMACOESCONSULADO>');
      lines.push('      <OBSERVACOES></OBSERVACOES>');
      lines.push('    </REGISTRONASCIMENTOINCLUSAO>');
    });

    lines.push('  </MOVIMENTONASCIMENTOTN>');
    lines.push('</CARGAREGISTROS>');
    return lines.join('\n');
  }

  function serializeCasamentoXml(arr) {
    const cnsDigits = padLeftDigits(cns || '', 6);
    const lines = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<CARGAREGISTROS>',
      `  <VERSAO>${escapeXml(versao || '')}</VERSAO>`,
      `  <ACAO>${escapeXml(acao || '')}</ACAO>`,
      `  <CNS>${escapeXml(cnsDigits)}</CNS>`,
      '  <MOVIMENTOCASAMENTOTC>'
    ];

    (arr || []).forEach((r, idx) => {
      const indice = idx + 1;
      const conjuge1 = getField(r, ['nomeConjuge1', 'conjuge1', 'nome']) || '';
      const conjuge2 = getField(r, ['nomeConjuge2', 'conjuge2']) || '';
      const sexo1 = getField(r, ['sexoConjuge1', 'sexo1']) || '';
      const sexo2 = getField(r, ['sexoConjuge2', 'sexo2']) || '';
      const cpf1 = getField(r, ['cpfConjuge1', 'cpf1', 'cpf']) || '';
      const cpf2 = getField(r, ['cpfConjuge2', 'cpf2']) || '';
      const dataNasc1 = getField(r, ['dataNascimentoConjuge1', 'dataNascimento', 'data_nasc1']) || '';
      const dataNasc2 = getField(r, ['dataNascimentoConjuge2', 'data_nasc2']) || '';
      const pai = getFiliacao(r, 0) || '';
      const mae = getFiliacao(r, 1) || '';
      const matriculaVal = r && r.matricula ? r.matricula : '';
      const dataRegistro = getField(r, ['dataRegistro', 'data', 'registroData', 'date']) || '';
      const dataCasamento = getField(r, ['dataCasamento', 'data_casamento']) || '';
      const regime = getField(r, ['regimeCasamento', 'regime_casamento']) || '';

      lines.push('    <REGISTROCASAMENTOINCLUSAO>');
      lines.push(`      <INDICEREGISTRO>${indice}</INDICEREGISTRO>`);
      lines.push(`      <NOMECONJUGE1>${escapeXml(conjuge1)}</NOMECONJUGE1>`);
      lines.push('      <NOVONOMECONJUGE1></NOVONOMECONJUGE1>');
      lines.push(`      <CPFCONJUGE1>${escapeXml(cpf1)}</CPFCONJUGE1>`);
      lines.push(`      <SEXOCONJUGE1>${escapeXml(sexo1)}</SEXOCONJUGE1>`);
      lines.push(`      <DATANASCIMENTOCONJUGE1>${escapeXml(dataNasc1)}</DATANASCIMENTOCONJUGE1>`);
      lines.push(`      <NOMEPAICONJUGE1>${escapeXml(pai)}</NOMEPAICONJUGE1>`);
      lines.push('      <SEXOPAICONJUGE1></SEXOPAICONJUGE1>');
      lines.push(`      <NOMEMAECONJUGE1>${escapeXml(mae)}</NOMEMAECONJUGE1>`);
      lines.push('      <SEXOMAECONJUGE1></SEXOMAECONJUGE1>');
      lines.push('      <CODIGOOCUPACAOSDCCONJUGE1></CODIGOOCUPACAOSDCCONJUGE1>');
      lines.push('      <PAISNASCIMENTOCONJUGE1></PAISNASCIMENTOCONJUGE1>');
      lines.push('      <NACIONALIDADECONJUGE1></NACIONALIDADECONJUGE1>');
      lines.push('      <CODIGOIBGEMUNNATCONJUGE1></CODIGOIBGEMUNNATCONJUGE1>');
      lines.push('      <TEXTOLIVREMUNNATCONJUGE1></TEXTOLIVREMUNNATCONJUGE1>');
      lines.push('      <CODIGOIBGEMUNLOGRADOURO1></CODIGOIBGEMUNLOGRADOURO1>');
      lines.push('      <DOMICILIOESTRANGEIRO1></DOMICILIOESTRANGEIRO1>');
      lines.push(`      <NOMECONJUGE2>${escapeXml(conjuge2)}</NOMECONJUGE2>`);
      lines.push('      <NOVONOMECONJUGE2></NOVONOMECONJUGE2>');
      lines.push(`      <CPFCONJUGE2>${escapeXml(cpf2)}</CPFCONJUGE2>`);
      lines.push(`      <SEXOCONJUGE2>${escapeXml(sexo2)}</SEXOCONJUGE2>`);
      lines.push(`      <DATANASCIMENTOCONJUGE2>${escapeXml(dataNasc2)}</DATANASCIMENTOCONJUGE2>`);
      lines.push('      <NOMEPAICONJUGE2></NOMEPAICONJUGE2>');
      lines.push('      <SEXOPAICONJUGE2></SEXOPAICONJUGE2>');
      lines.push('      <NOMEMAECONJUGE2></NOMEMAECONJUGE2>');
      lines.push('      <SEXOMAECONJUGE2></SEXOMAECONJUGE2>');
      lines.push('      <CODIGOOCUPACAOSDCCONJUGE2></CODIGOOCUPACAOSDCCONJUGE2>');
      lines.push('      <PAISNASCIMENTOCONJUGE2></PAISNASCIMENTOCONJUGE2>');
      lines.push('      <NACIONALIDADECONJUGE2></NACIONALIDADECONJUGE2>');
      lines.push('      <CODIGOIBGEMUNNATCONJUGE2></CODIGOIBGEMUNNATCONJUGE2>');
      lines.push('      <TEXTOLIVREMUNNATCONJUGE2></TEXTOLIVREMUNNATCONJUGE2>');
      lines.push('      <CODIGOIBGEMUNLOGRADOURO2></CODIGOIBGEMUNLOGRADOURO2>');
      lines.push('      <DOMICILIOESTRANGEIRO2></DOMICILIOESTRANGEIRO2>');
      lines.push(`      <MATRICULA>${escapeXml(matriculaVal)}</MATRICULA>`);
      lines.push(`      <DATAREGISTRO>${escapeXml(dataRegistro)}</DATAREGISTRO>`);
      lines.push(`      <DATACASAMENTO>${escapeXml(dataCasamento)}</DATACASAMENTO>`);
      lines.push(`      <REGIMECASAMENTO>${escapeXml(regime)}</REGIMECASAMENTO>`);
      lines.push('      <DOCUMENTOS>');
      lines.push(`        <INDICEREGISTRO>${indice}</INDICEREGISTRO>`);
      lines.push('        <DONO></DONO>');
      lines.push('        <TIPO_DOC></TIPO_DOC>');
      lines.push('        <DESCRICAO></DESCRICAO>');
      lines.push('        <NUMERO></NUMERO>');
      lines.push('        <NUMERO_SERIE></NUMERO_SERIE>');
      lines.push('        <CODIGOORGAOEMISSOR></CODIGOORGAOEMISSOR>');
      lines.push('        <UF_EMISSAO></UF_EMISSAO>');
      lines.push('        <DATA_EMISSAO></DATA_EMISSAO>');
      lines.push('      </DOCUMENTOS>');
      lines.push('      <ORGAOEMISSOREXTERIOR></ORGAOEMISSOREXTERIOR>');
      lines.push('      <INFORMACOESCONSULADO></INFORMACOESCONSULADO>');
      lines.push('      <OBSERVACOES></OBSERVACOES>');
      lines.push('    </REGISTROCASAMENTOINCLUSAO>');
    });

    lines.push('  </MOVIMENTOCASAMENTOTC>');
    lines.push('</CARGAREGISTROS>');
    return lines.join('\n');
  }

  function serializeObitoXml(arr) {
    const cnsDigits = padLeftDigits(cns || '', 6);
    const lines = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<CARGAREGISTROS>',
      `  <VERSAO>${escapeXml(versao || '')}</VERSAO>`,
      `  <ACAO>${escapeXml(acao || '')}</ACAO>`,
      `  <CNS>${escapeXml(cnsDigits)}</CNS>`,
      '  <MOVIMENTOOBITOTO>'
    ];

    (arr || []).forEach((r, idx) => {
      const indice = idx + 1;
      const nome = getField(r, ['nomeRegistrado', 'nome', 'name', 'registrado']) || '';
      const cpf = getField(r, ['cpf', 'cpfFalecido']) || '';
      const matriculaVal = r && r.matricula ? r.matricula : '';
      const dataRegistro = getField(r, ['dataRegistro', 'data', 'registroData', 'date']) || '';
      const pai = getFiliacao(r, 0) || '';
      const mae = getFiliacao(r, 1) || '';
      const cpfPai = getField(r, ['cpfPai']) || '';
      const cpfMae = getField(r, ['cpfMae']) || '';
      const sexoPai = getField(r, ['sexoPai']) || '';
      const sexoMae = getField(r, ['sexoMae']) || '';
      const dataObito = getField(r, ['dataObito', 'data_obito']) || '';
      const horaObito = getField(r, ['horaObito', 'hora_obito']) || '';
      const sexoVal = getField(r, ['sexo', 'sex', 'genero']) || '';
      const cor = getField(r, ['cor', 'corPele']) || '';
      const estadoCivil = getField(r, ['estadoCivil', 'estado_civil']) || '';
      const dataNasc = getField(r, ['dataNascimento', 'birthDate', 'datanascimento']) || '';

      lines.push('    <REGISTROOBITOINCLUSAO>');
      lines.push(`      <INDICEREGISTRO>${indice}</INDICEREGISTRO>`);
      lines.push('      <FLAGDESCONHECIDO></FLAGDESCONHECIDO>');
      lines.push(`      <NOMEFALECIDO>${escapeXml(nome)}</NOMEFALECIDO>`);
      lines.push(`      <CPFFALECIDO>${escapeXml(cpf)}</CPFFALECIDO>`);
      lines.push(`      <MATRICULA>${escapeXml(matriculaVal)}</MATRICULA>`);
      lines.push(`      <DATAREGISTRO>${escapeXml(dataRegistro)}</DATAREGISTRO>`);
      lines.push(`      <NOMEPAI>${escapeXml(pai)}</NOMEPAI>`);
      lines.push(`      <CPFPAI>${escapeXml(cpfPai)}</CPFPAI>`);
      lines.push(`      <SEXOPAI>${escapeXml(sexoPai)}</SEXOPAI>`);
      lines.push(`      <NOMEMAE>${escapeXml(mae)}</NOMEMAE>`);
      lines.push(`      <CPFMAE>${escapeXml(cpfMae)}</CPFMAE>`);
      lines.push(`      <SEXOMAE>${escapeXml(sexoMae)}</SEXOMAE>`);
      lines.push(`      <DATAOBITO>${escapeXml(dataObito)}</DATAOBITO>`);
      lines.push(`      <HORAOBITO>${escapeXml(horaObito)}</HORAOBITO>`);
      lines.push(`      <SEXO>${escapeXml(sexoVal)}</SEXO>`);
      lines.push(`      <CORPELE>${escapeXml(cor)}</CORPELE>`);
      lines.push(`      <ESTADOCIVIL>${escapeXml(estadoCivil)}</ESTADOCIVIL>`);
      lines.push(`      <DATANASCIMENTOFALECIDO>${escapeXml(dataNasc)}</DATANASCIMENTOFALECIDO>`);
      lines.push('      <IDADE></IDADE>');
      lines.push('      <IDADE_DIAS_MESES_ANOS></IDADE_DIAS_MESES_ANOS>');
      lines.push('      <ELEITOR></ELEITOR>');
      lines.push('      <POSSUIBENS></POSSUIBENS>');
      lines.push('      <CODIGOOCUPACAOSDC></CODIGOOCUPACAOSDC>');
      lines.push('      <PAISNASCIMENTO></PAISNASCIMENTO>');
      lines.push('      <NACIONALIDADE></NACIONALIDADE>');
      lines.push('      <CODIGOIBGEMUNNATURALIDADE></CODIGOIBGEMUNNATURALIDADE>');
      lines.push('      <TEXTOLIVREMUNICIPIONAT></TEXTOLIVREMUNICIPIONAT>');
      lines.push('      <CODIGOIBGEMUNLOGRADOURO></CODIGOIBGEMUNLOGRADOURO>');
      lines.push('      <DOMICILIOESTRANGEIROFALECIDO></DOMICILIOESTRANGEIROFALECIDO>');
      lines.push('      <LOGRADOURO></LOGRADOURO>');
      lines.push('      <NUMEROLOGRADOURO></NUMEROLOGRADOURO>');
      lines.push('      <COMPLEMENTOLOGRADOURO></COMPLEMENTOLOGRADOURO>');
      lines.push('      <BAIRRO></BAIRRO>');
      lines.push('      <BENEFICIOS_PREVIDENCIARIOS>');
      lines.push(`        <INDICEREGISTRO>${indice}</INDICEREGISTRO>`);
      lines.push('        <NUMEROBENEFICIO></NUMEROBENEFICIO>');
      lines.push('      </BENEFICIOS_PREVIDENCIARIOS>');
      lines.push('      <DOCUMENTOS>');
      lines.push(`        <INDICEREGISTRO>${indice}</INDICEREGISTRO>`);
      lines.push('        <DONO>FALECIDO</DONO>');
      lines.push('        <TIPO_DOC></TIPO_DOC>');
      lines.push('        <DESCRICAO></DESCRICAO>');
      lines.push('        <NUMERO></NUMERO>');
      lines.push('        <NUMERO_SERIE></NUMERO_SERIE>');
      lines.push('        <CODIGOORGAOEMISSOR></CODIGOORGAOEMISSOR>');
      lines.push('        <UF_EMISSAO></UF_EMISSAO>');
      lines.push('        <DATA_EMISSAO></DATA_EMISSAO>');
      lines.push('      </DOCUMENTOS>');
      lines.push('      <TIPOLOCALOBITO></TIPOLOCALOBITO>');
      lines.push('      <TIPOMORTE></TIPOMORTE>');
      lines.push('      <NUMDECLARACAOOBITO></NUMDECLARACAOOBITO>');
      lines.push('      <NUMDECLARACAOOBITOIGNORADA></NUMDECLARACAOOBITOIGNORADA>');
      lines.push('      <PAISOBITO></PAISOBITO>');
      lines.push('      <CODIGOIBGEMUNLOGRADOUROOBITO></CODIGOIBGEMUNLOGRADOUROOBITO>');
      lines.push('      <ENDERECOLOCALOBITOESTRANGEIRO></ENDERECOLOCALOBITOESTRANGEIRO>');
      lines.push('      <LOGRADOUROOBITO></LOGRADOUROOBITO>');
      lines.push('      <NUMEROLOGRADOUROOBITO></NUMEROLOGRADOUROOBITO>');
      lines.push('      <COMPLEMENTOLOGRADOUROOBITO></COMPLEMENTOLOGRADOUROOBITO>');
      lines.push('      <BAIRROOBITO></BAIRROOBITO>');
      lines.push('      <CAUSAMORTEANTECEDENTES_A></CAUSAMORTEANTECEDENTES_A>');
      lines.push('      <CAUSAMORTEANTECEDENTES_B></CAUSAMORTEANTECEDENTES_B>');
      lines.push('      <CAUSAMORTEANTECEDENTES_C></CAUSAMORTEANTECEDENTES_C>');
      lines.push('      <CAUSAMORTEANTECEDENTES_D></CAUSAMORTEANTECEDENTES_D>');
      lines.push('      <CAUSAMORTEOUTRASCOND_A></CAUSAMORTEOUTRASCOND_A>');
      lines.push('      <CAUSAMORTEOUTRASCOND_B></CAUSAMORTEOUTRASCOND_B>');
      lines.push('      <LUGARFALECIMENTO></LUGARFALECIMENTO>');
      lines.push('      <LUGARSEPULTAMENTOCEMITERIO></LUGARSEPULTAMENTOCEMITERIO>');
      lines.push('      <NOMEATESTANTEPRIMARIO></NOMEATESTANTEPRIMARIO>');
      lines.push('      <CRMATESTANTEPRIMARIO></CRMATESTANTEPRIMARIO>');
      lines.push('      <NOMEATESTANTESECUNDARIO></NOMEATESTANTESECUNDARIO>');
      lines.push('      <CRMATESTANTESECUNDARIO></CRMATESTANTESECUNDARIO>');
      lines.push('      <NOMEDECLARANTE></NOMEDECLARANTE>');
      lines.push('      <CPFDECLARANTE></CPFDECLARANTE>');
      lines.push('      <ORGAOEMISSOREXTERIOR></ORGAOEMISSOREXTERIOR>');
      lines.push('      <INFORMACOESCONSULADO></INFORMACOESCONSULADO>');
      lines.push('      <OBSERVACOES></OBSERVACOES>');
      lines.push('    </REGISTROOBITOINCLUSAO>');
    });

    lines.push('  </MOVIMENTOOBITOTO>');
    lines.push('</CARGAREGISTROS>');
    return lines.join('\n');
  }

  function serializeCargaXml(arr) {
    const tipo = String(tipoRegistro || '').toUpperCase();
    if (tipo === 'CASAMENTO') return serializeCasamentoXml(arr);
    if (tipo === 'OBITO' || tipo === 'ÓBITO') return serializeObitoXml(arr);
    return serializeNascimentoXml(arr);
  }

  async function handleSaveChangesAsXml() {
    try {
      if (!Array.isArray(results) || results.length === 0) {
        logWarning('Nenhum registro para exportar.');
        return;
      }

      // Se existir registro sem matrícula, gera antes de exportar
      const hasMissingMatricula = (results || []).some(r => !r || !r.matricula || String(r.matricula).trim() === '');
      let currentResults = results;
      if (hasMissingMatricula) {
        logInfo('Gerando matrículas pendentes antes de exportar XML...');
        const generated = await handleGenerateMatriculas({ silent: true });
        if (generated && Array.isArray(generated)) currentResults = generated;
      }

      logTitle('Gerar XML (client-side)');
      const enriched = (Array.isArray(currentResults) ? currentResults : []).map(r => (r ? Object.assign({}, r) : {}));
      const xml = serializeCargaXml(enriched);

      const blob = new Blob([xml], { type: 'application/xml' });
      const tipo = String(tipoRegistro || 'generico').toLowerCase();
      const filename = `crc_${tipo}_${jobId || 'manual'}_${Date.now()}.xml`;
      downloadBlobAs(blob, filename);
      logSuccess('XML gerado e download iniciado (layout CRC).');
    } catch (e) {
      logError('Falha ao gerar XML: ' + (e.message || e));
    }
  }

  // Gera matrículas no backend para os registros atualmente carregados em `results`
  async function handleGenerateMatriculas(options = {}) {
    const silent = options && options.silent;
    try {
      if (!Array.isArray(results) || results.length === 0) { logWarning('Nenhum registro para gerar matrícula.'); return; }
      if (!silent) {
        logTitle('Gerar Matrículas');
        logInfo('Solicitando geração de matrícula(s) ao backend...');
      }

      let lastResultsSnapshot = results;

      for (let i = 0; i < results.length; i++) {
        const r = results[i] || {};
        // monta payload similar ao usado para obter matrícula em handleSaveChangesAsXml
        const livro = getExactField(r, ['numeroLivro', 'numero_livro', 'livro', 'LIVRO', 'NROLIVRO', 'NUM_LIVRO', 'NUMEROLIVRO']) || (numeroLivro ? String(Number(numeroLivro)) : '');
        const folha = getExactField(r, ['numeroFolha', 'folha', 'page', 'FOLHA', 'NRO_FOLHA', 'NUM_FOLHA']) || '';
        const termo = getExactField(r, ['numeroTermo', 'termo', 'term', 'TERMO', 'NRO_TERMO', 'NUM_TERMO', 'ATO']) || '';
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
        } catch (_) {}

        const payload = buildMatriculaPayloadFromRecord(r);

        // mark pending in UI
        setResults(prev => {
          const copy = Array.isArray(prev) ? [...prev] : [];
          const rec = Object.assign({}, copy[i] || {});
          rec.matricula = '...';
          copy[i] = rec;
          lastResultsSnapshot = copy;
          return copy;
        });

          try {
          try { console.debug('backend:matricula request (batch)', { index: i, payload }); } catch (_) {}
          const orderedBody = buildOrderedPayload(payload, r);
          try { logJsonPreview(`Payload enviado (matricula) [${i + 1}/${results.length}]`, orderedBody, 2000); } catch (_) {}
          const resp = await fetch(`${apiURL}/matriculas/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderedBody) });
          if (resp.ok) {
            const data = await resp.json().catch(() => null);
            try { console.debug('backend:matricula response (batch)', { index: i, data }); } catch (_) {}
            let m = null;
            if (data && data.result && data.result.matricula) m = data.result.matricula;
            else if (data && Array.isArray(data.results) && data.results[0] && data.results[0].matricula) m = data.results[0].matricula;
            else if (data && data.matricula) m = data.matricula;
            if (m) {
              setResults(prev => {
                const copy = Array.isArray(prev) ? [...prev] : [];
                const rec = Object.assign({}, copy[i] || {});
                rec.matricula = m;
                copy[i] = rec;
                lastResultsSnapshot = copy;
                return copy;
              });
              if (!silent) logSuccess(`Registro ${i + 1}: matrícula gerada (${m}).`);
            } else {
              setResults(prev => {
                const copy = Array.isArray(prev) ? [...prev] : [];
                const rec = Object.assign({}, copy[i] || {});
                rec.matricula = '';
                copy[i] = rec;
                lastResultsSnapshot = copy;
                return copy;
              });
              if (!silent) logWarning(`Registro ${i + 1}: backend não retornou matrícula.`);
            }
          } else {
            const text = await resp.text().catch(() => '');
            setResults(prev => {
              const copy = Array.isArray(prev) ? [...prev] : [];
              const rec = Object.assign({}, copy[i] || {});
              rec.matricula = '';
              copy[i] = rec;
              lastResultsSnapshot = copy;
              return copy;
            });
            if (!silent) logWarning(`Falha ao gerar matrícula para registro ${i + 1}: ${resp.status} ${text.slice(0,300)}`);
          }
        } catch (innerE) {
          setResults(prev => {
            const copy = Array.isArray(prev) ? [...prev] : [];
            const rec = Object.assign({}, copy[i] || {});
            rec.matricula = '';
            copy[i] = rec;
            lastResultsSnapshot = copy;
            return copy;
          });
          if (!silent) logWarning(`Erro ao chamar /api/matriculas/generate para registro ${i + 1}: ${innerE.message || innerE}`);
        }
      }

      const received = (lastResultsSnapshot || []).filter(it => it && it.matricula).length;
      if (!silent) logSuccess(`Geração concluída. Matrículas presentes: ${received}/${(lastResultsSnapshot || []).length}`);
      return lastResultsSnapshot;
    } catch (e) {
      logError('Falha na geração de matrículas: ' + (e.message || e));
      return results;
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

  // Loga um snapshot JSON do payload retornado pelo backend (ajuda a diagnosticar campos de livros)
  const logJsonPreview = (label, data, maxChars = 3500) => {
    try {
      const serialized = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const truncated = serialized.length > maxChars
        ? `${serialized.slice(0, maxChars)}\n[warning] ... payload truncado (${serialized.length - maxChars} caracteres ocultos)`
        : serialized;
      logTitle(label);
      pushConsole(truncated);
    } catch (err) {
      logWarning(`Não foi possível exibir ${label}: ${err?.message || err}`);
    }
  };

  // Pré-teste simples do agente de IA na montagem da tela (não bloqueante)
  useEffect(() => {
    if (didMountTestRef.current) return;
    didMountTestRef.current = true;

    (async () => {
      try {
        logTitle('Checando disponibilidade do agente de IA (health)');
        // Chama apenas a rota de health do provedor de IA — não usamos /identificar-tipo aqui
        try {
          const token = localStorage.getItem('token');
          const h = await withTimeout(fetch(`${apiURL}/ia/health`, {
            headers: { Authorization: `Bearer ${token || ''}` }
          }), 8000, 'ia-health');
          if (h && h.ok) {
            const jd = await h.json().catch(() => null);
            try { console.debug('backend:ia/health', jd); } catch (_) {}
            const modelName = jd && (jd.providerModel || jd.resolvedModel || jd.provider) ? (jd.providerModel || jd.resolvedModel || jd.provider) : null;
            logSuccess('✓ Agente online');
            if (modelName) {
              const disp = normalizeModelKey(modelName) || modelName;
              logInfo(`Agente de IA: ${disp}`);
            }
          } else {
            const statusCode = h ? h.status : 'no-response';
            logWarning(`⚠ Agente possivelmente indisponível (health status: ${statusCode}).`);
          }
        } catch (innerErr) {
          logWarning(`⚠ Falha ao consultar /ia/health: ${innerErr.message || innerErr}`);
        }
      } catch (e) {
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
        // Debug: payload retornado pelo backend para CNS da serventia
        try { console.debug('backend:getMinhaServentiaCns', data); } catch (_) {}
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

  // Global handlers to capture uncaught errors and promise rejections and forward them to the in-app console
  useEffect(() => {
    const onUnhandledRejection = (ev) => {
      try { console.debug('window:unhandledrejection', ev); } catch (_) {}
      try {
        const reason = ev && ev.reason ? ev.reason : ev;
        const txt = typeof reason === 'string' ? reason : JSON.stringify(reason, null, 2);
        pushConsole(`[error] ${nowHHMMSS()} - UnhandledRejection: ${String(txt).slice(0,3000)}`);
      } catch (e) {
        pushConsole(`[error] ${nowHHMMSS()} - UnhandledRejection (cannot serialize reason)`);
      }
    };

    const onError = (ev) => {
      try { console.debug('window:error', ev); } catch (_) {}
      try {
        const msg = ev && (ev.message || (ev.error && ev.error.message)) ? (ev.message || ev.error.message) : String(ev);
        pushConsole(`[error] ${nowHHMMSS()} - Error: ${String(msg).slice(0,2000)}`);
      } catch (e) {
        pushConsole(`[error] ${nowHHMMSS()} - Error (cannot serialize event)`);
      }
    };

    const onMessage = (ev) => {
      try { console.debug('window:message', ev); } catch (_) {}
      try {
        let preview = '';
        if (typeof ev.data === 'string') preview = ev.data.slice(0,2000);
        else preview = JSON.stringify(ev.data).slice(0,2000);
        pushConsole(`[info] ${nowHHMMSS()} - window.message from ${ev.origin || 'local'}: ${preview}`);
      } catch (e) {
        // ignore serialization errors
      }
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  async function startProcessing(options = {}) {
    const fetchFullTextAfter = options && Object.prototype.hasOwnProperty.call(options, 'fetchFullText')
      ? !!options.fetchFullText
      : true; // padrão: já buscar inteiro teor
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
    setFullTextPreview('');
    setFullTextInline('');
    setFullTextAvailable(false);
    setFullTextDownloadUrl('');
    setFullTextContent('');
    setFullTextError('');
    setFullTextLoading(false);
    setFullTextRequested(fetchFullTextAfter);
    setFullTextJobId(null);
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
      // Formata número do livro como inteiro (sem casas decimais) antes de enviar ao backend
      const numeroLivroFormatted = numeroLivro ? String(Number(numeroLivro)) : '';
      logInfo(`Parâmetros: VERSAO=${versao}, ACAO=${acao}, CNS=${cns}, TIPO=${tipoRegistro}, Nº_LIVRO=${numeroLivroFormatted || '—'}`);
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
          versao, acao, cns, tipoRegistro, tipoEscrita, inclusaoPrimeiro: true,
          promptTipoEscritaIndexador: 'tipo_escrita',
          promptTipoEscrita: pTipo?.prompt || '',
          numeroLivro: numeroLivroFormatted
        });
        // Debug: response do backend ao iniciar processamento (visível no DevTools)
        try { console.debug('backend:startFolderProcessing response', resp); } catch (_) {}
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
          versao, acao, cns, tipoRegistro, tipoEscrita, inclusaoPrimeiro: true,
          promptTipoEscritaIndexador: 'tipo_escrita',
          promptTipoEscrita: pTipo?.prompt || '',
          numeroLivro: numeroLivroFormatted
        });
      }
      if (!resp || !resp.jobId) {
        logError('Falha ao iniciar o processamento (resposta inválida).');
        setRunning(false);
        return;
      }
      setJobId(resp.jobId);
      setFullTextJobId(resp.jobId);
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
                const msg = status.messages[i];
                pushConsole(msg);
                // Try to parse embedded JSON from IA responses that may include `registros` or `records`
                try {
                  const parsed = extractJsonFromText(String(msg));
                  if (parsed) {
                    const arr = parsed.registros || parsed.records || null;
                    if (Array.isArray(arr) && arr.length) {
                        try {
                          const normalized = normalizeRecordsArray(arr);
                          // Replace results with parsed registros (this mirrors backend result when available)
                          setResults(normalized);
                        } catch (_) {}
                    }
                  }
                } catch (_) {}
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
              logJsonPreview('Payload recebido do backend (livros)', res);
              const payload = res && res.payload ? res.payload : res;
              const payloadObj = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
              const numeroLivroFormatted = numeroLivro ? String(Number(numeroLivro)) : '';

              const previewText = payloadObj.fullTextPreview || '';
              const inlineText = payloadObj.fullTextInline || '';
              const available = !!payloadObj.fullTextAvailable;
              const downloadPath = payloadObj.fullTextDownload || '';
              setFullTextPreview(previewText || '');
              setFullTextInline(inlineText || '');
              setFullTextAvailable(available);
              setFullTextDownloadUrl(downloadPath || '');
              if (inlineText) {
                setFullTextContent(inlineText);
              } else if (previewText) {
                setFullTextContent(previewText);
              }

              const recordsCandidate = Array.isArray(payload) ? payload : (payloadObj.records || payloadObj.registros || payload || []);
              let finalResults = (Array.isArray(recordsCandidate) ? recordsCandidate : []).map((r) => hydrateRecordWithStandardFields(r, numeroLivroFormatted));
              // If IA provided raw responses (iaRawResponses) with embedded registros JSON, merge them
              try {
                const iaResponses = payloadObj.iaRawResponses || res?.iaRawResponses || [];
                if (Array.isArray(iaResponses) && iaResponses.length) {
                  for (const ia of iaResponses) {
                    try {
                      const raw = ia.raw || ia.debug || ia.text || '';
                      const parsed = extractJsonFromText(String(raw));
                      if (parsed) {
                        const arr = parsed.registros || parsed.records || null;
                        if (Array.isArray(arr) && arr.length) {
                          const normalizedParsed = normalizeRecordsArray(arr);
                          // merge: try to match by name, otherwise append
                          for (const pRec of normalizedParsed) {
                            try {
                              // attempt to find matching finalResults entry by name
                              const parsedName = (pRec && (pRec.campos && (pRec.campos.NOMEREGISTRADO || pRec.campos.NOME))) || (pRec && pRec.dados && pRec.dados.nomeRegistrado) || '';
                              const parsedNameNorm = String(parsedName || '').trim().toLowerCase();
                              let foundIdx = -1;
                              if (parsedNameNorm) {
                                for (let j = 0; j < finalResults.length; j++) {
                                  const fr = finalResults[j];
                                  const frName = getField(fr, ['nome', 'NOMEREGISTRADO', 'nomeRegistrado', 'name']);
                                  if (frName && String(frName).toLowerCase().includes(parsedNameNorm)) { foundIdx = j; break; }
                                }
                              }
                              if (foundIdx >= 0) {
                                // fill FOLHA/TERMO if missing
                                try { if ((!finalResults[foundIdx].campos['FOLHA'] || String(finalResults[foundIdx].campos['FOLHA']).trim() === '') && pRec.campos && pRec.campos['FOLHA']) finalResults[foundIdx].campos['FOLHA'] = pRec.campos['FOLHA']; } catch (_) {}
                                try { if ((!finalResults[foundIdx].campos['TERMO'] || String(finalResults[foundIdx].campos['TERMO']).trim() === '') && pRec.campos && pRec.campos['TERMO']) finalResults[foundIdx].campos['TERMO'] = pRec.campos['TERMO']; } catch (_) {}
                              } else {
                                // push as new result entry
                                finalResults.push(pRec);
                              }
                            } catch (_) {}
                          }
                        }
                      }
                    } catch (_) {}
                  }
                }
              } catch (_) {}
              setResults(finalResults);
              const count = finalResults.length;
              logTitle(`Resultados carregados (${count}).`);

              if (fetchFullTextAfter) {
                if (inlineText) {
                  logSuccess('Inteiro teor recebido inline (pequeno).');
                } else if (available) {
                  await fetchFullTextContent(downloadPath || '', resp.jobId);
                } else {
                  logWarning('Inteiro teor não disponível para download neste job.');
                }
              }
            } else if (status.status === 'failed') {
              clearInterval(pollRef.current);
              setRunning(false);
              const msg = status.error || 'Processamento falhou.';
              logError(msg);
            }
          }
        } catch (e) {
          try { console.error('Erro ao consultar status do job', e); } catch (_) {}
          logWarning('Erro ao consultar status do job: ' + (e && (e.message || e.toString()) ? (e.message || e.toString()) : String(e)));
        }
      }, 2000);
    } catch (e) {
      logError('Erro ao iniciar processamento: ' + (e.message || e));
      setRunning(false);
    }
  }

  // server-side XML download removed; XML is generated client-side via "Gerar XML"

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
      {/* Moveu Nº do LIVRO para baixo de ACAO, alinhado à esquerda */}
        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>Nº do LIVRO</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={numeroLivro}
              onChange={e => setNumeroLivro(String(e.target.value || '').replace(/\D/g, ''))}
              placeholder="somente números"
              style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14, width: 160 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>Acervo</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={acervoGlobal}
              onChange={e => setAcervoGlobal(String(e.target.value || '').replace(/\D/g, '').slice(0,2))}
              placeholder="01"
              style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14, width: 72, textAlign: 'center' }} />
          </div>
        </div>
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
      <select value={tipoLivroCode} onChange={e => {
          const code = String(e.target.value || '1');
          setTipoLivroCode(code);
          const labelMap = { '1': 'NASCIMENTO', '2': 'CASAMENTO', '3': 'CASAMENTO_RELIGIOSO', '4': 'OBITO', '5': 'NATIMORTO', '6': 'PROCLAMAS', '7': 'LIVRO_E' };
          setTipoRegistro(labelMap[code] || 'NASCIMENTO');
        }}
        style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14, minWidth: 220 }}>
        <option value="1">Nascimento</option>
        <option value="2">Casamento</option>
        <option value="3">Casamento Religioso</option>
        <option value="4">Óbito</option>
        <option value="5">Natimorto</option>
        <option value="6">Proclamas</option>
        <option value="7">Livro E</option>
      </select>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>ESCRITA</label>
      <select value={tipoEscrita} onChange={e => setTipoEscrita(e.target.value)}
        style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14, minWidth: 220 }}>
        <option value="digitado">Digitado</option>
        <option value="manuscrito">Manuscrito</option>
        <option value="misto">Misto</option>
      </select>
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
                {/* Baixar XML (server-side) removed — use "Gerar XML" to generate client-side XML */}
                <button onClick={() => setShowRawResults(s => !s)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                  {showRawResults ? 'Ocultar JSON' : 'Mostrar JSON'}
                </button>
                <button onClick={handleGenerateMatriculas} disabled={running || results.length === 0}
                  title={results.length === 0 ? 'Nenhum registro para gerar' : 'Gerar matrículas para os registros mostrados'}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: running || results.length === 0 ? '#f1f5f9' : '#fff', cursor: running || results.length === 0 ? 'not-allowed' : 'pointer' }}>
                  Gerar Matrículas
                </button>
                <button onClick={handleSaveChangesAsXml} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', cursor: 'pointer' }}>
                  Gerar XML
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
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Matrícula</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Número da folha</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Número do termo</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Data do registro</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Nome do registrado</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Sexo</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Data de nascimento</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Filiação 1</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Filiação 2</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e6eef6' }}>Ações</th>
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
                          <input value={r && r.matricula ? r.matricula : ''} readOnly
                            style={{ width: 200, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', color: '#0f172a', background: '#fafafa' }} />
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
                          <input value={formatDateDisplay(getField(r, ['dataRegistro', 'data', 'registroData', 'date'])) || ''}
                            onChange={e => updateRecordField(i, 'dataRegistro', e.target.value)}
                            style={{ width: 140, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <input value={getField(r, ['nomeRegistrado', 'nome', 'name', 'registrado']) || ''}
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
                          <input value={formatDateDisplay(getField(r, ['dataNascimento', 'nascimento', 'birthDate', 'datanascimento'])) || ''}
                            onChange={e => updateRecordField(i, 'dataNascimento', e.target.value)}
                            style={{ width: 140, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <input value={getFiliacao(r, 0) || ''} onChange={e => updateRecordField(i, 'filiacao1', e.target.value)} style={{ width: 220, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <input value={getFiliacao(r, 1) || ''} onChange={e => updateRecordField(i, 'filiacao2', e.target.value)} style={{ width: 220, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                        </td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                              onClick={() => insertRecordAbove(i)}
                              title="Inserir registro acima"
                              style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #c7e0f4', background: '#e6f2fb', color: '#0b5394', cursor: 'pointer' }}
                            >
                              + Acima
                            </button>
                            <button
                              onClick={() => insertRecordBelow(i)}
                              title="Inserir registro abaixo"
                              style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #c7e0f4', background: '#e6f2fb', color: '#0b5394', cursor: 'pointer' }}
                            >
                              + Abaixo
                            </button>
                            <button
                              onClick={() => removeRecord(i)}
                              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontWeight: 700 }}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

          {(fullTextRequested || fullTextPreview || fullTextInline || fullTextAvailable || fullTextContent || fullTextLoading || fullTextError) && (
            <div style={{ width: '100%' }}>
              <div style={{ background: '#ffffff', borderRadius: 16, padding: 16, boxShadow: '0 10px 26px rgba(32,50,73,0.08)', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <h4 style={{ marginTop: 0, color: '#1f2937', marginBottom: 0 }}>Inteiro teor</h4>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {(fullTextAvailable || fullTextContent || fullTextInline || fullTextPreview) && (
                      <button
                        onClick={handleCopyFullText}
                        disabled={fullTextLoading || (!fullTextAvailable && !fullTextContent && !fullTextInline && !fullTextPreview)}
                        style={{
                          background: fullTextLoading ? '#94a3b8' : 'linear-gradient(135deg,#10b981,#059669)',
                          color: '#fff',
                          border: 'none',
                          padding: '10px 16px',
                          borderRadius: 10,
                          fontWeight: 800,
                          cursor: fullTextLoading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {fullTextLoading ? 'Carregando…' : 'Copiar inteiro teor'}
                      </button>
                    )}
                    {fullTextCopied && (
                      <span style={{ color: '#047857', fontWeight: 700, fontSize: 13 }}>Copiado!</span>
                    )}
                  </div>
                </div>
                {fullTextError && (
                  <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecdd3', padding: 10, borderRadius: 10, marginBottom: 10 }}>
                    {fullTextError}
                  </div>
                )}
                {(fullTextContent || fullTextPreview) ? (
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0f172a', color: '#e6eef6', padding: 12, borderRadius: 8, maxHeight: 420, overflow: 'auto', marginBottom: 0 }}>
                    {fullTextContent || fullTextPreview}
                  </pre>
                ) : (
                  <div style={{ color: '#64748b' }}>{fullTextLoading ? 'Carregando inteiro teor...' : 'Inteiro teor não disponível para este job.'}</div>
                )}
                {fullTextAvailable && !fullTextContent && !fullTextLoading && (
                  <div style={{ marginTop: 8, color: '#475569', fontSize: 13 }}>Prévia exibida; use "Copiar inteiro teor" para obter o texto completo.</div>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
