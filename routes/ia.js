// Backend routes example for IA (Google Gemini 1.5 Flash) and PDF analysis
// Usage in your backend project (server.js):
//   const initIARoutes = require('./routes/ia');
//   initIARoutes(app, pool, { ensureAuth });

const multer = require('multer');

// memory storage is enough, we forward the PDF buffer to the parser/provider
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

module.exports = function initIARoutes(app, pool, middlewares = {}) {
  const ensureAuth = middlewares.ensureAuth || ((req, res, next) => next());

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
        return res.status(400).json({ error: 'Falha ao extrair texto do PDF.' });
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
};
