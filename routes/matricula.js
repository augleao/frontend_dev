/**
 * routes/matricula.js
 *
 * Express initializer to generate 'matricula' identifiers and compute a
 * two-digit verification value (DV) using a Modulo-11 two-step algorithm
 * (CPF-style double check digits generalized to arbitrary base length).
 *
 * Endpoint:
 *  POST /api/matriculas/generate
 *  - Accepts JSON body with either a single record or `records` array.
 *  - Each record should contain the components: cns, acervo, servico, ano,
 *    tipoLivro, livro, folha, termo (all numeric or strings containing digits).
 *  - Optionally, provide `widths` object to override padding widths for each
 *    component. If absent, defaults are used.
 *
 * Response:
 *  - For single input: { ok: true, result: { core, dv, matricula } }
 *  - For batch: { ok: true, results: [ { core, dv, matricula, error? } ] }
 *
 * Notes:
 *  - Defaults widths (component -> digits):
 *      cns:6, acervo:2, servico:2, ano:4, tipoLivro:2, livro:5, folha:5, termo:6
 *    These default to a 32-digit core when concatenated. The generated DV is
 *    two digits appended to the core (so final `matricula` length will be
 *    core.length + 2).
 *  - Widths are configurable in the request body under `widths`.
 *  - The DV algorithm uses a two-step Modulo-11 procedure similar to CPF:
 *      * compute first digit over the base with descending weights (len+1->2),
 *        dv1 = 11 - (sum % 11); if dv1 >= 10 => dv1 = 0
 *      * append dv1 to base and compute dv2 with weights (len+2->2), same rule
 *      * final two-digit DV: `${dv1}${dv2}`
 *
 * Example request (single):
 *  {
 *    "cns": "123", "acervo": "1", "servico": "2", "ano": "2025",
 *    "tipoLivro": "01", "livro": "12", "folha": "34", "termo": "56"
 *  }
 *
 * Example curl:
 *  curl -X POST http://localhost:3000/api/matriculas/generate -H 'Content-Type: application/json' -d '{"cns":"1","acervo":"1","servico":"1","ano":"2025","tipoLivro":"1","livro":"1","folha":"1","termo":"1"}'
 */

function padLeftDigits(v, width) {
  const s = v == null ? '' : String(v).replace(/\D+/g, '');
  if (s.length > width) return null; // signal too long
  return s.padStart(width, '0');
}

function onlyDigits(s) {
  return (s == null) ? '' : String(s).replace(/\D+/g, '');
}

// Generalized Modulo-11 two-step (CPF-like) for two check digits
function mod11TwoDigits(baseDigitsStr) {
  // remove non-digits
  const base = onlyDigits(baseDigitsStr);
  const digits = base.split('').map((d) => parseInt(d, 10));
  const L = digits.length;

  function computeDVForArray(digArray, startingWeight) {
    let sum = 0;
    for (let i = 0; i < digArray.length; i++) {
      const weight = startingWeight - i; // descending
      sum += Number(digArray[i]) * weight;
    }
    const r = sum % 11;
    let dv = 11 - r;
    if (dv >= 10) dv = 0;
    return dv;
  }

  // first DV: weights from L+1 down to 2
  const dv1 = computeDVForArray(digits, L + 1);
  // second DV: append dv1 and compute with weights from L+2 down to 2
  const arr2 = digits.concat([dv1]);
  const dv2 = computeDVForArray(arr2, L + 2);
  return String(dv1) + String(dv2);
}

function buildCoreFromRecord(rec, widths) {
  const parts = [];
  const map = [
    ['cns', widths.cns || 6],
    ['acervo', widths.acervo || 2],
    ['servico', widths.servico || 2],
    ['ano', widths.ano || 4],
    ['tipoLivro', widths.tipoLivro || 2],
    ['livro', widths.livro || 5],
    ['folha', widths.folha || 5],
    ['termo', widths.termo || 6],
  ];
  for (const [key, w] of map) {
    const val = rec[key];
    const padded = padLeftDigits(val, w);
    if (padded == null) return { error: `field ${key} exceeds width ${w}` };
    parts.push(padded);
  }
  return { core: parts.join(''), widthsMap: map.reduce((acc, [k, w]) => (acc[k] = w, acc), {}) };
}

module.exports = function initMatriculaRoutes(app) {
  if (!app || typeof app.post !== 'function') throw new Error('initMatriculaRoutes: app (express) required');

  app.post('/api/matriculas/generate', (req, res) => {
    try {
      const body = req.body || {};
      const widths = body.widths || {};
      // Support a top-level default numeroLivro passed in the request body.
      // This will be used for any record that does not provide its own 'livro'.
      const defaultNumeroLivro = onlyDigits(body.numeroLivro || body.numero_livro || body.numero_livro_default || '');

      const processOne = (rec) => {
        if (!rec || typeof rec !== 'object') return { error: 'invalid record' };
        // clone to avoid mutating caller data
        const r = Object.assign({}, rec);
        // If record.livro is missing/empty, try the default provided at body level
        if ((!r.livro || String(r.livro).replace(/\D+/g, '') === '') && defaultNumeroLivro) {
          r.livro = defaultNumeroLivro;
        }
        const resCore = buildCoreFromRecord(r, widths);
        if (resCore.error) return { error: resCore.error };
        const core = resCore.core;
        const dv = mod11TwoDigits(core);
        const matricula = core + dv;
        return { core, dv, matricula };
      };

      if (Array.isArray(body.records)) {
        const results = body.records.map((r) => processOne(r));
        return res.json({ ok: true, results });
      }

      // Single-record body: accept either full keys or a `record` wrapper
      const single = body.record || body;
      const result = processOne(single);
      if (result.error) return res.status(400).json({ ok: false, error: result.error });
      return res.json({ ok: true, result });
    } catch (e) {
      console.error('[matricula.generate] error', e && e.stack ? e.stack : e);
      return res.status(500).json({ ok: false, error: 'internal server error' });
    }
  });
};
