// Backend routes example for Legislação (Express + pg)
// Usage in your backend project (server.js):
//   const initLegislacaoRoutes = require('./routes/legislacao');
//   initLegislacaoRoutes(app, pool, { ensureAuth }); // role checks are handled in the frontend UI

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String).map((s) => s.trim()).filter(Boolean);
  // string "a, b, c"
  return String(tags)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBooleanMaybe(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return undefined;
}

function buildTsQuery(q) {
  if (!q) return null;
  const raw = String(q).trim();
  if (!raw) return null;
  // Se o usuário usou operadores (& | ! :*), preserva com to_tsquery; caso contrário, usa plainto_tsquery
  const hasOps = /[&|!:]/.test(raw);
  return {
    text: hasOps ? `searchable @@ to_tsquery('portuguese', $PARAM$${raw}$PARAM$)`
                 : `searchable @@ plainto_tsquery('portuguese', $PARAM$${raw}$PARAM$)`
  };
}

module.exports = function initLegislacaoRoutes(app, pool, middlewares = {}) {
  // If your backend has authentication, pass it via middlewares.ensureAuth; otherwise it's a no-op.
  const ensureAuth = middlewares.ensureAuth || ((req, res, next) => next());

  // GET /api/legislacao?q=&indexador=&ativo=
  app.get('/api/legislacao', ensureAuth, async (req, res) => {
    try {
      const { q, indexador } = req.query;
      const ativoMaybe = parseBooleanMaybe(req.query.ativo);

      // Por padrão, apenas ativos quando não especificado
      const ativo = ativoMaybe === undefined ? true : ativoMaybe;

      const where = [];
      const params = [];

      if (indexador && String(indexador).trim()) {
        params.push(`%${String(indexador).trim().toLowerCase()}%`);
        where.push(`LOWER(indexador) LIKE $${params.length}`);
      }

      // FTS
      if (q && String(q).trim()) {
        // Usar to_tsquery/plainto_tsquery sem bind parametrizado pois operadores podem ser inválidos para $1
        // Sanitização básica já feita; em Postgres, to_tsquery com string literal segura entre $PARAM$...$PARAM$
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
      console.error('Erro ao listar legislação:', err);
      return res.status(500).json({ error: 'Erro ao listar legislação.' });
    }
  });

  // POST /api/legislacao
  app.post('/api/legislacao', ensureAuth, async (req, res) => {
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
      console.error('Erro ao criar legislação:', err);
      return res.status(500).json({ error: 'Erro ao criar legislação.' });
    }
  });

  // PUT /api/legislacao/:id
  app.put('/api/legislacao/:id', ensureAuth, async (req, res) => {
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
      console.error('Erro ao atualizar legislação:', err);
      return res.status(500).json({ error: 'Erro ao atualizar legislação.' });
    }
  });

  // DELETE /api/legislacao/:id
  app.delete('/api/legislacao/:id', ensureAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'ID inválido.' });

      const del = await pool.query('DELETE FROM public.legislacao_normas WHERE id = $1 RETURNING id', [id]);
      if (!del.rowCount) return res.status(404).json({ error: 'Registro não encontrado.' });
      return res.json({ ok: true, id });
    } catch (err) {
      console.error('Erro ao excluir legislação:', err);
      return res.status(500).json({ error: 'Erro ao excluir legislação.' });
    }
  });
};
