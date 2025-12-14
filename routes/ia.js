const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../db');
const { ensureAuth } = require('../middlewares/auth');
const { resolveIaModel, resolveIaModels, resolveUserServentiaNome, resolveModelCandidates, getIaModelFor } = require('../utils/iaHelpers');

// Local helpers and config replicated from server.js to preserve behavior
// IA helper functions (imported from utils/iaHelpers)
// - resolveIaModel(name)
// - resolveIaModels()
// - resolveUserServentiaNome(req)
// - resolveModelCandidates({ codigoServentia, serventiaNome })
// - getIaModelFor(opts)

// Try generating content with the requested model candidates; do not fall back to env model
// Returns: { resp, usedModel }
// NOTE: This function enforces using the provided candidates only (no environment fallback).
// It will attempt each candidate in order; if all fail the error is propagated to the caller.
async function generateContentWithFallback(genAI, initialModelOrArray, prompt, opts = {}) {
  // initialModelOrArray may be a single model string or an array of candidate strings.
  // Build ordered candidates from the provided input; do not append any environment fallback.
  const candidates = [];
  if (Array.isArray(initialModelOrArray)) {
    initialModelOrArray.forEach((m) => { if (m && String(m).trim() && !candidates.includes(String(m).trim())) candidates.push(String(m).trim()); });
  } else if (initialModelOrArray && String(initialModelOrArray).trim()) {
    candidates.push(String(initialModelOrArray).trim());
  }
  // Do not silently append the environment fallback here; callers must opt-in.

  // If there are no candidates at all, fail fast with a clear error
  if (!Array.isArray(candidates) || candidates.length === 0) {
    const err = new Error('Nenhum agente IA fornecido (candidatos vazios)');
    err.name = 'IaModelCandidatesError';
    throw err;
  }

  let lastErr = null;
  for (const candidate of candidates) {
    if (!candidate || String(candidate).trim().length === 0) continue;
    try {
      const model = genAI.getGenerativeModel({ model: candidate });
      const resp = await callWithRetries(() => model.generateContent(prompt), { retries: opts.retries ?? 2, baseDelayMs: opts.baseDelayMs ?? 500 });
      return { resp, usedModel: candidate };
    } catch (e) {
      lastErr = e;
      const status = e && (e.status || (e.cause && e.cause.status));
      try { console.warn('[IA][generateContentWithFallback] candidate failed', { candidate, status }); } catch (_) {}
      // try next candidate
    }
  }
  const err = new Error('All IA model candidates failed');
  err.cause = lastErr;
  throw err;
}

// Centralized IA model configuration: DB-only resolution.
// We always prefer the per-serventia DB-configured agents (with fallbacks).

// the model (via `ia_agent` / ia_agent_fallback1 / ia_agent_fallback2).

function describeError(err) {
  const d = { name: err && err.name, message: err && err.message };
  if (err && typeof err === 'object') {
    if ('status' in err) d.status = err.status;
    if ('code' in err) d.code = err.code;
    if (err.cause) {
      d.cause = {
        name: err.cause.name,
        message: err.cause.message,
        status: err.cause.status,
        code: err.cause.code,
      };
    }
    if (err.response) {
      d.response = {
        status: err.response.status,
        statusText: err.response.statusText,
      };
    }
  }
  return d;
}

// Cached provider model list to avoid frequent REST calls
const _cachedAvailableModels = { ts: 0, models: [] };

function normalizeModelKey(name) {
  if (!name) return '';
  let s = String(name).trim();
  // Remove common resource prefixes
  s = s.replace(/^projects\/[^\/]+\/locations\/[^\/]+\/models\//i, '');
  s = s.replace(/^projects\/[^\/]+\/models\//i, '');
  s = s.replace(/^models\//i, '');
  // remove cosmetic suffixes
  s = s.replace(/-latest$/i, '').replace(/-v?\d+(?:\.\d+)?$/i, '');
  // Normalize separators to dashes and lower-case
  s = s.replace(/[\s_\/]+/g, '-').replace(/[^a-z0-9\-\.]/gi, '');
  return s.toLowerCase();
}

async function fetchAvailableModelsFromProvider() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const ttl = Number(process.env.S_CACHE_TTL_MS || 300000); // 5 minutes
  const now = Date.now();
  if (_cachedAvailableModels.ts && (now - _cachedAvailableModels.ts) < ttl && Array.isArray(_cachedAvailableModels.models) && _cachedAvailableModels.models.length) {
    return _cachedAvailableModels.models;
  }
  // Try REST list models endpoint
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const fetch = (await import('node-fetch')).default;
    const resp = await fetch(listUrl);
    if (!resp.ok) throw new Error(`list-models failed status=${resp.status}`);
    const data = await resp.json();
    const models = (data && Array.isArray(data.models)) ? data.models.map((m) => (m && (m.name || m.displayName || m.model) ? (m.name || m.model || m.displayName) : null)).filter(Boolean) : [];
    _cachedAvailableModels.ts = Date.now();
    _cachedAvailableModels.models = models;
    try { console.log('[IA][fetchAvailableModelsFromProvider] got models count=', models.length); } catch(_){}
    return models;
  } catch (e) {
    try { console.error('[IA][fetchAvailableModelsFromProvider] REST list failed, error=', e && e.message ? e.message : e); } catch(_){ }
    // As a last resort, try SDK import to see if it can list models
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      if (typeof genAI.listModels === 'function') {
        const sdkRes = await genAI.listModels();
        const sdkModels = (sdkRes && Array.isArray(sdkRes.models)) ? sdkRes.models.map(m => m.name || m.model || m.displayName).filter(Boolean) : [];
        _cachedAvailableModels.ts = Date.now();
        _cachedAvailableModels.models = sdkModels;
        try { console.log('[IA][fetchAvailableModelsFromProvider] SDK listModels count=', sdkModels.length); } catch(_){ }
        return sdkModels;
      }
    } catch (sdkErr) {
      try { console.error('[IA][fetchAvailableModelsFromProvider] SDK list attempt failed', sdkErr && sdkErr.message ? sdkErr.message : sdkErr); } catch(_){ }
    }
    // propagate original error
    throw e;
  }
}

// resolveModelCandidates is provided by shared helpers (utils/iaHelpers.js)
// Use: resolveModelCandidates({ codigoServentia, serventiaNome })

function normalizeText(s) {
  if (!s) return '';
  let t = String(s);
  t = t.replace(/\r/g, '\n').replace(/\u0000/g, '');
  t = t.replace(/[\t\f\v ]+/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

// resolveUserServentiaNome(req) is provided by shared helpers (utils/iaHelpers.js)

function clampForPrompt(s) {
  const max = Math.max(1000, Number(process.env.IA_MAX_INPUT_CHARS || 120000));
  const str = String(s || '');
  return str.length > max ? str.slice(0, max) : str;
}

async function ensurePromptsTable() {
  if (!pool) return;
  try {
    try { console.log('[IA][ensurePromptsTable] ensuring ia_prompts table exists'); } catch(_){}
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
    try { console.log('[IA][ensurePromptsTable] ok'); } catch(_){}
  } catch (_) {}
}

async function getPromptByIndexador(indexador) {
  if (!pool) return null;
  try {
    try { console.log('[IA][getPromptByIndexador] lookup', { indexador: String(indexador || '').toLowerCase() }); } catch(_){}
    await ensurePromptsTable();
    const { rows } = await pool.query(
      'SELECT indexador, prompt, updated_at FROM public.ia_prompts WHERE indexador = $1 LIMIT 1',
      [String(indexador || '').toLowerCase()]
    );
    try { console.log('[IA][getPromptByIndexador] db result', { found: !!(rows && rows[0]), sample: rows && rows[0] ? { indexador: rows[0].indexador, updated_at: rows[0].updated_at } : null }); } catch(_){}
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    try { console.error('[IA][getPromptByIndexador] error', e && e.message ? e.message : e); } catch(_){}
    return null;
  }
}

async function upsertPrompt(indexador, prompt) {
  if (!pool) return null;
  try {
    try { console.log('[IA][upsertPrompt] saving', { indexador: String(indexador || '').toLowerCase() }); } catch(_){}
    await ensurePromptsTable();
    const { rows } = await pool.query(
      `INSERT INTO public.ia_prompts (indexador, prompt)
       VALUES ($1, $2)
       ON CONFLICT (indexador)
       DO UPDATE SET prompt = EXCLUDED.prompt
       RETURNING indexador, prompt, updated_at`,
      [String(indexador || '').toLowerCase(), String(prompt || '')]
    );
    try { console.log('[IA][upsertPrompt] saved', { result: rows && rows[0] ? { indexador: rows[0].indexador, updated_at: rows[0].updated_at } : null }); } catch(_){}
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    try { console.error('[IA][upsertPrompt] error', e && e.message ? e.message : e); } catch(_){}
    return null;
  }
}

async function getLegislacaoByIndexador(idx) {
  try {
    const { rows } = await pool.query(
      `SELECT id, indexador, base_legal, titulo, artigo, jurisdicao, texto
       FROM public.legislacao_normas
       WHERE indexador = $1 AND ativo = true
       ORDER BY updated_at DESC, id DESC
       LIMIT 20`,
      [String(idx || '').toLowerCase()]
    );
    return rows || [];
  } catch (e) {
    return [];
  }
}

// Dedicated memory upload for PDFs (same config as server.js)
const upload3 = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdf) return cb(null, true);
    return cb(new Error('Apenas arquivos PDF são permitidos!'));
  }
});

function renderTemplate(tpl, ctx = {}) {
  const map = ctx || {};
  return String(tpl || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = map[k];
    return v == null ? '' : String(v);
  });
}

// Try to parse JSON from an LLM response that may include code fences or extra text
function parseJsonLoose(raw) {
  try {
    let clean = String(raw || '').trim();
    // Strip code fences if present
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/,'');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/i, '').replace(/\s*```$/,'');
    }
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

// Simple backoff utilities to soften transient provider rate limits
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function callWithRetries(fn, opts = {}) {
  const retries = Number(opts.retries ?? 2);
  const base = Number(opts.baseDelayMs ?? 500);
  let attempt = 0;
  // small jitter to avoid thundering herd
  const jitter = () => Math.floor(Math.random() * 200);
  // errors that justify retry (HTTP 429 or similar)
  const isRetryable = (e) => {
    const s = e && (e.status || e.code || (e.cause && e.cause.status));
    return s === 429 || s === 503 || s === 'RESOURCE_EXHAUSTED';
  };
  while (true) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries || !isRetryable(e)) throw e;
      attempt += 1;
      const delay = base * Math.pow(2, attempt - 1) + jitter();
      try { console.warn(`[IA] retrying provider call attempt=${attempt}/${retries} in ${delay}ms due to`, e && (e.status || e.code) ); } catch(_){}
      await sleep(delay);
    }
  }
}

function registerIaRoutes(app) {
  // Healthcheck — return DB-configured agent for the current user/serventia when available
  app.get('/api/ia/health', async (req, res) => {
    try {
      const stub = process.env.IA_STUB === 'true';
      // allow override with query param for diagnostics
      const qServ = req.query && req.query.serventiaNome ? String(req.query.serventiaNome) : null;
      let userServentiaNome = null;
      try { userServentiaNome = await resolveUserServentiaNome(req); } catch (_) { userServentiaNome = null; }
      const effectiveServentiaNome = qServ || userServentiaNome || null;

      let candidates = [];
      let detectedServentiaFromDb = null;
      try {
        candidates = await resolveModelCandidates({ serventiaNome: effectiveServentiaNome });
        if (!Array.isArray(candidates)) candidates = [];
      } catch (_) { candidates = []; }

      // If no serventia resolved and no candidates found, try to pick any configured agent
      if ((!effectiveServentiaNome || effectiveServentiaNome === null) && (!Array.isArray(candidates) || candidates.length === 0)) {
        try {
          // Try namespaced table first
          let rows = [];
          try {
            const q = "SELECT ia_agent, ia_agent_fallback1, ia_agent_fallback2, nome_abreviado FROM db_yq0x.public.serventia WHERE ia_agent IS NOT NULL LIMIT 1";
            const r = await pool.query(q);
            rows = r && r.rows ? r.rows : [];
          } catch (e) {
            const q2 = "SELECT ia_agent, ia_agent_fallback1, ia_agent_fallback2, nome_abreviado FROM public.serventia WHERE ia_agent IS NOT NULL LIMIT 1";
            const r2 = await pool.query(q2);
            rows = r2 && r2.rows ? r2.rows : [];
          }
          if (rows && rows[0]) {
            const r0 = rows[0];
            const cand = [];
            if (r0.ia_agent) cand.push(String(r0.ia_agent).trim());
            if (r0.ia_agent_fallback1 && !cand.includes(r0.ia_agent_fallback1)) cand.push(String(r0.ia_agent_fallback1).trim());
            if (r0.ia_agent_fallback2 && !cand.includes(r0.ia_agent_fallback2)) cand.push(String(r0.ia_agent_fallback2).trim());
            if (cand.length) {
              candidates = cand;
              detectedServentiaFromDb = r0.nome_abreviado || null;
            }
          }
        } catch (_) {
          // ignore
        }
      }

      const providerModel = Array.isArray(candidates) && candidates.length ? candidates[0] : null;
      // Normalize provider model and candidate keys for easier display in UIs
      const providerModelNormalized = providerModel ? normalizeModelKey(providerModel) : null;
      const providerModelCandidatesNormalized = Array.isArray(candidates) ? candidates.map((m) => normalizeModelKey(m)) : [];
      return res.json({
        ok: true,
        provider: 'db',
        providerModel,
        providerModelNormalized,
        providerModelCandidates: candidates,
        providerModelCandidatesNormalized,
        serventiaNome: effectiveServentiaNome || detectedServentiaFromDb,
        stub
      });
    } catch (e) {
      // Fallback to old shape if anything goes wrong
      return res.json({ ok: true, provider: 'db-only', stub: process.env.IA_STUB === 'true' });
    }
  });

  // Extrair texto
  app.post('/api/ia/extrair-texto', upload3.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo PDF (file) é obrigatório.' });
      const type = (req.file.mimetype || '').toLowerCase();
      const isPdf = type.includes('pdf') || req.file.originalname.toLowerCase().endsWith('.pdf');
      if (!isPdf) return res.status(400).json({ error: 'O arquivo deve ser um PDF.' });
      if (typeof req.file.size === 'number' && req.file.size === 0) {
        return res.status(400).json({ error: 'Arquivo vazio.' });
      }

      let text = '';
      let pages = undefined;
      let pdfParse;
      try { pdfParse = require('pdf-parse'); } catch (requireErr) { pdfParse = null; }
      if (pdfParse) {
        try {
          const bin = new Uint8Array(req.file.buffer);
          const parsed = await pdfParse(bin);
          text = parsed.text || '';
          if (parsed && typeof parsed.numpages === 'number') pages = parsed.numpages;
        } catch (e) {
          try { console.error('pdf-parse falhou ao extrair texto:', e && e.message ? e.message : e); } catch(_) {}
        }
      }
      if (!text || text.trim().length < 5) {
        let pdfjsLib = null;
        try { pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js'); } catch (_) { pdfjsLib = null; }
        if (pdfjsLib) {
          try {
            const data = new Uint8Array(req.file.buffer);
            const task = pdfjsLib.getDocument({ data, isEvalSupported: false });
            const pdf = await task.promise;
            let combined = '';
            const maxPagesEnv = Math.max(1, Number(process.env.IA_MAX_PAGES || 100));
            const maxPages = Math.min(pdf.numPages || 0, maxPagesEnv);
            for (let p = 1; p <= maxPages; p++) {
              const page = await pdf.getPage(p);
              const content = await page.getTextContent();
              const line = (content.items || []).map((it) => (it.str || '')).join(' ');
              combined += line + '\n';
            }
            text = combined || '';
            pages = pdf.numPages || maxPages;
          } catch (fallbackErr) {
            if (process.env.IA_STUB === 'true') {
              return res.json({ text: '', warning: 'Stub ativo: não foi possível extrair texto; retornando vazio.' });
            }
            try { console.error('pdfjs-dist falhou ao extrair texto:', fallbackErr && fallbackErr.message ? fallbackErr.message : fallbackErr); } catch (_) {}
          }
        }
      }

      text = normalizeText(text);
      const nonWs = (text || '').replace(/\s/g, '').length;
      const preview = String(text || '').slice(0, 2000);
      try {
        console.log(`[IA][extrair-texto] len=${text.length} nonWS=${nonWs} pages=${pages ?? 'n/a'} preview(0..2000)=`, JSON.stringify(preview));
      } catch (_) {}
      // Prepare response object and set debugging headers so frontend can verify full payload
      try {
        const respObj = { text, length: text.length, pages };
        const respBytes = Buffer.byteLength(JSON.stringify(respObj), 'utf8');
        // Expose basic diagnostics in headers (for debugging only)
        res.setHeader('X-Text-Length', String(text.length));
        res.setHeader('X-Text-NonWS', String(nonWs));
        res.setHeader('X-Response-Bytes', String(respBytes));

        if (!text || text.trim().length < 5) {
          if (process.env.IA_STUB === 'true') return res.json({ text: '' });
          return res.status(422).json({ error: 'PDF sem texto extraível (provavelmente escaneado ou protegido).' });
        }

        // Optional: if client requests IA processing of the extracted text, run agent
        const runIaFlag = (req.body && (req.body.runIa || req.body.run_ia)) || req.query && req.query.runIa;
        const runIa = String(runIaFlag || '').toLowerCase() === 'true';
        if (!runIa) return res.json(respObj);

        // Attempt to run IA on extracted text using the same model resolution logic as other IA routes
        if (process.env.IA_STUB === 'true') {
          console.log('[IA][extrair-texto] IA_STUB active - returning stubbed IA result');
          return res.json({ ...respObj, ia: { output: '[STUB] IA processing skipped (stub active)' } });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          console.warn('[IA][extrair-texto] GEMINI_API_KEY missing - cannot call provider');
          return res.status(501).json({ error: 'GEMINI_API_KEY não configurado. Defina a variável de ambiente ou ative IA_STUB=true.' });
        }

        let GoogleGenerativeAI = null;
        try { ({ GoogleGenerativeAI } = await import('@google/generative-ai')); } catch (impErr) {
          console.error('[IA][extrair-texto] failed to import provider SDK:', impErr && impErr.message ? impErr.message : impErr);
          return res.status(501).json({ error: "Pacote '@google/generative-ai' não instalado ou indisponível." });
        }

        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const userServentiaNome = await resolveUserServentiaNome(req);
          const modelCandidates = await resolveModelCandidates({ serventiaNome: userServentiaNome });
          try { console.log('[IA][extrair-texto] modelCandidates resolved', { userServentiaNome, modelCandidates }); } catch (_){ }
          if (!Array.isArray(modelCandidates) || modelCandidates.length === 0) {
            return res.status(422).json({ error: 'Nenhum agente IA configurado para esta serventia. Defina ia_agent / ia_agent_fallback na tabela serventia.' });
          }

          // Use stored prompt template if present
          const rowTpl = await getPromptByIndexador('extrair_texto');
          const defaultTpl = `Resuma e extraia as informações principais do texto a seguir. Retorne apenas texto claro e objetivo.`;
          const promptText = renderTemplate((rowTpl && rowTpl.prompt) || defaultTpl, { texto: clampForPrompt(text) });
          try { console.log('[IA][extrair-texto] calling provider preview prompt(0..800)=', String(promptText || '').slice(0,800)); } catch(_){ }

          const { resp: provResp, usedModel } = await generateContentWithFallback(genAI, modelCandidates, promptText, { retries: 3, baseDelayMs: 700 });
          const out = (provResp && provResp.response && provResp.response.text && provResp.response.text()) || '';
          try { res.setHeader('X-IA-UsedModel', String(usedModel || '')); } catch(_){}
          return res.json({ ...respObj, ia: { output: String(out || '').trim(), model: usedModel } });
        } catch (provErr) {
          console.error('[IA][extrair-texto] provider error', describeError(provErr));
          return res.status(502).json({ error: 'Falha ao chamar provedor de IA.', detail: describeError(provErr) });
        }
      } catch (hdrErr) {
        // If header setting or JSON.byteLength fails for any reason, fall back to original response
        try { console.warn('[IA][extrair-texto] debug headers failed:', hdrErr && hdrErr.message ? hdrErr.message : hdrErr); } catch (_) {}
        if (!text || text.trim().length < 5) {
          if (process.env.IA_STUB === 'true') return res.json({ text: '' });
          return res.status(422).json({ error: 'PDF sem texto extraível (provavelmente escaneado ou protegido).' });
        }
        return res.json({ text, length: text.length, pages });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao extrair texto.' });
    }
  });

  // Análise do mandado -> gera texto
  app.post('/api/ia/analise-mandado', upload3.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Arquivo PDF (file) é obrigatório.' });
      }
      const sizeOk = typeof req.file.size === 'number' ? req.file.size > 0 : true;
      const type = (req.file.mimetype || '').toLowerCase();
      const isPdf = type.includes('pdf') || req.file.originalname.toLowerCase().endsWith('.pdf');
      if (!sizeOk) return res.status(400).json({ error: 'Arquivo vazio.' });
      if (!isPdf) return res.status(400).json({ error: 'O arquivo deve ser um PDF.' });

      let metadata = {};
      if (req.body && req.body.metadata) { try { metadata = JSON.parse(req.body.metadata); } catch (_) {} }

      if (process.env.IA_STUB === 'true') {
        return res.json({
          aprovado: true,
          motivos: ['Stub ativo: resposta simulada para integração de frontend'],
          checklist: [ { requisito: 'Arquivo recebido', ok: !!req.file }, { requisito: 'Metadados parseados', ok: true } ],
          textoAverbacao: 'Averba-se, por mandado judicial, o que consta dos autos, conforme fundamentação legal pertinente.'
        });
      }

      let pdfParse;
      try { pdfParse = require('pdf-parse'); } catch (e) { return res.status(501).json({ error: 'pdf-parse não instalado no backend. Habilite IA_STUB=true ou instale as dependências.' }); }

      let text = '';
      let pages = undefined;
      try {
        const bin = new Uint8Array(req.file.buffer);
        const parsed = await pdfParse(bin);
        text = parsed.text || '';
        if (parsed && typeof parsed.numpages === 'number') pages = parsed.numpages;
      } catch (e) {
        try {
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
          const data = new Uint8Array(req.file.buffer);
          const task = pdfjsLib.getDocument({ data });
          const pdf = await task.promise;
          let combined = '';
          const maxPagesEnv = Math.max(1, Number(process.env.IA_MAX_PAGES || 100));
          const maxPages = Math.min(pdf.numPages || 0, maxPagesEnv);
          for (let p = 1; p <= maxPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            const line = (content.items || []).map((it) => (it.str || '')).join(' ');
            combined += line + '\n';
          }
          text = combined || '';
          pages = pdf.numPages || maxPages;
        } catch (fallbackErr) {
          if (process.env.IA_STUB === 'true') {
            return res.json({ aprovado: false, motivos: ['Stub ativo: não foi possível extrair texto do PDF; resposta simulada.'], checklist: [ { requisito: 'Texto extraível', ok: false } ], textoAverbacao: 'Averba-se, por mandado judicial... (resposta simulada sem análise do texto)' });
          }
          return res.status(422).json({ error: 'Não foi possível extrair texto do PDF (tente enviar um PDF pesquisável, não escaneado/sem senha).' });
        }
      }

      text = normalizeText(text);
      try { console.log(`[IA][analise-mandado][extract] len=${text.length} pages=${pages ?? 'n/a'} preview(0..400)=`, JSON.stringify(text.slice(0, 400))); } catch(_) {}
      if (!text || text.trim().length < 15) {
        if (process.env.IA_STUB === 'true') {
          return res.json({ aprovado: false, motivos: ['PDF sem texto extraível (provavelmente escaneado). Stub ativo.'], checklist: [ { requisito: 'Texto extraível', ok: false } ], textoAverbacao: 'Averba-se, por mandado judicial... (resposta simulada)' });
        }
        return res.status(422).json({ error: 'PDF sem texto extraível (provavelmente escaneado ou protegido). Envie um PDF pesquisável.' });
      }

      const maxTrechos = Number(process.env.IA_MAX_TRECHOS || 8);
      let trechos = [];
      if (pool) {
        try {
          const q = text.trim().split(/\s+/).slice(0, 12).join(' ');
          const sql = `
            SELECT id, indexador, base_legal, titulo, artigo, jurisdicao, texto
            FROM public.legislacao_normas
            WHERE searchable @@ plainto_tsquery('portuguese', $1)
            AND ativo = true
            ORDER BY updated_at DESC, id DESC
            LIMIT $2
          `;
          const { rows } = await pool.query(sql, [q, maxTrechos]);
          trechos = rows || [];
        } catch (_) {}
      }

      const contextoLegal = trechos.map(t => `• ${t.base_legal}${t.artigo ? ' - ' + t.artigo : ''}: ${t.texto}`).join('\n');
      const useText = clampForPrompt(text);
      if (useText.length < text.length) { try { console.warn(`[IA][analise-mandado] input truncated for provider: use.len=${useText.length} total.len=${text.length}`); } catch (_) {} }
      const prompt = `Analise o mandado judicial abaixo e gere o texto objetivo da averbação.\n\nMandado (texto extraído):\n${useText}\n\nContexto legal (trechos selecionados):\n${contextoLegal}`;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) { return res.status(501).json({ error: 'GEMINI_API_KEY não configurado. Defina a variável de ambiente ou ative IA_STUB=true.' }); }

      let GoogleGenerativeAI;
      try { ({ GoogleGenerativeAI } = await import('@google/generative-ai')); } catch (e) {
        return res.status(501).json({ error: "Pacote '@google/generative-ai' não instalado ou não suportado via require. Instale e redeploy ou use IA_STUB=true." });
      }

      try {
          const genAI = new GoogleGenerativeAI(apiKey);
          // Prefer serventia-specific ia_agent by matching serventia.nome_abreviado
          const metadataNome = (metadata && (metadata.serventiaNome || metadata.serventia)) || null;
          const userServentiaNome = await resolveUserServentiaNome(req);
          const modelCandidates = await resolveModelCandidates({ serventiaNome: metadataNome || userServentiaNome });
          if (!Array.isArray(modelCandidates) || modelCandidates.length === 0) {
            return res.status(422).json({ error: 'Nenhum agente IA configurado para esta serventia. Defina ia_agent / ia_agent_fallback na tabela serventia.' });
          }
          const primary = modelCandidates[0];
          const { resp: provResp, usedModel } = await generateContentWithFallback(genAI, modelCandidates, prompt, { retries: 3, baseDelayMs: 700 });
          const output = (provResp && provResp.response && provResp.response.text && provResp.response.text()) || '';
        const resposta = {
          aprovado: true,
          motivos: ['Análise automática concluída'],
          checklist: [ { requisito: 'PDF processado', ok: true }, { requisito: 'Legislação consultada', ok: trechos.length > 0 } ],
          textoAverbacao: output || 'Averba-se, por mandado judicial, o que consta dos autos...'
        };
        return res.json(resposta);
      } catch (e) {
        return res.status(502).json({ error: 'Falha ao chamar provedor de IA.' });
      }
    } catch (err) {
      try { console.error('Erro na análise de mandado:', err); } catch(_){}
      return res.status(500).json({ error: 'Erro interno na análise.' });
    }
  });

  // Identificar tipo
  app.post('/api/ia/identificar-tipo', ensureAuth, async (req, res) => {
    try {
      const startedAt = Date.now();
      const rid = `IA-IDT-${Date.now()}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
      const { text } = req.body || {};
  const inLen = typeof text === 'string' ? text.length : 0;
  const inNonWS = typeof text === 'string' ? (text.replace(/\s+/g, '').length) : 0;
      try { console.log(`[IA][identificar-tipo][${rid}] req.user snapshot:`, JSON.stringify(req.user || {})); } catch(_){}
      if (!text || typeof text !== 'string' || text.trim().length < 5) {
        try { console.warn(`[IA][identificar-tipo][${rid}] input inválido: texto curto ou ausente`); } catch(_){}
        return res.status(400).json({ error: 'Campo text é obrigatório.' });
      }

      if (process.env.IA_STUB === 'true') {
        const t = text.toLowerCase();
        let tipo = 'mandado_generico';
        if (t.includes('penhora')) tipo = 'mandado_penhora';
        else if (t.includes('alimentos') || t.includes('pensão')) tipo = 'mandado_alimentos';
        else if (t.includes('prisão civil')) tipo = 'mandado_prisao_civil';
        try { console.log(`[IA][identificar-tipo][${rid}] heuristic tipo=${tipo} confidence=0.8 ms=${Date.now() - startedAt}`); } catch(_){}
        return res.json({ tipo, confidence: 0.8 });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) { try { console.error(`[IA][identificar-tipo][${rid}] GEMINI_API_KEY ausente`); } catch(_){}; return res.status(501).json({ error: 'GEMINI_API_KEY não configurado.' }); }
      // Allow caller to pass serventia via metadata or top-level body; prefer that over token-derived value
      let metadataNome = null;
      try {
        if (req.body && req.body.metadata) {
          const md = typeof req.body.metadata === 'string' ? (() => { try { return JSON.parse(req.body.metadata); } catch(_) { return null; } })() : req.body.metadata;
          if (md && (md.serventiaNome || md.serventia)) metadataNome = md.serventiaNome || md.serventia;
        }
        if (!metadataNome && req.body && (req.body.serventia || req.body.serventiaNome)) metadataNome = req.body.serventiaNome || req.body.serventia;
      } catch (_) { metadataNome = null; }

      const userServentiaNome = await resolveUserServentiaNome(req);
      const effectiveServentiaNome = metadataNome || userServentiaNome || null;
      try { console.log('[IA][identificar-tipo] resolved serventiaNome', { metadataNome, userServentiaNome, effectiveServentiaNome }); } catch(_){}
      const modelCandidates = await resolveModelCandidates({ serventiaNome: effectiveServentiaNome });
      if (!Array.isArray(modelCandidates) || modelCandidates.length === 0) {
        try { console.warn(`[IA][identificar-tipo][${rid}] no IA agent configured for user/serventia`); } catch(_){ }
        return res.status(422).json({ error: 'Nenhum agente IA configurado para esta serventia. Defina ia_agent na tabela serventia.' });
      }
      const primary = modelCandidates[0];
      let GoogleGenerativeAI;
      try { ({ GoogleGenerativeAI } = await import('@google/generative-ai')); } catch (impErr) {
        try { console.error('[IA][identificar-tipo] Falha ao importar provedor @google/generative-ai:', impErr && impErr.message ? impErr.message : impErr); } catch(_){}
        return res.status(501).json({ error: "Pacote '@google/generative-ai' não instalado ou indisponível.", hint: "Instale com 'npm i @google/generative-ai' ou ative IA_STUB=true para heurística." });
      }
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const defaultTpl = `Classifique o tipo específico do mandado judicial a partir do texto abaixo.\n\nSe for um mandado de averbação, identifique o SUBTIPO da averbação (exemplo: averbacao_divorcio, averbacao_interdicao, averbacao_reconhecimento_paternidade, averbacao_obito, averbacao_casamento, averbacao_alteracao_nome, averbacao_sentenca_adocao, etc.).\n\nSe não for averbação, classifique como: mandado_penhora, mandado_alimentos, mandado_prisao_civil, ou mandado_generico.\n\nResponda APENAS um JSON com as chaves:\n- tipo: string em snake_case (ex: "averbacao_divorcio")\n- confidence: número entre 0 e 1\n\nTexto do mandado:\n{{texto}}`;
        const rowTpl = await getPromptByIndexador('identificar_tipo_mandado');
        const prompt = renderTemplate((rowTpl && rowTpl.prompt) || defaultTpl, { texto: text.slice(0, 8000) });
        const t0 = Date.now();
        const { resp: provResp, usedModel } = await generateContentWithFallback(genAI, modelCandidates, prompt, { retries: 3, baseDelayMs: 700 });
      const out = (provResp && provResp.response && provResp.response.text && provResp.response.text()) || '';
        try { console.log(`[IA][identificar-tipo][${rid}] provider ok out.len=${out.length} ms=${Date.now() - t0}`); } catch(_){}
        let tipo = 'mandado_generico', confidence = 0.5;
        try {
          let clean = out.trim();
          if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/,'');
          else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
          const parsed = JSON.parse(clean);
          tipo = parsed.tipo || tipo;
          confidence = Number(parsed.confidence) || confidence;
        } catch (parseErr) {
          try { console.warn(`[IA][identificar-tipo][${rid}] parse JSON falhou:`, parseErr && parseErr.message ? parseErr.message : parseErr); } catch(_){}
        }
        return res.json({ tipo, confidence });
      } catch (provErr) {
        try { console.error('[IA][identificar-tipo] Falha ao chamar provedor de IA:', JSON.stringify(describeError(provErr))); } catch(_){}
        const t = text.toLowerCase();
        let tipo = 'mandado_generico';
        if (t.includes('penhora')) tipo = 'mandado_penhora';
        else if (t.includes('alimentos') || t.includes('pensão')) tipo = 'mandado_alimentos';
        else if (t.includes('prisão civil')) tipo = 'mandado_prisao_civil';
        return res.json({ tipo, confidence: 0.4, warning: 'Provedor de IA indisponível, resultado heurístico.' });
      }
    } catch (err) {
      try { console.error('[IA][identificar-tipo] erro inesperado:', err && err.message ? err.message : err); } catch(_){}
      return res.status(500).json({ error: 'Erro ao identificar tipo.' });
    }
  });

  // Analisar exigência
  app.post('/api/ia/analisar-exigencia', ensureAuth, async (req, res) => {
    try {
      const { text, legislacao = [], tipo } = req.body || {};
      if (!text || !Array.isArray(legislacao)) {
        return res.status(400).json({ error: 'Campos text e legislacao[] são obrigatórios.' });
      }
      try { console.log('[IA][analisar-exigencia] input:', { tipo: tipo || 'n/d', textLen: typeof text === 'string' ? text.length : 0, legislacaoLen: Array.isArray(legislacao) ? legislacao.length : -1 }); } catch(_){}

      let legislacaoEspecifica = [];
      if (tipo && tipo !== 'n/d') {
        try { legislacaoEspecifica = await getLegislacaoByIndexador(tipo); } catch (e) { try { console.warn('[IA][analisar-exigencia] falha ao buscar legislação específica:', e && e.message ? e.message : e); } catch(_){} }
      }

      const contextoLegalFTS = (legislacao || []).map((t) => `• ${t.base_legal || ''}${t.artigo ? ' - ' + t.artigo : ''}: ${t.texto || ''}`).join('\n');
      const contextoLegalEspecifico = legislacaoEspecifica.map((t) => `• ${t.base_legal || ''}${t.artigo ? ' - ' + t.artigo : ''}: ${t.texto || ''}`).join('\n');
      let contextoLegal = '';
      if (contextoLegalEspecifico) {
        contextoLegal = `LEGISLAÇÃO ESPECÍFICA DO TIPO (${tipo}):\n${contextoLegalEspecifico}`;
        if (contextoLegalFTS) contextoLegal += `\n\nLEGISLAÇÃO CORRELATA (pesquisa):\n${contextoLegalFTS}`;
      } else {
        contextoLegal = contextoLegalFTS;
      }

      if (process.env.IA_STUB === 'true') {
        const checklist = [ { requisito: 'Coerência do tipo de mandado', ok: !!tipo }, { requisito: 'Legislação correlata fornecida', ok: (legislacao || []).length > 0 } ];
        return res.json({ aprovado: checklist.every(c => c.ok), motivos: checklist.filter(c => !c.ok).map(c => `Requisito não atendido: ${c.requisito}`), checklist, orientacao: 'Verifique a legislação correlata e preencha o texto de averbação conforme exigências.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(501).json({ error: 'GEMINI_API_KEY não configurado.' });
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const userServentiaNome = await resolveUserServentiaNome(req);
        const modelCandidates = await resolveModelCandidates({ serventiaNome: userServentiaNome });
        if (!Array.isArray(modelCandidates) || modelCandidates.length === 0) {
          try { console.warn('[IA][analisar-exigencia] no IA agent configured for user/serventia'); } catch(_){ }
          return res.status(422).json({ error: 'Nenhum agente IA configurado para esta serventia. Defina ia_agent na tabela serventia.' });
        }
        const primary = modelCandidates[0];
        const defaultTpl = `Com base no texto do mandado e nos trechos legais, liste as exigências legais aplicáveis (checklist) e indique se está aprovado.\nResponda APENAS JSON no formato: { aprovado: boolean, motivos: string[], checklist: [{ requisito, ok }], orientacao: string }.\nTipo (se houver): {{tipo}}\nTexto do mandado:\n{{texto}}\n\nLegislação correlata:\n{{legislacao_bullets}}`;
        const rowTpl = await getPromptByIndexador('analisar_mandado');
        const prompt = renderTemplate((rowTpl && rowTpl.prompt) || defaultTpl, { tipo: tipo || 'n/d', texto: text.slice(0, 8000), legislacao_bullets: contextoLegal });
    const { resp: provResp, usedModel } = await generateContentWithFallback(genAI, modelCandidates, prompt, { retries: 3, baseDelayMs: 700 });
      const out = (provResp && provResp.response && provResp.response.text && provResp.response.text()) || '';
        const data = parseJsonLoose(out);
        if (data && typeof data === 'object') {
          return res.json({
            aprovado: !!data.aprovado,
            motivos: Array.isArray(data.motivos) ? data.motivos : [],
            checklist: Array.isArray(data.checklist) ? data.checklist : [],
            orientacao: typeof data.orientacao === 'string' ? data.orientacao : ''
          });
        }
        // Fallback: graceful degradation if provider output is not strict JSON
        const checklist = [
          { requisito: 'Coerência do tipo de mandado', ok: !!tipo },
          { requisito: 'Legislação correlata fornecida', ok: (legislacao || []).length > 0 }
        ];
        return res.json({
          aprovado: checklist.every(c => c.ok),
          motivos: ['Resposta do provedor fora do formato esperado. Aplicado fallback.'],
          checklist,
          orientacao: 'Verifique a legislação correlata e preencha o texto de averbação conforme exigências.'
        });
      } catch (e) {
        try { console.error('[IA][analisar-exigencia] provider error:', JSON.stringify(describeError(e))); } catch(_){}
        // Fallback: don’t break UI when provider fails
        const checklist = [
          { requisito: 'Coerência do tipo de mandado', ok: !!tipo },
          { requisito: 'Legislação correlata fornecida', ok: (legislacao || []).length > 0 }
        ];
        return res.json({
          aprovado: checklist.every(c => c.ok),
          motivos: ['Provedor de IA indisponível. Resultado de fallback aplicado.'],
          checklist,
          orientacao: 'Provedor de IA indisponível. Utilize a legislação correlata e gere o texto de averbação manualmente.'
        });
      }
    } catch (err) {
      try { console.error('[IA][analisar-exigencia] erro inesperado:', describeError(err)); } catch(_){ }
      // As última medida, responder gracioso para não quebrar o fluxo do usuário
      return res.json({
        aprovado: false,
        motivos: ['Erro interno ao analisar exigência.'],
        checklist: [],
        orientacao: 'Tente novamente em instantes ou verifique a legislação manualmente.'
      });
    }
  });

  // Gerar texto da averbação
  app.post('/api/ia/gerar-texto-averbacao', ensureAuth,async (req, res) => {
    try {
      const { text, legislacao = [], tipo } = req.body || {};
      if (!text || typeof text !== 'string' || text.trim().length < 5) {
        return res.status(400).json({ error: 'Campo text é obrigatório.' });
      }
      const contextoLegal = (legislacao || []).map((t) => `• ${t.base_legal || ''}${t.artigo ? ' - ' + t.artigo : ''}: ${t.texto || ''}`).join('\n');
      if (process.env.IA_STUB === 'true') {
        const base = `Averba-se, por mandado judicial${tipo ? ` (${tipo.replace(/_/g, ' ')})` : ''}, o que consta do texto do mandado, observadas as disposições legais aplicáveis.`;
        const refs = (legislacao || []).slice(0, 3).map((l) => `${l.base_legal}${l.artigo ? ' - ' + l.artigo : ''}`).filter(Boolean);
        const complemento = refs.length ? ` Referências: ${refs.join('; ')}.` : '';
        return res.json({ textoAverbacao: base + complemento });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(501).json({ error: 'GEMINI_API_KEY não configurado.' });
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const userServentiaNome = await resolveUserServentiaNome(req);
        const modelCandidates = await resolveModelCandidates({ serventiaNome: userServentiaNome });
        if (!Array.isArray(modelCandidates) || modelCandidates.length === 0) {
          try { console.warn('[IA][gerar-texto-averbacao] no IA agent configured for user/serventia'); } catch(_){ }
          return res.status(422).json({ error: 'Nenhum agente IA configurado para esta serventia. Defina ia_agent na tabela serventia.' });
        }
        const primary = modelCandidates[0];
        const defaultTpl = `Elabore o texto objetivo da averbação a partir do mandado judicial abaixo, observando as exigências legais pertinentes. O texto deve ser curto, impessoal e adequado para lançamento no livro. Retorne apenas o texto, sem comentários.\nTipo (se houver): {{tipo}}\nMandado (texto):\n{{texto}}\n\nLegislação aplicável (trechos):\n{{legislacao_bullets}}`;
        const rowTpl = await getPromptByIndexador('criar_averbacao');
        const prompt = renderTemplate((rowTpl && rowTpl.prompt) || defaultTpl, { tipo: tipo || 'n/d', texto: text.slice(0, 8000), legislacao_bullets: contextoLegal });
    const { resp: provResp, usedModel } = await generateContentWithFallback(genAI, modelCandidates, prompt, { retries: 3, baseDelayMs: 700 });
      const out = (provResp && provResp.response && provResp.response.text && provResp.response.text()) || '';
        const texto = String(out).trim().replace(/^"|"$/g, '');
        return res.json({ textoAverbacao: texto || 'Averba-se, por mandado judicial...' });
      } catch (e) {
        return res.status(502).json({ error: 'Falha ao chamar provedor de IA.' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao gerar texto da averbação.' });
    }
  });

  // Diagnostics and prompts CRUD
  app.get('/api/ia/diagnostics', async (req, res) => {
    const envFallback = null;
    const model = null;
    const stub = process.env.IA_STUB === 'true';
    const apiKeySet = !!process.env.GEMINI_API_KEY;
    const report = { ok: false, stub, envFallback, resolvedModel: model, apiKey: apiKeySet ? `set(len=${String(process.env.GEMINI_API_KEY).length})` : 'missing', sdk: 'google/generative-ai' };
    if (stub) { report.ok = true; report.note = 'IA_STUB=true: provider calls are bypassed'; return res.json(report); }
    if (!apiKeySet) { report.error = 'GEMINI_API_KEY missing'; return res.status(501).json(report); }
    try {
      // Try listing via REST to show provider-available models
      let availableModels = [];
      try {
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
        const fetch = (await import('node-fetch')).default;
        const listResp = await fetch(listUrl);
        if (listResp.ok) {
          const data = await listResp.json();
          availableModels = (data.models || []).map(m => m.name || '').filter(Boolean);
          report.availableModels = availableModels.slice(0, 20);
          report.ok = true;
          return res.json(report);
        } else {
          report.listModelsError = { status: listResp.status, statusText: listResp.statusText };
        }
      } catch (listErr) { report.listModelsError = describeError(listErr); }

      // If listing failed, surface the error
      report.error = report.listModelsError || 'Failed to list provider models';
      return res.status(502).json(report);
    } catch (e) {
      const details = describeError(e);
      report.error = details;
      return res.status(502).json(report);
    }
  });

  // Debug endpoint: inspect serventia rows in both schemas to diagnose ia_agent lookups
  app.get('/api/ia/_debug/serventia', async (req, res) => {
    if (!pool) return res.status(501).json({ error: 'Pool/DB indisponível.' });
    try {
      const { codigo, nome } = req.query || {};
      const qCodigo = String(codigo || '').trim();
      const qNome = String(nome || '').trim();
      const norm = (s) => String(s || '').replace(/\D/g, '');
      const wantedNormalized = qCodigo ? norm(qCodigo) : null;
      const out = { requested: { codigo: qCodigo || null, nome: qNome || null, wantedNormalized }, db_yq0x: [], public: [] };

      // Query namespaced table
      try {
        let sql;
        let params = [];
        if (wantedNormalized) {
          sql = "SELECT id, nome_abreviado, codigo_serventia, ia_agent, ia_agent_fallback1, ia_agent_fallback2, regexp_replace(codigo_serventia, '\\D', '', 'g') AS codigo_normalized FROM db_yq0x.public.serventia WHERE regexp_replace(codigo_serventia, '\\D', '', 'g') = $1 LIMIT 10";
          params = [wantedNormalized];
        } else if (qNome) {
          sql = "SELECT id, nome_abreviado, codigo_serventia, ia_agent, ia_agent_fallback1, ia_agent_fallback2, regexp_replace(codigo_serventia, '\\D', '', 'g') AS codigo_normalized FROM db_yq0x.public.serventia WHERE lower(nome_abreviado) LIKE lower($1) LIMIT 10";
          params = ['%' + qNome + '%'];
        } else {
          sql = "SELECT id, nome_abreviado, codigo_serventia, ia_agent, ia_agent_fallback1, ia_agent_fallback2, regexp_replace(codigo_serventia, '\\D', '', 'g') AS codigo_normalized FROM db_yq0x.public.serventia LIMIT 20";
          params = [];
        }
        try { console.log('[IA][_debug/serventia] executing namespaced debug query', { sql, params }); } catch(_){}
        const { rows } = await pool.query(sql, params);
        out.db_yq0x = rows || [];
      } catch (e) {
        try { console.error('[IA][_debug/serventia] namespaced query failed', e && e.message ? e.message : e); } catch(_){}
      }

      // Query public table
      try {
        let sql2;
        let params2 = [];
        if (wantedNormalized) {
          sql2 = "SELECT id, nome_abreviado, codigo_serventia, ia_agent, ia_agent_fallback1, ia_agent_fallback2, regexp_replace(codigo_serventia, '\\D', '', 'g') AS codigo_normalized FROM public.serventia WHERE regexp_replace(codigo_serventia, '\\D', '', 'g') = $1 LIMIT 10";
          params2 = [wantedNormalized];
        } else if (qNome) {
          sql2 = "SELECT id, nome_abreviado, codigo_serventia, ia_agent, ia_agent_fallback1, ia_agent_fallback2, regexp_replace(codigo_serventia, '\\D', '', 'g') AS codigo_normalized FROM public.serventia WHERE lower(nome_abreviado) LIKE lower($1) LIMIT 10";
          params2 = ['%' + qNome + '%'];
        } else {
          sql2 = "SELECT id, nome_abreviado, codigo_serventia, ia_agent, ia_agent_fallback1, ia_agent_fallback2, regexp_replace(codigo_serventia, '\\D', '', 'g') AS codigo_normalized FROM public.serventia LIMIT 20";
          params2 = [];
        }
        try { console.log('[IA][_debug/serventia] executing public debug query', { sql: sql2, params: params2 }); } catch(_){}
        const { rows: rows2 } = await pool.query(sql2, params2);
        out.public = rows2 || [];
      } catch (e) {
        try { console.error('[IA][_debug/serventia] public query failed', e && e.message ? e.message : e); } catch(_){}
      }

      return res.json(out);
    } catch (err) {
      try { console.error('[IA][_debug/serventia] unexpected error', err && err.message ? err.message : err); } catch(_){}
      return res.status(500).json({ error: 'Erro ao executar debug.' });
    }
  });

  // 5) Run arbitrary stored prompt against one or more DAPs (by id)
  // Require authentication for running prompts
  app.post('/api/ia/run-prompt', ensureAuth, async (req, res) => {
    try {
      if (!pool) return res.status(501).json({ error: 'Pool/DB indisponível.' });
      const { indexador, dapIds } = req.body || {};
      console.log('[IA][run-prompt] incoming request', { userId: req.user && req.user.id ? req.user.id : null, indexador: String(indexador || ''), dapIdsCount: Array.isArray(dapIds) ? dapIds.length : 0 });
      try {
        console.log('[IA][run-prompt] req.user snapshot:', JSON.stringify(req.user || {}));
      } catch (jsonErr) {
        console.log('[IA][run-prompt] req.user (raw):', req.user);
      }
      console.log('[IA][run-prompt] req.user.codigo_serventia:', req.user && (req.user.codigo_serventia || req.user.codigoServentia || null));
      if (!indexador || !Array.isArray(dapIds) || dapIds.length === 0) {
        return res.status(400).json({ error: 'Informe indexador e dapIds (array) no corpo.' });
      }

      const promptRow = await getPromptByIndexador(String(indexador || '').toLowerCase());
      console.log('[IA][run-prompt] prompt lookup', { found: !!promptRow, indexador: String(indexador || '').toLowerCase() });
      if (!promptRow) return res.status(404).json({ error: 'Prompt não encontrado.' });

      // Helper: load a single DAP with its periodos and atos (re-using dap route SQL)
      async function loadDap(id, codigoServentia) {
        const baseSelect = `
          SELECT id, mes_referencia AS "mesReferencia", ano_referencia AS "anoReferencia",
                 retificadora, retificadora_de_id AS "retificadoraDeId", retificada_por_id AS "retificadaPorId",
                 serventia_nome AS "serventiaNome", codigo_serventia AS "codigoServentia", cnpj,
                 data_transmissao AS "dataTransmissao", codigo_recibo AS "codigoRecibo", observacoes,
                 emolumento_apurado AS "emolumentoApurado",
                 taxa_fiscalizacao_judiciaria_apurada AS "taxaFiscalizacaoJudiciariaApurada",
                 taxa_fiscalizacao_judiciaria_paga AS "taxaFiscalizacaoJudiciariaPaga",
                 recompe_apurado AS "recompeApurado",
                 recompe_depositado AS "recompeDepositado",
                 data_deposito_recompe AS "dataDepositoRecompe",
                 valores_recebidos_recompe AS "valoresRecebidosRecompe",
                 valores_recebidos_ferrfis AS "valoresRecebidosFerrfis",
                 issqn_recebido_usuarios AS "issqnRecebidoUsuarios",
                 repasses_responsaveis_anteriores AS "repassesResponsaveisAnteriores",
                 saldo_deposito_previo AS "saldoDepositoPrevio",
                 total_despesas_mes AS "totalDespesasMes",
                 estoque_selos_eletronicos_transmissao AS "estoqueSelosEletronicosTransmissao"
          FROM public.dap
        `;
        let headerSql;
        let headerParams;
        if (codigoServentia) {
          headerSql = baseSelect + '\n          WHERE id = $1 AND codigo_serventia = $2\n        ';
          headerParams = [id, codigoServentia];
        } else {
          headerSql = baseSelect + '\n          WHERE id = $1\n        ';
          headerParams = [id];
        }
        const headerResult = await pool.query(headerSql, headerParams);
        if (!headerResult.rowCount) return null;

        // Try namespaced periodos table first (some DBs use db_yq0x.public.dap_periodo)
        let periodosResult;
        try {
          periodosResult = await pool.query(`
            SELECT id, ordem, quantidade_total AS "quantidadeTotal", tfj_total AS "tfjTotal"
            FROM db_yq0x.public.dap_periodo
            WHERE dap_id = $1
            ORDER BY ordem
          `, [id]);
        } catch (_) {
          const periodosSql = `
            SELECT id, ordem, quantidade_total AS "quantidadeTotal", tfj_total AS "tfjTotal"
            FROM public.dap_periodo
            WHERE dap_id = $1
            ORDER BY ordem
          `;
          periodosResult = await pool.query(periodosSql, [id]);
        }
        const periodoIds = (periodosResult && periodosResult.rows) ? periodosResult.rows.map((row) => row.id) : [];

        let atos = [];
        if (periodoIds.length) {
          // Snapshots with exercised atos live in dap_periodo_ato_snapshot; try namespaced first
          let atosResult;
          try {
            const atosSqlNs = `
              SELECT a.periodo_id AS "periodoId",
                     a.codigo,
                     a.tributacao,
                     a.quantidade,
                     a.tfj_valor AS "tfjValor",
                     at.descricao AS "atoDescricao",
                     cg.descricao AS "tributacaoDescricao"
              FROM db_yq0x.public.dap_periodo_ato_snapshot a
              LEFT JOIN public.atos at ON at.codigo = a.codigo
              LEFT JOIN public.codigos_gratuitos cg ON cg.codigo = a.tributacao
              WHERE periodo_id = ANY($1)
              ORDER BY a.codigo, a.tributacao
            `;
            atosResult = await pool.query(atosSqlNs, [periodoIds]);
          } catch (_) {
            const atosSql = `
              SELECT a.periodo_id AS "periodoId",
                     a.codigo,
                     a.tributacao,
                     a.quantidade,
                     a.tfj_valor AS "tfjValor",
                     at.descricao AS "atoDescricao",
                     cg.descricao AS "tributacaoDescricao"
              FROM public.dap_periodo_ato_snapshot a
              LEFT JOIN public.atos at ON at.codigo = a.codigo
              LEFT JOIN public.codigos_gratuitos cg ON cg.codigo = a.tributacao
              WHERE periodo_id = ANY($1)
              ORDER BY a.codigo, a.tributacao
            `;
            atosResult = await pool.query(atosSql, [periodoIds]);
          }
          atos = (atosResult && atosResult.rows) ? atosResult.rows : [];

          // Fetch tributacao (codigos_gratuitos) descriptions and attach to atos
          try {
            // Build a normalized lookup by fetching codigos_gratuitos (small table expected)
            let codesRows = [];
            try {
              const q = 'SELECT codigo, descricao FROM db_yq0x.public.codigos_gratuitos';
              const r = await pool.query(q, []);
              codesRows = r.rows || [];
            } catch (_) {
              const q2 = 'SELECT codigo, descricao FROM public.codigos_gratuitos';
              const r2 = await pool.query(q2, []);
              codesRows = r2.rows || [];
            }

            // Build mapping: raw trimmed key and a normalized numeric key (no non-digits, no leading zeros)
            const codigoMap = {}; // keys -> descricao
            const norm = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
            codesRows.forEach((c) => {
              if (!c || !c.codigo) return;
              const raw = String(c.codigo).trim();
              const descricao = c.descricao || '';
              codigoMap[raw] = descricao;
              const n = norm(raw);
              if (n) codigoMap[n] = descricao;
              // also map zero-padded 2-digit (e.g., '1' -> '01') to handle common representations
              if (n && n.length === 1) codigoMap['0' + n] = descricao;
            });

            // Attach tributacaoDescricao using flexible matching
            atos = atos.map((a) => {
              const tRaw = a.tributacao ? String(a.tributacao).trim() : '';
              let desc = '';
              if (tRaw && codigoMap[tRaw]) desc = codigoMap[tRaw];
              if (!desc) {
                const tNorm = norm(tRaw);
                if (tNorm && codigoMap[tNorm]) desc = codigoMap[tNorm];
                else if (tNorm && codigoMap['0' + tNorm]) desc = codigoMap['0' + tNorm];
              }
              return ({ ...a, tributacaoDescricao: desc || '' });
            });

            try { console.log('[IA][loadDap] tributacao mapping sample:', Object.entries(codigoMap).slice(0,10)); } catch(_) {}
          } catch (mapErr) {
            // ignore mapping failures; atos remain as-is
          }
        }

        // Log the raw DB reads for debugging/verification (header, periodos, atos)
        try {
          console.log('[IA][loadDap] header:', headerResult.rows[0]);
          console.log('[IA][loadDap] periodos count:', (periodosResult && periodosResult.rows) ? periodosResult.rows.length : 0, 'ids:', periodoIds);
          console.log('[IA][loadDap] atos count:', atos.length, 'sample:', atos.slice(0, 6));
        } catch (_) {}

        const periodoMap = (periodosResult && periodosResult.rows) ? periodosResult.rows.map((periodo) => ({
          ...periodo,
          atos: atos.filter((ato) => ato.periodoId === periodo.id),
        })) : [];

        return { header: headerResult.rows[0], periodos: periodoMap };
      }

      const usuario = req.user || {};
      const codigoServentia = usuario.codigo_serventia || usuario.codigoServentia || null;

      // Prepare provider
      let GoogleGenerativeAI = null;
      try {
        ({ GoogleGenerativeAI } = await import('@google/generative-ai'));
      } catch (impErr) {
        // continue; we'll handle stub or error later
      }

      const results = [];
      for (const rawId of dapIds) {
        const id = Number(rawId);
        if (!Number.isInteger(id)) {
          results.push({ dapId: rawId, error: 'ID inválido' });
          continue;
        }
        try {
          const dapStart = Date.now();
          console.log(`[IA][run-prompt] processing dap ${id}`);
          const loaded = await loadDap(id, codigoServentia);
          if (!loaded) {
            console.warn(`[IA][run-prompt] dap ${id} not found or access denied`);
            results.push({ dapId: id, error: 'DAP não encontrada ou acesso negado.' });
            continue;
          }
          console.log(`[IA][run-prompt] dap ${id} loaded header`, { id: loaded.header && loaded.header.id ? loaded.header.id : null, serventia: loaded.header && (loaded.header.serventiaNome || loaded.header.codigoServentia) });

          // Build a concise text context from DAP
          const hdr = loaded.header || {};
          let combined = `DAP ${id} • Serventia: ${hdr.serventiaNome || hdr.codigoServentia || ''} • Referência: ${hdr.mesReferencia || ''}/${hdr.anoReferencia || ''}\n`;
          (loaded.periodos || []).forEach((p, idx) => {
            combined += `----- PERIODO ${p.ordem} -----\n`;
            (p.atos || []).forEach((a) => {
              const atoDesc = a.atoDescricao || a.descricao || '';
              const tribDesc = a.tributacaoDescricao || '';
              const tribLabel = a.tributacao ? `${a.tributacao}${tribDesc ? ' - ' + tribDesc : ''}` : '';
              combined += `ATO ${a.codigo} ${atoDesc ? ' - ' + atoDesc : ''} | Trib: ${tribLabel} | Qtd: ${a.quantidade} | Emol: ${a.tfjValor} \n`;
            });
          });

          const promptText = renderTemplate(promptRow.prompt || '', { dap_text: clampForPrompt(combined), dap_id: id, serventia: hdr.serventiaNome || hdr.codigoServentia });
          console.log(`[IA][run-prompt] dap ${id} prompt length=${String(promptText || '').length}`);
          try {
            const preview = String(promptText || '').slice(0, 4000);
            console.log(`[IA][run-prompt] dap ${id} prompt preview(0..4000)=`, preview);
          } catch (_) {}

          if (process.env.IA_STUB === 'true' || !GoogleGenerativeAI) {
            // Provide a safe stubbed response
            console.log(`[IA][run-prompt] dap ${id} using stub or provider unavailable`);
            results.push({ dapId: id, indexador: indexador, prompt: promptText, output: `[STUB] Execução simulada para DAP ${id}` });
            continue;
          }

          try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
              console.error('[IA][run-prompt] missing GEMINI_API_KEY');
              results.push({ dapId: id, error: 'GEMINI_API_KEY não configurada.' });
              continue;
            }
            // Resolve serventia (nome_abreviado) for the logged-in user (token or DB) and use it
            const userServentiaNome = await resolveUserServentiaNome(req) || (hdr && (hdr.serventiaNome || hdr.serventia_nome)) || null;
            try { console.log(`[IA][run-prompt] dap ${id} resolving IA agent using serventiaNome=${userServentiaNome}`); } catch(_){ }
            let modelCandidates = await resolveModelCandidates({ serventiaNome: userServentiaNome });
            if (!Array.isArray(modelCandidates) || modelCandidates.length === 0) {
              results.push({ dapId: id, error: 'Nenhum agente IA configurado para esta serventia. Atualize a coluna ia_agent/ia_agent_fallback na tabela serventia.' });
              continue;
            }
            const primary = modelCandidates[0];
            console.log(`[IA][run-prompt] dap ${id} calling provider candidates=${JSON.stringify(modelCandidates)}`);
                const genAI = new GoogleGenerativeAI(apiKey);
                try {
                  const { resp: provResp, usedModel } = await generateContentWithFallback(genAI, modelCandidates, promptText, { retries: 2, baseDelayMs: 600 });
                  const out = (provResp && provResp.response && provResp.response.text && provResp.response.text()) || '';
                  try { console.log(`[IA][run-prompt] dap ${id} provider returned model=${usedModel} len=${String(out ? out.length : 0)}`); } catch(_){}
                  results.push({ dapId: id, indexador: indexador, prompt: promptText, output: String(out || '').trim(), model: usedModel });
                } catch (fallbackErr) {
                  console.error(`[IA][run-prompt] dap ${id} provider error after fallbacks`, describeError(fallbackErr));
                  results.push({ dapId: id, error: 'Falha ao chamar provedor de IA', detail: describeError(fallbackErr) });
                }
          } catch (provErr) {
            console.error(`[IA][run-prompt] dap ${id} provider error`, describeError(provErr));
            results.push({ dapId: id, error: 'Falha ao chamar provedor de IA', detail: describeError(provErr) });
          }
          const dapElapsed = Date.now() - dapStart;
          console.log(`[IA][run-prompt] dap ${id} completed in ${dapElapsed}ms`);
        } catch (e) {
          console.error('[IA][run-prompt] unexpected error for dap', rawId, e && e.message ? e.message : e);
          results.push({ dapId: rawId, error: e && e.message ? e.message : String(e) });
        }
      }

      console.log('[IA][run-prompt] all daps processed', { total: results.length });
      return res.json({ results });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao executar prompt.' });
    }
  });

  app.get('/api/ia/prompts', async (req, res) => {
    if (!pool) return res.status(501).json({ error: 'Pool/DB indisponível.' });
    try { await ensurePromptsTable(); const { rows } = await pool.query('SELECT indexador, prompt, updated_at FROM public.ia_prompts ORDER BY indexador ASC'); return res.json(rows || []); } catch (e) { return res.status(500).json({ error: 'Falha ao listar prompts.' }); }
  });

  app.get('/api/ia/prompts/:indexador', async (req, res) => {
    const idx = String(req.params.indexador || '').toLowerCase();
    const row = await getPromptByIndexador(idx);
    if (!row) return res.status(404).json({ error: 'Prompt não encontrado' });
    return res.json(row);
  });

  app.put('/api/ia/prompts/:indexador', async (req, res) => {
    if (!pool) return res.status(501).json({ error: 'Pool/DB indisponível.' });
    const idx = String(req.params.indexador || '').toLowerCase();
    const { prompt } = req.body || {};
    if (!idx || typeof prompt !== 'string' || prompt.trim().length < 5) {
      return res.status(400).json({ error: 'Informe um indexador e um prompt válido (>=5 chars).' });
    }
    const row = await upsertPrompt(idx, prompt);
    if (!row) return res.status(500).json({ error: 'Falha ao salvar prompt.' });
    return res.json(row);
  });

  app.delete('/api/ia/prompts/:indexador', async (req, res) => {
    if (!pool) return res.status(501).json({ error: 'Pool/DB indisponível.' });
    try {
      await ensurePromptsTable();
      const idx = String(req.params.indexador || '').toLowerCase();
      const { rowCount } = await pool.query('DELETE FROM public.ia_prompts WHERE indexador = $1', [idx]);
      if (rowCount === 0) return res.status(404).json({ error: 'Prompt não encontrado' });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Falha ao apagar prompt.' });
    }
  });

  // Public endpoint: list available IA agents (friendly + normalized keys).
  // Optional: ?force=true to refresh provider cache.
  app.get('/api/ia/agents', async (req, res) => {
    try {
      const force = String(req.query && req.query.force || '').toLowerCase() === 'true';
      if (force) _cachedAvailableModels.ts = 0;
      if (!process.env.GEMINI_API_KEY) return res.status(501).json({ error: 'GEMINI_API_KEY missing' });
      const models = await fetchAvailableModelsFromProvider();
      const agents = (models || []).map((m) => {
        const raw = String(m || '');
        const friendly = raw.replace(/^projects\/[^^\/]+\/locations\/[^^\/]+\/models\//, '').replace(/^projects\/[^^\/]+\/models\//, '').replace(/^models\//, '');
        return { name: raw, friendly, normalized: normalizeModelKey(raw) };
      });
      return res.json({ count: agents.length, agents, cachedAt: _cachedAvailableModels.ts });
    } catch (e) {
      try { console.error('[IA][agents] error fetching agents', e && e.message ? e.message : e); } catch(_){}
      return res.status(502).json({ error: 'Failed to fetch agents', detail: describeError(e) });
    }
  });
}

module.exports = { registerIaRoutes };
