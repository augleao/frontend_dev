const pool = require('../db');

function parseBooleanMaybe(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return undefined;
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String).map((s) => s.trim()).filter(Boolean);
  return String(tags).split(',').map((s) => s.trim()).filter(Boolean);
}

// Build a safe full-text search condition; returns object with SQL text snippet
function buildTsQuery(q) {
  try {
    const raw = String(q || '').trim();
    if (!raw) return null;
    // Basic sanitation: collapse spaces and remove dangerous chars
    const simplified = raw.replace(/[\n\r\t]+/g, ' ').trim();
    // Use plainto_tsquery to avoid operator injection; we inline literal using $$...$$ to bypass parameterization issues
    return { text: `searchable @@ plainto_tsquery('portuguese', $$${simplified}$$)` };
  } catch (_) { return null; }
}

function registerLegislacaoRoutes(app) {
  // GET /api/legislacao?q=&indexador=&ativo=
  app.get('/api/legislacao', async (req, res) => {
    try {
      const { q, indexador } = req.query;
      const ativoMaybe = parseBooleanMaybe(req.query.ativo);
      const ativo = ativoMaybe === undefined ? true : ativoMaybe;

      const where = [];
      const params = [];

      if (indexador && String(indexador).trim()) {
        params.push(`%${String(indexador).trim().toLowerCase()}%`);
        where.push(`LOWER(indexador) LIKE $${params.length}`);
      }

      if (q && String(q).trim()) {
        const ts = buildTsQuery(q);
        if (ts) where.push(ts.text);
      }

      if (ativo !== undefined) {
        params.push(ativo);
        where.push(`ativo = $${params.length}`);
      }

      const sql = `
        SELECT id, indexador, base_legal, titulo, artigo, jurisdicao, tags, vigente_desde, vigente_ate, ativo, texto, created_at, updated_at
        FROM public.legislacao_normas
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY updated_at DESC, id DESC
        LIMIT 200
      `;

      const { rows } = await pool.query(sql, params);
      return res.json(rows);
    } catch (err) {
      try { console.error('Erro ao listar legislação:', err); } catch(_){ }
      return res.status(500).json({ error: 'Erro ao listar legislação.' });
    }
  });

  // POST /api/legislacao
  app.post('/api/legislacao', async (req, res) => {
    try {
      const {
        indexador,
        base_legal,
        texto,
        titulo = null,
        artigo = null,
        jurisdicao = null,
        tags = [],
        ativo = true,
        vigente_desde = null,
        vigente_ate = null,
      } = req.body || {};

      if (!indexador || !base_legal || !texto) {
        return res.status(400).json({ error: 'indexador, base_legal e texto são obrigatórios.' });
      }
      const tagsArr = normalizeTags(tags);

      const sql = `
        INSERT INTO public.legislacao_normas
          (indexador, base_legal, texto, titulo, artigo, jurisdicao, tags, ativo, vigente_desde, vigente_ate)
        VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9, $10)
        RETURNING *
      `;
      const params = [
        String(indexador).trim(),
        String(base_legal).trim(),
        String(texto),
        titulo ? String(titulo).trim() : null,
        artigo ? String(artigo).trim() : null,
        jurisdicao ? String(jurisdicao).trim() : null,
        tagsArr,
        !!ativo,
        vigente_desde || null,
        vigente_ate || null,
      ];

      const { rows } = await pool.query(sql, params);
      return res.status(201).json(rows[0]);
    } catch (err) {
      try { console.error('Erro ao criar legislação:', err); } catch(_){ }
      return res.status(500).json({ error: 'Erro ao criar legislação.' });
    }
  });

  // PUT /api/legislacao/:id
  app.put('/api/legislacao/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID inválido.' });

      const allowed = ['indexador', 'base_legal', 'texto', 'titulo', 'artigo', 'jurisdicao', 'tags', 'ativo', 'vigente_desde', 'vigente_ate'];
      const set = [];
      const params = [];

      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
          let val = req.body[key];
          if (key === 'tags') val = normalizeTags(val);
          if (key === 'ativo') val = !!val;
          params.push(key === 'tags' ? val : (val === '' ? null : val));
          set.push(`${key} = ${key === 'tags' ? `$${params.length}::text[]` : `$${params.length}`}`);
        }
      }

      if (set.length === 0) return res.status(400).json({ error: 'Nada para atualizar.' });

      params.push(id);
      const sql = `
        UPDATE public.legislacao_normas
        SET ${set.join(', ')}
        WHERE id = $${params.length}
        RETURNING *
      `;
      const { rows } = await pool.query(sql, params);
      if (!rows[0]) return res.status(404).json({ error: 'Registro não encontrado.' });
      return res.json(rows[0]);
    } catch (err) {
      try { console.error('Erro ao atualizar legislação:', err); } catch(_){ }
      return res.status(500).json({ error: 'Erro ao atualizar legislação.' });
    }
  });

  // DELETE /api/legislacao/:id
  app.delete('/api/legislacao/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID inválido.' });

      const del = await pool.query('DELETE FROM public.legislacao_normas WHERE id = $1 RETURNING id', [id]);
      if (!del.rowCount) return res.status(404).json({ error: 'Registro não encontrado.' });
      return res.json({ ok: true, id });
    } catch (err) {
      try { console.error('Erro ao excluir legislação:', err); } catch(_){ }
      return res.status(500).json({ error: 'Erro ao excluir legislação.' });
    }
  });
}

module.exports = { registerLegislacaoRoutes };
