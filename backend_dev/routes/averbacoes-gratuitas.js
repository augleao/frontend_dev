const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { authenticate } = require('../middlewares/auth');
const { uploadPdfToSharepoint } = require('../services/graphSharepointClient');

// Upload config: in-memory PDF only
const uploadAverbacao = multer({
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

function ensureDirSyncAverbacao(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const PT_MONTHS = [
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

async function nextMonthlySeq(pool, anoMes, tipo) {
  const primaryTable = 'public.averbacoes_upload_seq';
  const backupTable = 'public.averbacoes_upload_seq_by_tipo';

  // Primeiro tenta criar/usar a tabela primária com chave composta (ano_mes, tipo)
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
    // Se falhar (ex: tabela existe com esquema antigo), cria/usa tabela alternativa
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
      // Última tentativa: fallback para tabela antiga por ano_mes apenas
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.averbacoes_upload_seq (
          ano_mes VARCHAR(7) PRIMARY KEY,
          seq INTEGER NOT NULL DEFAULT 0
        )
      `);

      const upsertLegacy = await pool.query(
        `
        INSERT INTO public.averbacoes_upload_seq (ano_mes, seq)
        VALUES ($1, 1)
        ON CONFLICT (ano_mes)
        DO UPDATE SET seq = public.averbacoes_upload_seq.seq + 1
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

function formatAverbacaoRow(row) {
  if (!row) return null;
  // normalize tipo_outro and expose aliases for frontend convenience
  const tipoOutroVal = row.tipo_outro || row.tipoOutro || row.tipoAto || null;

  return {
    id: row.id,
    data: row.data,
    tipo: row.tipo,
    // keep canonical DB column, plus camelCase and explicit alias
    tipo_outro: tipoOutroVal,
    tipoOutro: tipoOutroVal,
    tipoAto: tipoOutroVal,
    descricao: row.descricao,
    ressarcivel: row.ressarcivel,
    observacoes: row.observacoes,
    livro: row.livro,
    folha: row.folha,
    termo: row.termo,
    nomes: row.nomes,
    nome1: row.nome1,
    nome2: row.nome2,
    codigo_tributario: row.codigo_tributario,
    pdf_filename: row.pdf_filename,
    pdf_url: row.pdf_url,
    // ensure the canonical execucao id is returned in two common shapes
    execucao_id: row.execucao_id || null,
    execucaoId: row.execucao_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function isValidDateISO(s) {
  if (!s) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

async function resolveExecucaoServico(execParam) {
  if (!execParam) return null;
  try {
    if (/^[0-9]+$/.test(String(execParam))) {
      const r = await pool.query('SELECT * FROM execucao_servico WHERE id = $1', [parseInt(execParam, 10)]);
      return r.rows[0] || null;
    } else {
      // try exact match on execucao_id column (string like 'AV4')
      const r = await pool.query('SELECT * FROM execucao_servico WHERE execucao_id = $1', [String(execParam)]);
      return r.rows[0] || null;
    }
  } catch (err) {
    console.error('Erro ao resolver execucao_servico:', err);
    throw err;
  }
}

function registerAverbacoesGratuitasRoutes(app) {
  // GET /api/averbacoes-gratuitas
  app.get('/api/averbacoes-gratuitas', async (req, res) => {
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
        FROM public.averbacoes_gratuitas
        ${where}
        ORDER BY data DESC, id DESC
      `;
      const result = await pool.query(sql, params);
      // Busca anexos na tabela uploads para cada averbação
      const rows = await Promise.all(result.rows.map(async row => {
        const base = formatAverbacaoRow(row);
        let pdf_filename = base.pdf_filename;
        let pdf_url = base.pdf_url;
        // Busca na tabela uploads
        try {
          const q = 'SELECT stored_name, key FROM uploads WHERE averbacao_id = $1 ORDER BY id DESC LIMIT 1';
          const r = await pool.query(q, [row.id]);
          if (r && r.rowCount > 0) {
            pdf_filename = r.rows[0].stored_name || pdf_filename;
            pdf_url = r.rows[0].key || pdf_url;
          }
        } catch (err) {
          console.warn('[averbacoes-gratuitas] Falha ao buscar anexo em uploads para id', row.id, err && err.message);
        }
        return {
          ...base,
          pdf_filename,
          pdf_url,
          anexo_url: row.anexo_url || null,
          anexo_metadata: row.anexo_metadata || null
        };
      }));
      return res.json(rows);
    } catch (err) {
      try { console.error('Erro ao listar averbações gratuitas:', err); } catch(_){}
      return res.status(500).json({ error: 'Erro interno ao listar averbações gratuitas.' });
    }
  });

  // POST /api/averbacoes-gratuitas
app.post('/api/averbacoes-gratuitas', async (req, res) => {
  try {
    let {
      data,
      tipo,
      tipo_outro,
      tipoAto,
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

    // Require 'tipo' only when tipoAto indicates an averbação
    if (String(tipoAto || '').trim() === 'Averbação') {
      if (!tipo || String(tipo).trim() === '') { return res.status(400).json({ error: 'Campo tipo é obrigatório para Averbação.' }); }
    }

    tipo = tipo ? String(tipo).trim() : null;
    // prefer explicit tipo_outro from body, otherwise use tipoAto (the new field)
    tipo_outro = tipo_outro ? String(tipo_outro) : (tipoAto ? String(tipoAto) : null);

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
      INSERT INTO public.averbacoes_gratuitas
      (data, tipo, tipo_outro, descricao, ressarcivel, observacoes, livro, folha, termo, nomes, nome1, nome2, codigo_tributario, pdf_filename, pdf_url, created_at, updated_at)
      VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
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
    ];
    const result = await pool.query(insertSQL, params);
    return res.status(201).json(formatAverbacaoRow(result.rows[0]));
  } catch (err) {
    try { console.error('Erro ao criar averbação gratuita:', err); } catch(_){}
    return res.status(500).json({ error: 'Erro interno ao criar averbação gratuita.' });
  }
});

  // GET /api/averbacoes-gratuitas/:id
app.get('/api/averbacoes-gratuitas/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
    const result = await pool.query('SELECT * FROM public.averbacoes_gratuitas WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Averbação gratuita não encontrada.' });
    return res.json(formatAverbacaoRow(result.rows[0]));
  } catch (err) {
    try { console.error('Erro ao buscar averbação gratuita por id:', err); } catch(_){}
    return res.status(500).json({ error: 'Erro interno ao buscar averbação gratuita.' });
  }
});

  // PUT /api/averbacoes-gratuitas/:id
app.put('/api/averbacoes-gratuitas/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    let {
      data,
      tipo,
      tipo_outro,
      tipoAto,
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

    // Require 'tipo' only when tipoAto indicates an averbação
    if (String(tipoAto || '').trim() === 'Averbação') {
      if (!tipo || String(tipo).trim() === '') { return res.status(400).json({ error: 'Campo tipo é obrigatório para Averbação.' }); }
    }

    tipo = tipo ? String(tipo).trim() : null;
    // prefer explicit tipo_outro from body, otherwise use tipoAto (the new field)
    tipo_outro = tipo_outro ? String(tipo_outro) : (tipoAto ? String(tipoAto) : null);

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
      UPDATE public.averbacoes_gratuitas
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
    if (result.rows.length === 0) return res.status(404).json({ error: 'Averbação gratuita não encontrada.' });
    return res.json(formatAverbacaoRow(result.rows[0]));
  } catch (err) {
    try { console.error('Erro ao atualizar averbação gratuita:', err); } catch(_){}
    return res.status(500).json({ error: 'Erro interno ao atualizar averbação gratuita.' });
  }
});

  // DELETE /api/averbacoes-gratuitas/:id
  app.delete('/api/averbacoes-gratuitas/:id', async (req, res) => {
    const client = await pool.connect();
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) { client.release(); return res.status(400).json({ error: 'ID inválido.' }); }

      await client.query('BEGIN');

      const del = await client.query('DELETE FROM public.averbacoes_gratuitas WHERE id = $1 RETURNING id', [id]);
      if (del.rows.length === 0) { await client.query('ROLLBACK'); client.release(); return res.status(404).json({ error: 'Averbação gratuita não encontrada.' }); }

      await client.query('COMMIT');
      client.release();
      return res.status(204).send();
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      try { console.error('Erro ao excluir averbação gratuita:', err); } catch(_){}
      return res.status(500).json({ error: 'Erro interno ao excluir averbação gratuita.' });
    }
  });

  app.post('/api/averbacoes-gratuitas/:id/anexo', authenticate, uploadAnexo.single('file'), async (req, res) => {
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

      const filename = req.file.originalname || `averbacao-${id}.pdf`;
      const folderPath = `Averbacoes/${id}`;

      const uploadResult = await uploadPdfToSharepoint(req.file.buffer, filename, folderPath);
      const metadata = uploadResult.response || {
        id: uploadResult.id,
        name: uploadResult.name,
        webUrl: uploadResult.webUrl,
        size: uploadResult.size,
      };

      const update = await pool.query(
        `
          UPDATE public.averbacoes_gratuitas
             SET anexo_url = $1,
                 anexo_metadata = $2,
                 updated_at = NOW()
           WHERE id = $3
           RETURNING id
        `,
        [uploadResult.webUrl, metadata, id]
      );

      if (update.rows.length === 0) {
        return res.status(404).json({ error: 'Averbação gratuita não encontrada.' });
      }

      const elapsed = Date.now() - startedAt;
      try { console.log(`averbacoes-gratuitas ${id}: upload concluído em ${elapsed}ms`); } catch (_) {}
      return res.json({ url: uploadResult.webUrl });
    } catch (err) {
      const message = err && err.message ? err.message : 'Erro interno ao enviar anexo.';
      try { console.error('Erro ao enviar anexo de averbação gratuita:', err); } catch (_) {}
      if (/Apenas PDF/.test(message)) {
        return res.status(400).json({ error: 'Apenas PDF é permitido.' });
      }
      return res.status(500).json({ error: message });
    }
  });

  // POST /api/averbacoes-gratuitas/upload-pdf
  app.post('/api/averbacoes-gratuitas/upload-pdf', uploadAverbacao.single('file'), async (req, res) => {
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

      const seq = await nextMonthlySeq(pool, anoMes, tipoPrefix);
      const seqStr = String(seq).padStart(3, '0');
      const tipoRaw = (req.body && (req.body.tipo || req.body.tipo_outro || req.body.tipoAto || '')) ? String(req.body.tipo || req.body.tipo_outro || req.body.tipoAto || '') : '';
      let tipoPrefix = 'AVERBACAO';
      if (tipoRaw && String(tipoRaw).trim() !== '') {
        // remove caracteres não alfanuméricos e deixa em maiúsculas
        const cleaned = String(tipoRaw).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleaned) tipoPrefix = cleaned;
      }
      const filename = `${tipoPrefix}-${seqStr}-${mesNome}.PDF`;

      const rootUploads = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(__dirname, '..', 'uploads');
      const destDir = path.join(rootUploads, 'averbacoes', anoMes);
      ensureDirSyncAverbacao(destDir);
      const absPath = path.join(destDir, filename);
      fs.writeFileSync(absPath, req.file.buffer);

      const publicBase = '/uploads';
      const url = `${publicBase}/averbacoes/${anoMes}/${filename}`;

      return res.status(201).json({ filename, url, anoMes, seq });
    } catch (err) {
      try { console.error('Erro no upload de PDF de averbação:', err); } catch(_){}
      if (String(err.message || '').includes('Apenas PDF')) { return res.status(400).json({ error: 'Apenas PDF é permitido.' }); }
      return res.status(500).json({ error: 'Erro interno ao processar upload de PDF.' });
    }
  });
}

module.exports = { registerAverbacoesGratuitasRoutes };
