// Backend routes example for IA (Google Gemini 1.5 Flash) and PDF analysis
// Usage in your backend project (server.js):
//   const initIARoutes = require('./routes/ia');
//   initIARoutes(app, pool, { ensureAuth });

const multer = require('multer');

// memory storage is enough, we forward the PDF buffer to the parser/provider
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

module.exports = function initIARoutes(app, pool, middlewares = {}) {
  const ensureAuth = middlewares.ensureAuth || ((req, res, next) => next());
  const jobs = new Map(); // in-memory job store { id: { state, step, message, progress, textPreview, result, error } }

  // Healthcheck (optional)
  app.get('/api/ia/health', (req, res) => {
    res.json({ ok: true, provider: process.env.IA_MODEL || 'gemini-1.5-flash', stub: process.env.IA_STUB === 'true' });
  });

  // POST /api/ia/analise-mandado
  app.post('/api/ia/analise-mandado', ensureAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Arquivo PDF (file) é obrigatório.' });
      }

      // Validações rápidas do arquivo
      const sizeOk = typeof req.file.size === 'number' ? req.file.size > 0 : true;
      const type = (req.file.mimetype || '').toLowerCase();
      const isPdf = type.includes('pdf') || req.file.originalname.toLowerCase().endsWith('.pdf');
      if (!sizeOk) return res.status(400).json({ error: 'Arquivo vazio.' });
      if (!isPdf) return res.status(400).json({ error: 'O arquivo deve ser um PDF.' });

      let metadata = {};
      if (req.body && req.body.metadata) {
        try { metadata = JSON.parse(req.body.metadata); } catch (_) {}
      }

      // Stub mode to unblock frontend while integrating the real provider
      if (process.env.IA_STUB === 'true') {
        return res.json({
          aprovado: true,
          motivos: ['Stub ativo: resposta simulada para integração de frontend'],
          checklist: [
            { requisito: 'Arquivo recebido', ok: !!req.file },
            { requisito: 'Metadados parseados', ok: true }
          ],
          textoAverbacao: 'Averba-se, por mandado judicial, o que consta dos autos, conforme fundamentação legal pertinente.'
        });
      }

      // Try to load pdf-parse dynamically so this file can exist without breaking build on environments without it
      let pdfParse;
      try { pdfParse = require('pdf-parse'); } catch (e) {
        return res.status(501).json({ error: 'pdf-parse não instalado no backend. Habilite IA_STUB=true ou instale as dependências.' });
      }

      let text = '';
      try {
        const parsed = await pdfParse(req.file.buffer);
        text = parsed.text || '';
      } catch (e) {
        // Fallback com pdfjs-dist (pode funcionar em alguns PDFs onde pdf-parse falha)
        try {
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
          const data = new Uint8Array(req.file.buffer);
          const task = pdfjsLib.getDocument({ data });
          const pdf = await task.promise;
          let combined = '';
          const maxPages = Math.min(pdf.numPages || 0, 50);
          for (let p = 1; p <= maxPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            const line = (content.items || []).map((it) => (it.str || '')).join(' ');
            combined += line + '\n';
          }
          text = combined || '';
        } catch (fallbackErr) {
          if (process.env.IA_STUB === 'true') {
            return res.json({
              aprovado: false,
              motivos: ['Stub ativo: não foi possível extrair texto do PDF; resposta simulada.'],
              checklist: [ { requisito: 'Texto extraível', ok: false } ],
              textoAverbacao: 'Averba-se, por mandado judicial... (resposta simulada sem análise do texto)'
            });
          }
          return res.status(422).json({ error: 'Não foi possível extrair texto do PDF (tente enviar um PDF pesquisável, não escaneado/sem senha).' });
        }
      }

      if (!text || text.trim().length < 15) {
        if (process.env.IA_STUB === 'true') {
          return res.json({
            aprovado: false,
            motivos: ['PDF sem texto extraível (provavelmente escaneado). Stub ativo.'],
            checklist: [ { requisito: 'Texto extraível', ok: false } ],
            textoAverbacao: 'Averba-se, por mandado judicial... (resposta simulada)'
          });
        }
        return res.status(422).json({ error: 'PDF sem texto extraível (provavelmente escaneado ou protegido). Envie um PDF pesquisável.' });
      }

      // Retrieve top-N legislação trechos via FTS
      // Simple query using plainto_tsquery; adjust scoring/limit as needed
      const maxTrechos = Number(process.env.IA_MAX_TRECHOS || 8);
      let trechos = [];
      if (pool) {
        try {
          const q = text.trim().split(/\s+/).slice(0, 12).join(' '); // naive short query from PDF text
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
        } catch (_) {
          // ignore DB errors for now, IA can still run with minimal context
        }
      }

      // Build prompt/context
      const contextoLegal = trechos.map(t => `• ${t.base_legal}${t.artigo ? ' - ' + t.artigo : ''}: ${t.texto}`).join('\n');
      const prompt = `Analise o mandado judicial abaixo e gere o texto objetivo da averbação.\n\nMandado (texto extraído):\n${text.slice(0, 8000)}\n\nContexto legal (trechos selecionados):\n${contextoLegal}`;

      // Call Google Gemini dynamically
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(501).json({ error: 'GEMINI_API_KEY não configurado. Defina a variável de ambiente ou ative IA_STUB=true.' });
      }

      let GoogleGenerativeAI;
      try {
        ({ GoogleGenerativeAI } = await import('@google/generative-ai'));
      } catch (e) {
        return res.status(501).json({ error: "Pacote '@google/generative-ai' não instalado ou não suportado via require. Instale e redeploy ou use IA_STUB=true." });
      }

      try {
  const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.IA_MODEL || 'gemini-1.5-flash';
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const output = (result && result.response && result.response.text && result.response.text()) || '';

        // naive structure; in production, instruct model to return JSON and parse it
        const resposta = {
          aprovado: true,
          motivos: ['Análise automática concluída'],
          checklist: [
            { requisito: 'PDF processado', ok: true },
            { requisito: 'Legislação consultada', ok: trechos.length > 0 }
          ],
          textoAverbacao: output || 'Averba-se, por mandado judicial, o que consta dos autos...'
        };
        return res.json(resposta);
      } catch (e) {
        return res.status(502).json({ error: 'Falha ao chamar provedor de IA.' });
      }
    } catch (err) {
      console.error('Erro na análise de mandado:', err);
      return res.status(500).json({ error: 'Erro interno na análise.' });
    }
  });

  // Async flow: create job and process in background
  function newJob(initial = {}) {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const job = {
      id,
      state: 'queued', // queued|processing|done|error
      step: 'queued',
      message: 'Aguardando processamento',
      progress: 0,
      createdAt: Date.now(),
      ...initial
    };
    jobs.set(id, job);
    return job;
  }

  function updateJob(id, patch) {
    const job = jobs.get(id);
    if (!job) return;
    Object.assign(job, patch);
    jobs.set(id, job);
  }

  async function processJob(jobId, reqSnapshot) {
    updateJob(jobId, { state: 'processing', step: 'upload_received', message: 'Arquivo recebido', progress: 10 });
    const { buffer, mimetype, originalname, metadata } = reqSnapshot;

    // Validate
    const type = (mimetype || '').toLowerCase();
    const isPdf = type.includes('pdf') || (originalname || '').toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      updateJob(jobId, { state: 'error', step: 'validate', message: 'O arquivo deve ser um PDF.', error: 'invalid_file_type' });
      return;
    }

    // Extract text (pdf-parse then pdfjs fallback)
    updateJob(jobId, { step: 'extracting_text', message: 'Extraindo texto do PDF…', progress: 25 });
    let extracted = '';
    try {
      const pdfParse = require('pdf-parse');
      const parsed = await pdfParse(buffer);
      extracted = parsed.text || '';
    } catch (_) {
      // fallback
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
        const data = new Uint8Array(buffer);
        const task = pdfjsLib.getDocument({ data });
        const pdf = await task.promise;
        const maxPages = Math.min(pdf.numPages || 0, 50);
        for (let p = 1; p <= maxPages; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          const line = (content.items || []).map((it) => (it.str || '')).join(' ');
          extracted += line + '\n';
        }
      } catch (e2) {
        if (process.env.IA_STUB === 'true') {
          updateJob(jobId, { step: 'text_unavailable', message: 'PDF sem texto extraível (stub ativo).', progress: 30, textPreview: '' });
        } else {
          updateJob(jobId, { state: 'error', step: 'extract_text', message: 'PDF sem texto extraível. Envie um PDF pesquisável.', error: 'no_text' });
          return;
        }
      }
    }

    if (extracted && extracted.trim().length > 0) {
      updateJob(jobId, { step: 'text_extracted', message: 'Texto extraído com sucesso', progress: 45, textPreview: extracted.slice(0, 1500) });
    }

    // Retrieve legislação
    let trechos = [];
    if (pool) {
      updateJob(jobId, { step: 'retrieving_legislation', message: 'Buscando legislação relevante…', progress: 55 });
      try {
        const q = (extracted || '').trim().split(/\s+/).slice(0, 12).join(' ');
        const { rows } = await pool.query(
          `SELECT id, indexador, base_legal, titulo, artigo, jurisdicao, texto
           FROM public.legislacao_normas
           WHERE ativo = true AND searchable @@ plainto_tsquery('portuguese', $1)
           ORDER BY updated_at DESC, id DESC
           LIMIT $2`,
          [q, Number(process.env.IA_MAX_TRECHOS || 8)]
        );
        trechos = rows || [];
      } catch (_) {
        // ignore
      }
    }

    // IA call or stub
    updateJob(jobId, { step: 'calling_llm', message: 'Analisando o conteúdo com IA…', progress: 70 });
    let result;
    if (process.env.IA_STUB === 'true') {
      result = {
        aprovado: true,
        motivos: ['Stub ativo: análise simulada.'],
        checklist: [
          { requisito: 'Texto extraído', ok: !!(extracted && extracted.trim()) },
          { requisito: 'Legislação consultada', ok: trechos.length > 0 }
        ],
        textoAverbacao: 'Averba-se, por mandado judicial... (stub)'
      };
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        updateJob(jobId, { state: 'error', step: 'provider', message: 'GEMINI_API_KEY não configurado.', error: 'no_api_key' });
        return;
      }
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: process.env.IA_MODEL || 'gemini-1.5-flash' });
        const contextoLegal = (trechos || []).map(t => `• ${t.base_legal}${t.artigo ? ' - ' + t.artigo : ''}: ${t.texto}`).join('\n');
        const prompt = `Analise o mandado judicial abaixo e gere o texto objetivo da averbação.\n\nMandado (texto extraído):\n${(extracted || '').slice(0, 8000)}\n\nContexto legal (trechos selecionados):\n${contextoLegal}`;
        const resp = await model.generateContent(prompt);
        const out = (resp && resp.response && resp.response.text && resp.response.text()) || '';
        result = {
          aprovado: true,
          motivos: ['Análise automática concluída'],
          checklist: [
            { requisito: 'Texto extraído', ok: !!(extracted && extracted.trim()) },
            { requisito: 'Legislação consultada', ok: trechos.length > 0 }
          ],
          textoAverbacao: out || 'Averba-se, por mandado judicial...'
        };
      } catch (e) {
        updateJob(jobId, { state: 'error', step: 'provider', message: 'Falha ao chamar provedor de IA.', error: 'provider_error' });
        return;
      }
    }

    updateJob(jobId, { state: 'done', step: 'completed', message: 'Análise concluída', progress: 100, result });
  }

  // POST /api/ia/analise-mandado-async
  app.post('/api/ia/analise-mandado-async', ensureAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo PDF (file) é obrigatório.' });
      const job = newJob();
      // snapshot necessary data to process later (buffer, mimetype, name, metadata)
      let metadata = {};
      if (req.body && req.body.metadata) {
        try { metadata = JSON.parse(req.body.metadata); } catch (_) {}
      }
      const snapshot = { buffer: req.file.buffer, mimetype: req.file.mimetype, originalname: req.file.originalname, metadata };
      setImmediate(() => { processJob(job.id, snapshot); });
      return res.status(202).json({ jobId: job.id });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao iniciar análise.' });
    }
  });

  // GET /api/ia/status/:jobId
  app.get('/api/ia/status/:jobId', ensureAuth, (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job não encontrado' });
    const { id, state, step, message, progress, textPreview, result, error } = job;
    return res.json({ id, state, step, message, progress, textPreview, result, error });
  });
};
