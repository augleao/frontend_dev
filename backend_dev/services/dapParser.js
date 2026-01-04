/**
 * Extrai todos os dados da DAP (campos fixos e tabela de atos) usando apenas o Tesseract OCR
 * @param {string} pdfPath Caminho do PDF
 * @param {object} [opts] Opções (ex: página da tabela)
 * @returns {Promise<{header: object, periodosDap: Array}>}
 */
async function parseDapSomenteTesseract(pdfPath, opts = {}) {
  const { pageNum = 1 } = opts;
  // 1. Renderiza página do PDF como imagem
  const tempPng = path.join(path.dirname(pdfPath), `ocr_page${pageNum}.png`);
  await renderPdfPageToPng(pdfPath, pageNum, tempPng);
  // 2. Pré-processa imagem para OCR
  const preImg = await preprocessImage(tempPng);
  // 3. Executa OCR
  const ocrText = await ocrImage(preImg, { logger: m => DEBUG_EXTRACTION && console.log(m) });
  if (DEBUG_EXTRACTION) {
    console.log('==== OCR RAW TEXT (Somente Tesseract) ====');
    console.log(ocrText);
    console.log('==== FIM OCR RAW TEXT (Somente Tesseract) ====');
  }
  // 4. Extrai campos fixos e tabela de atos do texto OCR
  const header = extractHeader(ocrText);
  const periodosDap = parsePeriods(ocrText);
  return { header, periodosDap };
}

// OCR para tabela de atos
const { renderPdfPageToPng, ocrImage } = require('../utils/ocrUtils');
const { preprocessImage } = require('../utils/imagePreprocess');
const path = require('path');

/**
 * Fallback: tenta extrair a tabela de atos via OCR da página do PDF
 * @param {string} pdfPath Caminho do PDF
 * @param {number} pageNum Página (1-based)
 * @param {object} [opts] Opções (ex: crop)
 * @returns {Promise<Array>} Array de períodos extraídos via OCR
 */

/**
 * Extrai a tabela de atos da DAP via OCR (Tesseract)
 * @param {string} pdfPath Caminho do PDF
 * @param {number} pageNum Página da tabela (1-based)
 * @returns {Promise<Array>} Array de períodos extraídos via OCR
 */
async function extractTabelaAtosViaOcr(pdfPath, pageNum = 1) {
  // 1. Renderiza página do PDF como imagem
  const tempPng = path.join(path.dirname(pdfPath), `ocr_page${pageNum}.png`);
  await renderPdfPageToPng(pdfPath, pageNum, tempPng);
  // 2. Pré-processa imagem para OCR
  const preImg = await preprocessImage(tempPng);
  // 3. Executa OCR
  const ocrText = await ocrImage(preImg, { logger: m => DEBUG_EXTRACTION && console.log(m) });
  if (DEBUG_EXTRACTION) {
    console.log('==== OCR RAW TEXT ====');
    console.log(ocrText);
    console.log('==== FIM OCR RAW TEXT ====');
  }
  // 4. Parseia o texto extraído para identificar períodos e blocos de atos
  // (Aqui pode-se usar parsePeriods ou implementar lógica específica para blocos de 4 campos)
  const periods = parsePeriods(ocrText);
  console.log('==== [DAP] Períodos extraídos via Tesseract OCR ====');
  periods.forEach((p, idx) => {
    console.log(`[Tesseract][Período ${idx + 1}] numero: ${p.numero}, atos: ${p.atos ? p.atos.length : 0}`);
  });
  console.log('==== FIM [DAP] Períodos via Tesseract ====');
  return periods;
}

const pdfParse = require('pdf-parse');


// Debug mode - set to true to log extraction attempts
const DEBUG_EXTRACTION = process.env.DEBUG_DAP_PARSER === 'true';
/**
 * Função principal para extrair dados da DAP em duas etapas:
 * 1. Extrai dados fixos via pdf-parse
 * 2. Extrai tabela de atos via OCR
 * @param {Buffer|string} pdfBuffer Caminho ou buffer do PDF
 * @param {object} [opts] Opções (ex: página da tabela)
 * @returns {Promise<{header: object, periodosDap: Array}>}
 */
async function parseDapEmDuasEtapas(pdfBuffer, opts = {}) {
  // Usa apenas pdf-parse para extrair todos os dados
  console.log('[DAP] Agente de extração utilizado: pdf-parse');
  let buf;
  if (Buffer.isBuffer(pdfBuffer)) {
    buf = pdfBuffer;
  } else if (pdfBuffer && Buffer.isBuffer(pdfBuffer.buffer)) {
    buf = pdfBuffer.buffer;
  } else {
    throw new Error('parseDapEmDuasEtapas: pdfBuffer deve ser um Buffer ou um objeto com buffer');
  }
  return await parseDapPdf({ buffer: buf, metadata: opts && opts.metadata });
}

function escapeRegex(label) {
  return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim());
}

function extractFieldFromLines(lines, labels, fieldName = '') {
  if (!Array.isArray(lines) || !Array.isArray(labels)) return null;
  const regexes = labels.map((label) => {
    const safe = escapeRegex(label);
    return new RegExp(`^${safe}\s*[:\-]?(?:\s+)?`, 'i');
  });

  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i] && lines[i].trim();
    if (!current) continue;
    for (const regex of regexes) {
      if (!regex.test(current)) continue;
      const remainder = current.replace(regex, '').trim();
      if (remainder) {
        return remainder;
      } else if (i + 1 < lines.length) {
        // Se não houver valor na mesma linha, tenta pegar da próxima linha
        const nextLine = lines[i + 1] && lines[i + 1].trim();
        if (nextLine) return nextLine;
      }
    }
  }
  return null;
}

// Extrai valor de uma linha que contenha todos os tokens (útil para campos monetários ou genéricos)
function extractByTokens(lines, tokens, fieldName = '') {
  if (!Array.isArray(lines) || !Array.isArray(tokens) || !tokens.length) return null;
  const loweredTokens = tokens.map(t => t.toLowerCase());
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || '').trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    const allPresent = loweredTokens.every(t => lower.includes(t));
    if (!allPresent) continue;
    // Extrai valor após os tokens (padrão: após dois pontos, hífen, ou último token)
    let value = line;
    // Tenta extrair após dois pontos ou hífen
    const match = line.match(/[:\-]\s*([\d\.,\w\s]+)/);
    if (match && match[1]) {
      value = match[1].trim();
    } else {
      // Se não houver separador, pega o que vier após o último token
      const lastToken = tokens[tokens.length - 1];
      const idx = lower.lastIndexOf(lastToken.toLowerCase());
      if (idx !== -1) {
        value = line.substring(idx + lastToken.length).trim();
      }
    }
    if (process.env.DEBUG_DAP_PARSER === 'true') {
      console.log(`✓ [${fieldName}] extractByTokens: "${value}"`);
    }
    return value;
  }
  if (process.env.DEBUG_DAP_PARSER === 'true') {
    console.log(`✗ [${fieldName}] tokens NOT FOUND: ${tokens.join(', ')}`);
  }
  return null;
}

// Extract first date (DD/MM/YYYY) appearing on a line containing all tokens.
function extractDateByTokens(lines, tokens, fieldName = '') {
  if (!Array.isArray(lines) || !Array.isArray(tokens) || !tokens.length) return null;
  const loweredTokens = tokens.map(t => t.toLowerCase());
  for (const lineRaw of lines) {
    const line = (lineRaw || '').trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    const allPresent = loweredTokens.every(t => lower.includes(t));
    if (!allPresent) continue;
    const dateMatch = line.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    if (dateMatch) {
      if (process.env.DEBUG_DAP_PARSER === 'true') console.log(`✓ [${fieldName}] date inline: "${dateMatch[1]}"`);
      return normalizeDate(dateMatch[1]);
    }
  }
  if (process.env.DEBUG_DAP_PARSER === 'true') console.log(`✗ [${fieldName}] date tokens NOT FOUND: ${tokens.join(', ')}`);
  return null;
}

function sanitizeCodigoServentia(value) {
  if (!value) return null;
  return String(value).trim().replace(/\s+/g, '');
}

function normalizeDateTime(value) {
  if (!value) return null;
  const cleaned = String(value).trim();
  const dateTimeMatch = cleaned.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!dateTimeMatch) return cleaned;
  const [, day, month, year, hour, minute] = dateTimeMatch;
  if (hour && minute) {
    return `${year}-${month}-${day}T${hour}:${minute}:00`;
  }
  return `${year}-${month}-${day}`;
}

function toNumber(value) {
  if (value == null) return null;
  const normalized = String(value).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value) {
  if (value == null) return null;
  const parsed = parseInt(String(value).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractHeader(text) {
  const header = {
    ano: null,
    mes: null,
    numero: null,
    tipo: null,
    dataEmissao: null,
    serventia: null,
    serventiaNome: null,
    codigoServentia: null,
    cnpj: null,
    codigoRecibo: null,
    dataTransmissao: null,
    observacoes: null,
    retificadora: false,
  };

  const lines = splitLines(text);

  const anoMatch = text.match(/\bAno\s*[:\-]?\s*(\d{4})/i);
  if (anoMatch) header.ano = toInteger(anoMatch[1]);

  const mesMatch = text.match(/\bM[êe]s\s*[:\-]?\s*(\d{1,2})/i);
  if (mesMatch) {
    const mes = toInteger(mesMatch[1]);
    if (mes && mes >= 1 && mes <= 12) header.mes = mes;
  }

  const numeroMatch = text.match(/\bN[ºo]?[\.:\-]?\s*([\w\/-]{3,})/i);
  if (numeroMatch) header.numero = numeroMatch[1].trim();

  if (/retificadora/i.test(text)) {
    header.tipo = 'RETIFICADORA';
  } else {
    header.tipo = 'ORIGINAL';
  }

  const dataMatch = text.match(/\bData\s+de\s+Emiss[aã]o\s*[:\-]?\s*(\d{2}[/\-]\d{2}[/\-]\d{4})/i);
  if (dataMatch) header.dataEmissao = normalizeDate(dataMatch[1]);

  const serventiaMatch = text.match(/\bServentia\s*[:\-]?\s*(.+)/i);
  if (serventiaMatch) {
    header.serventia = serventiaMatch[1].split('\n')[0].trim();
  }

  const serventiaNome = extractFieldFromLines(lines, ['Nome da serventia', 'Serventia', 'Unidade']);
  if (serventiaNome) {
    header.serventiaNome = serventiaNome;
    header.serventia = header.serventia || serventiaNome;
  }

  const codigoServ = extractFieldFromLines(lines, ['Código da serventia', 'Codigo da serventia', 'Código serventia']);
  if (codigoServ) {
    header.codigoServentia = sanitizeCodigoServentia(codigoServ);
  }

  const cnpj = extractFieldFromLines(lines, ['CNPJ', 'CPNJ']);
  if (cnpj) header.cnpj = cnpj.replace(/[^0-9]/g, '') || cnpj;

  const retificadoraMatch = extractFieldFromLines(lines, ['Retificadora'], 'retificadora');
  if (retificadoraMatch) {
    const v = retificadoraMatch.trim().toLowerCase();
    if (/s(i|í)m|yes|verdadeiro|true/.test(v)) {
      header.retificadora = true;
    } else if (/n(a|ã)o|nao|no|falso|false/.test(v)) {
      header.retificadora = false;
    } else {
      // ambiguous value, default to false
      header.retificadora = false;
    }
  } else {
    // Fallback: infer from detected tipo when label is absent
    header.retificadora = header.tipo === 'RETIFICADORA';
  }

  const observacoes = extractFieldFromLines(lines, ['Observações', 'Observacoes']);
  if (observacoes) header.observacoes = observacoes;

  const reciboLine = lines.find((line) => /c[oó]digo do recibo/i.test(line));
  if (reciboLine) {
    const reciboMatch = reciboLine.match(/c[oó]digo do recibo\s*[:\-]?\s*([^|]+)/i);
    if (reciboMatch) {
      header.codigoRecibo = reciboMatch[1].trim();
    }
    const dataMatch = reciboLine.match(/data de transmiss[aã]o\s*[:\-]?\s*([^|]+)/i);
    if (dataMatch) {
      header.dataTransmissao = normalizeDateTime(dataMatch[1]);
    }
  }

  // Patterns like "Mês/Ano: Outubro/2025" or "Mês/Ano: 10/2025"
  if (!header.ano || !header.mes) {
    const mesAnoMatch = text.match(/M[êe]s\s*\/\s*Ano\s*[:\-]?\s*([\wçãõáéíóú\.]+)\s*\/?\s*(\d{4})/i);
    if (mesAnoMatch) {
      const monthToken = mesAnoMatch[1].replace(/[^\wçãõáéíóú]/gi, ' ').trim();
      const numericMonth = toInteger(monthToken);
      const maybeMonth = monthNameToNumber(monthToken) || numericMonth;
      if (maybeMonth) header.mes = maybeMonth;
      header.ano = header.ano || toInteger(mesAnoMatch[2]);
    }
  }

  // Generic month/year slashed tokens like "Outubro/2025" or "10/2025"
  if (!header.ano || !header.mes) {
    const genericMatches = text.match(/\b([A-Za-zçÇãÃõÕáÁéÉíÍóÓúÚ]+|\d{1,2})\s*\/\s*(\d{4})\b/g);
    if (genericMatches) {
      for (const token of genericMatches) {
        // ...existing code...
      }
    }
  }

  // Emolumento Apurado
  let emolumentoApurado = extractFieldFromLines(lines, [
    'Emolumento Apurado:',
    'Emolumento Apurado',
    'Emolumentos Apurados:',
    'Emolumentos Apurados',
    'Emolumentos apurados:',
    'Emolumento apurado:',
    'Emolumentos',
    'Emolumento',
    'Valor do Emolumento Apurado',
    'Valor dos Emolumentos Apurados',
    'Valor dos emolumentos apurados',
    'Valor emolumento apurado',
    'Valor emolumentos apurados',
    'Total de Emolumentos',
    'Total Emolumentos',
    'Total de emolumentos',
    'Total emolumentos'
  ], 'emolumentoApurado');
  if (!emolumentoApurado) {
    // Fallback: busca por tokens
    const tokenValue = extractByTokens(lines, ['emolumento', 'apurado'], 'emolumentoApurado')
      || extractByTokens(lines, ['emolumentos', 'apurados'], 'emolumentoApurado')
      || extractByTokens(lines, ['total', 'emolumentos'], 'emolumentoApurado');
    if (tokenValue) emolumentoApurado = tokenValue;
  }
  if (emolumentoApurado) header.emolumentoApurado = toNumber(emolumentoApurado);

  // Taxa de Fiscalização Judiciária Apurada
  let taxaFiscalizacaoJudiciariaApurada = extractFieldFromLines(lines, [
    'Taxa de Fiscalização Judiciária Apurada:',
    'Taxa de Fiscalização Judiciária Apurada',
    'Taxa Fiscalização Judiciária Apurada:',
    'Taxa Fiscalização Judiciária Apurada',
    'Taxa de Fiscalização Apurada:',
    'Taxa de Fiscalização Apurada',
    'Taxa Fiscalização Apurada:',
    'Taxa Fiscalização Apurada',
    'Taxa de Fiscalização:',
    'Taxa Fiscalização:'
  ], 'taxaFiscalizacaoJudiciariaApurada');
  if (taxaFiscalizacaoJudiciariaApurada) header.taxaFiscalizacaoJudiciariaApurada = toNumber(taxaFiscalizacaoJudiciariaApurada);

  // Taxa de Fiscalização Judiciária Paga
  let taxaFiscalizacaoJudiciariaPaga = extractFieldFromLines(lines, [
    'Taxa de Fiscalização Judiciária Paga:',
    'Taxa de Fiscalização Judiciária Paga',
    'Taxa Fiscalização Judiciária Paga:',
    'Taxa Fiscalização Judiciária Paga',
    'Taxa de Fiscalização Paga:',
    'Taxa de Fiscalização Paga',
    'Taxa Fiscalização Paga:',
    'Taxa Fiscalização Paga'
  ], 'taxaFiscalizacaoJudiciariaPaga');
  if (taxaFiscalizacaoJudiciariaPaga) header.taxaFiscalizacaoJudiciariaPaga = toNumber(taxaFiscalizacaoJudiciariaPaga);

  let recompeApurado = extractFieldFromLines(lines, [
    'RECOMPE (Depósitos Compensação Gratuidade Art.31,§ ún. Lei nº 15.424) Apurado:',
    'RECOMPE (Depósitos Compensação Gratuidade Art.31,§ ún. Lei nº 15.424) Apurado',
    'RECOMPE Apurado:',
    'RECOMPE Apurado',
    'Recompe Apurado:',
    'Recompe Apurado',
    'RECOMPE apurado:',
    'Recompe apurado:',
    'RECOMPE - Apurado',
    'Valor do RECOMPE Apurado',
    'Valor RECOMPE Apurado'
  ], 'recompeApurado');
  if (!recompeApurado) {
    // Handle long label with parênteses: RECOMPE (Depósitos Compensação ...) Apurado
    const tokenValue = extractByTokens(lines, ['recompe', 'apurado'], 'recompeApurado');
    if (tokenValue) recompeApurado = tokenValue;
  }
  if (recompeApurado) header.recompeApurado = toNumber(recompeApurado);

  // recompeDepositado já será tratado mais abaixo, não redeclarar aqui

  let recompeDepositado = extractFieldFromLines(lines, [
    'RECOMPE (Depósitos Compensação Gratuidade Art.31,§ ún. Lei nº 15.424) Depositado:',
    'RECOMPE (Depósitos Compensação Gratuidade Art.31,§ ún. Lei nº 15.424) Depositado',
    'RECOMPE Depositado:',
    'RECOMPE Depositado',
    'Recompe Depositado:',
    'Recompe Depositado',
    'RECOMPE depositado:',
    'Recompe depositado:',
    'RECOMPE - Depositado',
    'Valor do RECOMPE Depositado',
    'Valor RECOMPE Depositado',
    'RECOMPE a Depositar',
    'Recompe a Depositar'
  ], 'recompeDepositado');
  if (!recompeDepositado) {
    const tokenValue = extractByTokens(lines, ['recompe', 'depositado'], 'recompeDepositado');
    if (tokenValue) recompeDepositado = tokenValue;
  }
  if (recompeDepositado) header.recompeDepositado = toNumber(recompeDepositado);

  const valoresRecebidosRecompe = extractFieldFromLines(lines, [
    'Valores Recebidos do RECOMPE',
    'Valores recebidos do RECOMPE',
    'Valores Recebidos RECOMPE',
    'Valores recebidos RECOMPE',
    'Valores recebidos - RECOMPE',
    'Total recebido RECOMPE'
  ], 'valoresRecebidosRecompe');
  if (valoresRecebidosRecompe) header.valoresRecebidosRecompe = toNumber(valoresRecebidosRecompe);

  const valoresRecebidosFerrfis = extractFieldFromLines(lines, [
    'Valores Recebidos do FERRFIS',
    'Valores recebidos do FERRFIS',
    'Valores Recebidos FERRFIS',
    'Valores recebidos FERRFIS',
    'Valores recebidos - FERRFIS',
    'Total recebido FERRFIS',
    'Valores Recebidos do Fundo',
    'Valores recebidos do Fundo'
  ], 'valoresRecebidosFerrfis');
  if (valoresRecebidosFerrfis) header.valoresRecebidosFerrfis = toNumber(valoresRecebidosFerrfis);

  // Data do depósito do RECOMPE
  let dataDepositoRecompe = extractDateByTokens(lines, ['data', 'dep', 'recompe'], 'dataDepositoRecompe');
  if (!dataDepositoRecompe) {
    // Try more explicit Portuguese words with accents variants
    dataDepositoRecompe = extractDateByTokens(lines, ['data', 'depósito', 'recompe'], 'dataDepositoRecompe')
      || extractDateByTokens(lines, ['data', 'deposito', 'recompe'], 'dataDepositoRecompe');
  }
  if (dataDepositoRecompe) header.dataDepositoRecompe = dataDepositoRecompe;

  const issqnRecebidoUsuarios = extractFieldFromLines(lines, [
    'ISSQN Recebido dos Usuários',
    'ISSQN Recebido dos Usuarios',
    'ISSQN recebido dos usuários',
    'ISSQN recebido dos usuarios',
    'ISSQN Recebido de Usuários'
  ]);
  if (issqnRecebidoUsuarios) header.issqnRecebidoUsuarios = toNumber(issqnRecebidoUsuarios);

  const repassesResponsaveisAnteriores = extractFieldFromLines(lines, [
    'Repasses dos Responsáveis Anteriores',
    'Repasses dos Responsaveis Anteriores',
    'Repasses de Responsáveis Anteriores',
    'Repasses Responsáveis Anteriores',
    'Repasses responsáveis anteriores',
    'Valores repassados de responsáveis anteriores',
    'Repasses anteriores',
    'Valores de repasses anteriores'
  ]);
  if (repassesResponsaveisAnteriores) header.repassesResponsaveisAnteriores = toNumber(repassesResponsaveisAnteriores);

  const saldoDepositoPrevio = extractFieldFromLines(lines, [
    'Saldo do Depósito Prévio',
    'Saldo do Deposito Previo',
    'Saldo Depósito Prévio',
    'Saldo Deposito Previo',
    'Saldo depósito prévio',
    'Saldo de depósito prévio',
    'Depósito Prévio - Saldo',
    'Saldo depositado anteriormente'
  ]);
  if (saldoDepositoPrevio) header.saldoDepositoPrevio = toNumber(saldoDepositoPrevio);

  const totalDespesasMes = extractFieldFromLines(lines, [
    'Total de Despesas do Mês',
    'Total de Despesas do Mes',
    'Total Despesas do Mês',
    'Total Despesas Mês',
    'Total despesas mês'
  ]);
  if (totalDespesasMes) header.totalDespesasMes = toNumber(totalDespesasMes);

  const estoqueSelosEletronicosTransmissao = extractFieldFromLines(lines, [
    'Estoque dos selos eletrônicos na data da transmissão da DAP:',
    'Estoque dos selos eletrônicos na data da transmissão da DAP',
    'Estoque de Selos Eletrônicos na Transmissão',
    'Estoque de Selos Eletronicos na Transmissao',
    'Estoque Selos Eletrônicos Transmissão',
    'Estoque selos eletrônicos',
    'Selos Eletrônicos'
  ]);
  if (estoqueSelosEletronicosTransmissao) header.estoqueSelosEletronicosTransmissao = toInteger(estoqueSelosEletronicosTransmissao);

  // Campo longo: "Estoque dos selos eletrônicos na data da transmissão da DAP:" seguido do número na mesma ou próxima linha.
  if (!header.estoqueSelosEletronicosTransmissao) {
    const estoqueLongo = extractByTokens(lines, ['estoque', 'selos', 'transmissão', 'dap'], 'estoqueSelosEletronicosTransmissao')
      || extractByTokens(lines, ['estoque', 'selos', 'transmissao', 'dap'], 'estoqueSelosEletronicosTransmissao');
    if (estoqueLongo) header.estoqueSelosEletronicosTransmissao = toInteger(estoqueLongo);
  }

  // Data de Depósito do RECOMPE - procura explicitamente pelo label completo
  let dataDepositoRecompeLabel = extractFieldFromLines(lines, [
    'Data de Depósito do RECOMPE',
    'Data de Deposito do RECOMPE',
    'Data Depósito RECOMPE',
    'Data Deposito RECOMPE'
  ], 'dataDepositoRecompe');
  if (dataDepositoRecompeLabel) {
    const norm = normalizeDate(dataDepositoRecompeLabel) || normalizeDate((dataDepositoRecompeLabel.split(' ')||[])[0]);
    if (norm) header.dataDepositoRecompe = norm;
  }
  if (!header.dataDepositoRecompe) {
    const dateToken = extractDateByTokens(lines, ['data', 'depósito', 'recompe'], 'dataDepositoRecompe')
      || extractDateByTokens(lines, ['data', 'deposito', 'recompe'], 'dataDepositoRecompe')
      || extractDateByTokens(lines, ['depósito', 'recompe'], 'dataDepositoRecompe')
      || extractDateByTokens(lines, ['deposito', 'recompe'], 'dataDepositoRecompe');
    if (dateToken) header.dataDepositoRecompe = dateToken;
  }

  return header;
}

function monthNameToNumber(name) {
  if (!name) return null;
  const m = String(name).trim().toLowerCase();
  const map = {
    janeiro: 1, jan: 1,
    fevereiro: 2, fev: 2,
    marco: 3, março: 3, mar: 3,
    abril: 4, abr: 4,
    maio: 5,
    junho: 6, jun: 6,
    julho: 7, jul: 7,
    agosto: 8, ago: 8,
    setembro: 9, set: 9, sept: 9,
    outubro: 10, out: 10,
    novembro: 11, nov: 11,
    dezembro: 12, dez: 12
  };
  return map[m] || null;
}

function normalizeDate(value) {
  if (!value) return null;
  const cleaned = value.trim().replace(/\//g, '-');
  const match = cleaned.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [ , dia, mes, ano ] = match;
  return `${ano}-${mes}-${dia}`;
}

function parsePeriodTotals(block) {
  const totals = {
    totalAtos: null,
    totalEmolumentos: null,
    totalTed: null,
    totalIss: null,
    totalLiquido: null,
    outrosCampos: {},
  };

  const atosMatch = block.match(/total\s+de\s+atos\s*[:\-]?\s*(\d+)/i);
  if (atosMatch) totals.totalAtos = toInteger(atosMatch[1]);

  const emolMatch = block.match(/emolumentos\s*[:\-]?\s*([\d\.,]+)/i);
  if (emolMatch) totals.totalEmolumentos = toNumber(emolMatch[1]);

  const tedMatch = block.match(/ted\s*[:\-]?\s*([\d\.,]+)/i);
  if (tedMatch) totals.totalTed = toNumber(tedMatch[1]);

  const issMatch = block.match(/iss\s*[:\-]?\s*([\d\.,]+)/i);
  if (issMatch) totals.totalIss = toNumber(issMatch[1]);

  const liquidoMatch = block.match(/l[ií]quido\s*[:\-]?\s*([\d\.,]+)/i);
  if (liquidoMatch) totals.totalLiquido = toNumber(liquidoMatch[1]);

  return totals;
}

// Normalize a single line extracted from pdf-parse
function normalizeLine(line) {
  if (!line) return '';
  return line
    .replace(/\u00A0/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Find last token that looks like a Brazilian monetary value (e.g. 1.234,56 or 123,45)
function findMonetaryToken(tokens) {
  if (!Array.isArray(tokens)) return null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i].replace(/R\$\s?/i, '');
    if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(t) || /^\d+,\d{2}$/.test(t)) {
      return { token: tokens[i], index: i };
    }
  }
  return null;
}

// Find first pure-integer token (quantity)
function findQuantityToken(tokens) {
  if (!Array.isArray(tokens)) return null;
  for (let i = 0; i < tokens.length; i++) {
    if (/^\d+$/.test(tokens[i])) return { token: tokens[i], index: i };
  }
  return null;
}

// Parse an ato from a single line using heuristics
function parseAtosFromLine(rawLine, toNumberFn) {
  const line = normalizeLine(rawLine);
  if (!line) return [];
  // Reject header/total lines
  if (/^(Trib|Código|Qtde|Subtotal|Total|Página|Período)/i.test(line)) return [];

  const results = [];
  // Find all 4-digit codes in the line (codes are always 4 digits)
  const codeRegex = /\b(\d{4})\b/g;
  let m;
  const matches = [];
  while ((m = codeRegex.exec(line)) !== null) {
    matches.push({ code: m[1], idx: m.index });
  }
  if (!matches.length) return [];

  for (let i = 0; i < matches.length; i++) {
    const code = matches[i].code;
    const start = matches[i].idx;
    const end = (i + 1 < matches.length) ? matches[i + 1].idx : line.length;
    const segment = line.slice(start, end).trim();

      // Espera colunas: CÓDIGO <sep> TRIBUTAÇÃO <sep> QUANTIDADE <sep> TFJ
      // Tolerante a separadores variados. TFJ pode ter R$ opcional.
      const segRegex = new RegExp('^(\d{4})\D+(\d{1,2})\D+(\d{1,3})\D+(?:R\$\s*)?([0-9\.,]+)');
      const segMatch = segment.match(segRegex);
      if (segMatch) {
        const codigoAto = segMatch[1];
        const tributacao = segMatch[2];
        const quantidade = toInteger(segMatch[3]) || 0;
        const tfj_valor = (typeof toNumberFn === 'function') ? toNumberFn(segMatch[4]) : toNumber(segMatch[4]);
        results.push({
          codigoAto,
          tributacao: String(tributacao).trim(),
          descricao: null,
          quantidade,
          emolumentos: null,
          tfjValor: tfj_valor ?? null,
          taxaIss: null,
          taxaCns: null,
          valorLiquido: null,
          detalhes: null,
        });
    } else {
      // fallback: try to capture numbers in order after code
      const nums = segment.match(/(\d{1,2}|\d{1,3}|[0-9\.,]+)/g) || [];
      // nums may include the code itself as first element
      const after = nums.slice(1); // drop the code
      // Try to find trib (1-2 digits), qty (1-3 digits), tfj (with comma)
      let trib = null; let qtd = 0; let tfj = null;
      for (const token of after) {
        if (!trib && /^\d{1,2}$/.test(token)) { trib = token; continue; }
        if (!qtd && /^\d{1,3}$/.test(token)) { qtd = toInteger(token) || 0; continue; }
        if (!tfj && (/\d{1,3}(?:\.\d{3})*,\d{2}/.test(token) || /\d+,\d{2}/.test(token))) { tfj = (typeof toNumberFn === 'function') ? toNumberFn(token) : toNumber(token); break; }
      }
      if (trib) {
        results.push({
          codigoAto: code,
          tributacao: String(trib).trim(),
          descricao: null,
          quantidade: qtd || 0,
          emolumentos: null,
          tfjValor: tfj ?? null,
          taxaIss: null,
          taxaCns: null,
          valorLiquido: null,
          detalhes: null,
        });
      }
    }
  }

  return results;
}

// Extract atos from a block by trying line-based heuristics
function extractAtosFromPeriodLines(block) {
  const lines = splitLines(block).filter(Boolean);
  const parsed = [];
  for (const l of lines) {
    const atos = parseAtosFromLine(l, toNumber);
    if (Array.isArray(atos) && atos.length) parsed.push(...atos);
  }
  return parsed;
}

function parseActs(block) {
  if (!block || typeof block !== 'string') return [];

  // 1) Try the stricter table regex (fast path)
  const strictActs = [];
  const lineRegex = /^\s*(\d{2,})\s+[\-–]\s*(.*?)\s+(\d{1,5})\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)/gim;
  let match;
  while ((match = lineRegex.exec(block)) !== null) {
    strictActs.push({
      codigoAto: match[1].trim(),
      descricao: match[2].trim(),
      quantidade: toInteger(match[3]),
      emolumentos: toNumber(match[4]),
      tfjValor: toNumber(match[5]),
      taxaIss: toNumber(match[6]),
      taxaCns: toNumber(match[7]),
      valorLiquido: toNumber(match[8]),
      detalhes: null,
    });
  }
  if (strictActs.length) return dedupeActs(strictActs);

  // 2) Try labeled fallback regex
  const labeledActs = [];
  const fallbackRegex = /^\s*(\d{2,})\s+(.*?)\s+Qtd\s*[:\-]?\s*(\d+)\s+Emol\s*[:\-]?\s*([\d\.,]+).*?TFJ\s*[:\-]?\s*([\d\.,]+).*?(ISS|TAXA ISS)\s*[:\-]?\s*([\d\.,]+).*?(CNS|TAXA CNS)\s*[:\-]?\s*([\d\.,]+).*?(L[ií]quido)\s*[:\-]?\s*([\d\.,]+)/gim;
  while ((match = fallbackRegex.exec(block)) !== null) {
    labeledActs.push({
      codigoAto: match[1].trim(),
      descricao: match[2].trim(),
      quantidade: toInteger(match[3]),
      emolumentos: toNumber(match[4]),
      tfjValor: toNumber(match[5]),
      taxaIss: toNumber(match[7]),
      taxaCns: toNumber(match[9]),
      valorLiquido: toNumber(match[11]),
      detalhes: null,
    });
  }
  if (labeledActs.length) return dedupeActs(labeledActs);

  // 3) Line-by-line heuristic parsing (more tolerant)
  const lineParsed = extractAtosFromPeriodLines(block);
  if (lineParsed && lineParsed.length) return dedupeActs(lineParsed.map(a => ({
    codigoAto: a.codigoAto,
    descricao: a.descricao,
    quantidade: a.quantidade,
    emolumentos: a.emolumentos,
    tfjValor: a.tfjValor,
    taxaIss: a.taxaIss,
    taxaCns: a.taxaCns,
    valorLiquido: a.valorLiquido,
    detalhes: a.detalhes,
  })));

  // 4) Last resort: the previous heuristic over the whole block
  const heuristic = parseActsHeuristic(block);
  return heuristic && heuristic.length ? dedupeActs(heuristic) : [];
}

function parseActsHeuristic(block) {
  const acts = [];
  if (!block || typeof block !== 'string') return acts;
  const codeRegex = /\b(\d{3,5})\b/g;
  let match;
  while ((match = codeRegex.exec(block)) !== null) {
    const code = match[1];
    const idx = match.index;
    // take a window of text after the code to find quantities and currency values
    const window = block.slice(idx, Math.min(block.length, idx + 300));
    // look for a small integer quantity
    const qtyMatch = window.match(/\b(\d{1,4})\b/);
    const quantidade = qtyMatch ? toInteger(qtyMatch[1]) : null;
    // look for currency patterns like R$ 1.234,56 or plain numbers that look like amounts
    const currencyMatch = window.match(/R\$\s*([\d\.,]+)/i) || window.match(/([\d\.,]+)\s*R\$/i);
    const valorLiquido = currencyMatch ? toNumber(currencyMatch[1]) : null;
    const emolMatch = window.match(/([\d\.,]+)\s*(?:TFJ|Emolumentos|Emol)/i);
    const emolumentos = emolMatch ? toNumber(emolMatch[1]) : null;

    acts.push({
      codigoAto: code,
      descricao: null,
      quantidade,
      emolumentos,
      taxaIss: null,
      taxaCns: null,
      valorLiquido,
      detalhes: null,
    });
  }
  return acts;
}


// Nova função: extrai atos por tabela de colunas (4 colunas = 4 períodos)
function extractAtosByColumnarTable(text) {
  // Procura a tabela de atos: linha que contenha pelo menos 4 grupos do padrão completo de ato
  const lines = splitLines(text).filter(Boolean);
  const colRegex = /(\d{4})\s+(\d{1,2})\s+(\d{1,3})\s+([0-9\.,]+)/g;
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    // Ignora linhas com hífens/barras (telefones/códigos)
    if (/[\/-]/.test(lines[i])) continue;
    // Conta quantos grupos completos de ato existem na linha
    let count = 0;
    colRegex.lastIndex = 0;
    while (colRegex.exec(lines[i]) !== null) count++;
    if (count >= 4) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) {
    if (DEBUG_EXTRACTION) console.log('[extractAtosByColumnarTable] Não encontrou linha inicial de tabela de atos.');
    return null;
  }

  const tableLines = [];
  for (let i = startIdx; i < lines.length; i++) {
    if (/[\/-]/.test(lines[i])) break; // fim da tabela se linha de telefone/código
    let count = 0;
    colRegex.lastIndex = 0;
    while (colRegex.exec(lines[i]) !== null) count++;
    if (count >= 1) {
      tableLines.push(lines[i]);
    } else {
      // Permite pequenas variações (ex: última linha pode ter menos colunas)
      if (tableLines.length > 0 && /\d{4}/.test(lines[i])) {
        tableLines.push(lines[i]);
      } else {
        break;
      }
    }
  }
  if (!tableLines.length) {
    if (DEBUG_EXTRACTION) console.log('[extractAtosByColumnarTable] Não encontrou linhas de tabela após startIdx.');
    return null;
  }

  if (DEBUG_EXTRACTION) {
    console.log(`[extractAtosByColumnarTable] Encontrou tabela de atos a partir da linha ${startIdx}. Total de linhas: ${tableLines.length}`);
    tableLines.forEach((l, idx) => console.log(`  [${idx}] ${l}`));
  }

  const periodAtos = [[], [], [], []];
  for (const [lineIdx, rawLine] of tableLines.entries()) {
    colRegex.lastIndex = 0;
    let match, colIdx = 0;
    if (DEBUG_EXTRACTION) console.log(`[extractAtosByColumnarTable] Linha ${lineIdx}: ${rawLine}`);
    while ((match = colRegex.exec(rawLine)) !== null && colIdx < 4) {
      const codigoAto = match[1];
      const tributacao = match[2];
      const quantidade = toInteger(match[3]) || 0;
      const tfj_valor = toNumber(match[4]);
      if (DEBUG_EXTRACTION) {
        console.log(`[extractAtosByColumnarTable]  Coluna ${colIdx + 1}:`);
        console.log(`    codigoAto: ${codigoAto}`);
        console.log(`    tributacao: ${tributacao}`);
        console.log(`    quantidade: ${quantidade}`);
        console.log(`    tfjValor: ${tfj_valor}`);
      }
      periodAtos[colIdx].push({
        codigoAto,
        tributacao: String(tributacao).trim(),
        descricao: null,
        quantidade,
        emolumentos: null,
        tfjValor: tfj_valor ?? null,
        taxaIss: null,
        taxaCns: null,
        valorLiquido: null,
        detalhes: null,
      });
      colIdx++;
    }
    if (DEBUG_EXTRACTION && colIdx === 0) console.log(`[extractAtosByColumnarTable]  Nenhuma coluna extraída nesta linha.`);
  }
  if (DEBUG_EXTRACTION) {
    periodAtos.forEach((atos, idx) => {
      console.log(`[extractAtosByColumnarTable] Período ${idx + 1}: ${atos.length} atos extraídos.`);
    });
  }
  return periodAtos.map((atos, idx) => ({ numero: idx + 1, atos: dedupeActs(atos) }));
}

function parsePeriods(text) {
  // 1. Tenta extrair por tabela de colunas (4 colunas = 4 períodos)
  const colPeriods = extractAtosByColumnarTable(text);
  if (colPeriods && colPeriods.some(p => p.atos && p.atos.length)) {
    return mergeDuplicatePeriods(colPeriods);
  }

  // 2. Fallback: parser sequencial por blocos
  const lines = splitLines(text).filter(Boolean);
  // Loga as linhas puras antes da extração
  console.log('==== LOG Fallback: Linhas puras do texto extraído ====');
  lines.forEach((line, idx) => {
    console.log(`Linha ${idx + 1}: ${line}`);
  });
  console.log('==== FIM LOG Fallback Linhas ====');

  // Parser sequencial por blocos
  const isCodigo = v => /^\d{4}$/.test(v);
  const isTrib = v => /^\d{1,2}$/.test(v);
  const isQtd = v => /^\d+$/.test(v);
  const isTFJ = v => /^\d+,\d{2}$/.test(v);
  const values = lines.map(l => l.trim()).filter(Boolean);
  let idx = 0;
  const atos = [];
  while (idx < values.length) {
    // 1. Busca blocos de códigos
    const codigos = [];
    let look = idx;
    while (look < values.length && codigos.length < 4) {
      if (isCodigo(values[look])) {
        codigos.push(values[look]);
        look++;
      } else {
        break;
      }
    }
    if (codigos.length === 0) { idx++; continue; }
    // 2. Busca N tributações
    const tribs = [];
    while (look < values.length && tribs.length < codigos.length) {
      if (isTrib(values[look])) {
        tribs.push(values[look]);
        look++;
      } else {
        look++;
      }
    }
    // 3. Busca N quantidades
    const qtds = [];
    while (look < values.length && qtds.length < codigos.length) {
      if (isQtd(values[look])) {
        qtds.push(values[look]);
        look++;
      } else {
        look++;
      }
    }
    // 4. Busca N TFJ
    const tfjs = [];
    while (look < values.length && tfjs.length < codigos.length) {
      if (isTFJ(values[look])) {
        tfjs.push(values[look]);
        look++;
      } else {
        look++;
      }
    }
    // 5. Monta atos se todos os campos foram encontrados
    if (tribs.length === codigos.length && qtds.length === codigos.length && tfjs.length === codigos.length) {
      for (let i = 0; i < codigos.length; i++) {
        atos.push({
          codigoAto: codigos[i],
          tributacao: tribs[i],
          descricao: null,
          quantidade: toInteger(qtds[i]),
          emolumentos: null,
          tfjValor: toNumber(tfjs[i]),
          taxaIss: null,
          taxaCns: null,
          valorLiquido: null,
          detalhes: null,
        });
      }
      idx = look;
    } else {
      // Se não encontrou bloco completo, avança 1
      idx++;
    }
  }
  if (atos.length > 0) {
    // Log detalhado dos atos extraídos para depuração
    console.log('==== LOG Fallback: Atos extraídos (sequencial/blocos) ====');
    atos.forEach((ato, idx) => {
      console.log(`Ato ${idx + 1}: codigo=${ato.codigoAto}, trib=${ato.tributacao}, qtd=${ato.quantidade}, tfj=${ato.tfjValor}`);
    });
    console.log('==== FIM LOG Fallback Blocos ====');
    return [{ numero: 1, atos }];
  }

  // Se ainda não encontrou nenhum ato, tentar fallback por blocos de 4 linhas após cada marcador de período
  const anyActsFallback = Array.isArray(periods) && periods.some(p => Array.isArray(p.atos) && p.atos.length > 0);
  if (!anyActsFallback) {
    // Fallback: processar blocos de 4 linhas após cada marcador de período
    const lines = splitLines(text).filter(Boolean);
    // Encontrar índices dos marcadores de período
    const periodoRegex = /Per[ií]odo\s*(\d+)\s*\(([^)]+)\)/i;
    const periodos = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(periodoRegex);
      if (m) {
        periodos.push({
          numero: parseInt(m[1], 10),
          faixa: m[2],
          startIdx: i
        });
      }
    }
    // Adicionar índice final para facilitar split
    for (let i = 0; i < periodos.length; i++) {
      periodos[i].endIdx = (i + 1 < periodos.length) ? periodos[i + 1].startIdx : lines.length;
    }
    // Para cada período, processar blocos de 4 linhas após o marcador
    const periodosDap = [];
    for (const periodo of periodos) {
      if (DEBUG_EXTRACTION) {
        console.log(`---- RAW PERÍODO ${periodo.numero} (primeiras linhas) ----`);
        for (let j = periodo.startIdx + 1; j < Math.min(periodo.endIdx, periodo.startIdx + 10); j++) {
          console.log(`${j - periodo.startIdx}: ${lines[j]}`);
        }
        console.log('---- FIM RAW PERÍODO ----');
      }
      const atos = [];
      let i = periodo.startIdx + 1;
      while (i + 3 < periodo.endIdx) {
        // Preencher campos vazios explicitamente com 'XXX'
        const bloco = [lines[i], lines[i + 1], lines[i + 2], lines[i + 3]].map(v => {
          if (v === undefined || v === null || String(v).trim() === '') return 'XXX';
          return String(v).trim();
        });
        const [codigo, trib, qtd, tfj] = bloco;
        // Validar se é um código de ato (4 dígitos)
        if (/^\d{4}$/.test(codigo)) {
          atos.push({
            codigoAto: codigo,
            tributacao: trib,
            descricao: null,
            quantidade: toInteger(qtd),
            emolumentos: null,
            tfjValor: toNumber(tfj),
            taxaIss: null,
            taxaCns: null,
            valorLiquido: null,
            detalhes: null,
          });
          i += 4;
        } else {
          i++;
        }
      }
      periodosDap.push({
        numero: periodo.numero,
        atos
      });
    }
    if (periodosDap.some(p => p.atos.length > 0)) {
      return periodosDap;
    }
  }
  // Se ainda não encontrou nenhum ato, tentar fallback por blocos de 4 linhas após cada marcador de período
  const anyActs = Array.isArray(periods) && periods.some(p => Array.isArray(p.atos) && p.atos.length > 0);
  if (!anyActs) {
    // Fallback: processar blocos de 4 linhas após cada marcador de período
    const lines = splitLines(text).filter(Boolean);
    // Encontrar índices dos marcadores de período
    const periodoRegex = /Per[ií]odo\s*(\d+)\s*\(([^)]+)\)/i;
    const periodos = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(periodoRegex);
      if (m) {
        periodos.push({
          numero: parseInt(m[1], 10),
          faixa: m[2],
          startIdx: i
        });
      }
    }
    // Adicionar índice final para facilitar split
    for (let i = 0; i < periodos.length; i++) {
      periodos[i].endIdx = (i + 1 < periodos.length) ? periodos[i + 1].startIdx : lines.length;
    }
    // Para cada período, processar blocos de 4 linhas após o marcador
    const periodosDap = [];
    for (const periodo of periodos) {
      if (DEBUG_EXTRACTION) {
        console.log(`---- RAW PERÍODO ${periodo.numero} (primeiras linhas) ----`);
        for (let j = periodo.startIdx + 1; j < Math.min(periodo.endIdx, periodo.startIdx + 10); j++) {
          console.log(`${j - periodo.startIdx}: ${lines[j]}`);
        }
        console.log('---- FIM RAW PERÍODO ----');
      }
      const atos = [];
      let i = periodo.startIdx + 1;
      while (i + 3 < periodo.endIdx) {
        const codigo = lines[i]?.trim();
        const trib = lines[i + 1]?.trim();
        const qtd = lines[i + 2]?.trim();
        const tfj = lines[i + 3]?.trim();
        // Validar se é um código de ato (4 dígitos)
        if (/^\d{4}$/.test(codigo)) {
          atos.push({
            codigoAto: codigo,
            tributacao: trib,
            descricao: null,
            quantidade: toInteger(qtd),
            emolumentos: null,
            tfjValor: toNumber(tfj),
            taxaIss: null,
            taxaCns: null,
            valorLiquido: null,
            detalhes: null,
          });
          i += 4;
        } else {
          i++;
        }
      }
      periodosDap.push({
        numero: periodo.numero,
        atos
      });
    }
    if (periodosDap.some(p => p.atos.length > 0)) {
      return periodosDap;
    }
    // Se ainda não encontrou, tenta fallback OCR se for PDF
    if (typeof text === 'string' && text.startsWith('file:')) {
      // Não implementado: chamada OCR automática para arquivos PDF
    }
  }
  return mergeDuplicatePeriods(periods);
}

function mergeDuplicatePeriods(periods) {
  if (!Array.isArray(periods)) return [];
  const map = new Map();
  for (const periodo of periods) {
    if (!periodo || typeof periodo.numero !== 'number') continue;
    const key = periodo.numero;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        numero: key,
        totalAtos: periodo.totalAtos ?? null,
        totalEmolumentos: periodo.totalEmolumentos ?? null,
        totalTed: periodo.totalTed ?? null,
        totalIss: periodo.totalIss ?? null,
        totalLiquido: periodo.totalLiquido ?? null,
        outrosCampos: { ...(periodo.outrosCampos || {}) },
        atos: dedupeActs(periodo.atos),
      });
    } else {
      existing.totalAtos = existing.totalAtos ?? periodo.totalAtos ?? null;
      existing.totalEmolumentos = existing.totalEmolumentos ?? periodo.totalEmolumentos ?? null;
      existing.totalTed = existing.totalTed ?? periodo.totalTed ?? null;
      existing.totalIss = existing.totalIss ?? periodo.totalIss ?? null;
      existing.totalLiquido = existing.totalLiquido ?? periodo.totalLiquido ?? null;
      existing.outrosCampos = { ...(existing.outrosCampos || {}), ...(periodo.outrosCampos || {}) };
      if (Array.isArray(periodo.atos) && periodo.atos.length) {
        existing.atos = dedupeActs((existing.atos || []).concat(periodo.atos));
      }
    }
  }
  return Array.from(map.values());
}

function dedupeActs(acts) {
  if (!Array.isArray(acts)) return [];
  const seen = new Set();
  const result = [];
  for (const ato of acts) {
    if (!ato) continue;
    const key = [
      String(ato.codigoAto || '').trim(),
      String(ato.quantidade ?? '').trim(),
      String(ato.tfjValor ?? '').trim(),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ato);
  }
  return result;
}

function validateParsedDap(data) {
  if (!data.header) throw createParseError('Cabeçalho ausente no documento.');
  // Try to infer ano/mes from data_emissao if present
  if ((!data.header.ano || !data.header.mes) && data.header.dataEmissao) {
    const d = data.header.dataEmissao;
    const m = d && d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      data.header.ano = data.header.ano || toInteger(m[1]);
      data.header.mes = data.header.mes || toInteger(m[2]);
    }
  }
  // Ensure tipo defaults to ORIGINAL when not explicitly detected
  data.header.tipo = data.header.tipo || 'ORIGINAL';
  if (!data.header.ano || !data.header.mes) {
    throw createParseError('Cabeçalho incompleto. Certifique-se de que o PDF contém ano e mês (competência) ou uma data de emissão válida.');
  }
  return data;
}

function createParseError(message) {
  const err = new Error(message);
  err.name = 'DapParseError';
  return err;
}

function parseDapText(text) {
  if (!text || !text.trim()) {
    throw createParseError('PDF vazio ou sem texto legível.');
  }
  const header = extractHeader(text);
  // If debug enabled, scan the whole document for candidate ato lines (4-digit codes or patterns)
  if (DEBUG_EXTRACTION) {
    try {
      console.log('---- DEBUG SCAN: procurando linhas com possíveis atos (4 dígitos, padrões) ----');
      const allLines = splitLines(text);
      const candidates = [];
      for (let i = 0; i < allLines.length; i++) {
        const ln = allLines[i];
        if (!ln) continue;
        // lines that contain 4-digit groups or the word 'TFJ' or 'Emol' or 'Qtd' or pattern like '0001 -'
        if (/\b\d{4}\b/.test(ln) || /\bTFJ\b/i.test(ln) || /Emol/i.test(ln) || /\bQtd\b/i.test(ln) || /\b\d{1,4}\s*[-–]\s*/.test(ln)) {
          candidates.push({ idx: i + 1, line: ln });
          if (candidates.length >= 80) break;
        }
      }
      if (candidates.length) {
        console.log(`Found ${candidates.length} candidate lines (showing up to 80):`);
        candidates.slice(0, 80).forEach((c) => {
          const contextStart = Math.max(0, c.idx - 3 - 1);
          const contextEnd = Math.min(allLines.length, c.idx + 2);
          console.log(`-- Line ${c.idx}: ${c.line}`);
          for (let j = contextStart; j < contextEnd; j++) {
            if (j === c.idx - 1) continue; // already printed as main
            console.log(`   ${j + 1}: ${allLines[j]}`);
          }
        });
      } else {
        console.log('No candidate ato-like lines found in full text scan.');
      }
      console.log('---- FIM DEBUG SCAN ----');
    } catch (err) {
      console.log('DEBUG scan failed:', err);
    }
  }

  const periods = parsePeriods(text);
  // LOG: Mostra os períodos parseados (pdf-parse)
  console.log('==== [DAP] Períodos extraídos via pdf-parse ====');
  console.log(`Total de períodos encontrados: ${periods.length}`);
  periods.forEach((p, idx) => {
    console.log(`[pdf-parse][Período ${idx + 1}] numero: ${p.numero}, atos: ${p.atos ? p.atos.length : 0}`);
    if (p.atos && p.atos.length > 0) {
      p.atos.slice(0, 3).forEach((ato, atoIdx) => {
        console.log(`  Ato ${atoIdx + 1}: codigo=${ato.codigoAto}, desc="${ato.descricao?.substring(0, 30)}...", qtd=${ato.quantidade}, tfj=${ato.tfjValor}`);
      });
      if (p.atos.length > 3) console.log(`  ... e mais ${p.atos.length - 3} atos`);
    }
  });
  console.log('==== FIM [DAP] Períodos via pdf-parse ====\n');
  
  const metadata = {
    rawTextLength: text.length,
    hasPeriods: periods.length > 0,
  };
  const payload = {
    header,
    periods,
    metadata,
  };
  return validateParsedDap(payload);
}

function inferTributacao(descricao) {
  if (!descricao) return '0';
  const d = String(descricao).toLowerCase();
  // Heuristics: if description contains 'grat' or 'isenta', mark as 1 (gratuita) else 0 (normal)
  if (/grat|isenta|isento/.test(d)) return '1';
  return '0';
}

function inferTfjValor(ato) {
  // If we parsed a TFJ column explicitly (tfjValor), use it
  if (ato && typeof ato.tfjValor !== 'undefined' && ato.tfjValor !== null) return ato.tfjValor;
  // Otherwise, try to infer: some tables present order: Emol, TFJ, ISS, CNS, Liquido
  // If we captured three taxes (ISS, CNS) and a valorLiquido, we can't reliably compute TFJ; fallback 0
  return 0;
}

async function parseDapPdf(input) {
  // Accept either a Buffer directly, or an object with { buffer, data, metadata, filename, ... }
  const buf = Buffer.isBuffer(input)
    ? input
    : (input && Buffer.isBuffer(input.buffer))
      ? input.buffer
      : (input && input.data)
        ? input.data
        : null;

  const metadata = (input && input.metadata) || {};
  
  function composeServentiaNome(baseName, city) {
    if (!baseName) return baseName || null;
    const b = String(baseName || '').trim();
    const c = city ? String(city || '').trim() : null;
    if (!c) return b;
    // If base already ends with the city (case-insensitive) or already contains ' de ' followed by city, return as-is
    const lowerB = b.toLowerCase();
    const lowerC = c.toLowerCase();
    if (lowerB.endsWith(lowerC) || lowerB.includes(` de ${lowerC}`) || lowerB.includes(`, ${lowerC}`)) return b;
    // Otherwise append ' de <city>' ensuring no double spaces
    return `${b} de ${c}`;
  }
  let text = '';
  try {
    if (!buf) {
      throw createParseError('Arquivo da DAP não fornecido ou inválido (buffer ausente).');
    }
    const result = await pdfParse(buf);
    text = result && result.text ? result.text : '';

    // Extrai header normalmente
    const parsed = parseDapText(text); // { header: { ano, mes, ... }, periods: [...] }
    const headerIn = parsed.header || {};
    // Try to extract municipality/city from metadata or raw text lines so we can
    // append it to the serventia name (e.g. "Registro Civil... de Lavras").
    let cidadeCandidate = metadata.cidade ?? metadata.municipio ?? null;
    try {
      const _lines = splitLines(text).filter(Boolean);
      const cidadeFound = extractFieldFromLines(_lines, ['Município', 'Município ou distrito', 'Municipio ou distrito', 'Comarca', 'Cidade']);
      if (cidadeFound) cidadeCandidate = cidadeCandidate || cidadeFound;
    } catch (e) {
      // ignore
    }
    try {
      console.log(`==== [parseDapPdf] cidadeCandidate detected: ${cidadeCandidate}`);
    } catch (e) {
      // ignore logging errors
    }
    const headerOut = {
      mesReferencia: headerIn.mes ?? metadata.mesReferencia ?? metadata.mes_referencia ?? null,
      anoReferencia: headerIn.ano ?? metadata.anoReferencia ?? metadata.ano_referencia ?? null,
      // Compose serventiaNome from base name + city when available
      serventiaNome: composeServentiaNome(
        metadata.serventiaNome ?? metadata.serventia ?? headerIn.serventiaNome ?? headerIn.serventia ?? null,
        cidadeCandidate
      ),
      codigoServentia: metadata.codigoServentia ?? metadata.codigo_serventia ?? headerIn.codigoServentia ?? null,
      cnpj: metadata.cnpj ?? metadata.cnpjNumero ?? headerIn.cnpj ?? null,
      dataTransmissao: metadata.dataTransmissao ?? metadata.data_transmissao ?? headerIn.dataTransmissao ?? null,
      codigoRecibo: metadata.codigoRecibo ?? metadata.codigo_recibo ?? headerIn.codigoRecibo ?? null,
      observacoes: metadata.observacoes ?? headerIn.observacoes ?? null,
      retificadora: (typeof metadata.retificadora !== 'undefined')
        ? !!metadata.retificadora
        : (typeof headerIn.retificadora !== 'undefined')
          ? !!headerIn.retificadora
          : (headerIn.tipo === 'RETIFICADORA'),
      emolumentoApurado: metadata.emolumentoApurado ?? headerIn.emolumentoApurado ?? null,
      taxaFiscalizacaoJudiciariaApurada: metadata.taxaFiscalizacaoJudiciariaApurada ?? headerIn.taxaFiscalizacaoJudiciariaApurada ?? null,
      taxaFiscalizacaoJudiciariaPaga: metadata.taxaFiscalizacaoJudiciariaPaga ?? headerIn.taxaFiscalizacaoJudiciariaPaga ?? null,
      recompeApurado: metadata.recompeApurado ?? headerIn.recompeApurado ?? null,
      recompeDepositado: metadata.recompeDepositado ?? headerIn.recompeDepositado ?? null,
      dataDepositoRecompe: metadata.dataDepositoRecompe ?? headerIn.dataDepositoRecompe ?? null,
      valoresRecebidosRecompe: metadata.valoresRecebidosRecompe ?? headerIn.valoresRecebidosRecompe ?? null,
      valoresRecebidosFerrfis: metadata.valoresRecebidosFerrfis ?? headerIn.valoresRecebidosFerrfis ?? null,
      issqnRecebidoUsuarios: metadata.issqnRecebidoUsuarios ?? headerIn.issqnRecebidoUsuarios ?? null,
      repassesResponsaveisAnteriores: metadata.repassesResponsaveisAnteriores ?? headerIn.repassesResponsaveisAnteriores ?? null,
      saldoDepositoPrevio: metadata.saldoDepositoPrevio ?? headerIn.saldoDepositoPrevio ?? null,
      totalDespesasMes: metadata.totalDespesasMes ?? headerIn.totalDespesasMes ?? null,
      estoqueSelosEletronicosTransmissao: metadata.estoqueSelosEletronicosTransmissao ?? headerIn.estoqueSelosEletronicosTransmissao ?? null,
    };

    // Prefer the atos parsed already by parseDapText (more tolerant heuristics).
    // If parseDapText produced periods with atos, reuse them (normalized). Only
    // fall back to the stricter line-based 4-lines heuristic when no atos were
    // found by parseDapText.
    let periodosOut = [];
    if (Array.isArray(parsed.periods) && parsed.periods.some(p => Array.isArray(p.atos) && p.atos.length > 0)) {
      periodosOut = parsed.periods.map((p, idx) => ({
        ordem: p.numero ?? p.ordem ?? idx + 1,
        atos: (p.atos || []).map((a) => ({
          codigo: a.codigoAto ?? a.codigo ?? a.codigoAto ?? null,
          tributacao: a.tributacao ?? a.tributacao ?? null,
          quantidade: a.quantidade ?? a.qtd ?? 0,
          tfj_valor: a.tfjValor ?? a.tfj_valor ?? a.tfj ?? null,
        })),
      }));
    } else {
      // Nova lógica: para cada linha que é código de ato (4 dígitos), pega as próximas 3 linhas como trib, qtd, tfj
      const lines = splitLines(text).filter(Boolean);
      const codigoRegex = /^\d{4}$/;
      const atos = [];
      for (let i = 0; i < lines.length - 3; i++) {
        const codigo = lines[i].trim();
        if (!codigoRegex.test(codigo)) continue;
        const tribRaw = lines[i + 1] ? lines[i + 1].trim() : '';
        const qtdRaw = lines[i + 2] ? lines[i + 2].trim() : '';
        const tfjRaw = lines[i + 3] ? lines[i + 3].trim() : '';

        // trib: só aceita 1 ou 2 dígitos
        const trib = /^[0-9]{1,2}$/.test(tribRaw) ? parseInt(tribRaw, 10) : null;
        // qtd: só aceita 1 a 3 dígitos (1-999)
        const qtd = /^[0-9]{1,3}$/.test(qtdRaw) ? parseInt(qtdRaw, 10) : null;
        // tfj pode ser valor monetário ou inteiro
        let tfj = null;
        if (/^\d{1,6}(,\d{2})?$/.test(tfjRaw)) {
          tfj = parseFloat(tfjRaw.replace(',', '.'));
        } else if (/^\d+$/.test(tfjRaw)) {
          tfj = parseInt(tfjRaw, 10);
        }

        // Só adiciona se trib e qtd forem válidos, qtd entre 1 e 999, e qtd diferente do código
        if (
          trib !== null &&
          qtd !== null &&
          qtd >= 1 &&
          qtd <= 999 &&
          qtd !== parseInt(codigo, 10)
        ) {
          atos.push({
            codigo,
            tributacao: trib,
            quantidade: qtd,
            tfj_valor: tfj ?? 0
          });
        }
      }
      periodosOut = [ { ordem: 1, atos } ];
    }

    // LOG: Mostra todos os atos extraídos para cada período
    console.log('==== PERÍODOS MAPEADOS PARA DB ====');
    console.log(`Total de períodos: ${periodosOut.length}`);
    periodosOut.forEach((p, idx) => {
      console.log(`\n[Período ${idx + 1}] ordem: ${p.ordem}, atos: ${p.atos.length}`);
      if (p.atos.length > 0) {
        p.atos.forEach((ato, atoIdx) => {
          console.log(`  Ato ${atoIdx + 1}: codigo=${ato.codigo}, trib=${ato.tributacao}, qtd=${ato.quantidade}, tfj=${ato.tfj_valor}`);
        });
      } else {
        console.log('  ⚠️ Nenhum ato mapeado para este período');
      }
    });
  console.log('==== FIM PERÍODOS MAPEADOS ====');

    // If required fields are still missing, raise a targeted parse error so caller can provide metadata
    if (!headerOut.mesReferencia || !headerOut.anoReferencia) {
      throw createParseError('Não foi possível determinar mês/ano da competência. Informe-os via metadata (mesReferencia, anoReferencia).');
    }
    if (!headerOut.serventiaNome || !headerOut.codigoServentia) {
      throw createParseError('Informações da serventia ausentes. Informe via metadata (serventiaNome, codigoServentia).');
    }

    return {
      header: headerOut,
      periodosDap: periodosOut,
      metadata: { ...(parsed.metadata || {}), filename: input && input.filename },
    };
  } catch (err) {
    // If the parsing step discovered a DapParseError (e.g. header missing),
    // attach the extracted text to the error so callers can build a readable preview.
    if (err && err.name === 'DapParseError') {
      try { err.extractedText = text; } catch (_) {}
      throw err;
    }
    const wrapped = createParseError('Falha ao extrair texto do PDF para a DAP.');
    wrapped.cause = err;
    throw wrapped;
  }
}

module.exports = {
  // extractTabelaAtosViaOcr, // OCR removido
  parseDapEmDuasEtapas,
  parseDapPdf,
  parseDapText,
  // parseDapSomenteTesseract, // OCR removido
  normalizeDate,
};
