const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middlewares/auth');

const COMPETENCIA_PATTERN = /^(\d{4})-(\d{2})$/;

const ALERT_CONFIGS = [
  {
    relatorioId: 'ibge_mapa_trimestral',
    titulo: 'IBGE - Mapa Trimestral',
    evaluate(today) {
      const deliveryMonths = [0, 3, 6, 9];
      if (!deliveryMonths.includes(today.getMonth())) return null;
      const deadline = buildDate(today.getFullYear(), today.getMonth(), 8);
      if (!isSameDay(today, deadline)) return null;
      const competencia = shiftMonth(deadline, -3);
      return { deadline, competencia };
    }
  },
  {
    relatorioId: 'pf_estrangeiros',
    titulo: 'PF - Estrangeiros',
    evaluate(today) {
      const deadline = lastBusinessDayOfMonth(today.getFullYear(), today.getMonth());
      if (!isSameDay(today, deadline)) return null;
      const competencia = shiftMonth(deadline, -1);
      return { deadline, competencia };
    }
  },
  {
    relatorioId: 'junta_alistamento',
    titulo: 'Junta de Alistamento',
    evaluate(today) {
      const deadline = lastBusinessDayOfMonth(today.getFullYear(), today.getMonth());
      if (!isSameDay(today, deadline)) return null;
      const competencia = shiftMonth(deadline, -1);
      return { deadline, competencia };
    }
  },
  {
    relatorioId: 'detran_mg',
    titulo: 'DETRAN/MG',
    evaluate(today) {
      const deadline = lastBusinessDayOfMonth(today.getFullYear(), today.getMonth());
      if (!isSameDay(today, deadline)) return null;
      const competencia = shiftMonth(deadline, -1);
      return { deadline, competencia };
    }
  },
  {
    relatorioId: 'secretaria_saude',
    titulo: 'Secretaria de Saude',
    evaluate(today) {
      const deadline = lastBusinessDayOfMonth(today.getFullYear(), today.getMonth());
      if (!isSameDay(today, deadline)) return null;
      const competencia = shiftMonth(deadline, -1);
      return { deadline, competencia };
    }
  },
  {
    relatorioId: 'secretaria_seguranca',
    titulo: 'Secretaria de Seguranca',
    evaluate(today) {
      const deadline = lastBusinessDayOfMonth(today.getFullYear(), today.getMonth());
      if (!isSameDay(today, deadline)) return null;
      const competencia = shiftMonth(deadline, -1);
      return { deadline, competencia };
    }
  },
  {
    relatorioId: 'defensoria_paternidade',
    titulo: 'Defensoria - Paternidade',
    evaluate(today) {
      const deadline = nthBusinessDayOfMonth(today.getFullYear(), today.getMonth(), 5);
      if (!isSameDay(today, deadline)) return null;
      const competencia = shiftMonth(deadline, -1);
      return { deadline, competencia };
    }
  },
  {
    relatorioId: 'infodip_obitos',
    titulo: 'INFODIP - Obitos',
    evaluate(today) {
      const deadline = buildDate(today.getFullYear(), today.getMonth(), 15);
      if (!isSameDay(today, deadline)) return null;
      const competencia = shiftMonth(deadline, -1);
      return { deadline, competencia };
    }
  },
  {
    relatorioId: 'af_minas',
    titulo: 'AF Minas',
    evaluate(today) {
      const deadline = buildDate(today.getFullYear(), today.getMonth(), 10);
      if (!isSameDay(today, deadline)) return null;
      const competencia = shiftMonth(deadline, -1);
      return { deadline, competencia };
    }
  }
];

router.use(authenticate);

router.use(async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, serventia FROM public.users WHERE id = $1 LIMIT 1',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }
    req.authUser = rows[0];
    return next();
  } catch (error) {
    console.error('[relatorios-obrigatorios] Erro ao carregar usuario', error);
    return res.status(500).json({ message: 'Erro ao carregar usuario autenticado.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { competencia: competenciaParam, serventia: serventiaParam } = req.query;
    const effectiveServentia = selectServentia(serventiaParam, req.authUser.serventia);
    if (!effectiveServentia.valid) {
      return res.status(effectiveServentia.status).json({ message: effectiveServentia.message });
    }

    const filtros = ['serventia = $1'];
    const valores = [effectiveServentia.value];

    if (competenciaParam) {
      const competenciaDateString = parseCompetenciaToDateString(competenciaParam);
      if (!competenciaDateString) {
        return res.status(400).json({ message: 'Competencia invalida. Use YYYY-MM.' });
      }
      filtros.push(`competencia = $${valores.length + 1}`);
      valores.push(competenciaDateString);
    }

    const query = `
      SELECT id, relatorio_id, competencia, enviado, data_envio, meios, protocolo, responsavel, observacoes, atualizado_em
      FROM public.relatorios_obrigatorios_envios
      WHERE ${filtros.join(' AND ')}
      ORDER BY relatorio_id
    `;

    const { rows } = await pool.query(query, valores);
    const registros = rows.map(mapRegistro);
    return res.json({ registros });
  } catch (error) {
    console.error('[relatorios-obrigatorios][GET] Erro ao listar registros', error);
    return res.status(500).json({ message: 'Erro ao listar registros.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      relatorio_id: relatorioId,
      competencia,
      serventia,
      enviado,
      data_envio: dataEnvio,
      meios,
      protocolo,
      responsavel,
      observacoes
    } = req.body || {};

    if (!relatorioId || typeof relatorioId !== 'string' || !relatorioId.trim()) {
      return res.status(400).json({ message: 'Campo relatorio_id obrigatorio.' });
    }

    const competenciaDateString = parseCompetenciaToDateString(competencia);
    if (!competenciaDateString) {
      return res.status(400).json({ message: 'Competencia invalida. Use YYYY-MM.' });
    }

    const serventiaCheck = selectServentia(serventia, req.authUser.serventia);
    if (!serventiaCheck.valid) {
      return res.status(serventiaCheck.status).json({ message: serventiaCheck.message });
    }

    const enviadoValue = enviado === undefined ? false : Boolean(enviado);
  const dataEnvioValue = parseOptionalDate(dataEnvio);
    if (dataEnvio && !dataEnvioValue) {
      return res.status(400).json({ message: 'data_envio invalida. Use YYYY-MM-DD.' });
    }

    const meiosValue = normalizeMeios(meios);
    if (meiosValue === null) {
      return res.status(400).json({ message: 'meios deve ser um array de strings.' });
    }

    const values = [
      serventiaCheck.value,
      relatorioId.trim(),
      competenciaDateString,
      enviadoValue,
      dataEnvioValue,
      meiosValue,
      toNullableString(protocolo),
      toNullableString(responsavel),
      toNullableString(observacoes),
      req.user.id
    ];

    const upsertQuery = `
      INSERT INTO public.relatorios_obrigatorios_envios (
        serventia,
        relatorio_id,
        competencia,
        enviado,
        data_envio,
        meios,
        protocolo,
        responsavel,
        observacoes,
        usuario_id,
        atualizado_em
  ) VALUES ($1,$2,$3,$4,$5,$6::text[],$7,$8,$9,$10,NOW())
      ON CONFLICT (serventia, relatorio_id, competencia)
      DO UPDATE SET
        enviado = EXCLUDED.enviado,
        data_envio = EXCLUDED.data_envio,
        meios = EXCLUDED.meios,
        protocolo = EXCLUDED.protocolo,
        responsavel = EXCLUDED.responsavel,
        observacoes = EXCLUDED.observacoes,
        usuario_id = EXCLUDED.usuario_id,
        atualizado_em = NOW()
      RETURNING id, relatorio_id, competencia, enviado, data_envio, meios, protocolo, responsavel, observacoes, atualizado_em
    `;

    const { rows } = await pool.query(upsertQuery, values);
    const registro = mapRegistro(rows[0]);
    return res.json({ message: 'Registro salvo com sucesso.', registro });
  } catch (error) {
    console.error('[relatorios-obrigatorios][POST] Erro ao salvar registro', error);
    return res.status(500).json({ message: 'Erro ao salvar registro.' });
  }
});

router.get('/alertas', async (req, res) => {
  try {
    const serventiaCheck = selectServentia(req.query.serventia, req.authUser.serventia);
    if (!serventiaCheck.valid) {
      return res.status(serventiaCheck.status).json({ message: serventiaCheck.message });
    }

    const today = normalizeDate(new Date());
    const alertas = [];

    for (const config of ALERT_CONFIGS) {
      const result = config.evaluate(today);
      if (!result) continue;
  const competenciaDateString = formatCompetenciaDate(result.competencia);
      const { rows } = await pool.query(
        `SELECT enviado FROM public.relatorios_obrigatorios_envios
         WHERE serventia = $1 AND relatorio_id = $2 AND competencia = $3
         LIMIT 1`,
        [serventiaCheck.value, config.relatorioId, competenciaDateString]
      );
      const enviado = rows.length ? rows[0].enviado === true : false;
      if (enviado) continue;
      alertas.push({
        relatorio_id: config.relatorioId,
        titulo: config.titulo,
        competencia: competenciaDateString.slice(0, 7),
        prazoFormatado: formatDateBr(result.deadline),
        enviado
      });
    }

    return res.json({ alertas });
  } catch (error) {
    console.error('[relatorios-obrigatorios][GET alertas] Erro ao montar alertas', error);
    return res.status(500).json({ message: 'Erro ao montar alertas.' });
  }
});

function selectServentia(requested, fallback) {
  const fromRequest = requested && String(requested).trim();
  const base = fallback && String(fallback).trim();
  if (!base) {
    return { valid: false, status: 400, message: 'Serventia nao encontrada para o usuario.' };
  }
  if (fromRequest && fromRequest.toLowerCase() !== base.toLowerCase()) {
    return { valid: false, status: 403, message: 'Serventia nao autorizada.' };
  }
  return { valid: true, value: base };
}

function parseCompetenciaToDateString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = COMPETENCIA_PATTERN.exec(trimmed);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

function parseOptionalDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return formatIsoDate(value);
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function normalizeMeios(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const out = value
    .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
    .filter(Boolean);
  return out;
}

function toNullableString(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str ? str : null;
}

function mapRegistro(row) {
  return {
    id: row.id,
    relatorio_id: row.relatorio_id,
    competencia: formatCompetenciaValue(row.competencia),
    enviado: row.enviado,
    data_envio: formatDateOrNull(row.data_envio),
    meios: row.meios || [],
    protocolo: row.protocolo || null,
    responsavel: row.responsavel || null,
    observacoes: row.observacoes || null,
    atualizado_em: formatTimestamp(row.atualizado_em)
  };
}

function formatCompetenciaValue(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.slice(0, 7);
  }
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }
  const coerced = new Date(value);
  if (Number.isNaN(coerced.getTime())) return null;
  return `${coerced.getFullYear()}-${String(coerced.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateOrNull(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const coerced = new Date(value);
  if (Number.isNaN(coerced.getTime())) return null;
  return coerced.toISOString().slice(0, 10);
}

function formatTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const coerced = new Date(value);
  if (Number.isNaN(coerced.getTime())) return null;
  return coerced.toISOString();
}

function normalizeDate(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBusinessDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function lastBusinessDayOfMonth(year, monthIndex) {
  const date = new Date(year, monthIndex + 1, 0);
  while (!isBusinessDay(date)) {
    date.setDate(date.getDate() - 1);
  }
  return normalizeDate(date);
}

function nthBusinessDayOfMonth(year, monthIndex, n) {
  const date = new Date(year, monthIndex, 1);
  let count = 0;
  while (count < n) {
    if (isBusinessDay(date)) {
      count += 1;
      if (count === n) {
        return normalizeDate(date);
      }
    }
    date.setDate(date.getDate() + 1);
  }
  return normalizeDate(date);
}

function shiftMonth(date, offset) {
  const shifted = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return normalizeDate(shifted);
}

function buildDate(year, monthIndex, day) {
  return normalizeDate(new Date(year, monthIndex, day));
}

function formatIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatCompetenciaDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatDateBr(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

module.exports = router;
