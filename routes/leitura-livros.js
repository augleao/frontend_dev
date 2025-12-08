const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const multer = require('multer');
const { create } = require('xmlbuilder2');
const archiver = require('archiver');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const forge = require('node-forge');
const { authenticate } = require('../middlewares/auth');
const pool = require('../db');
const { resolveIaModel, resolveIaModels, resolveUserServentiaNome, resolveModelCandidates } = require('../utils/iaHelpers');

// Configs
const JOBS_ROOT = process.env.LEITURA_JOBS_DIR || path.join(__dirname, '..', 'jobs');
const ALLOWED_FOLDERS = (process.env.LEITURA_ALLOWED_FOLDERS || '')
  .split(/[;,]/)
  .map((s) => s.trim())
  .filter(Boolean);

function ensureDirSync(p) { fs.mkdirSync(p, { recursive: true }); }
ensureDirSync(JOBS_ROOT);

// Multer for uploads: save into a temp area under jobs root
const tempUploadsDir = path.join(JOBS_ROOT, '_uploads');
ensureDirSync(tempUploadsDir);
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempUploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')),
  }),
  limits: { fileSize: 80 * 1024 * 1024, files: 200 },
  fileFilter: (req, file, cb) => {
    const nameOk = /\.(jpg|jpeg|png|tif|tiff|pdf|p7s)$/i.test(file.originalname);
    const typeOk = ['image/jpeg','image/png','image/tiff','application/pdf','application/pkcs7-signature','application/pkcs7-mime','application/x-pkcs7-signature','application/x-pkcs7-mime'].includes(file.mimetype);
    const ok = nameOk || typeOk;
    if (!ok) return cb(new Error('Apenas imagens (jpg/png/tiff), PDF e .p7s são permitidos'), false);
    cb(null, true);
  },
});

function newJobId() {
  try { return require('crypto').randomUUID(); } catch { return String(Date.now()) + '-' + Math.random().toString(36).slice(2); }
}

function validateParams(body) {
  const errors = [];
  const p = {
    versao: String(body.versao || '').trim(),
    acao: String(body.acao || '').trim(),
    cns: String(body.cns || '').trim(),
    tipoRegistro: String(body.tipoRegistro || '').trim().toUpperCase(),
    maxPorArquivo: body.maxPorArquivo != null ? Number(body.maxPorArquivo) : 2500,
    inclusaoPrimeiro: body.inclusaoPrimeiro !== false,
  };
  if (!p.versao) errors.push('versao é obrigatório');
  if (!p.acao) errors.push('acao é obrigatório');
  if (!p.cns) errors.push('cns é obrigatório');
  if (!['NASCIMENTO','CASAMENTO','OBITO'].includes(p.tipoRegistro)) errors.push('tipoRegistro inválido');
  if (!Number.isFinite(p.maxPorArquivo) || p.maxPorArquivo <= 0) errors.push('maxPorArquivo inválido');
  return { params: p, errors };
}

function jobPaths(jobId) {
  const dir = path.join(JOBS_ROOT, jobId);
  return {
    dir,
    status: path.join(dir, 'status.json'),
    inputs: path.join(dir, 'inputs.json'),
    result: path.join(dir, 'result.json'),
  };
}

async function writeJSON(file, data) {
  await fsp.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}
async function readJSON(file) {
  const txt = await fsp.readFile(file, 'utf8');
  return JSON.parse(txt);
}

function pushMessage(statusObj, level, text) {
  const tag = level.toLowerCase();
  let prefix = '[info]';
  if (tag === 'title') prefix = '[title]';
  else if (tag === 'success') prefix = '[success]';
  else if (tag === 'warning') prefix = '[warning]';
  else if (tag === 'error') prefix = '[error]';
  statusObj.messages.push(`${prefix} ${text}`);
}

// Import shared IA helpers (DB-driven model resolution, serventia resolution)
// Exports: resolveIaModel, resolveIaModels, resolveUserServentiaNome, resolveModelCandidates

function parseJsonLoose(raw) {
  try {
    let clean = String(raw || '').trim();
    if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(clean); } catch (_) {}
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const slice = clean.slice(start, end + 1);
      try { return JSON.parse(slice); } catch (_) {}
    }
  } catch (_) {}
  return null;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function callWithRetries(fn, opts = {}) {
  const retries = Number(opts.retries ?? 2);
  const base = Number(opts.baseDelayMs ?? 500);
  let attempt = 0;
  const jitter = () => Math.floor(Math.random() * 200);
  const isRetryable = (e) => {
    const s = e && (e.status || e.code || (e.cause && e.cause.status));
    return s === 429 || s === 503 || s === 'RESOURCE_EXHAUSTED';
  };
  while (true) {
    try { return await fn(); }
    catch (e) { if (attempt >= retries || !isRetryable(e)) throw e; attempt += 1; const delay = base * Math.pow(2, attempt - 1) + jitter(); await sleep(delay); }
  }
}

function clampForPrompt(s) {
  const max = Math.max(1000, Number(process.env.IA_MAX_INPUT_CHARS || 120000));
  const str = String(s || '');
  return str.length > max ? str.slice(0, max) : str;
}

function renderTemplate(tpl, ctx = {}) {
  const map = ctx || {};
  return String(tpl || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = map[k];
    return v == null ? '' : String(v);
  });
}

function isStrictMode() {
  return String(process.env.IA_STRICT_MODE || '').toLowerCase() === 'true';
}

function addStrictPreamble(prompt, tipoReg) {
  if (!isStrictMode()) return prompt;
  const rules = `REGRAS ESTRITAS (NÃO INVENTAR):
- NÃO deduza ou invente NENHUM valor.
- Se o dado não estiver legível no documento, deixe o campo vazio (string vazia) e NÃO preencha com suposições.
- Copie números e datas exatamente como aparecem (DD/MM/AAAA quando possível). Nomes em CAIXA ALTA.
- Não "corrija" ortografia antiga.
- Se houver dúvida, prefira deixar vazio.`;
  return `${rules}\n\n${prompt}`;
}

// --- IA logging helpers ---
async function flushStatus(status) {
  try {
    if (!status || !status.jobId) return;
    await writeJSON(jobPaths(status.jobId).status, status);
  } catch (_) {}
}

async function safeLogPrompt(status, label, promptText, extra = {}) {
  try {
    // By default, do not log prompt contents. Enable only if IA_LOG_PROMPTS=true
    const shouldLog = String(process.env.IA_LOG_PROMPTS || '').toLowerCase() === 'true';
    if (!shouldLog) return;
    // Never log the tipo_escrita prompt (by request)
    const lbl = String(label || '').toLowerCase();
    if (lbl.startsWith('tipo_escrita')) return;
    const max = Math.max(500, Number(process.env.IA_LOG_MAX || 2000));
    const text = String(promptText || '');
    const truncated = text.length > max ? (text.slice(0, max) + ' …[truncado]') : text;
    const meta = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
    pushMessage(status, 'info', `IA • Prompt (${label}) — enviado${meta ? ' ' + meta : ''}:\n${truncated}`);
    await flushStatus(status);
  } catch (_) {}
}

async function safeLogResponse(status, label, rawText) {
  try {
    // Never log the tipo_escrita responses (by request)
    const lbl = String(label || '').toLowerCase();
    if (lbl.startsWith('tipo_escrita')) return;
    const max = Math.max(500, Number(process.env.IA_LOG_MAX || 2000));
    const text = String(rawText || '');
    const truncated = text.length > max ? (text.slice(0, max) + ' …[truncado]') : text;
    pushMessage(status, 'info', `IA • Resposta (${label}) — bruta:
${truncated}`);
    await flushStatus(status);
  } catch (_) {}
}

// Log a preview of extracted text for debugging (always truncated)
function logExtractedText(status, source, text) {
  try {
    const max = Math.max(300, Number(process.env.IA_LOG_TEXT_MAX || 1200));
    const t = String(text || '');
    const preview = t.length > max ? (t.slice(0, max) + ' …[truncado]') : t;
    const msg = `Texto extraído (${source}): ${t.length} caracteres. Prévia:\n${preview}`;
    // Console output to help during live debugging
    try { console.log(msg); } catch(_) {}
    pushMessage(status, 'info', msg);
  } catch(_) {}
}

// Prompts via DB (mesma lógica do módulo IA)
async function ensurePromptsTable() {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.ia_prompts (
        id SERIAL PRIMARY KEY,
        indexador TEXT UNIQUE NOT NULL,
        prompt TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_ia_prompts'
        ) THEN
          CREATE TRIGGER set_timestamp_ia_prompts
          BEFORE UPDATE ON public.ia_prompts
          FOR EACH ROW
          EXECUTE PROCEDURE public.trigger_set_timestamp();
        END IF;
      END $$;
    `);
  } catch (_) {}
}



async function getPromptByIndexador(indexador) {
  if (!pool) return null;
  try {
    await ensurePromptsTable();
    const { rows } = await pool.query(
      'SELECT indexador, prompt, updated_at FROM public.ia_prompts WHERE indexador = $1 LIMIT 1',
      [String(indexador || '').toLowerCase()]
    );
    return rows && rows[0] ? rows[0] : null;
  } catch (_) {
    return null;
  }
}

function isPathAllowed(folderPath) {
  if (!ALLOWED_FOLDERS.length) return false; // must configure whitelist
  const resolved = path.resolve(folderPath);
  if (resolved.includes('..')) return false; // basic traversal guard
  return ALLOWED_FOLDERS.some((base) => {
    const allowedBase = path.resolve(base);
    return resolved.startsWith(allowedBase + path.sep) || resolved === allowedBase;
  });
}

async function extractP7s(files) {
  const fd = new FormData();
  files.forEach((f, i) => fd.append('files', f, f.name || `file${i}`));
  const res = await withAuthFetch(`${config.apiURL}/leitura-livros/extract-p7s`, {
    method: 'POST',
    body: fd
  });
  if (!res.ok) throw new Error('Falha ao extrair payloads de .p7s');
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  // fallback: return blob for binary responses
  return { blob: await res.blob(), contentType: ct };
}

// OCR/extração com suporte a imagens, PDF e .p7s
async function ocrAndExtractRecords(filePaths, params, status, cancelFlagRef, ctx = {}) {
  const records = [];
  const seen = new Set();
  let processed = 0;
  for (const fp of filePaths) {
    if (seen.has(fp)) { continue; }
    if (cancelFlagRef.cancelled) break;
    const baseName = path.basename(fp);
    pushMessage(status, 'info', `Processando arquivo: ${baseName}`);
    try {
      const ext = path.extname(fp).toLowerCase();
      if (ext === '.p7s') {
        pushMessage(status, 'title', 'Verificando assinatura .p7s');
        const buf = await fsp.readFile(fp);
        const payload = await extractP7sPayload(buf, status);
        if (payload && payload.buffer) {
          const detected = detectContentType(payload.buffer);
          const outName = `${baseName}.payload${detected.ext}`;
          const outPath = path.join(path.dirname(fp), outName);
          await fsp.writeFile(outPath, payload.buffer);
            if (detected.type === 'pdf') {
            const text = await extractPdfText(outPath, status);
            await maybeProduceRecordFromText(text, outPath, records, params, status, ctx);
          } else if (detected.type === 'image') {
            // Classificar escrita via imagem; se manuscrito, IA multimodal; senão OCR + IA texto
            let recFromImg = null;
            let escritaTipo = null;
            let escritaReg = null;
            try {
              const escritaImg = await identifyEscritaWithGeminiImage(outPath, status, ctx);
              escritaTipo = escritaImg && escritaImg.tipo ? escritaImg.tipo : null;
              escritaReg = escritaImg && escritaImg.tipoRegistro ? escritaImg.tipoRegistro : null;
              if (escritaImg && escritaImg.tipo === 'manuscrito') {
                  recFromImg = await analyzeRecordFromImageWithGemini(outPath, params, status, { tipoRegistroOverride: escritaReg }, ctx);
              }
            } catch (_) {}
            if (recFromImg) {
              // Sempre inclusão, conforme requisito
              recFromImg.tipo = 'INCLUSAO';
              recFromImg.origens = [...(recFromImg.origens || []), path.basename(outPath)];
              if (!recFromImg.campos || typeof recFromImg.campos !== 'object') recFromImg.campos = {};
              if (!Array.isArray(recFromImg.filiacao)) recFromImg.filiacao = [];
              if (!Array.isArray(recFromImg.documentos)) recFromImg.documentos = [];
              records.push(recFromImg);
            } else {
          const text = await ocrImage(outPath, status);
        await maybeProduceRecordFromText(text, outPath, records, params, status, { writingType: escritaTipo || 'digitado', tipoRegistroOverride: escritaReg }, ctx);
            }
          } else {
            pushMessage(status, 'warning', `Payload extraído do .p7s com tipo desconhecido; ignorando (${outName})`);
          }
        } else {
          // Tentativa de pareamento: mesmo nome sem .p7s com extensões comuns
          const paired = findPairForDetachedP7s(fp, filePaths);
            if (paired) {
            pushMessage(status, 'info', `Assinatura destacada pareada com arquivo: ${path.basename(paired)}`);
            const pext = path.extname(paired).toLowerCase();
            if (pext === '.pdf') {
              const text = await extractPdfText(paired, status);
              if (text && text.trim().length >= 5) {
                  await maybeProduceRecordFromText(text, paired, records, params, status, {}, ctx);
              } else {
                pushMessage(status, 'warning', `Arquivo pareado (${path.basename(paired)}) não possui texto nativo`);
              }
            } else {
              const text = await ocrImage(paired, status);
              await maybeProduceRecordFromText(text, paired, records, params, status, {}, ctx);
            }
            seen.add(paired); // Evita processar o arquivo pareado novamente no loop
          } else {
            pushMessage(status, 'warning', 'Arquivo .p7s com assinatura destacada (sem conteúdo). Não foi encontrado arquivo original correspondente. Envie o arquivo original (ex.: PDF/imagem) com o MESMO nome do .p7s.');
          }
        }
      } else if (ext === '.pdf') {
          const text = await extractPdfText(fp, status);
        if (!text || text.trim().length < 10) {
          pushMessage(status, 'warning', 'PDF sem texto nativo detectado; rasterização para OCR não está habilitada neste ambiente');
        } else {
            await maybeProduceRecordFromText(text, fp, records, params, status, {}, ctx);
        }
      } else {
        // imagem
        let recFromImg = null;
        let escritaTipo = null;
        let escritaReg = null;
        try {
          const escritaImg = await identifyEscritaWithGeminiImage(fp, status, ctx);
          escritaTipo = escritaImg && escritaImg.tipo ? escritaImg.tipo : null;
          escritaReg = escritaImg && escritaImg.tipoRegistro ? escritaImg.tipoRegistro : null;
          if (escritaImg && escritaImg.tipo === 'manuscrito') {
            recFromImg = await analyzeRecordFromImageWithGemini(fp, params, status, { tipoRegistroOverride: escritaReg }, ctx);
          }
        } catch (_) {}
        if (recFromImg) {
          // Sempre inclusão, conforme requisito
          recFromImg.tipo = 'INCLUSAO';
          recFromImg.origens = [...(recFromImg.origens || []), path.basename(fp)];
          if (!recFromImg.campos || typeof recFromImg.campos !== 'object') recFromImg.campos = {};
          if (!Array.isArray(recFromImg.filiacao)) recFromImg.filiacao = [];
          if (!Array.isArray(recFromImg.documentos)) recFromImg.documentos = [];
          records.push(recFromImg);
        } else {
          const text = await ocrImage(fp, status);
          await maybeProduceRecordFromText(text, fp, records, params, status, { writingType: escritaTipo || 'digitado', tipoRegistroOverride: escritaReg }, ctx);
        }
      }
    } catch (err) {
      pushMessage(status, 'warning', `Falha ao processar ${path.basename(fp)}: ${err.message}`);
    }
    seen.add(fp);
    processed++;
    status.progress = Math.min(99, Math.round((processed / filePaths.length) * 80) + 10);
    await writeJSON(jobPaths(status.jobId).status, status);
  }
  return records;
}

function guessField(text, regex, fallback) {
  const m = text.match(regex);
  return m && m[1] ? m[1].trim() : fallback;
}

function buildXmlFiles(records, params, jobDir) {
  // Order: inclusões antes de alterações
  const inclusoes = records.filter(r => r.tipo === 'INCLUSAO');
  const alteracoes = records.filter(r => r.tipo === 'ALTERACAO');
  const ordered = params.inclusaoPrimeiro ? [...inclusoes, ...alteracoes] : [...alteracoes, ...inclusoes];

  const chunks = [];
  for (let i = 0; i < ordered.length; i += params.maxPorArquivo) {
    chunks.push(ordered.slice(i, i + params.maxPorArquivo));
  }

  const xmlPaths = [];
  chunks.forEach((chunk, idx) => {
    // Uppercase tags per spec
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('CARGAREGISTROS')
        .ele('VERSAO').txt(params.versao).up()
        .ele('ACAO').txt(params.acao).up()
        .ele('CNS').txt(params.cns).up();

    const tipo = params.tipoRegistro;
    const blocoTag = tipo === 'NASCIMENTO' ? 'MOVIMENTONASCIMENTOTN'
                    : tipo === 'CASAMENTO' ? 'MOVIMENTOCASAMENTOTC'
                    : 'MOVIMENTOOBITOTO';
    const bloco = root.ele(blocoTag);

    for (let i = 0; i < chunk.length; i++) {
      const r = chunk[i];
      const indice = i + 1; // por arquivo
      const isNascimento = (tipo === 'NASCIMENTO');
      const isCasamento = (tipo === 'CASAMENTO');
      const isObito = (tipo === 'OBITO');
        const tagRegistro = (r.tipo === 'INCLUSAO')
        ? (tipo === 'NASCIMENTO' ? 'REGISTRONASCIMENTOINCLUSAO' : tipo === 'CASAMENTO' ? 'REGISTROCASAMENTOINCLUSAO' : 'REGISTROOBITOINCLUSAO')
        : (tipo === 'NASCIMENTO' ? 'REGISTRONASCIMENTOALTERACAO' : tipo === 'CASAMENTO' ? 'REGISTROCASAMENTOALTERACAO' : 'REGISTROOBITOALTERACAO');

      const reg = bloco.ele(tagRegistro);
      reg.ele('INDICEREGISTRO').txt(String(indice)).up();

      const campos = r.campos || {};
      const write = (node, tag, val) => node.ele(tag).txt(val == null ? '' : String(val)).up();

      if (isNascimento && r.tipo === 'INCLUSAO') {
        // Ordem de tags conforme manual v2.6 para Inclusão de Nascimento
        const orderInc = [
          'NOMEREGISTRADO',
          'CPFREGISTRADO',
          'MATRICULA',
          'DATAREGISTRO',
          'DNV',
          'DATANASCIMENTO',
          'HORANASCIMENTO',
          'LOCALNASCIMENTO',
          'SEXO',
          'POSSUIGEMEOS',
          'NUMEROGEMEOS',
          'CODIGOIBGEMUNNASCIMENTO',
          'PAISNASCIMENTO',
          'NACIONALIDADE',
          'TEXTONACIONALIDADEESTRANGEIRO'
        ];
        orderInc.forEach(tag => write(reg, tag, campos[tag]));

        // FILIACAONASCIMENTO (estrutura ordenada)
        if (Array.isArray(r.filiacao)) {
          r.filiacao.forEach((f, idxF) => {
            const fNode = reg.ele('FILIACAONASCIMENTO');
            write(fNode, 'INDICEREGISTRO', String(indice));
            write(fNode, 'INDICEFILIACAO', String(idxF + 1));
            const fOrder = [
              'NOME','SEXO','CPF','DATANASCIMENTO','IDADE','IDADE_DIAS_MESES_ANOS',
              'CODIGOIBGEMUNLOGRADOURO','LOGRADOURO','NUMEROLOGRADOURO','COMPLEMENTOLOGRADOURO','BAIRRO',
              'NACIONALIDADE','DOMICILIOESTRANGEIRO','CODIGOIBGEMUNNATURALIDADE','TEXTOLIVREMUNICIPIONAT','CODIGOOCUPACAOSDC'
            ];
            fOrder.forEach(tg => write(fNode, tg, f && f[tg]));
          });
        }

        // DOCUMENTOS
        if (Array.isArray(r.documentos)) {
          r.documentos.forEach((d) => {
            const dNode = reg.ele('DOCUMENTOS');
            write(dNode, 'INDICEREGISTRO', String(indice));
            if (d.INDICEFILIACAO != null) write(dNode, 'INDICEFILIACAO', String(d.INDICEFILIACAO));
            write(dNode, 'DONO', d.DONO || 'FILIACAO_NASCIMENTO');
            const dOrder = ['TIPO_DOC','DESCRICAO','NUMERO','NUMERO_SERIE','CODIGOORGAOEMISSOR','UF_EMISSAO','DATA_EMISSAO'];
            dOrder.forEach(tg => write(dNode, tg, d && d[tg]));
          });
        }

        // Campos finais conforme template de Inclusão
        write(reg, 'ORGAOEMISSOREXTERIOR', campos['ORGAOEMISSOREXTERIOR']);
        write(reg, 'INFORMACOESCONSULADO', campos['INFORMACOESCONSULADO']);
        write(reg, 'OBSERVACOES', campos['OBSERVACOES']);

      } else if (isCasamento && r.tipo === 'INCLUSAO') {
        // Inclusão de Casamento — ordem conforme manual v2.6 (Pág. 15)
        const orderCasInc = [
          'NOMECONJUGE1',
          'NOVONOMECONJUGE1',
          'CPFCONJUGE1',
          'SEXOCONJUGE1',
          'DATANASCIMENTOCONJUGE1',
          'NOMEPAICONJUGE1',
          'SEXOPAICONJUGE1',
          'NOMEMAECONJUGE1',
          'SEXOMAECONJUGE1',
          'CODIGOOCUPACAOSDCCONJUGE1',
          'PAISNASCIMENTOCONJUGE1',
          'NACIONALIDADECONJUGE1',
          'CODIGOIBGEMUNNATCONJUGE1',
          'TEXTOLIVREMUNNATCONJUGE1',
          'CODIGOIBGEMUNLOGRADOURO1',
          'DOMICILIOESTRANGEIRO1',
          'NOMECONJUGE2',
          'NOVONOMECONJUGE2',
          'CPFCONJUGE2',
          'SEXOCONJUGE2',
          'DATANASCIMENTOCONJUGE2',
          'NOMEPAICONJUGE2',
          'SEXOPAICONJUGE2',
          'NOMEMAECONJUGE2',
          'SEXOMAECONJUGE2',
          'CODIGOOCUPACAOSDCCONJUGE2',
          'PAISNASCIMENTOCONJUGE2',
          'NACIONALIDADECONJUGE2',
          'CODIGOIBGEMUNNATCONJUGE2',
          'TEXTOLIVREMUNNATCONJUGE2',
          'CODIGOIBGEMUNLOGRADOURO2',
          'DOMICILIOESTRANGEIRO2',
          'MATRICULA',
          'DATAREGISTRO',
          'DATACASAMENTO',
          'REGIMECASAMENTO'
        ];
        orderCasInc.forEach(tag => write(reg, tag, campos[tag]));

        // DOCUMENTOS
        if (Array.isArray(r.documentos)) {
          r.documentos.forEach((d) => {
            const dNode = reg.ele('DOCUMENTOS');
            write(dNode, 'INDICEREGISTRO', String(indice));
            write(dNode, 'DONO', d.DONO || 'CONJUGE1');
            const dOrder = ['TIPO_DOC','DESCRICAO','NUMERO','NUMERO_SERIE','CODIGOORGAOEMISSOR','UF_EMISSAO','DATA_EMISSAO'];
            dOrder.forEach(tg => write(dNode, tg, d && d[tg]));
          });
        }

        // Campos finais
        write(reg, 'ORGAOEMISSOREXTERIOR', campos['ORGAOEMISSOREXTERIOR']);
        write(reg, 'INFORMACOESCONSULADO', campos['INFORMACOESCONSULADO']);
        write(reg, 'OBSERVACOES', campos['OBSERVACOES']);

      } else if (isObito && r.tipo === 'INCLUSAO') {
        // Inclusão de Óbito — ordem conforme manual v2.6 (Pág. 19)
        const orderObitoHead = [
          'FLAGDESCONHECIDO',
          'NOMEFALECIDO',
          'CPFFALECIDO',
          'MATRICULA',
          'DATAREGISTRO',
          'NOMEPAI',
          'CPFPAI',
          'SEXOPAI',
          'NOMEMAE',
          'CPFMAE',
          'SEXOMAE',
          'DATAOBITO',
          'HORAOBITO',
          'SEXO',
          'CORPELE',
          'ESTADOCIVIL',
          'DATANASCIMENTOFALECIDO',
          'IDADE',
          'IDADE_DIAS_MESES_ANOS',
          'ELEITOR',
          'POSSUIBENS',
          'CODIGOOCUPACAOSDC',
          'PAISNASCIMENTO',
          'NACIONALIDADE',
          'CODIGOIBGEMUNNATURALIDADE',
          'TEXTOLIVREMUNICIPIONAT',
          'CODIGOIBGEMUNLOGRADOURO',
          'DOMICILIOESTRANGEIROFALECIDO',
          'LOGRADOURO',
          'NUMEROLOGRADOURO',
          'COMPLEMENTOLOGRADOURO',
          'BAIRRO'
        ];
        orderObitoHead.forEach(tag => write(reg, tag, campos[tag]));

        // BENEFICIOS_PREVIDENCIARIOS (zero ou mais)
        if (Array.isArray(r.beneficios)) {
          r.beneficios.forEach((b) => {
            const bNode = reg.ele('BENEFICIOS_PREVIDENCIARIOS');
            write(bNode, 'INDICEREGISTRO', String(indice));
            write(bNode, 'NUMEROBENEFICIO', b && b.NUMEROBENEFICIO);
          });
        }

        // DOCUMENTOS (zero ou mais)
        if (Array.isArray(r.documentos)) {
          r.documentos.forEach((d) => {
            const dNode = reg.ele('DOCUMENTOS');
            write(dNode, 'INDICEREGISTRO', String(indice));
            write(dNode, 'DONO', d.DONO || 'FALECIDO');
            const dOrder = ['TIPO_DOC','DESCRICAO','NUMERO','NUMERO_SERIE','CODIGOORGAOEMISSOR','UF_EMISSAO','DATA_EMISSAO'];
            dOrder.forEach(tg => write(dNode, tg, d && d[tg]));
          });
        }

        // Campos finais de local, causas, atestantes e declarante
        const orderObitoTail = [
          'TIPOLOCALOBITO',
          'TIPOMORTE',
          'NUMDECLARACAOOBITO',
          'NUMDECLARACAOOBITOIGNORADA',
          'PAISOBITO',
          'CODIGOIBGEMUNLOGRADOUROOBITO',
          'ENDERECOLOCALOBITOESTRANGEIRO',
          'LOGRADOUROOBITO',
          'NUMEROLOGRADOUROOBITO',
          'COMPLEMENTOLOGRADOUROOBITO',
          'BAIRROOBITO',
          'CAUSAMORTEANTECEDENTES_A',
          'CAUSAMORTEANTECEDENTES_B',
          'CAUSAMORTEANTECEDENTES_C',
          'CAUSAMORTEANTECEDENTES_D',
          'CAUSAMORTEOUTRASCOND_A',
          'CAUSAMORTEOUTRASCOND_B',
          'LUGARFALECIMENTO',
          'LUGARSEPULTAMENTOCEMITERIO',
          'NOMEATESTANTEPRIMARIO',
          'CRMATESTANTEPRIMARIO',
          'NOMEATESTANTESECUNDARIO',
          'CRMATESTANTESECUNDARIO',
          'NOMEDECLARANTE',
          'CPFDECLARANTE'
        ];
        orderObitoTail.forEach(tag => write(reg, tag, campos[tag]));

        // Finais
        write(reg, 'ORGAOEMISSOREXTERIOR', campos['ORGAOEMISSOREXTERIOR']);
        write(reg, 'INFORMACOESCONSULADO', campos['INFORMACOESCONSULADO']);
        write(reg, 'OBSERVACOES', campos['OBSERVACOES']);

      } else if (isNascimento && r.tipo === 'ALTERACAO') {
        // Ordem de tags conforme manual v2.6 para Alteração de Nascimento
        const order = [
          'REGISTROINVISIVEL',
          'CODIGOMOTIVOALTERACAO',
          'DATAAVERBACAO',
          'NOMEREGISTRADO',
          'CPFREGISTRADO',
          'MATRICULA',
          'DATAREGISTRO',
          'DNV',
          'DATANASCIMENTO',
          'HORANASCIMENTO',
          'LOCALNASCIMENTO',
          'SEXO',
          'POSSUIGEMEOS',
          'NUMEROGEMEOS',
          'CODIGOIBGEMUNNASCIMENTO',
          'PAISNASCIMENTO',
          'NACIONALIDADE',
          'TEXTONACIONALIDADEESTRANGEIRO'
        ];
        order.forEach(tag => write(reg, tag, campos[tag]));

        // FILIACAONASCIMENTO (estrutura ordenada)
        if (Array.isArray(r.filiacao)) {
          r.filiacao.forEach((f, idxF) => {
            const fNode = reg.ele('FILIACAONASCIMENTO');
            write(fNode, 'INDICEREGISTRO', String(indice));
            write(fNode, 'INDICEFILIACAO', String(idxF + 1));
            const fOrder = [
              'NOME','SEXO','CPF','DATANASCIMENTO','IDADE','IDADE_DIAS_MESES_ANOS',
              'CODIGOIBGEMUNLOGRADOURO','LOGRADOURO','NUMEROLOGRADOURO','COMPLEMENTOLOGRADOURO','BAIRRO',
              'NACIONALIDADE','DOMICILIOESTRANGEIRO','CODIGOIBGEMUNNATURALIDADE','TEXTOLIVREMUNICIPIONAT','CODIGOOCUPACAOSDC'
            ];
            fOrder.forEach(tg => write(fNode, tg, f && f[tg]));
          });
        }

        // DOCUMENTOS
        if (Array.isArray(r.documentos)) {
          r.documentos.forEach((d) => {
            const dNode = reg.ele('DOCUMENTOS');
            write(dNode, 'INDICEREGISTRO', String(indice));
            if (d.INDICEFILIACAO != null) write(dNode, 'INDICEFILIACAO', String(d.INDICEFILIACAO));
            write(dNode, 'DONO', d.DONO || 'FILIACAO_NASCIMENTO');
            const dOrder = ['TIPO_DOC','DESCRICAO','NUMERO','NUMERO_SERIE','CODIGOORGAOEMISSOR','UF_EMISSAO','DATA_EMISSAO'];
            dOrder.forEach(tg => write(dNode, tg, d && d[tg]));
          });
        }

        // Campos finais conforme template
        write(reg, 'OBSERVACOES', campos['OBSERVACOES']);
        write(reg, 'ORGAOEMISSOREXTERIOR', campos['ORGAOEMISSOREXTERIOR']);
        write(reg, 'INFORMACOESCONSULADO', campos['INFORMACOESCONSULADO']);

      } else {
        // Caminho genérico atual (mantido para Inclusão e demais tipos)
        Object.entries(campos).forEach(([k, v]) => {
          write(reg, String(k).toUpperCase(), v);
        });
        if (isNascimento && Array.isArray(r.filiacao)) {
          r.filiacao.forEach((f, idxF) => {
            const fNode = reg.ele('FILIACAONASCIMENTO');
            write(fNode, 'INDICEREGISTRO', String(indice));
            write(fNode, 'INDICEFILIACAO', String(idxF + 1));
            Object.entries(f).forEach(([k, v]) => write(fNode, String(k).toUpperCase(), v));
          });
        }
        if (Array.isArray(r.documentos)) {
          r.documentos.forEach((d) => {
            const dNode = reg.ele('DOCUMENTOS');
            write(dNode, 'INDICEREGISTRO', String(indice));
            Object.entries(d).forEach(([k, v]) => write(dNode, String(k).toUpperCase(), v));
          });
        }
      }
    }

    const xml = root.end({ prettyPrint: true });
    const filename = `crc_${tipo.toLowerCase()}_${params.acao.toLowerCase()}_${path.basename(jobDir)}${chunks.length > 1 ? '_' + (idx + 1) : ''}.xml`;
    const xmlPath = path.join(jobDir, filename);
    fs.writeFileSync(xmlPath, xml, 'utf8');
    xmlPaths.push(xmlPath);
  });

  return xmlPaths;
}

// IA-based XML generation using DB prompts xml_nascimento | xml_casamento | xml_obito
function mapTipoToXmlIndexador(tipo) {
  const t = String(tipo || '').toUpperCase();
  if (t === 'NASCIMENTO') return 'xml_nascimento';
  if (t === 'CASAMENTO') return 'xml_casamento';
  if (t === 'OBITO') return 'xml_obito';
  return null;
}

async function buildXmlFilesViaIa(records, params, jobDir, status, ctx = {}) {
  try {
    const idx = mapTipoToXmlIndexador(params.tipoRegistro);
    if (!idx) return null;
    const row = await getPromptByIndexador(idx);
    if (!row || !row.prompt) return null; // no IA prompt configured -> fallback to code
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    // Chunk records same as code path
    const inclusoes = records.filter(r => r.tipo === 'INCLUSAO');
    const alteracoes = records.filter(r => r.tipo === 'ALTERACAO');
    const ordered = params.inclusaoPrimeiro ? [...inclusoes, ...alteracoes] : [...alteracoes, ...inclusoes];
    const chunks = [];
    for (let i = 0; i < ordered.length; i += params.maxPorArquivo) {
      chunks.push(ordered.slice(i, i + params.maxPorArquivo));
    }

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const candidates = (ctx && Array.isArray(ctx.modelCandidates) && ctx.modelCandidates.length) ? ctx.modelCandidates : null;
  let primary, secondary;
  if (candidates && candidates.length) { primary = candidates[0]; secondary = candidates[1] || candidates[0]; }
  else { const rr = resolveIaModels(); primary = rr.primary; secondary = rr.secondary; }

    const xmlPaths = [];

    // Helper: validate IA XML has meaningful non-empty content for required tags per tipo
    const iaXmlHasRequiredContent = (xml, tipo) => {
      try {
        const t = String(tipo || '').toUpperCase();
        const tags = t === 'NASCIMENTO'
          ? ['NOMEREGISTRADO', 'DATANASCIMENTO', 'DNV']
          : t === 'CASAMENTO'
          ? ['NOMECONJUGE1', 'NOMECONJUGE2', 'DATACASAMENTO']
          : ['NOMEFALECIDO', 'DATAOBITO'];
        const hasNonEmpty = (tag) => new RegExp(`<${tag}>\\s*([^<\\s][^<]*)</${tag}>`, 'i').test(xml);
        // Consider válido se pelo menos um dos campos chave vier preenchido
        return tags.some(hasNonEmpty);
      } catch(_) { return false; }
    };
    // helper para gerar XML de um chunk com um modelo
    const tryOnce = async (chunk, ci, modelName) => {
      const header = { VERSAO: params.versao, ACAO: params.acao, CNS: params.cns, tipoRegistro: params.tipoRegistro };
      const registros = chunk.map((r, i) => ({
        indice: i + 1,
        tipo: r.tipo,
        campos: r.campos || {},
        filiacao: Array.isArray(r.filiacao) ? r.filiacao : [],
        documentos: Array.isArray(r.documentos) ? r.documentos : [],
        beneficios: Array.isArray(r.beneficios) ? r.beneficios : [],
      }));

      const contextObj = { header, registros };
      const contextJson = JSON.stringify(contextObj, null, 2);
      const promptText = `${row.prompt}\n\nContexto (JSON):\n${contextJson}\n\nResponda APENAS o XML final, sem comentários ou explicações.`;
      await safeLogPrompt(status, `${idx} (xml)`, promptText, { model: modelName, chunk: `${ci + 1}/${chunks.length}` });
      const model = genAI.getGenerativeModel({ model: modelName });
      const resp = await callWithRetries(() => model.generateContent(clampForPrompt(promptText)), { retries: 3, baseDelayMs: 700 });
      const out = (resp && resp.response && resp.response.text && resp.response.text()) || '';
      await safeLogResponse(status, `${idx} (xml)`, out);
      const xml = String(out || '').trim();
      if (!xml || xml.length < 20 || !xml.includes('<CARGAREGISTROS')) return null;
      if (!iaXmlHasRequiredContent(xml, params.tipoRegistro)) return null;
      return xml;
    };

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      // Tenta com o modelo primário; se falhar nos essenciais, reforça com secundário
      let xml = await tryOnce(chunk, ci, primary);
      if (!xml) {
        pushMessage(status, 'info', `${idx}: reforçando geração de XML com modelo secundário (${secondary})`);
        xml = await tryOnce(chunk, ci, secondary);
      }
      if (!xml) {
        pushMessage(status, 'warning', 'IA não retornou XML válido com conteúdo essencial mesmo após reforço; fallback para gerador de código.');
        return null;
      }
      const filename = `crc_${params.tipoRegistro.toLowerCase()}_${params.acao.toLowerCase()}_${path.basename(jobDir)}${chunks.length > 1 ? '_' + (ci + 1) : ''}.xml`;
      const xmlPath = path.join(jobDir, filename);
      fs.writeFileSync(xmlPath, xml, 'utf8');
      xmlPaths.push(xmlPath);
    }
    return xmlPaths;
  } catch (e) {
    pushMessage(status, 'warning', `Falha ao gerar XML via IA: ${(e && e.message) || e}`);
    return null;
  }
}

async function runJob(jobId, inputs, params) {
  const paths = jobPaths(jobId);
  const status = { jobId, status: 'running', progress: 5, messages: [] };
  pushMessage(status, 'title', 'Preparando processamento');
  await writeJSON(paths.status, status);
  const cancelFlag = { cancelled: false };

  // Build execution context including model candidates resolved for this job's serventia
  const ctx = { userServentiaNome: (inputs && inputs.userServentiaNome) ? inputs.userServentiaNome : null, modelCandidates: [] };
  try { ctx.modelCandidates = await resolveModelCandidates({ serventiaNome: ctx.userServentiaNome }); } catch (_) { ctx.modelCandidates = []; }

  try {
    let filePaths = [];
    if (inputs.folderPath) {
      const entries = await fsp.readdir(inputs.folderPath);
      filePaths = entries
        .filter((n) => /\.(jpg|jpeg|png|tif|tiff|pdf|p7s)$/i.test(n))
        .map((n) => path.join(inputs.folderPath, n));
    } else if (Array.isArray(inputs.uploadedFiles)) {
      // Move uploaded temp files into job folder
      filePaths = [];
      for (const file of inputs.uploadedFiles) {
        const dest = path.join(paths.dir, file.originalname);
        try { await fsp.copyFile(file.path, dest); } finally { await fsp.unlink(file.path).catch(() => {}); }
        filePaths.push(dest);
      }
    }

    pushMessage(status, 'info', `Lendo ${filePaths.length} arquivo(s)...`);
    // bump progress to show work started
    status.progress = 10;
    await writeJSON(paths.status, status);

    // indicate we're about to start extraction/IA work
    status.progress = 15;
    await writeJSON(paths.status, status);

  const records = await ocrAndExtractRecords(filePaths, params, status, cancelFlag, ctx);

    // after extraction, ensure progress advances (extraction may have already updated progress)
    try {
      status.progress = Math.max(status.progress || 0, 70);
      await writeJSON(paths.status, status);
    } catch (_) {}

    pushMessage(status, 'info', 'Normalizando e produzindo resultado (JSON) — sem geração automática de XML.');
    await writeJSON(paths.status, status);

    // Produce result JSON containing only extracted records and params.
    const result = {
      params,
      records,
      recordsCount: Array.isArray(records) ? records.length : 0
    };
    await writeJSON(paths.result, result);

    status.status = 'done';
    status.progress = 100;
    pushMessage(status, 'success', 'Processamento concluído (registros extraídos e gravados em JSON)');
    await writeJSON(paths.status, status);
  } catch (err) {
    status.status = 'failed';
    pushMessage(status, 'error', err.message || String(err));
    await writeJSON(paths.status, status);
  }
}

async function ocrImage(imagePath, status) {
  const ocr = await Tesseract.recognize(imagePath, 'por', { logger: () => {} });
  const txt = (ocr.data.text || '').trim();
  if (status) logExtractedText(status, path.basename(imagePath), txt);
  return txt;
}

// Infer MIME type from image extension
function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.tif' || ext === '.tiff') return 'image/tiff';
  return 'application/octet-stream';
}

// IA: classificar escrita diretamente a partir da imagem (digitado x manuscrito)
async function identifyEscritaWithGeminiImage(imagePath, status, ctx = {}) {
  if (process.env.IA_STUB === 'true') return { tipo: 'manuscrito', confidence: 0.55 };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const row = await getPromptByIndexador('tipo_escrita');
  const promptTpl = (row && row.prompt) || (
    'Classifique o tipo de escrita da imagem (digitado ou manuscrito) e identifique o tipo de registro (NASCIMENTO, CASAMENTO ou OBITO).\n' +
    'Responda APENAS JSON estrito neste formato:\n' +
    '{\n' +
    '  "tipo": "leitura_manuscrito" | "leitura_digitado",\n' +
    '  "confidence": number,\n' +
    '  "criterios": string[],\n' +
    '  "tipoRegistro": "NASCIMENTO" | "CASAMENTO" | "OBITO"\n' +
    '}'
  );
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const candidates = (ctx && Array.isArray(ctx.modelCandidates) && ctx.modelCandidates.length) ? ctx.modelCandidates : null;
    let primary, secondary;
    if (candidates && candidates.length) {
      primary = candidates[0];
      secondary = candidates[1] || candidates[0];
    } else {
      const r = resolveIaModels(); primary = r.primary; secondary = r.secondary;
    }
    const tryOnce = async (modelName) => {
      if (!modelName) {
        const msg = 'Nenhum agente IA configurado (modelName faltando). Defina ia_agent / ia_agent_fallback na tabela serventia.';
        try { pushMessage(status, 'warning', msg); } catch (_) { try { console.warn(msg); } catch(_){} }
        throw new Error(msg);
      }
      const model = genAI.getGenerativeModel({ model: modelName });
      const b64 = (await fsp.readFile(imagePath)).toString('base64');
      const parts = [ { text: promptTpl }, { inlineData: { mimeType: mimeFromExt(imagePath), data: b64 } } ];
      await safeLogPrompt(status, 'tipo_escrita (imagem)', promptTpl, { model: modelName, image: path.basename(imagePath) });
      const resp = await callWithRetries(() => model.generateContent(parts), { retries: 3, baseDelayMs: 700 });
      const out = (resp && resp.response && resp.response.text && resp.response.text()) || '';
      await safeLogResponse(status, 'tipo_escrita (imagem)', out);
      return parseJsonLoose(out);
    };
    let data = await tryOnce(primary);
    if (!data) {
      pushMessage(status, 'info', `tipo_escrita: reforçando com modelo secundário (${secondary})`);
      data = await tryOnce(secondary);
    }
    data = data || {};
    // tipo pode vir como leitura_manuscrito|leitura_digitado — normaliza
    let tipoRaw = String(data.tipo || '').toLowerCase();
    let tipo = tipoRaw.includes('manuscrito') ? 'manuscrito' : (tipoRaw.includes('digit') ? 'digitado' : 'digitado');
    const confidence = Number(data.confidence) || 0.6;
    const criterios = Array.isArray(data.criterios) ? data.criterios.slice(0, 5) : [];
    let tipoRegistro = String(data.tipoRegistro || '').toUpperCase();
    if (!['NASCIMENTO','CASAMENTO','OBITO'].includes(tipoRegistro)) {
      // tentativa leve baseada no texto bruto
      const lc = out.toLowerCase();
      if (lc.includes('nascimento')) tipoRegistro = 'NASCIMENTO';
      else if (lc.includes('casamento')) tipoRegistro = 'CASAMENTO';
      else if (lc.includes('óbito') || lc.includes('obito')) tipoRegistro = 'OBITO';
    }
    return { tipo, confidence, criterios, tipoRegistro };
  } catch (e) {
    pushMessage(status, 'warning', `Falha IA tipo_escrita (imagem): ${(e && e.message) || e}`);
    return null;
  }
}

// IA: ler manuscrito diretamente da imagem (sem OCR)
async function analyzeRecordFromImageWithGemini(imagePath, params, status, opts = {}, ctx = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const tipoReg = (opts && opts.tipoRegistroOverride) || params.tipoRegistro || 'NASCIMENTO';
  const row = await getPromptByIndexador('leitura_manuscrito') || await getPromptByIndexador('leitura_manuscito');
  const promptTpl = (row && row.prompt) || (
    'Leia e transcreva a imagem de registro manuscrito e extraia os campos no JSON esperado.\n' +
    'Responda APENAS JSON conforme:\n' +
    '{ "tipo": "INCLUSAO"|"ALTERACAO", "campos": { ... }, "filiacao"?: [ ... ], "documentos"?: [ ... ] }\n' +
    'Tipo de registro: {{tipoRegistro}}'
  );
  let prompt = renderTemplate(promptTpl, { tipoRegistro: tipoReg });
  prompt = addStrictPreamble(prompt, tipoReg);
  try {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const candidates = (ctx && Array.isArray(ctx.modelCandidates) && ctx.modelCandidates.length) ? ctx.modelCandidates : null;
  let primary, secondary;
  if (candidates && candidates.length) { primary = candidates[0]; secondary = candidates[1] || candidates[0]; }
  else { const r = resolveIaModels(); primary = r.primary; secondary = r.secondary; }
    const idxUsed = row ? (row.indexador || 'leitura_manuscrito') : 'leitura_manuscrito';
    const tryOnce = async (modelName) => {
      if (!modelName) {
        const msg = 'Nenhum agente IA configurado (modelName faltando). Defina ia_agent / ia_agent_fallback na tabela serventia.';
        try { pushMessage(status, 'warning', msg); } catch (_) { try { console.warn(msg); } catch(_){} }
        throw new Error(msg);
      }
      const model = genAI.getGenerativeModel({ model: modelName });
      const b64 = (await fsp.readFile(imagePath)).toString('base64');
      const parts = [ { text: prompt }, { inlineData: { mimeType: mimeFromExt(imagePath), data: b64 } } ];
      await safeLogPrompt(status, `${idxUsed} (imagem)`, prompt, { model: modelName, tipoRegistro: tipoReg, image: path.basename(imagePath) });
      const resp = await callWithRetries(() => model.generateContent(parts), { retries: 3, baseDelayMs: 700 });
      const out = (resp && resp.response && resp.response.text && resp.response.text()) || '';
      await safeLogResponse(status, `${idxUsed} (imagem)`, out);
      const data = parseJsonLoose(out);
      if (data && typeof data === 'object') {
        // Suporte ao formato { registros: [...] } — escolher o de melhor cobertura
        if (Array.isArray(data.registros) && data.registros.length > 0) {
          const upperTipo = String(tipoReg || '').toUpperCase();
          const list = data.registros.filter(r => !upperTipo || String(r.tipoRegistro || '').toUpperCase() === upperTipo || !r.tipoRegistro);
          let best = null;
          let bestScore = -1;
          for (const r of (list.length ? list : data.registros)) {
            const mapped = mapIaRegistroToNormalized(r, upperTipo);
            const sc = scoreRecordForTipo(mapped, upperTipo);
            if (mapped && sc > bestScore) { best = mapped; bestScore = sc; }
          }
          if (best) return best;
        }
        return normalizeRecordOutput(data, '', tipoReg);
      }
      return null;
    };
    let rec = await tryOnce(primary);
    if (!rec || isWeakRecord(rec, tipoReg)) {
      pushMessage(status, 'info', `${idxUsed}: reforçando com modelo secundário (${secondary})`);
      const rec2 = await tryOnce(secondary);
      if (rec2 && (!rec || isWeakRecord(rec, tipoReg))) rec = rec2;
    }
    // Em modo estrito, valida campos contra OCR do próprio documento
    if (rec && isStrictMode()) {
      try {
        const srcTxt = await ocrImage(imagePath, status);
        const filtered = enforceStrictEvidence(rec, srcTxt, tipoReg, status);
        rec = filtered || rec;
      } catch(_) {}
    }
    if (rec) return rec;
    return null;
  } catch (e) {
    pushMessage(status, 'warning', `Falha IA leitura_manuscrito: ${(e && e.message) || e}`);
    return null;
  }
}

// Converte YYYY-MM-DD -> DD/MM/AAAA
function toBrDate(s) {
  if (!s) return '';
  const str = String(s).trim();
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  return str;
}

function mapIaRegistroToNormalized(reg, tipoReg) {
  try {
    const t = String(tipoReg || '').toUpperCase();
    const dados = reg && reg.dados ? reg.dados : {};
    const out = { tipo: 'INCLUSAO', campos: {}, filiacao: [], documentos: [] };
    if (reg && reg.dataRegistro) out.campos['DATAREGISTRO'] = toBrDate(reg.dataRegistro);
    if (reg && reg.observacoes) out.campos['OBSERVACOES'] = String(reg.observacoes || '');

    if (t === 'NASCIMENTO' || !t) {
      if (dados.nomeRegistrado) out.campos['NOMEREGISTRADO'] = String(dados.nomeRegistrado).toUpperCase();
      if (dados.sexo) out.campos['SEXO'] = String(dados.sexo).toUpperCase();
      if (dados.dataNascimento) out.campos['DATANASCIMENTO'] = toBrDate(dados.dataNascimento);
      if (dados.horaNascimento) out.campos['HORANASCIMENTO'] = String(dados.horaNascimento);
      if (dados.localNascimento) out.campos['LOCALNASCIMENTO'] = String(dados.localNascimento);
      if (dados.dnv) out.campos['DNV'] = String(dados.dnv);
      const fil = Array.isArray(dados.filiacao) ? dados.filiacao : [];
      fil.forEach((f) => {
        const item = { NOME: String(f && f.nome || '').toUpperCase() };
        const tipo = String(f && f.tipo || '').toLowerCase();
        if (tipo === 'pai') item.SEXO = 'MASCULINO';
        else if (tipo === 'mae' || tipo === 'mãe') item.SEXO = 'FEMININO';
        out.filiacao.push(item);
      });
      const docs = reg && reg.documentos && Array.isArray(reg.documentos.lista) ? reg.documentos.lista : [];
      docs.forEach((d) => {
        const node = { DONO: 'FILIACAO_NASCIMENTO' };
        if (d.tipo) node.TIPO_DOC = String(d.tipo);
        if (d.descricao) node.DESCRICAO = String(d.descricao);
        if (d.numero) node.NUMERO = String(d.numero);
        out.documentos.push(node);
      });
      return out;
    }

    if (t === 'CASAMENTO') {
      if (dados.nubente1) out.campos['NOMECONJUGE1'] = String(dados.nubente1).toUpperCase();
      if (dados.nubente2) out.campos['NOMECONJUGE2'] = String(dados.nubente2).toUpperCase();
      if (dados.dataCasamento) out.campos['DATACASAMENTO'] = toBrDate(dados.dataCasamento);
      if (dados.regimeBens) out.campos['REGIMECASAMENTO'] = String(dados.regimeBens).toUpperCase();
      return out;
    }

    if (t === 'OBITO') {
      if (dados.nomeFalecido) out.campos['NOMEFALECIDO'] = String(dados.nomeFalecido).toUpperCase();
      if (dados.dataObito) out.campos['DATAOBITO'] = toBrDate(dados.dataObito);
      if (dados.horaObito) out.campos['HORAOBITO'] = String(dados.horaObito);
      return out;
    }
    return null;
  } catch (_) { return null; }
}

function scoreRecordForTipo(rec, tipoReg) {
  try {
    if (!rec || !rec.campos) return 0;
    const c = rec.campos || {};
    const t = String(tipoReg || '').toUpperCase();
    let keys = [];
    if (t === 'CASAMENTO') keys = ['NOMECONJUGE1','NOMECONJUGE2','DATACASAMENTO'];
    else if (t === 'OBITO') keys = ['NOMEFALECIDO','DATAOBITO'];
    else keys = ['NOMEREGISTRADO','DATANASCIMENTO','DNV','SEXO']; // Nascimento default
    let score = 0;
    keys.forEach(k => { if (c[k] && String(c[k]).trim()) score += 1; });
    if (Array.isArray(rec.filiacao) && rec.filiacao.length) score += 1;
    return score;
  } catch (_) { return 0; }
}

async function extractPdfText(pdfPath, status) {
  try {
    const dataBuffer = await fsp.readFile(pdfPath);
    const info = await pdfParse(dataBuffer);
    const txt = String(info.text || '').trim();
    logExtractedText(status, path.basename(pdfPath), txt);
    return txt;
  } catch (e) {
    pushMessage(status, 'warning', `Falha ao extrair texto PDF: ${e.message}`);
    return '';
  }
}

async function identifyEscritaWithGemini(text, status, ctx = {}) {
  // IA_STUB: heurística simples
  if (process.env.IA_STUB === 'true') {
    // Muito rudimentar: se houver muitos padrões de caligrafia típica (ex.: palavras quebradas e ruído), assume manuscrito
    const t = String(text || '');
    const digitadoHint = /[A-Za-z]{5,}\s+[A-Za-z]{5,}/.test(t) && (t.match(/[il1]{4,}/i) ? 0 : 1);
    const manuscritoHint = (t.match(/\b[a-z]{1,2}\b/g) || []).length > 20;
    const tipo = manuscritoHint && !digitadoHint ? 'manuscrito' : 'digitado';
    return { tipo, confidence: 0.6 };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const useText = clampForPrompt(text);
  const defaultTpl = `Classifique o tipo de escrita do texto OCR (digitado ou manuscrito) e identifique o tipo de registro (NASCIMENTO, CASAMENTO ou OBITO).
Responda APENAS JSON estrito no formato:
{
  "tipo": "leitura_manuscrito" | "leitura_digitado",
  "confidence": number,
  "tipoRegistro": "NASCIMENTO" | "CASAMENTO" | "OBITO"
}
Texto:
{{texto}}`;
  let promptTpl = defaultTpl;
  const row = await getPromptByIndexador('tipo_escrita');
  if (row && row.prompt) promptTpl = row.prompt;
  const prompt = renderTemplate(promptTpl, { texto: useText });
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const candidates = (ctx && Array.isArray(ctx.modelCandidates) && ctx.modelCandidates.length) ? ctx.modelCandidates : null;
    let primary, secondary;
    if (candidates && candidates.length) { primary = candidates[0]; secondary = candidates[1] || candidates[0]; }
    else { const r = resolveIaModels(); primary = r.primary; secondary = r.secondary; }
      const tryOnce = async (modelName) => {
      if (!modelName) {
        const msg = 'Nenhum agente IA configurado (modelName faltando). Defina ia_agent / ia_agent_fallback na tabela serventia.';
        try { pushMessage(status, 'warning', msg); } catch (_) { try { console.warn(msg); } catch(_){} }
        throw new Error(msg);
      }
      const model = genAI.getGenerativeModel({ model: modelName });
      await safeLogPrompt(status, 'tipo_escrita', prompt, { model: modelName, mode: 'texto' });
      const resp = await callWithRetries(() => model.generateContent(prompt), { retries: 3, baseDelayMs: 700 });
      const out = (resp && resp.response && resp.response.text && resp.response.text()) || '';
      await safeLogResponse(status, 'tipo_escrita', out);
      return parseJsonLoose(out);
    };
    let data = await tryOnce(primary);
    if (!data) {
      pushMessage(status, 'info', `tipo_escrita: reforçando com modelo secundário (${secondary})`);
      data = await tryOnce(secondary);
    }
    data = data || {};
    let tipoRaw = String(data.tipo || '').toLowerCase();
    let tipo = tipoRaw.includes('manuscrito') ? 'manuscrito' : (tipoRaw.includes('digit') ? 'digitado' : 'digitado');
    const confidence = Number(data.confidence) || 0.6;
    const criterios = Array.isArray(data.criterios) ? data.criterios.slice(0, 5) : [];
    let tipoRegistro = String(data.tipoRegistro || '').toUpperCase();
    if (!['NASCIMENTO','CASAMENTO','OBITO'].includes(tipoRegistro)) {
      const lc = out.toLowerCase();
      if (lc.includes('nascimento')) tipoRegistro = 'NASCIMENTO';
      else if (lc.includes('casamento')) tipoRegistro = 'CASAMENTO';
      else if (lc.includes('óbito') || lc.includes('obito')) tipoRegistro = 'OBITO';
    }
    return { tipo, confidence, criterios, tipoRegistro };
  } catch (e) {
    pushMessage(status, 'warning', `Falha ao classificar tipo de escrita: ${(e && e.message) || e}`);
    return null;
  }
}

async function analyzeRecordWithGemini(text, params, status, opts = {}, ctx = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (process.env.IA_STUB === 'true') {
      return {
        tipo: 'INCLUSAO',
        campos: {
          NOMEREGISTRADO: guessField(text, /Nome\s*[:\-]\s*(.+)/i, 'Ignorado(a)'),
          MATRICULA: guessField(text, /MATRICULA\s*[:\-]\s*(\d{10,})/i, ''),
          DATAREGISTRO: guessField(text, /Data\s*do\s*Registro\s*[:\-]\s*(\d{2}\/\d{2}\/\d{4})/i, ''),
        },
        filiacao: [],
        documentos: [],
      };
    }
    pushMessage(status, 'warning', 'GEMINI_API_KEY não configurado; usando heurísticas básicas.');
    return null;
  }
  const writingType = (opts && opts.writingType) || 'digitado';
  const tipoReg = (opts && opts.tipoRegistroOverride) || params.tipoRegistro || 'NASCIMENTO';
  const useText = clampForPrompt(text);
  // Busca prompt específico por tipo de escrita
  const idxList = writingType === 'manuscrito'
    ? ['leitura_manuscrito', 'leitura_manuscito']
    : ['leitura_digitado'];
  let promptTpl = null;
  let idxUsed = null;
  for (const idx of idxList) {
    const row = await getPromptByIndexador(idx);
    if (row && row.prompt) { promptTpl = row.prompt; idxUsed = idx; break; }
  }
  let prompt;
  if (promptTpl) {
    prompt = renderTemplate(promptTpl, { texto: useText, tipoRegistro: tipoReg });
  } else {
    // Fallback para nosso template genérico
    const schema = `Responda APENAS um JSON no formato:
{
  "tipo": "INCLUSAO" | "ALTERACAO",
  "campos": { "NOMEREGISTRADO"?: string, "MATRICULA"?: string, "DATAREGISTRO"?: string, ... },
  "filiacao"?: [ { "NOME": string, "TIPO"?: "MAE"|"PAI"|"RESPONSAVEL" } ],
  "documentos"?: [ { "TIPO"?: string, "NUMERO"?: string, "EMISSOR"?: string, "DATA"?: string } ]
}
Chaves extras em campos são permitidas. Datas no formato DD/MM/AAAA.`;
    const instrucoes = tipoReg === 'NASCIMENTO'
      ? 'Extraia dados do registro de NASCIMENTO: nome do registrado, data do registro, possíveis nomes de filiação (mãe/pai), e documentos citados.'
      : tipoReg === 'CASAMENTO'
      ? 'Extraia dados do registro de CASAMENTO: nomes dos cônjuges, data do registro, e documentos citados.'
      : 'Extraia dados do registro de ÓBITO: nome do falecido, data do registro, e documentos citados.';
    prompt = `Você é um assistente que extrai dados de livros de Registro Civil a partir de texto OCR.
Tipo de registro: ${tipoReg}
Tipo de escrita: ${writingType}
${instrucoes}
${schema}
Texto (normalizado):\n${useText}`;
  }
  // Preambulo estrito
  prompt = addStrictPreamble(prompt, tipoReg);
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const candidates = (ctx && Array.isArray(ctx.modelCandidates) && ctx.modelCandidates.length) ? ctx.modelCandidates : null;
    let primary, secondary;
    if (candidates && candidates.length) { primary = candidates[0]; secondary = candidates[1] || candidates[0]; }
    else { const r = resolveIaModels(); primary = r.primary; secondary = r.secondary; }
    const labelBase = idxUsed ? `${idxUsed} (${writingType})` : `leitura_generica (${writingType})`;
    const tryOnce = async (modelName) => {
      if (!modelName) {
        const msg = 'Nenhum agente IA configurado (modelName faltando). Defina ia_agent / ia_agent_fallback na tabela serventia.';
        try { pushMessage(status, 'warning', msg); } catch (_) { try { console.warn(msg); } catch(_){} }
        throw new Error(msg);
      }
      const model = genAI.getGenerativeModel({ model: modelName });
      await safeLogPrompt(status, labelBase, prompt, { model: modelName, tipoRegistro: tipoReg });
      const resp = await callWithRetries(() => model.generateContent(prompt), { retries: 3, baseDelayMs: 700 });
      const out = (resp && resp.response && resp.response.text && resp.response.text()) || '';
      await safeLogResponse(status, labelBase, out);
      const data = parseJsonLoose(out);
      if (data && typeof data === 'object') {
        if (Array.isArray(data.registros) && data.registros.length > 0) {
          const upperTipo = String(tipoReg || '').toUpperCase();
          const list = data.registros;
          const preferred = list.filter(r => String(r.tipoRegistro || '').toUpperCase() === upperTipo);
          const chosen = preferred[0] || list[0];
          const mapped = mapIaRegistroToNormalized(chosen, upperTipo);
          if (mapped) return mapped;
        }
        return normalizeRecordOutput(data, String(text || ''), tipoReg);
      }
      return null;
    };
    let rec = await tryOnce(primary);
    if (!rec || isWeakRecord(rec, tipoReg)) {
      pushMessage(status, 'info', `${labelBase}: reforçando com modelo secundário (${secondary})`);
      const rec2 = await tryOnce(secondary);
      if (rec2 && (!rec || isWeakRecord(rec, tipoReg))) rec = rec2;
    }
    // Em modo estrito, valida campos contra o próprio texto de entrada
    if (rec && isStrictMode()) {
      const filtered = enforceStrictEvidence(rec, String(text || ''), tipoReg, status);
      rec = filtered || rec;
    }
    if (rec) return rec;
    pushMessage(status, 'warning', 'IA retornou saída não estruturada; aplicando heurísticas.');
    return null;
  } catch (e) {
    pushMessage(status, 'warning', `Falha ao chamar IA: ${(e && e.message) || e}`);
    return null;
  }
}

// Converte uma string de data ISO (YYYY-MM-DD) para DD/MM/AAAA; deixa como está se já estiver em outro formato
function toBrDate(s) {
  if (!s) return '';
  const str = String(s).trim();
  const m = str.match(/^\d{4}-\d{2}-\d{2}/);
  if (m) {
    const [y, mm, d] = str.slice(0, 10).split('-');
    return `${d}/${mm}/${y}`;
  }
  // já pode estar DD/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  return str;
}

function mapIaRegistroToNormalized(reg, tipoReg) {
  try {
    const t = String(tipoReg || '').toUpperCase();
    const dados = reg && reg.dados ? reg.dados : {};
    const out = { tipo: 'INCLUSAO', campos: {}, filiacao: [], documentos: [] };
    // comum: data do registro no topo do item
    if (reg && reg.dataRegistro) out.campos['DATAREGISTRO'] = toBrDate(reg.dataRegistro);
    if (reg && reg.observacoes) out.campos['OBSERVACOES'] = String(reg.observacoes || '');

    if (t === 'NASCIMENTO') {
      if (dados.nomeRegistrado) out.campos['NOMEREGISTRADO'] = String(dados.nomeRegistrado).toUpperCase();
      if (dados.sexo) out.campos['SEXO'] = String(dados.sexo).toUpperCase();
      if (dados.dataNascimento) out.campos['DATANASCIMENTO'] = toBrDate(dados.dataNascimento);
      if (dados.horaNascimento) out.campos['HORANASCIMENTO'] = String(dados.horaNascimento);
      if (dados.localNascimento) out.campos['LOCALNASCIMENTO'] = String(dados.localNascimento);
      if (dados.dnv) out.campos['DNV'] = String(dados.dnv);
      // Filiacao
      const fil = Array.isArray(dados.filiacao) ? dados.filiacao : [];
      fil.forEach((f) => {
        const item = { NOME: String(f.nome || '') };
        const tipo = String(f.tipo || '').toLowerCase();
        if (tipo === 'pai') item.SEXO = 'MASCULINO';
        else if (tipo === 'mae' || tipo === 'mãe') item.SEXO = 'FEMININO';
        out.filiacao.push(item);
      });
      // Documentos
      const docs = reg && reg.documentos && Array.isArray(reg.documentos.lista) ? reg.documentos.lista : [];
      docs.forEach((d) => {
        const node = { DONO: 'FILIACAO_NASCIMENTO' };
        if (d.tipo) node.TIPO_DOC = String(d.tipo);
        if (d.descricao) node.DESCRICAO = String(d.descricao);
        if (d.numero) node.NUMERO = String(d.numero);
        out.documentos.push(node);
      });
      return out;
    }

    if (t === 'CASAMENTO') {
      if (dados.nubente1) out.campos['NOMECONJUGE1'] = String(dados.nubente1).toUpperCase();
      if (dados.nubente2) out.campos['NOMECONJUGE2'] = String(dados.nubente2).toUpperCase();
      if (dados.dataCasamento) out.campos['DATACASAMENTO'] = toBrDate(dados.dataCasamento);
      if (dados.regimeBens) out.campos['REGIMECASAMENTO'] = String(dados.regimeBens).toUpperCase();
      return out;
    }

    if (t === 'OBITO') {
      if (dados.nomeFalecido) out.campos['NOMEFALECIDO'] = String(dados.nomeFalecido).toUpperCase();
      if (dados.dataObito) out.campos['DATAOBITO'] = toBrDate(dados.dataObito);
      if (dados.horaObito) out.campos['HORAOBITO'] = String(dados.horaObito);
      return out;
    }

    return null;
  } catch (_) {
    return null;
  }
}

async function maybeProduceRecordFromText(text, sourcePath, records, params, status, opts = {}, ctx = {}) {
  // 1) Identificar tipo de escrita via IA (manuscrito/digitado) — ou usar tipo já conhecido
  let escrita = null;
  if (opts && opts.writingType) {
    escrita = { tipo: String(opts.writingType), confidence: 1, tipoRegistro: opts.tipoRegistroOverride };
  } else {
    try { escrita = await identifyEscritaWithGemini(String(text || ''), status, ctx); } catch(_){ }
  }
  if (escrita && escrita.tipo) {
    pushMessage(status, 'info', `Tipo de escrita identificado pela IA: ${escrita.tipo} (conf=${(escrita.confidence ?? 0).toFixed(2)})`);
  }
  // Se IA sugerir tipoRegistro e divergir do requisitado, logar aviso
  if (escrita && escrita.tipoRegistro && ['NASCIMENTO','CASAMENTO','OBITO'].includes(escrita.tipoRegistro)) {
    if (params && params.tipoRegistro && params.tipoRegistro !== escrita.tipoRegistro) {
      pushMessage(status, 'warning', `IA sugeriu tipoRegistro ${escrita.tipoRegistro}, mas a requisição é ${params.tipoRegistro}. Continuando com ${params.tipoRegistro}.`);
    }
  }

  // 2) Tenta IA para extrair campos (usando prompt por escrita)
  let rec = null;
  try {
    rec = await analyzeRecordWithGemini(String(text || ''), params, status, {
      writingType: (escrita && escrita.tipo) || 'digitado',
      tipoRegistroOverride: (opts && opts.tipoRegistroOverride) || (escrita && escrita.tipoRegistro)
    }, ctx);
  } catch (_) {}
  if (!rec) {
    // Fallback heurístico
    rec = {
      tipo: 'INCLUSAO',
      campos: {
        NOMEREGISTRADO: guessField(text, /Nome\s*[:\-]\s*(.+)/i, 'Ignorado(a)'),
        MATRICULA: guessField(text, /MATRICULA\s*[:\-]\s*(\d{10,})/i, ''),
        DATAREGISTRO: guessField(text, /Data\s*do\s*Registro\s*[:\-]\s*(\d{2}\/\d{2}\/\d{4})/i, ''),
      },
      filiacao: [],
      documentos: [],
    };
  } else {
    // Se veio da IA mas sem campos, tenta heurística leve para preencher o básico
    const hasCampos = rec.campos && Object.keys(rec.campos).length > 0;
    if (!hasCampos) {
      const extraCampos = minimalHeuristicExtract(String(text || ''), params.tipoRegistro || 'NASCIMENTO');
      rec.campos = { ...rec.campos, ...extraCampos };
    }
  }
  // Forçar sempre inclusão conforme requisito do cliente
  rec.tipo = 'INCLUSAO';
  // Sempre anexa a origem e normaliza tipos básicos
  rec.origens = [...(rec.origens || []), path.basename(sourcePath)];
  if (!rec.campos || typeof rec.campos !== 'object') rec.campos = {};
  if (!Array.isArray(rec.filiacao)) rec.filiacao = [];
  if (!Array.isArray(rec.documentos)) rec.documentos = [];
  records.push(rec);
}

// --- Normalização e heurísticas de saída da IA ---
function stripDiacritics(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeKey(k) {
  return stripDiacritics(String(k || ''))
    .replace(/[^A-Za-z0-9]+/g, '')
    .toUpperCase();
}

function minimalHeuristicExtract(text, tipoReg) {
  const t = String(text || '');
  const campos = {};
  const nome = guessField(t, /(Nome\s*(?:do\s*registrado|do\s*falecido|dos?\s*noiv[oa]s?)?\s*[:\-]\s*)(.+)/i, '')
    || guessField(t, /Registrado\s*[:\-]\s*(.+)/i, '')
    || guessField(t, /Falecido\s*[:\-]\s*(.+)/i, '');
  if (nome) campos.NOMEREGISTRADO = nome;
  const matricula = guessField(t, /MATR[ÍI]CULA\s*[:\-]?\s*(\S{6,})/i, '');
  if (matricula) campos.MATRICULA = matricula;
  const data = guessField(t, /(Data\s*(?:do\s*)?(?:Registro|Assento))\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, '')
    || guessField(t, /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/, '');
  if (data) campos.DATAREGISTRO = data;
  const livro = guessField(t, /LIVRO\s*[:\-]?\s*(\S{1,20})/i, '');
  if (livro) campos.LIVRO = livro;
  const folha = guessField(t, /FOLHA\s*[:\-]?\s*(\S{1,20})/i, '')
    || guessField(t, /FOLIO\s*[:\-]?\s*(\S{1,20})/i, '');
  if (folha) campos.FOLHA = folha;
  const termo = guessField(t, /(?:TERMO|N[ÚU]MERO\s*DO\s*TERMO)\s*[:\-]?\s*(\S{1,20})/i, '');
  if (termo) campos.NUMEROTERMO = termo;
  return campos;
}

function normalizeRecordOutput(data, text, tipoReg) {
  const out = {
    tipo: ((data.tipo || 'INCLUSAO').toString().toUpperCase() === 'ALTERACAO') ? 'ALTERACAO' : 'INCLUSAO',
    campos: {},
    filiacao: Array.isArray(data.filiacao) ? data.filiacao : [],
    documentos: Array.isArray(data.documentos) ? data.documentos : [],
    beneficios: Array.isArray(data.beneficios) ? data.beneficios : [],
  };
  // 1) Fonte primária: data.campos
  const rawCampos = (data && typeof data === 'object' && data.campos && typeof data.campos === 'object')
    ? data.campos
    : null;
  const baseObj = rawCampos || data; // se não houver campos, tenta pegar do topo
  if (baseObj && typeof baseObj === 'object') {
    Object.entries(baseObj).forEach(([k, v]) => {
      if (k === 'tipo' || k === 'campos' || k === 'filiacao' || k === 'documentos') return;
      if (v == null) return;
      if (typeof v === 'object') return; // evita objetos aninhados inesperados
      const nk = normalizeKey(k);
      out.campos[nk] = String(v);
    });
    if (rawCampos) {
      // também normaliza chaves dentro de campos declarados
      const normalized = {};
      Object.entries(rawCampos).forEach(([k, v]) => {
        const nk = normalizeKey(k);
        normalized[nk] = v == null ? '' : String(v);
      });
      out.campos = { ...out.campos, ...normalized };
    }
  }
  // 2) Sinônimos comuns
  const rename = (fromList, to) => {
    for (const from of fromList) {
      if (from in out.campos && !(to in out.campos)) {
        out.campos[to] = out.campos[from];
      }
    }
  };
  rename(['NOMEREGISTRADA', 'NOME', 'NOME_REGISTRADO', 'NOMEDOREGISTRADO', 'REGISTRADO', 'REGISTRADA', 'NOMEFALECIDO', 'NOME_DO_REGISTRADO'], 'NOMEREGISTRADO');
  rename(['MATRICULA', 'MATRICULA_', 'MATRICULAASSENTO', 'MATRICULADOASSENTO', 'MATRICULAREGISTRO'], 'MATRICULA');
  rename(['DATAREGISTRO', 'DATA_DO_REGISTRO', 'DATAREG', 'DATAASSENTO', 'DATA_DO_ASSENTO'], 'DATAREGISTRO');
  rename(['LIVRO', 'LIVROASSENTO', 'LIVRO_DO_ASSENTO'], 'LIVRO');
  rename(['FOLHA', 'FOLIO', 'FOLHAASSENTO', 'FOLHA_DO_ASSENTO'], 'FOLHA');
  rename(['NUMEROTERMO', 'TERMO', 'NUMERO_TERMO', 'NTERMO', 'NUMERO_DO_TERMO'], 'NUMEROTERMO');
  // Específicos por tipo de registro
  const tipo = (tipoReg || '').toUpperCase();
  if (tipo === 'CASAMENTO') {
    rename(['NOMENOIVO', 'NOME_NOIVO', 'NOMECONJUGE1', 'NOME_CONJUGE1'], 'NOMECONJUGE1');
    rename(['NOMENOIVA', 'NOME_NOIVA', 'NOMECONJUGE2', 'NOME_CONJUGE2'], 'NOMECONJUGE2');
    // CPFs dos cônjuges
    rename(['CPF_CONJUGE1', 'CPF1', 'CPFNOIVO'], 'CPFCONJUGE1');
    rename(['CPF_CONJUGE2', 'CPF2', 'CPFNOIVA'], 'CPFCONJUGE2');
    // Sexo
    rename(['SEXO_CONJUGE1', 'SEXONOIVO', 'SEXO1'], 'SEXOCONJUGE1');
    rename(['SEXO_CONJUGE2', 'SEXONOIVA', 'SEXO2'], 'SEXOCONJUGE2');
    // Datas de nascimento
    rename(['DATANASC_CONJUGE1', 'DATANASCIMENTONOIVO', 'DATANASC1'], 'DATANASCIMENTOCONJUGE1');
    rename(['DATANASC_CONJUGE2', 'DATANASCIMENTONOIVA', 'DATANASC2'], 'DATANASCIMENTOCONJUGE2');
    // Filiação
    rename(['NOMEPAI_CONJUGE1', 'NOME_PAI_CONJUGE1', 'NOMEPAINOIVO', 'NOMEPAI1'], 'NOMEPAICONJUGE1');
    rename(['NOMEDAPAI_CONJUGE2', 'NOME_PAI_CONJUGE2', 'NOMEPAINOIVA', 'NOMEPAI2', 'NOMEPAICONJUGE2'], 'NOMEPAICONJUGE2');
    rename(['NOMEMAE_CONJUGE1', 'NOME_MAE_CONJUGE1', 'NOMEMAENOIVO', 'NOMEMAE1', 'NOMEMAECONJUGE1'], 'NOMEMAECONJUGE1');
    rename(['NOMEMAE_CONJUGE2', 'NOME_MAE_CONJUGE2', 'NOMEMAENOIVA', 'NOMEMAE2', 'NOMEMAECONJUGE2'], 'NOMEMAECONJUGE2');
    // Datas e regime
    rename(['DATA_CASAMENTO', 'DATADECASAMENTO'], 'DATACASAMENTO');
    rename(['REGIME', 'REGIME_CASAMENTO'], 'REGIMECASAMENTO');
  } else if (tipo === 'OBITO') {
    // Nome do falecido
    rename(['NOMEFALECIDO', 'NOME_FALECIDO', 'NOMEREGISTRADO', 'REGISTRADO', 'NOME'], 'NOMEFALECIDO');
    // CPF do falecido
    rename(['CPFFALECIDO', 'CPF_FALECIDO', 'CPFREGISTRADO', 'CPF'], 'CPFFALECIDO');
    // Datas
    rename(['DATA_OBITO', 'DATADEOBITO'], 'DATAOBITO');
    rename(['HORA_OBITO', 'HORA_DE_OBITO', 'HORARIO_OBITO'], 'HORAOBITO');
    rename(['DATANASCIMENTO', 'DATANASC', 'DATA_NASCIMENTO'], 'DATANASCIMENTOFALECIDO');
    // Filiação
    rename(['NOME_PAI', 'PAI', 'NOMEPAI_FALECIDO'], 'NOMEPAI');
    rename(['NOME_MAE', 'MAE', 'NOMEDAMAE_FALECIDO', 'NOMEMAEDOFALECIDO'], 'NOMEMAE');
    rename(['CPF_PAI'], 'CPFPAI');
    rename(['CPF_MAE'], 'CPFMAE');
    rename(['SEXO_PAI'], 'SEXOPAI');
    rename(['SEXO_MAE'], 'SEXOMAE');
    // Características e estado civil
    rename(['COR_DA_PELE', 'COR'], 'CORPELE');
    rename(['ESTADO_CIVIL'], 'ESTADOCIVIL');
    // Ocupação e naturalidade
    rename(['OCUPACAO_CBO', 'CODIGO_OCUPACAO_SDC'], 'CODIGOOCUPACAOSDC');
    rename(['NACIONALIDADE_FALECIDO'], 'NACIONALIDADE');
    rename(['PAIS_NASCIMENTO'], 'PAISNASCIMENTO');
    rename(['NATURALIDADE_IBGE', 'MUNICIPIO_NAT_IBGE'], 'CODIGOIBGEMUNNATURALIDADE');
    rename(['MUNICIPIO_NATURALIDADE', 'MUNICIPIO_NAT_TXT'], 'TEXTOLIVREMUNICIPIONAT');
    // Endereço do falecido
    rename(['MUN_LOGRADOURO_IBGE', 'IBGE_MUN_LOGRADOURO'], 'CODIGOIBGEMUNLOGRADOURO');
    rename(['DOMICILIO_EXTERIOR', 'DOMICILIO_ESTRANGEIRO'], 'DOMICILIOESTRANGEIROFALECIDO');
    // Documentos do falecido: default DONO tratado no builder
    // Local do óbito
    rename(['TIPO_LOCAL_OBITO'], 'TIPOLOCALOBITO');
    rename(['TIPO_MORTE'], 'TIPOMORTE');
    rename(['NUMERO_DO', 'DO_NUMERO'], 'NUMDECLARACAOOBITO');
    rename(['DO_IGNORADA', 'DECLARACAO_OBITO_IGNORADA'], 'NUMDECLARACAOOBITOIGNORADA');
    rename(['PAIS_DO_OBITO'], 'PAISOBITO');
    rename(['IBGE_MUN_OBITO', 'MUN_OBITO_IBGE'], 'CODIGOIBGEMUNLOGRADOUROOBITO');
    rename(['ENDERECO_OBITO_EXTERIOR'], 'ENDERECOLOCALOBITOESTRANGEIRO');
    rename(['LOGRADOURO_OBITO'], 'LOGRADOUROOBITO');
    rename(['NUMERO_OBITO'], 'NUMEROLOGRADOUROOBITO');
    rename(['COMPLEMENTO_OBITO'], 'COMPLEMENTOLOGRADOUROOBITO');
    rename(['BAIRRO_OBITO'], 'BAIRROOBITO');
    // Causas de morte
    rename(['CAUSA_A'], 'CAUSAMORTEANTECEDENTES_A');
    rename(['CAUSA_B'], 'CAUSAMORTEANTECEDENTES_B');
    rename(['CAUSA_C'], 'CAUSAMORTEANTECEDENTES_C');
    rename(['CAUSA_D'], 'CAUSAMORTEANTECEDENTES_D');
    rename(['OUTRAS_COND_A'], 'CAUSAMORTEOUTRASCOND_A');
    rename(['OUTRAS_COND_B'], 'CAUSAMORTEOUTRASCOND_B');
    // Atestantes e declarante
    rename(['NOME_ATESTANTE_1', 'ATESTANTE_PRIMARIO'], 'NOMEATESTANTEPRIMARIO');
    rename(['CRM_ATESTANTE_1'], 'CRMATESTANTEPRIMARIO');
    rename(['NOME_ATESTANTE_2', 'ATESTANTE_SECUNDARIO'], 'NOMEATESTANTESECUNDARIO');
    rename(['CRM_ATESTANTE_2'], 'CRMATESTANTESECUNDARIO');
    rename(['NOME_DECLARANTE'], 'NOMEDECLARANTE');
    rename(['CPF_DECLARANTE'], 'CPFDECLARANTE');
  }
  // 3) Se nada foi mapeado, tenta heurística mínima no texto
  if (!out.campos || Object.keys(out.campos).length === 0) {
    out.campos = minimalHeuristicExtract(text, tipoReg);
  }
  return out;
}

function detectContentType(buf) {
  if (!buf || buf.length < 4) return { type: 'unknown', ext: '' };
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return { type: 'pdf', ext: '.pdf' }; // %PDF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return { type: 'image', ext: '.jpg' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return { type: 'image', ext: '.png' };
  if ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2A && buf[3] === 0x00) || (buf[0] === 0x4D && buf[1] === 0x4D && buf[2] === 0x00 && buf[3] === 0x2A)) return { type: 'image', ext: '.tiff' };
  return { type: 'unknown', ext: '' };
}

// --- Validação de evidências (anti-invenção) ---
function normalizeForEvidence(s) {
  return stripDiacritics(String(s || '').toUpperCase()).replace(/[^A-Z0-9\/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function valueHasEvidence(val, srcNorm) {
  const v = String(val || '').trim();
  if (!v) return false;
  const vNorm = normalizeForEvidence(v);
  if (!vNorm) return false;
  // Datas DD/MM/AAAA precisam aparecer literalmente
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return srcNorm.includes(v.replace(/\s+/g, ' '));
  // Sequências numéricas longas (ex.: DNV) precisam estar presentes
  const digits = v.replace(/\D+/g, '');
  if (digits.length >= 6) return srcNorm.replace(/\D+/g, '').includes(digits);
  // Nomes: exigir ao menos 2 tokens (>=3 letras) presentes no texto
  const tokens = vNorm.split(' ').filter(t => /^[A-Z]{3,}$/.test(t));
  if (tokens.length >= 2) {
    const hits = tokens.filter(t => srcNorm.includes(t));
    return hits.length >= Math.max(2, Math.ceil(tokens.length * 0.5));
  }
  // Valor curto (<=5) pouco confiável
  if (vNorm.length <= 5) return srcNorm.includes(vNorm);
  // Fallback: substring direta
  return srcNorm.includes(vNorm);
}

function enforceStrictEvidence(rec, sourceText, tipoReg, status) {
  try {
    const srcNorm = normalizeForEvidence(sourceText || '');
    const out = JSON.parse(JSON.stringify(rec));
    const removed = [];
    // Campos simples
    Object.entries(out.campos || {}).forEach(([k, v]) => {
      if (!v) return;
      if (!valueHasEvidence(v, srcNorm)) {
        removed.push(k);
        out.campos[k] = '';
      }
    });
    // Filiação: manter apenas nomes com evidência
    if (Array.isArray(out.filiacao)) {
      out.filiacao = out.filiacao.filter((f) => valueHasEvidence(f && f.NOME, srcNorm));
    }
    // Documentos: manter se número presente
    if (Array.isArray(out.documentos)) {
      out.documentos = out.documentos.filter((d) => valueHasEvidence(d && d.NUMERO, srcNorm));
    }
    if (removed.length) {
      pushMessage(status, 'warning', `IA_STRICT: campos removidos por falta de evidência: ${removed.join(', ')}`);
    }
    return out;
  } catch (_) {
    return rec;
  }
}

// Verifica se o registro está fraco (campos essenciais ausentes) para decidir tentar modelo secundário
function isWeakRecord(rec, tipoReg) {
  try {
    if (!rec || !rec.campos) return true;
    const c = rec.campos || {};
    const t = String(tipoReg || '').toUpperCase();
    if (t === 'NASCIMENTO') {
      return !((c.NOMEREGISTRADO && String(c.NOMEREGISTRADO).trim()) || (c.DATANASCIMENTO && String(c.DATANASCIMENTO).trim()) || (c.DNV && String(c.DNV).trim()));
    }
    if (t === 'CASAMENTO') {
      const ok = ((c.NOMECONJUGE1 && String(c.NOMECONJUGE1).trim()) && (c.NOMECONJUGE2 && String(c.NOMECONJUGE2).trim())) || (c.DATACASAMENTO && String(c.DATACASAMENTO).trim());
      return !ok;
    }
    if (t === 'OBITO') {
      return !((c.NOMEFALECIDO && String(c.NOMEFALECIDO).trim()) || (c.DATAOBITO && String(c.DATAOBITO).trim()));
    }
    return false;
  } catch (_) { return true; }
}

async function extractP7sPayload(buf, status) {
  try {
    let derBuf = buf;
    // Detecta PEM e converte para DER se necessário
    const ascii = buf.toString('utf8');
    if (/-----BEGIN/i.test(ascii)) {
      const pem = ascii.replace(/\r/g, '').trim();
      let b64 = pem.replace(/-----BEGIN[^-]+-----/g, '').replace(/-----END[^-]+-----/g, '').replace(/\n/g, '');
      derBuf = Buffer.from(b64, 'base64');
    }
    let asn1;
    try { asn1 = forge.asn1.fromDer(derBuf.toString('binary')); }
    catch (_) {
      // Tentativa de base64 crua (alguns .p7s vêm apenas em B64 sem PEM)
      try {
        const maybeB64 = ascii.replace(/\s+/g, '');
        const tryBuf = Buffer.from(maybeB64, 'base64');
        asn1 = forge.asn1.fromDer(tryBuf.toString('binary'));
      } catch (e2) {
        throw e2;
      }
    }
    const p7 = forge.pkcs7.messageFromAsn1(asn1);
    // 1) rawCapture.content (algumas versões)
    let contentBuf = null;
    if (p7 && p7.rawCapture) {
      if (p7.rawCapture.content) {
        try { contentBuf = Buffer.from(p7.rawCapture.content, 'binary'); } catch {}
      }
      // 2) rawCapture.eContent (mais comum em SignedData)
      if ((!contentBuf || contentBuf.length === 0) && p7.rawCapture.eContent) {
        try { contentBuf = Buffer.from(p7.rawCapture.eContent, 'binary'); } catch {}
      }
    }
    // 3) Caminhar pela ASN.1 para encontrar EncapsulatedContentInfo eContent [0] OCTET STRING
    if (!contentBuf || contentBuf.length === 0) {
      const asn1Mod = forge.asn1;
      function findOctetString(node) {
        if (!node) return null;
        // Context-specific [0] pode conter OCTET STRING
        if (node.tagClass === asn1Mod.Class.CONTEXT_SPECIFIC && node.type === 0) {
          if (node.constructed && Array.isArray(node.value)) {
            for (const child of node.value) {
              const found = findOctetString(child);
              if (found) return found;
            }
          }
        }
        if (node.tagClass === asn1Mod.Class.UNIVERSAL && node.type === asn1Mod.Type.OCTETSTRING) {
          if (node.constructed && Array.isArray(node.value)) {
            // OCTET STRING construída: concatena os pedaços
            let acc = '';
            for (const part of node.value) {
              const inner = findOctetString(part);
              if (inner && inner.length) acc += inner.toString('binary');
            }
            return Buffer.from(acc, 'binary');
          }
          // node.value é string binária
          return Buffer.from(node.value, 'binary');
        }
        if (Array.isArray(node.value)) {
          for (const child of node.value) {
            const found = findOctetString(child);
            if (found) return found;
          }
        }
        return null;
      }
      const possible = findOctetString(asn1);
      if (possible && possible.length) contentBuf = possible;
    }
    // 4) Fallback bruto: procurar magic bytes de PDF/PNG/JPEG/TIFF dentro do DER
    if (!contentBuf || contentBuf.length === 0) {
      const mags = [
        { sig: Buffer.from([0x25,0x50,0x44,0x46]), type: 'pdf' }, // %PDF
        { sig: Buffer.from([0xFF,0xD8,0xFF]), type: 'image' },     // JPEG
        { sig: Buffer.from([0x89,0x50,0x4E,0x47]), type: 'image' },// PNG
        { sig: Buffer.from([0x49,0x49,0x2A,0x00]), type: 'image' },// TIFF LE
        { sig: Buffer.from([0x4D,0x4D,0x00,0x2A]), type: 'image' },// TIFF BE
      ];
      let bestIdx = -1;
      for (const m of mags) {
        const idx = derBuf.indexOf(m.sig);
        if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
      }
      if (bestIdx !== -1) {
        contentBuf = Buffer.from(derBuf.slice(bestIdx));
      }
    }
    if (!contentBuf || contentBuf.length === 0) {
      pushMessage(status, 'warning', 'Arquivo .p7s sem conteúdo anexado (assinatura destacada)');
      return null;
    }
    pushMessage(status, 'success', 'Payload extraído do .p7s (assinatura não verificada)');
    return { buffer: contentBuf };
  } catch (e) {
    pushMessage(status, 'warning', `Falha ao processar .p7s: ${e.message}`);
    return null;
  }
}

function findPairForDetachedP7s(p7sPath, allPaths) {
  const dir = path.dirname(p7sPath);
  const name = path.basename(p7sPath).toLowerCase();
  const tryNames = [];
  if (name.endsWith('.pdf.p7s')) {
    const base = name.slice(0, -('.pdf.p7s'.length));
    tryNames.push(base + '.pdf');
  }
  if (name.endsWith('.p7s')) {
    const base = name.slice(0, -('.p7s'.length));
    ['.pdf', '.jpg', '.jpeg', '.png', '.tif', '.tiff'].forEach(ext => tryNames.push(base + ext));
  }
  // 1) Buscar nos paths recebidos
  for (const p of allPaths) {
    const bn = path.basename(p).toLowerCase();
    if (tryNames.includes(bn)) return p;
  }
  // 2) Buscar no diretório físico
  try {
    const entries = fs.readdirSync(dir);
    for (const e of entries) {
      const el = e.toLowerCase();
      if (tryNames.includes(el)) return path.join(dir, e);
    }
  } catch {}
  return null;
}

function registerLeituraLivrosRoutes(app) {
  const registerBase = (base = '') => {
    // Start processing for a folder
    app.post(`${base}/leitura-livros/process-folder`, authenticate, express.json(), async (req, res) => {
    const { params, errors } = validateParams(req.body || {});
    const folderPath = (req.body && req.body.folderPath) || '';
    if (errors.length) return res.status(400).json({ error: 'Parâmetros inválidos', details: errors });
    if (!folderPath) return res.status(400).json({ error: 'folderPath é obrigatório' });
    if (!isPathAllowed(folderPath)) return res.status(403).json({ error: 'folderPath não permitido' });

    const userServentiaNome = await resolveUserServentiaNome(req);
    const jobId = newJobId();
    const paths = jobPaths(jobId);
    ensureDirSync(paths.dir);
    await writeJSON(paths.inputs, { folderPath, userServentiaNome });
    await writeJSON(paths.status, { jobId, status: 'queued', progress: 0, messages: [] });
    setImmediate(() => runJob(jobId, { folderPath, userServentiaNome }, params));
    return res.json({ jobId });
    });

    // Upload images to start processing
    app.post(`${base}/leitura-livros/upload`, authenticate, upload.array('files', 200), async (req, res) => {
    const body = req.body || {};
    const { params, errors } = validateParams(body);
    if (errors.length) return res.status(400).json({ error: 'Parâmetros inválidos', details: errors });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const userServentiaNome = await resolveUserServentiaNome(req);
    const jobId = newJobId();
    const paths = jobPaths(jobId);
    ensureDirSync(paths.dir);
    await writeJSON(paths.inputs, { uploadedFiles: files.map(({ originalname, path }) => ({ originalname, path })), userServentiaNome });
    await writeJSON(paths.status, { jobId, status: 'queued', progress: 0, messages: [] });
    setImmediate(() => runJob(jobId, { uploadedFiles: files, userServentiaNome }, params));
    return res.json({ jobId });
    });

    // Extract payload from a single .p7s upload (convenience endpoint)
    app.post(`${base}/leitura-livros/extract-p7s`, authenticate, upload.array('files', 200), async (req, res) => {
    try {
      const file = req.file || (Array.isArray(req.files) && req.files[0]);
      if (!file) return res.status(400).json({ error: 'Arquivo (file) é obrigatório.' });
      const filePath = file.path;
      const buf = await fsp.readFile(filePath);
      const statusObj = { jobId: `extract-p7s-${Date.now()}`, messages: [] };
      const payload = await extractP7sPayload(buf, statusObj);
      if (!payload || !payload.buffer) {
        return res.status(422).json({ error: 'Nenhum payload encontrado no .p7s (assinatura destacada?).' });
      }
      const detected = detectContentType(payload.buffer);
      // Save payload alongside uploaded file for debug/consumption
      const outName = `${file.originalname}.payload${detected.ext || ''}`;
      const outPath = path.join(path.dirname(filePath), outName);
      // save extracted payload for server-side debugging/consumption
      await fsp.writeFile(outPath, payload.buffer);
      // prepare response payload: include base64 and contentType so frontend can consume immediately
      const base64 = payload.buffer.toString('base64');
      let contentType = mimeFromExt(outName) || 'application/octet-stream';
      // small debug text preview (first 2KB) if interpretable as utf8
      let debugText = null;
      try { debugText = payload.buffer.slice(0, 2048).toString('utf8'); } catch (_) { debugText = null; }
      return res.json({ ok: true, detected, length: payload.buffer.length, savedPath: outPath, contentType, base64, debugText });
    } catch (e) {
      try { console.error('[leitura-livros][extract-p7s] error', e && e.message ? e.message : e); } catch (_) {}
      return res.status(500).json({ error: 'Falha ao extrair .p7s', detail: String(e && e.message ? e.message : e) });
    }
    });

    // Poll status
    app.get(`${base}/leitura-livros/status/:jobId`, authenticate, async (req, res) => {
    const { jobId } = req.params;
    const paths = jobPaths(jobId);
    try {
      const st = await readJSON(paths.status);
      return res.json(st);
    } catch {
      return res.status(404).json({ error: 'jobId não encontrado' });
    }
    });

    // Get result JSON
    app.get(`${base}/leitura-livros/result/:jobId`, authenticate, async (req, res) => {
    const { jobId } = req.params;
    const paths = jobPaths(jobId);
    try {
      const result = await readJSON(paths.result);
      return res.json(result);
    } catch {
      return res.status(404).json({ error: 'jobId não encontrado' });
    }
    });

    // Note: server-side XML download endpoint removed — XML is now generated on the frontend after user review.

    // Optional cancel: cooperative
    app.post(`${base}/leitura-livros/cancel/:jobId`, authenticate, async (req, res) => {
    const { jobId } = req.params;
    const paths = jobPaths(jobId);
    try {
      const st = await readJSON(paths.status);
      if (st.status === 'done' || st.status === 'failed') return res.json({ ok: true, status: st.status });
      st.status = 'running';
      st.messages = st.messages || [];
      st.messages.push('[warning] Cancelamento solicitado (cooperativo)');
      st.cancel = true;
      await writeJSON(paths.status, st);
      return res.json({ ok: true });
    } catch {
      return res.status(404).json({ error: 'jobId não encontrado' });
    }
    });
  };

  // Expose both with and without /api prefix for compatibility with frontend
  registerBase('');
  registerBase('/api');
}

module.exports = { registerLeituraLivrosRoutes };
