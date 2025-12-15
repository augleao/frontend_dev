// Rotas administrativas para gerenciar versões da tabela TJMG (atos_tabelas)
// Uso: const initAtosTabelasRoutes = require('./routes/atosTabelas');
//       initAtosTabelasRoutes(app, pool, { ensureAuth });

function sanitizeOrigem(value) {
  if (!value) return null;
  return String(value).trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-_/]/gi, '').toUpperCase();
}

function normalizeMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null;
    return Number(value.toFixed(2));
  }
  let normalized = String(value).trim().replace(/\s+/g, '');
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');
  if (hasComma && hasDot) {
    // Provável formato 1.234,56 => remove pontos e troca vírgula por ponto
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && !hasDot) {
    normalized = normalized.replace(',', '.');
  }
  const asNumber = Number(normalized);
  if (Number.isNaN(asNumber)) return null;
  return Number(asNumber.toFixed(2));
}

function normalizePayloadRow(raw = {}) {
  const codigo = raw.codigo != null ? String(raw.codigo).trim() : '';
  const descricao = raw.descricao != null ? String(raw.descricao).trim() : '';
  if (!codigo || !descricao) return null;
  return {
    codigo,
    descricao,
    emol_bruto: normalizeMoney(raw.emol_bruto),
    recompe: normalizeMoney(raw.recompe),
    emol_liquido: normalizeMoney(raw.emol_liquido),
    issqn: normalizeMoney(raw.issqn),
    taxa_fiscal: normalizeMoney(raw.taxa_fiscal),
    valor_final: normalizeMoney(raw.valor_final)
  };
}

async function fetchActiveOrigem(pool) {
  try {
    const { rows } = await pool.query(`
      SELECT origem, COUNT(*) AS total
      FROM public.atos
      WHERE origem IS NOT NULL AND origem <> ''
      GROUP BY origem
      ORDER BY total DESC
      LIMIT 1
    `);
    if (rows && rows[0]) {
      return { origem: rows[0].origem, total: Number(rows[0].total) || 0 };
    }
  } catch (_) {
    // noop
  }
  return { origem: null, total: 0 };
}

module.exports = function initAtosTabelasRoutes(app, pool, middlewares = {}) {
  if (!app || !pool) {
    throw new Error('initAtosTabelasRoutes requer app e pool configurados');
  }
  const ensureAuth = middlewares.ensureAuth || ((req, _res, next) => next());

  // Lista versões disponíveis e destaca a versão ativa
  app.get('/api/atos/versoes', ensureAuth, async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT origem,
               COUNT(*)                         AS total_registros,
               MIN(criado_em)                   AS primeira_insercao,
               MAX(atualizado_em)               AS ultima_atualizacao
        FROM public.atos_tabelas
        GROUP BY origem
        ORDER BY MAX(atualizado_em) DESC, origem DESC
      `);
      const ativa = await fetchActiveOrigem(pool);
      const list = rows.map((row) => ({
        origem: row.origem,
        total_registros: Number(row.total_registros) || 0,
        primeira_insercao: row.primeira_insercao,
        ultima_atualizacao: row.ultima_atualizacao,
        ativa: row.origem === ativa.origem
      }));
      return res.json({ origens: list, ativa });
    } catch (err) {
      console.error('[atos/versoes][GET] erro ao listar origens', err);
      return res.status(500).json({ error: 'Erro ao listar versões da tabela TJMG.' });
    }
  });

  // Pré-visualização de uma origem específica (limite 200 registros)
  app.get('/api/atos/versoes/:origem', ensureAuth, async (req, res) => {
    const origem = sanitizeOrigem(req.params.origem);
    if (!origem) {
      return res.status(400).json({ error: 'Origem inválida.' });
    }
    try {
      const { rows } = await pool.query(`
        SELECT codigo, descricao, emol_bruto, recompe, emol_liquido, issqn, taxa_fiscal, valor_final
        FROM public.atos_tabelas
        WHERE origem = $1
        ORDER BY codigo ASC
        LIMIT 200
      `, [origem]);
      return res.json({ origem, total_preview: rows.length, registros: rows });
    } catch (err) {
      console.error('[atos/versoes/:origem][GET] erro ao carregar prévia', err);
      return res.status(500).json({ error: 'Erro ao carregar dados da origem solicitada.' });
    }
  });

  // Atualiza um registro específico dentro de uma origem existente
  app.put('/api/atos/versoes/:origem/:codigo', ensureAuth, async (req, res) => {
    const origem = sanitizeOrigem(req.params.origem);
    const codigo = req.params.codigo ? String(req.params.codigo).trim() : '';
    if (!origem || !codigo) {
      return res.status(400).json({ error: 'Origem ou código inválidos.' });
    }
    try {
      const currentResult = await pool.query(`
        SELECT codigo, descricao, emol_bruto, recompe, emol_liquido, issqn, taxa_fiscal, valor_final
        FROM public.atos_tabelas
        WHERE origem = $1 AND codigo = $2
        LIMIT 1
      `, [origem, codigo]);
      if (!currentResult.rowCount) {
        return res.status(404).json({ error: 'Registro não encontrado para a origem/código informados.' });
      }
      const current = currentResult.rows[0];
      const normalized = normalizePayloadRow({
        codigo,
        descricao: req.body && Object.prototype.hasOwnProperty.call(req.body, 'descricao') ? req.body.descricao : current.descricao,
        emol_bruto: req.body && Object.prototype.hasOwnProperty.call(req.body, 'emol_bruto') ? req.body.emol_bruto : current.emol_bruto,
        recompe: req.body && Object.prototype.hasOwnProperty.call(req.body, 'recompe') ? req.body.recompe : current.recompe,
        emol_liquido: req.body && Object.prototype.hasOwnProperty.call(req.body, 'emol_liquido') ? req.body.emol_liquido : current.emol_liquido,
        issqn: req.body && Object.prototype.hasOwnProperty.call(req.body, 'issqn') ? req.body.issqn : current.issqn,
        taxa_fiscal: req.body && Object.prototype.hasOwnProperty.call(req.body, 'taxa_fiscal') ? req.body.taxa_fiscal : current.taxa_fiscal,
        valor_final: req.body && Object.prototype.hasOwnProperty.call(req.body, 'valor_final') ? req.body.valor_final : current.valor_final
      });
      if (!normalized) {
        return res.status(400).json({ error: 'Payload inválido para atualização.' });
      }
      const updateResult = await pool.query(`
        UPDATE public.atos_tabelas
           SET descricao = $3,
               emol_bruto = $4,
               recompe = $5,
               emol_liquido = $6,
               issqn = $7,
               taxa_fiscal = $8,
               valor_final = $9,
               atualizado_em = NOW()
         WHERE origem = $1 AND codigo = $2
         RETURNING codigo, descricao, emol_bruto, recompe, emol_liquido, issqn, taxa_fiscal, valor_final, atualizado_em
      `, [
        origem,
        codigo,
        normalized.descricao,
        normalized.emol_bruto,
        normalized.recompe,
        normalized.emol_liquido,
        normalized.issqn,
        normalized.taxa_fiscal,
        normalized.valor_final
      ]);
      return res.json({ ok: true, registro: updateResult.rows[0] });
    } catch (err) {
      console.error('[atos/versoes/:origem/:codigo][PUT] erro ao atualizar registro', err);
      return res.status(500).json({ error: 'Erro ao atualizar o registro solicitado.' });
    }
  });

  // Salva a tabela "atos" atual como nova origem em atos_tabelas
  app.post('/api/atos/versoes/snapshot', ensureAuth, async (req, res) => {
    const origem = sanitizeOrigem(req.body && req.body.origem);
    const overwrite = Boolean(req.body && req.body.overwrite);
    if (!origem) {
      return res.status(400).json({ error: 'Informe o identificador da origem (ex.: 01-2026).' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (!overwrite) {
        const exists = await client.query('SELECT 1 FROM public.atos_tabelas WHERE origem = $1 LIMIT 1', [origem]);
        if (exists.rowCount) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Já existe uma versão com esta origem.' });
        }
      }
      await client.query('DELETE FROM public.atos_tabelas WHERE origem = $1', [origem]);
      const insertSql = `
        INSERT INTO public.atos_tabelas
          (origem, codigo, descricao, emol_bruto, recompe, emol_liquido, issqn, taxa_fiscal, valor_final)
        SELECT $1, codigo, descricao, emol_bruto, recompe, emol_liquido, issqn, taxa_fiscal, valor_final
        FROM public.atos
      `;
      const insertResult = await client.query(insertSql, [origem]);
      await client.query('COMMIT');
      return res.status(201).json({ ok: true, origem, registros: insertResult.rowCount });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[atos/versoes/snapshot][POST] erro ao capturar versão', err);
      return res.status(500).json({ error: 'Erro ao salvar a versão atual da tabela de atos.' });
    } finally {
      client.release();
    }
  });

  // Importa registros fornecidos manualmente para uma origem
  app.post('/api/atos/versoes', ensureAuth, async (req, res) => {
    const origem = sanitizeOrigem(req.body && req.body.origem);
    const registros = Array.isArray(req.body && req.body.registros) ? req.body.registros : [];
    if (!origem || registros.length === 0) {
      return res.status(400).json({ error: 'Origem e registros são obrigatórios.' });
    }
    const normalizados = registros
      .map((item) => normalizePayloadRow(item))
      .filter(Boolean);
    if (!normalizados.length) {
      return res.status(400).json({ error: 'Nenhum registro válido para importação.' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM public.atos_tabelas WHERE origem = $1', [origem]);
      const chunkSize = 200;
      const columns = ['origem', 'codigo', 'descricao', 'emol_bruto', 'recompe', 'emol_liquido', 'issqn', 'taxa_fiscal', 'valor_final'];
      for (let i = 0; i < normalizados.length; i += chunkSize) {
        const chunk = normalizados.slice(i, i + chunkSize);
        const values = [];
        const params = [];
        chunk.forEach((row, idx) => {
          const offset = idx * columns.length;
          values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`);
          params.push(
            origem,
            row.codigo,
            row.descricao,
            row.emol_bruto,
            row.recompe,
            row.emol_liquido,
            row.issqn,
            row.taxa_fiscal,
            row.valor_final
          );
        });
        const insert = `
          INSERT INTO public.atos_tabelas
            (origem, codigo, descricao, emol_bruto, recompe, emol_liquido, issqn, taxa_fiscal, valor_final)
          VALUES ${values.join(', ')}
        `;
        await client.query(insert, params);
      }
      await client.query('COMMIT');
      return res.status(201).json({ ok: true, origem, registros: normalizados.length });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[atos/versoes][POST] erro ao importar registros', err);
      return res.status(500).json({ error: 'Erro ao importar registros para a origem informada.' });
    } finally {
      client.release();
    }
  });

  // Promove uma origem histórica para a tabela operacional "atos"
  app.post('/api/atos/versoes/:origem/ativar', ensureAuth, async (req, res) => {
    const origem = sanitizeOrigem(req.params.origem);
    if (!origem) {
      return res.status(400).json({ error: 'Origem inválida.' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT COUNT(*) AS total FROM public.atos_tabelas WHERE origem = $1', [origem]);
      const total = rows && rows[0] ? Number(rows[0].total) : 0;
      if (!total) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Não existem registros para a origem solicitada.' });
      }
      await client.query('DELETE FROM public.atos');
      const insertSql = `
        INSERT INTO public.atos
          (codigo, descricao, emol_bruto, recompe, emol_liquido, issqn, taxa_fiscal, valor_final, origem)
        SELECT codigo, descricao, emol_bruto, recompe, emol_liquido, issqn, taxa_fiscal, valor_final, origem
        FROM public.atos_tabelas
        WHERE origem = $1
      `;
      const inserted = await client.query(insertSql, [origem]);
      await client.query('COMMIT');
      return res.json({ ok: true, origem, registros: inserted.rowCount });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[atos/versoes/:origem/ativar][POST] erro ao promover origem', err);
      return res.status(500).json({ error: 'Erro ao atualizar a tabela principal de atos.' });
    } finally {
      client.release();
    }
  });

  // Remove completamente uma origem armazenada
  app.delete('/api/atos/versoes/:origem', ensureAuth, async (req, res) => {
    const origem = sanitizeOrigem(req.params.origem);
    if (!origem) {
      return res.status(400).json({ error: 'Origem inválida.' });
    }
    try {
      const del = await pool.query('DELETE FROM public.atos_tabelas WHERE origem = $1', [origem]);
      if (!del.rowCount) {
        return res.status(404).json({ error: 'Nenhum registro encontrado para esta origem.' });
      }
      return res.json({ ok: true, origem, removidos: del.rowCount });
    } catch (err) {
      console.error('[atos/versoes/:origem][DELETE] erro ao remover origem', err);
      return res.status(500).json({ error: 'Erro ao remover a origem solicitada.' });
    }
  });
};
