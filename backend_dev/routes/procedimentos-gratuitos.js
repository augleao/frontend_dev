const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { authenticate } = require('../middlewares/auth');
const { uploadPdfToSharepoint } = require('../services/graphSharepointClient');

// Upload config: in-memory PDF only
const uploadProcedimento = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf';
    if (!isPdf) return cb(new Error('Apenas PDF é permitido.'), false);
    cb(null, true);
  },
});

const uploadAnexo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf' && path.extname(file.originalname).toLowerCase() !== '.pdf') {
      return cb(new Error('Apenas PDF é permitido.'), false);
    }
    cb(null, true);
  },
});

function ensureDirSyncProcedimento(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const PT_MONTHS = [
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

async function nextMonthlySeq(pool, anoMes, tipo) {
  const primaryTable = 'public.procedimentos_upload_seq';
  const backupTable = 'public.procedimentos_upload_seq_by_tipo';

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${primaryTable} (
        ano_mes VARCHAR(7) NOT NULL,
        tipo VARCHAR(50) NOT NULL,
        seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (ano_mes, tipo)
      )
    `);

    const upsert = await pool.query(
      `
      INSERT INTO ${primaryTable} (ano_mes, tipo, seq)
      VALUES ($1, $2, 1)
      ON CONFLICT (ano_mes, tipo)
      DO UPDATE SET seq = ${primaryTable}.seq + 1
      RETURNING seq
      `,
      [anoMes, tipo || '']
    );

    return upsert.rows[0].seq;
  } catch (err) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${backupTable} (
          ano_mes VARCHAR(7) NOT NULL,
          tipo VARCHAR(50) NOT NULL,
          seq INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (ano_mes, tipo)
        )
      `);

      const upsert2 = await pool.query(
        `
        INSERT INTO ${backupTable} (ano_mes, tipo, seq)
        VALUES ($1, $2, 1)
        ON CONFLICT (ano_mes, tipo)
        DO UPDATE SET seq = ${backupTable}.seq + 1
        RETURNING seq
        `,
        [anoMes, tipo || '']
      );

      return upsert2.rows[0].seq;
    } catch (err2) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.procedimentos_upload_seq (
          ano_mes VARCHAR(7) PRIMARY KEY,
          seq INTEGER NOT NULL DEFAULT 0
        )
      `);

      const upsertLegacy = await pool.query(
        `
        INSERT INTO public.procedimentos_upload_seq (ano_mes, seq)
        VALUES ($1, 1)
        ON CONFLICT (ano_mes)
        DO UPDATE SET seq = public.procedimentos_upload_seq.seq + 1
        RETURNING seq
        `,
        [anoMes]
      );

      return upsertLegacy.rows[0].seq;
    }
  }
}

function parseBooleanQuery(value) {
  if (value === undefined || value === null || value === '') return null;
  const v = String(value).trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null; // 'todos' ou outro -> sem filtro
}

function normalizeBodyBoolean(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return Boolean(value);
}

function formatProcedimentoRow(row) {
  if (!row) return row;
  return {
    ...row,
    criado_em: row.criado_em ?? row.created_at ?? null,
    atualizado_em: row.atualizado_em ?? row.updated_at ?? null,
    anexoUrl: row.anexo_url ?? null,
  };
}

function isValidDateISO(s) {
  if (!s) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function registerProcedimentosGratuitosRoutes(app) {
  // GET /api/procedimentos-gratuitos
  app.get('/api/procedimentos-gratuitos', async (req, res) => {
    try {
      const { dataInicial, dataFinal, ressarcivel, tipo } = req.query;
      const conds = [];
      const params = [];

      if (isValidDateISO(dataInicial)) { params.push(dataInicial); conds.push(`data >= $${params.length}`); }
      if (isValidDateISO(dataFinal))   { params.push(dataFinal);   conds.push(`data <= $${params.length}`); }

      const ressa = parseBooleanQuery(ressarcivel);
      if (ressa !== null) { params.push(ressa); conds.push(`ressarcivel = $${params.length}`); }

      if (tipo && String(tipo).trim() !== '') {
        params.push(`%${String(tipo).trim()}%`);
        conds.push(`tipo ILIKE $${params.length}`);
      }

      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const sql = `
        SELECT *
        FROM public.procedimentos_gratuitos
        ${where}
        ORDER BY data DESC, id DESC
      `;
      const result = await pool.query(sql, params);
      const rows = result.rows.map(formatProcedimentoRow);
      return res.json(rows);
    } catch (err) {
      try { console.error('Erro ao listar procedimentos gratuitos:', err); } catch(_){ }
      return res.status(500).json({ error: 'Erro interno ao listar procedimentos gratuitos.' });
    }
  });

  // POST /api/procedimentos-gratuitos
  app.post('/api/procedimentos-gratuitos', async (req, res) => {
    try {
      let {
        data,
        tipo,
        tipo_outro,
        descricao,
        ressarcivel,
        observacoes,
        livro,
        folha,
        termo,
        nomes,
        nome1,
        nome2,
        codigo_tributario,
        pdf_filename,
        pdf_url,
      } = req.body || {};
      if (!isValidDateISO(data)) { return res.status(400).json({ error: 'Campo data é obrigatório (YYYY-MM-DD).' }); }
      if (!tipo || String(tipo).trim() === '') { return res.status(400).json({ error: 'Campo tipo é obrigatório.' }); }

      tipo = String(tipo).trim();
      tipo_outro = tipo_outro ? String(tipo_outro) : null;
      descricao = descricao ? String(descricao) : null;
      observacoes = observacoes ? String(observacoes) : null;
      livro = livro ? String(livro) : null;
      folha = folha ? String(folha) : null;
      termo = termo ? String(termo) : null;
      nomes = nomes ? String(nomes) : null;
      nome1 = nome1 ? String(nome1) : null;
      nome2 = nome2 ? String(nome2) : null;
      codigo_tributario = codigo_tributario ? String(codigo_tributario) : null;
      pdf_filename = pdf_filename ? String(pdf_filename) : null;
      pdf_url = pdf_url ? String(pdf_url) : null;

      if (!nomes) {
        const joined = [nome1, nome2].filter(Boolean).join(' / ');
        nomes = joined || null;
      }

      const normalizedRessarcivel = normalizeBodyBoolean(ressarcivel);

      const insertSQL = `
        INSERT INTO public.procedimentos_gratuitos
        (data, tipo, tipo_outro, descricao, ressarcivel, observacoes, livro, folha, termo, nomes, nome1, nome2, codigo_tributario, pdf_filename, pdf_url, created_at, updated_at)
        VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        RETURNING *;
      `;
      const params = [
        data,
        tipo,
        tipo_outro,
        descricao,
        normalizedRessarcivel,
        observacoes,
        livro,
        folha,
        termo,
        nomes,
        nome1,
        nome2,
        codigo_tributario,
        pdf_filename,
        pdf_url,
        new Date().toISOString(),
      ];
      const result = await pool.query(insertSQL, params);
      return res.status(201).json(formatProcedimentoRow(result.rows[0]));
    } catch (err) {
      try { console.error('Erro ao criar procedimento gratuito:', err); } catch(_){ }
      return res.status(500).json({ error: 'Erro interno ao criar procedimento gratuito.' });
    }
  });

  // GET /api/procedimentos-gratuitos/:id
  app.get('/api/procedimentos-gratuitos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
      const result = await pool.query('SELECT * FROM public.procedimentos_gratuitos WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Procedimento gratuito não encontrado.' });
      return res.json(formatProcedimentoRow(result.rows[0]));
    } catch (err) {
      try { console.error('Erro ao buscar procedimento gratuito por id:', err); } catch(_){ }
      return res.status(500).json({ error: 'Erro interno ao buscar procedimento gratuito.' });
    }
  });

  // PUT /api/procedimentos-gratuitos/:id
  app.put('/api/procedimentos-gratuitos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

      let {
        data,
        tipo,
        tipo_outro,
        descricao,
        ressarcivel,
        observacoes,
        livro,
        folha,
        termo,
        nomes,
        nome1,
        nome2,
        codigo_tributario,
        pdf_filename,
        pdf_url,
      } = req.body || {};
      if (!isValidDateISO(data)) return res.status(400).json({ error: 'Campo data é obrigatório (YYYY-MM-DD).' });
      if (!tipo || String(tipo).trim() === '') return res.status(400).json({ error: 'Campo tipo é obrigatório.' });

      tipo = String(tipo).trim();
      tipo_outro = tipo_outro ? String(tipo_outro) : null;
      descricao = descricao ? String(descricao) : null;
      observacoes = observacoes ? String(observacoes) : null;
      livro = livro ? String(livro) : null;
      folha = folha ? String(folha) : null;
      termo = termo ? String(termo) : null;
      nomes = nomes ? String(nomes) : null;
      nome1 = nome1 ? String(nome1) : null;
      nome2 = nome2 ? String(nome2) : null;
      codigo_tributario = codigo_tributario ? String(codigo_tributario) : null;
      pdf_filename = pdf_filename ? String(pdf_filename) : null;
      pdf_url = pdf_url ? String(pdf_url) : null;

      if (!nomes) {
        const joined = [nome1, nome2].filter(Boolean).join(' / ');
        nomes = joined || null;
      }

      const normalizedRessarcivel = normalizeBodyBoolean(ressarcivel);

      const updateSQL = `
        UPDATE public.procedimentos_gratuitos
           SET data = $1,
               tipo = $2,
               tipo_outro = $3,
               descricao = $4,
               ressarcivel = $5,
               observacoes = $6,
               livro = $7,
               folha = $8,
               termo = $9,
               nomes = $10,
               nome1 = $11,
               nome2 = $12,
               codigo_tributario = $13,
               pdf_filename = $14,
               pdf_url = $15,
               updated_at = NOW()
         WHERE id = $16
         RETURNING *;
      `;

      const params = [
        data,
        tipo,
        tipo_outro,
        descricao,
        normalizedRessarcivel,
        observacoes,
        livro,
        folha,
        termo,
        nomes,
        nome1,
        nome2,
        codigo_tributario,
        pdf_filename,
        pdf_url,
        id,
      ];
      const result = await pool.query(updateSQL, params);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Procedimento gratuito não encontrado.' });
      return res.json(formatProcedimentoRow(result.rows[0]));
    } catch (err) {
      try { console.error('Erro ao atualizar procedimento gratuito:', err); } catch(_){ }
      return res.status(500).json({ error: 'Erro interno ao atualizar procedimento gratuito.' });
    }
  });

  // DELETE /api/procedimentos-gratuitos/:id
  app.delete('/api/procedimentos-gratuitos/:id', async (req, res) => {
    const client = await pool.connect();
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) { client.release(); return res.status(400).json({ error: 'ID inválido.' }); }

      await client.query('BEGIN');

      const del = await client.query('DELETE FROM public.procedimentos_gratuitos WHERE id = $1 RETURNING id', [id]);
      if (del.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return res.status(404).json({ error: 'Procedimento gratuito não encontrado.' }); }

      await client.query('COMMIT');
      client.release();
      return res.status(204).send();
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      try { console.error('Erro ao excluir procedimento gratuito:', err); } catch(_){ }
      return res.status(500).json({ error: 'Erro interno ao excluir procedimento gratuito.' });
    }
  });

  app.post('/api/procedimentos-gratuitos/:id/anexo', authenticate, uploadAnexo.single('file'), async (req, res) => {
    const startedAt = Date.now();
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Arquivo (file) é obrigatório.' });
      }

      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: 'Apenas PDF é permitido.' });
      }

      const filename = req.file.originalname || `procedimento-${id}.pdf`;
      const folderPath = `Procedimentos/${id}`;

      const uploadResult = await uploadPdfToSharepoint(req.file.buffer, filename, folderPath);
      const metadata = uploadResult.response || {
        id: uploadResult.id,
        name: uploadResult.name,
        webUrl: uploadResult.webUrl,
        size: uploadResult.size,
      };

      const update = await pool.query(
        `
          UPDATE public.procedimentos_gratuitos
             SET anexo_url = $1,
                 anexo_metadata = $2,
                 updated_at = NOW()
           WHERE id = $3
           RETURNING id
        `,
        [uploadResult.webUrl, metadata, id]
      );

      if (update.rows.length === 0) {
        return res.status(404).json({ error: 'Procedimento gratuito não encontrado.' });
      }

      const elapsed = Date.now() - startedAt;
      try { console.log(`procedimentos-gratuitos ${id}: upload concluído em ${elapsed}ms`); } catch (_) {}
      return res.json({ url: uploadResult.webUrl });
    } catch (err) {
      const message = err && err.message ? err.message : 'Erro interno ao enviar anexo.';
      try { console.error('Erro ao enviar anexo de procedimento gratuito:', err); } catch (_) {}
      if (/Apenas PDF/.test(message)) {
        return res.status(400).json({ error: 'Apenas PDF é permitido.' });
      }
      return res.status(500).json({ error: message });
    }
  });

  // POST /api/procedimentos-gratuitos/upload-pdf
  app.post('/api/procedimentos-gratuitos/upload-pdf', uploadProcedimento.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo (file) é obrigatório.' });

      const dataStr = (req.body && String(req.body.data || '').trim()) || '';
      let baseDate = new Date();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
        const [y, m, d] = dataStr.split('-').map((v) => parseInt(v, 10));
        const tmp = new Date(Date.UTC(y, m - 1, d));
        if (!Number.isNaN(tmp.getTime())) baseDate = tmp;
      }

      const ano = baseDate.getUTCFullYear();
      const mesIdx = baseDate.getUTCMonth();
      const mesNome = PT_MONTHS[mesIdx];
      const anoMes = `${ano}-${String(mesIdx + 1).padStart(2, '0')}`;

      // derive tipo prefix from payload (tipo, tipo_outro or tipoAto)
      const tipoRaw = (req.body && (req.body.tipo || req.body.tipo_outro || req.body.tipoAto || '')) ? String(req.body.tipo || req.body.tipo_outro || req.body.tipoAto || '') : '';
      let tipoPrefix = 'PROCEDIMENTO';
      if (tipoRaw && String(tipoRaw).trim() !== '') {
        const cleaned = String(tipoRaw).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleaned) tipoPrefix = cleaned;
      }
      const seq = await nextMonthlySeq(pool, anoMes, tipoPrefix);
      const seqStr = String(seq).padStart(3, '0');
      const filename = `${tipoPrefix}-${seqStr}-${mesNome}.PDF`;

      const rootUploads = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(__dirname, '..', 'uploads');
      const destDir = path.join(rootUploads, 'procedimentos', anoMes);
      ensureDirSyncProcedimento(destDir);
      const absPath = path.join(destDir, filename);
      fs.writeFileSync(absPath, req.file.buffer);

      const publicBase = '/uploads';
      const url = `${publicBase}/procedimentos/${anoMes}/${filename}`;

      return res.status(201).json({ filename, url, anoMes, seq });
    } catch (err) {
      try { console.error('Erro no upload de PDF de procedimento:', err); } catch(_){ }
      if (String(err.message || '').includes('Apenas PDF')) { return res.status(400).json({ error: 'Apenas PDF é permitido.' }); }
      return res.status(500).json({ error: 'Erro interno ao processar upload de PDF.' });
    }
  });
}

module.exports = { registerProcedimentosGratuitosRoutes };
