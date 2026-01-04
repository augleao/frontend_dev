const pool = require('../db');

function resolveIaModel(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  if (/\-latest$/.test(n)) return n.replace(/-latest$/, '');
  if (/\-\d{3}$/.test(n)) return n.replace(/-\d{3}$/, '');
  return n;
}

function resolveIaModels() {
  // No environment fallback: prefer DB-provided agents only.
  // Returning nulls indicates no env-provided defaults.
  return { primary: null, secondary: null };
}

async function resolveUserServentiaNome(req) {
  if (!req) return null;
  try {
    if (req.user && (req.user.serventia || req.user.serventiaNome)) return req.user.serventia || req.user.serventiaNome;
    if (req.body) {
      if (req.body.serventia) return req.body.serventia;
      if (req.body.serventiaNome) return req.body.serventiaNome;
      if (req.body.metadata) {
        const m = typeof req.body.metadata === 'string' ? (() => { try { return JSON.parse(req.body.metadata); } catch (_) { return null; } })() : req.body.metadata;
        if (m) {
          if (m.serventiaNome) return m.serventiaNome;
          if (m.serventia) return m.serventia;
        }
      }
    }
    const h = req.headers && (req.headers['x-serventia'] || req.headers['x-serventia-nome']);
    if (h) return h;
    const q = req.query && (req.query.serventia || req.query.serventiaNome);
    if (q) return q;
    if (req.user && req.user.id && pool) {
      try {
        const { rows } = await pool.query('SELECT serventia FROM public.users WHERE id = $1 LIMIT 1', [req.user.id]);
        if (rows && rows[0] && rows[0].serventia) return rows[0].serventia;
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

async function getIaModelFor(opts = {}) {
  try {
    if (!pool) return [];
    const codigo = opts.codigoServentia || null;
    const nome = opts.serventiaNome || null;
    let q = null; let params = [];
    if (codigo) {
      const normalized = String(codigo || '').replace(/\D/g, '');
      q = "SELECT ia_agent, ia_agent_fallback1, ia_agent_fallback2 FROM db_yq0x.public.serventia WHERE regexp_replace(codigo_serventia, '\\D', '', 'g') = $1 LIMIT 1";
      params = [normalized];
    } else if (nome) {
      q = "SELECT ia_agent, ia_agent_fallback1, ia_agent_fallback2 FROM db_yq0x.public.serventia WHERE lower(nome_abreviado) = lower($1) LIMIT 1";
      params = [String(nome || '')];
    } else {
      return [];
    }
    try {
      const { rows } = await pool.query(q, params);
      if (rows && rows[0]) {
        const r = rows[0];
        const candidates = [];
        if (r.ia_agent) candidates.push(String(r.ia_agent).trim());
        if (r.ia_agent_fallback1 && !candidates.includes(r.ia_agent_fallback1)) candidates.push(String(r.ia_agent_fallback1).trim());
        if (r.ia_agent_fallback2 && !candidates.includes(r.ia_agent_fallback2)) candidates.push(String(r.ia_agent_fallback2).trim());
        if (candidates.length) return candidates;
      }
    } catch (e) {
      // fallback to public
      try {
        if (codigo) {
          const normalized = String(codigo || '').replace(/\D/g, '');
          const q2 = "SELECT ia_agent, ia_agent_fallback1, ia_agent_fallback2 FROM public.serventia WHERE regexp_replace(codigo_serventia, '\\D', '', 'g') = $1 LIMIT 1";
          const { rows } = await pool.query(q2, [normalized]);
          if (rows && rows[0]) {
            const r = rows[0];
            const candidates = [];
            if (r.ia_agent) candidates.push(String(r.ia_agent).trim());
            if (r.ia_agent_fallback1 && !candidates.includes(r.ia_agent_fallback1)) candidates.push(String(r.ia_agent_fallback1).trim());
            if (r.ia_agent_fallback2 && !candidates.includes(r.ia_agent_fallback2)) candidates.push(String(r.ia_agent_fallback2).trim());
            if (candidates.length) return candidates;
          }
        } else if (nome) {
          const q3 = "SELECT ia_agent, ia_agent_fallback1, ia_agent_fallback2 FROM public.serventia WHERE lower(nome_abreviado) = lower($1) LIMIT 1";
          const { rows } = await pool.query(q3, [String(nome || '')]);
          if (rows && rows[0]) {
            const r = rows[0];
            const candidates = [];
            if (r.ia_agent) candidates.push(String(r.ia_agent).trim());
            if (r.ia_agent_fallback1 && !candidates.includes(r.ia_agent_fallback1)) candidates.push(String(r.ia_agent_fallback1).trim());
            if (r.ia_agent_fallback2 && !candidates.includes(r.ia_agent_fallback2)) candidates.push(String(r.ia_agent_fallback2).trim());
            if (candidates.length) return candidates;
          }
        }
      } catch (_) {}
    }
  } catch (_) {}
  return [];
}

async function resolveModelCandidates(opts = {}) {
  try {
    const codigoServentia = opts.codigoServentia || null;
    const serventiaNome = opts.serventiaNome || null;
    let candidates = [];
    try { candidates = await getIaModelFor({ codigoServentia, serventiaNome }); } catch (e) { candidates = []; }
    if (Array.isArray(candidates) && candidates.length) return candidates;
    // No environment fallback: only DB-configured agents are allowed.
    return [];
  } catch (_) { return []; }
}

module.exports = { resolveIaModel, resolveIaModels, resolveUserServentiaNome, resolveModelCandidates, getIaModelFor };
