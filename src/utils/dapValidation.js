// Utility validators for DAP ato snapshot lines
// Fields:
// codigo: exactly 4 digits (string) e.g. '0001', '1045'
// tributacao: 1 or 2 digits (string) e.g. '1', '46'
// quantidade: 1 to 3 digits (string) -> will be parsed as integer 0..999
// tfjValor: monetary with two decimal places, stored as string or number; validator accepts '0', '0.00', '12.30'

const regexCodigo = /^[0-9]{4}$/;
const regexTributacao = /^[0-9]{1,2}$/;
const regexQuantidade = /^[0-9]{1,3}$/; // 0..999 (we can disallow leading zeros if needed)
const regexTfjValor = /^\d{1,9}(\.\d{2})$/; // up to 9 digits integer part, mandatory two decimals

/**
 * Validate one ato line.
 * @param {Object} ato
 * @param {string|number} ato.codigo
 * @param {string|number} ato.tributacao
 * @param {string|number} ato.quantidade
 * @param {string|number} ato.tfjValor
 * @returns {{valid: boolean, errors: string[], normalized: {codigo: string, tributacao: string, quantidade: number, tfjValor: number}}}
 */
export function validateAto(ato) {
  const errors = [];
  const normalized = {
    codigo: String(ato.codigo ?? '').trim(),
    tributacao: String(ato.tributacao ?? '').trim(),
    quantidade: Number(String(ato.quantidade ?? '').trim()),
    tfjValor: parseFloat(String(ato.tfjValor ?? '').replace(',', '.')),
  };

  if (!regexCodigo.test(normalized.codigo)) {
    errors.push('codigo deve conter exatamente 4 dígitos');
  }
  if (!regexTributacao.test(normalized.tributacao)) {
    errors.push('tributacao deve conter 1 ou 2 dígitos');
  }
  if (!regexQuantidade.test(String(ato.quantidade ?? '').trim())) {
    errors.push('quantidade deve conter 1 a 3 dígitos');
  } else if (normalized.quantidade < 0 || normalized.quantidade > 999) {
    errors.push('quantidade fora do intervalo 0..999');
  }

  const tfjRaw = String(ato.tfjValor ?? '').replace(',', '.').trim();
  // Normalize '12' => '12.00' if needed
  let tfjWorking = tfjRaw;
  if (/^\d+$/.test(tfjWorking)) {
    tfjWorking = tfjWorking + '.00';
  }
  if (!regexTfjValor.test(tfjWorking)) {
    errors.push('tfjValor deve ser número com duas casas decimais (ex.: 123.45)');
  } else {
    normalized.tfjValor = parseFloat(tfjWorking);
  }

  return { valid: errors.length === 0, errors, normalized };
}

/**
 * Batch validate an array of atos.
 * @param {Array} atos
 * @returns {{valid: boolean, errors: Array<{index:number, errors:string[]}>, normalized: Array}}
 */
export function validateAtoLista(atos = []) {
  const allErrors = [];
  const normalizedList = [];
  atos.forEach((a, idx) => {
    const r = validateAto(a);
    normalizedList.push(r.normalized);
    if (!r.valid) {
      allErrors.push({ index: idx, errors: r.errors });
    }
  });
  return { valid: allErrors.length === 0, errors: allErrors, normalized: normalizedList };
}

export const atoPatterns = {
  codigo: regexCodigo,
  tributacao: regexTributacao,
  quantidade: regexQuantidade,
  tfjValor: regexTfjValor,
};

/**
 * Format monetary value to string with two decimals.
 * @param {number|string} v
 * @returns {string}
 */
export function formatTfj(v) {
  const num = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (Number.isNaN(num)) return '0.00';
  return num.toFixed(2);
}

export default {
  validateAto,
  validateAtoLista,
  atoPatterns,
  formatTfj,
};
