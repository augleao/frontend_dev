// Backend routes example for IA (Google Gemini 1.5 Flash) and PDF analysis
// Usage in your backend project (server.js):
//   const initIARoutes = require('./routes/ia');
//   initIARoutes(app, pool, { ensureAuth });

const multer = require('multer');

// Resolve IA model name to a supported variant. Auto-upgrade known names to "-latest".
function resolveIaModel(name) {
  if (!name) return 'gemini-1.5-flash-latest';
  if (/\-latest$/.test(name)) return name;
  if (name === 'gemini-1.5-flash') return 'gemini-1.5-flash-latest';
  if (name === 'gemini-1.5-pro') return 'gemini-1.5-pro-latest';
  return name; // leave others as-is
}

// memory storage is enough, we forward the PDF buffer to the parser/provider
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

module.exports = function initIARoutes(app, pool, middlewares = {}) {
  const jobs = new Map(); // in-memory job store { id: { state, step, message, progress, textPreview, result, error } }

  // Resolve IA model name to a supported variant. Auto-upgrade known names to "-latest".
  function resolveIaModel(name) {
    if (!name) return 'gemini-1.5-flash-latest';
    if (/\-latest$/.test(name)) return name;
    if (name === 'gemini-1.5-flash') return 'gemini-1.5-flash-latest';
    if (name === 'gemini-1.5-pro') return 'gemini-1.5-pro-latest';
    return name; // leave others as-is
  }

  // Healthcheck (optional)
  app.get('/api/ia/health', (req, res) => {
    const raw = process.env.IA_MODEL || 'gemini-1.5-flash-latest';
    const resolved = resolveIaModel(raw);
    res.json({ ok: true, provider: resolved, stub: process.env.IA_STUB === 'true' });
  });

  // POST /api/ia/analise-mandado
  app.post('/api/ia/analise-mandado', upload.single('file'), async (req, res) => {
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
        // Usa Uint8Array para compatibilidade com pdf.js interno do pdf-parse
        const bin = new Uint8Array(req.file.buffer);
        const parsed = await pdfParse(bin);
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
        const rawName = process.env.IA_MODEL || 'gemini-1.5-flash-latest';
        const modelName = resolveIaModel(rawName);
        if (rawName !== modelName) {
          console.log(`[IA][analise-mandado] model resolved from '${rawName}' to '${modelName}'`);
        }
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

  // New structured flow endpoints
  // 1) Extrair texto do PDF e devolver ao frontend
  app.post('/api/ia/extrair-texto', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo PDF (file) é obrigatório.' });
      const type = (req.file.mimetype || '').toLowerCase();
      const isPdf = type.includes('pdf') || req.file.originalname.toLowerCase().endsWith('.pdf');
      if (!isPdf) return res.status(400).json({ error: 'O arquivo deve ser um PDF.' });
      if (typeof req.file.size === 'number' && req.file.size === 0) {
        return res.status(400).json({ error: 'Arquivo vazio.' });
      }

      let text = '';
      // 1) Tenta com pdf-parse (se instalado)
      let pdfParse;
      try { pdfParse = require('pdf-parse'); } catch (requireErr) { pdfParse = null; }
      if (pdfParse) {
        try {
          // Garante Uint8Array para evitar erro "Invalid parameter in getDocument"
          const bin = new Uint8Array(req.file.buffer);
          const parsed = await pdfParse(bin);
          text = parsed.text || '';
        } catch (e) {
          // segue para fallback
          console.error('pdf-parse falhou ao extrair texto:', e && e.message ? e.message : e);
        }
      }

      // 2) Fallback opcional com pdfjs-dist caso text ainda esteja vazio
      if (!text || text.trim().length < 5) {
        let pdfjsLib = null;
        try {
          pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
        } catch (fallbackImportErr) {
          // Fallback indisponível; não trate como erro de dependência, apenas siga para a resposta padrão
          console.warn('pdfjs-dist não disponível para fallback de extração. Prosseguindo sem fallback.');
        }
        if (pdfjsLib) {
          try {
            const data = new Uint8Array(req.file.buffer);
            const task = pdfjsLib.getDocument({ data, isEvalSupported: false });
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
              return res.json({ text: '', warning: 'Stub ativo: não foi possível extrair texto; retornando vazio.' });
            }
            console.error('pdfjs-dist falhou ao extrair texto:', fallbackErr && fallbackErr.message ? fallbackErr.message : fallbackErr);
            // segue para verificação final e 422 padrão
          }
        }
      }

      if (!text || text.trim().length < 5) {
        if (process.env.IA_STUB === 'true') return res.json({ text: '' });
        return res.status(422).json({ error: 'PDF sem texto extraível (provavelmente escaneado ou protegido).' });
      }
      return res.json({ text });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao extrair texto.' });
    }
  });

  // 2) Identificar tipo do mandado a partir do texto
  app.post('/api/ia/identificar-tipo', async (req, res) => {
    try {
      const startedAt = Date.now();
      const rid = `IA-IDT-${Date.now()}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
      const { text } = req.body || {};
      const inLen = typeof text === 'string' ? text.length : 0;
      const inNonWS = typeof text === 'string' ? (text.replace(/\s+/g, '').length) : 0;
      console.log(`[IA][identificar-tipo][${rid}] start len=${inLen} nonWS=${inNonWS}`);
      if (!text || typeof text !== 'string' || text.trim().length < 5) {
        console.warn(`[IA][identificar-tipo][${rid}] input inválido: texto curto ou ausente`);
        return res.status(400).json({ error: 'Campo text é obrigatório.' });
      }

      // Stub simples com heurística
      if (process.env.IA_STUB === 'true') {
        console.log(`[IA][identificar-tipo][${rid}] IA_STUB=true → usando heurística`);
        const t = text.toLowerCase();
        let tipo = 'mandado_generico';
        if (t.includes('penhora')) tipo = 'mandado_penhora';
        else if (t.includes('alimentos') || t.includes('pensão')) tipo = 'mandado_alimentos';
        else if (t.includes('prisão civil')) tipo = 'mandado_prisao_civil';
        console.log(`[IA][identificar-tipo][${rid}] heuristic tipo=${tipo} confidence=0.8 ms=${Date.now() - startedAt}`);
        return res.json({ tipo, confidence: 0.8 });
      }

      // Gemini identifica o tipo e devolve JSON { tipo, confidence }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error(`[IA][identificar-tipo][${rid}] GEMINI_API_KEY ausente`);
        return res.status(501).json({ error: 'GEMINI_API_KEY não configurado.' });
      }
      const rawModel = process.env.IA_MODEL || 'gemini-1.5-flash-latest';
      const modelName = resolveIaModel(rawModel);
      if (rawModel !== modelName) {
        console.log(`[IA][identificar-tipo][${rid}] model resolved from '${rawModel}' to '${modelName}'`);
      }
      console.log(`[IA][identificar-tipo][${rid}] provider=gemini model=${modelName} key.len=${String(apiKey).length}`);
      // Import do provedor com erro claro se pacote faltar
      let GoogleGenerativeAI;
      try {
        ({ GoogleGenerativeAI } = await import('@google/generative-ai'));
      } catch (impErr) {
        console.error('[IA][identificar-tipo] Falha ao importar provedor @google/generative-ai:', impErr && impErr.message ? impErr.message : impErr);
        return res.status(501).json({ error: "Pacote '@google/generative-ai' não instalado ou indisponível.", hint: "Instale com 'npm i @google/generative-ai' ou ative IA_STUB=true para heurística." });
      }
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = `Classifique o tipo do mandado judicial a partir do texto abaixo. Responda APENAS um JSON com as chaves tipo (string curta, ex.: mandado_penhora) e confidence (0..1). Texto:\n${text.slice(0, 8000)}`;
        console.log(`[IA][identificar-tipo][${rid}] calling provider prompt.len=${prompt.length}`);
        const resp = await model.generateContent(prompt);
        const out = (resp && resp.response && resp.response.text && resp.response.text()) || '';
        console.log(`[IA][identificar-tipo][${rid}] provider ok out.len=${out.length}`);
        let tipo = 'mandado_generico', confidence = 0.5;
        try {
          const parsed = JSON.parse(out);
          tipo = parsed.tipo || tipo;
          confidence = Number(parsed.confidence) || confidence;
          console.log(`[IA][identificar-tipo][${rid}] parsed tipo=${tipo} confidence=${confidence} ms=${Date.now() - startedAt}`);
        } catch (parseErr) {
          console.warn(`[IA][identificar-tipo][${rid}] parse JSON falhou:`, parseErr && parseErr.message ? parseErr.message : parseErr);
          console.warn(`[IA][identificar-tipo][${rid}] out preview:`, out.slice(0, 160));
        }
        return res.json({ tipo, confidence });
      } catch (provErr) {
        console.error('[IA][identificar-tipo] Falha ao chamar provedor de IA:', provErr && provErr.message ? provErr.message : provErr);
        // Fallback heurístico para não bloquear o fluxo
        const t = text.toLowerCase();
        let tipo = 'mandado_generico';
        if (t.includes('penhora')) tipo = 'mandado_penhora';
        else if (t.includes('alimentos') || t.includes('pensão')) tipo = 'mandado_alimentos';
        else if (t.includes('prisão civil')) tipo = 'mandado_prisao_civil';
        console.log(`[IA][identificar-tipo][${rid}] fallback heuristic tipo=${tipo} confidence=0.4 ms=${Date.now() - startedAt}`);
        return res.json({ tipo, confidence: 0.4, warning: 'Provedor de IA indisponível, resultado heurístico.' });
      }
    } catch (err) {
      console.error('[IA][identificar-tipo] erro inesperado:', err && err.message ? err.message : err);
      return res.status(500).json({ error: 'Erro ao identificar tipo.' });
    }
  });

  // 3) Analisar exigência legal aplicável com base no texto e legislação correlata
  app.post('/api/ia/analisar-exigencia', async (req, res) => {
    try {
      const { text, legislacao = [], tipo } = req.body || {};
      if (!text || !Array.isArray(legislacao)) {
        return res.status(400).json({ error: 'Campos text e legislacao[] são obrigatórios.' });
      }

      // Monta contexto legal
      const contextoLegal = (legislacao || []).map((t) => `• ${t.base_legal || ''}${t.artigo ? ' - ' + t.artigo : ''}: ${t.texto || ''}`).join('\n');

      if (process.env.IA_STUB === 'true') {
        const checklist = [
          { requisito: 'Coerência do tipo de mandado', ok: !!tipo },
          { requisito: 'Legislação correlata fornecida', ok: (legislacao || []).length > 0 }
        ];
        return res.json({
          aprovado: checklist.every(c => c.ok),
          motivos: checklist.filter(c => !c.ok).map(c => `Requisito não atendido: ${c.requisito}`),
          checklist,
          orientacao: 'Verifique a legislação correlata e preencha o texto de averbação conforme exigências.'
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(501).json({ error: 'GEMINI_API_KEY não configurado.' });
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const rawName = process.env.IA_MODEL || 'gemini-1.5-flash-latest';
        const modelName = resolveIaModel(rawName);
        if (rawName !== modelName) {
          console.log(`[IA][analisar-exigencia] model resolved from '${rawName}' to '${modelName}'`);
        }
        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = `Com base no texto do mandado e nos trechos legais, liste as exigências legais aplicáveis (checklist) e indique se está aprovado. Responda JSON: { aprovado: boolean, motivos: string[], checklist: [{ requisito, ok }], orientacao: string }.\nTipo (se houver): ${tipo || 'n/d'}\nTexto do mandado:\n${text.slice(0, 8000)}\n\nLegislação correlata:\n${contextoLegal}`;
        const resp = await model.generateContent(prompt);
        const out = (resp && resp.response && resp.response.text && resp.response.text()) || '';
        try {
          const data = JSON.parse(out);
          return res.json({
            aprovado: !!data.aprovado,
            motivos: Array.isArray(data.motivos) ? data.motivos : [],
            checklist: Array.isArray(data.checklist) ? data.checklist : [],
            orientacao: typeof data.orientacao === 'string' ? data.orientacao : ''
          });
        } catch (_) {
          return res.status(502).json({ error: 'Resposta do provedor fora do formato esperado.' });
        }
      } catch (e) {
        return res.status(502).json({ error: 'Falha ao chamar provedor de IA.' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao analisar exigência.' });
    }
  });

  // 4) Gerar texto da averbação com base no mandado e na legislação aplicável
  app.post('/api/ia/gerar-texto-averbacao', async (req, res) => {
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
  const rawName = process.env.IA_MODEL || 'gemini-1.5-flash-latest';
  const modelName = resolveIaModel(rawName);
  if (rawName !== modelName) {
    console.log(`[IA][gerar-texto-averbacao] model resolved from '${rawName}' to '${modelName}'`);
  }
  const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = `Elabore o texto objetivo da averbação a partir do mandado judicial abaixo, observando as exigências legais pertinentes. O texto deve ser curto, impessoal e adequado para lançamento no livro. Retorne apenas o texto, sem comentários.
Tipo (se houver): ${tipo || 'n/d'}
Mandado (texto):\n${text.slice(0, 8000)}\n\nLegislação aplicável (trechos):\n${contextoLegal}`;
        const resp = await model.generateContent(prompt);
        const out = (resp && resp.response && resp.response.text && resp.response.text()) || '';
        // Sanitiza saída (remove possíveis marcas)
        const texto = String(out).trim().replace(/^"|"$/g, '');
        return res.json({ textoAverbacao: texto || 'Averba-se, por mandado judicial...' });
      } catch (e) {
        return res.status(502).json({ error: 'Falha ao chamar provedor de IA.' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao gerar texto da averbação.' });
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
      const bin = new Uint8Array(buffer);
      const parsed = await pdfParse(bin);
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
        const rawName = process.env.IA_MODEL || 'gemini-1.5-flash-latest';
        const modelName = resolveIaModel(rawName);
        if (rawName !== modelName) {
          console.log(`[IA][analise-mandado-async] model resolved from '${rawName}' to '${modelName}'`);
        }
        const model = genAI.getGenerativeModel({ model: modelName });
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
  app.post('/api/ia/analise-mandado-async', upload.single('file'), async (req, res) => {
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
  app.get('/api/ia/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job não encontrado' });
    const { id, state, step, message, progress, textPreview, result, error } = job;
    return res.json({ id, state, step, message, progress, textPreview, result, error });
  });
};
