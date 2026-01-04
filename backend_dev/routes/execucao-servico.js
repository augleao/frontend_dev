const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const Tesseract = require('tesseract.js');
const pool = require('../db');
const { authenticate } = require('../middlewares/auth');

// Upload handler for images/text used by selo OCR route
const upload = multer({
  dest: path.join(__dirname, '..', 'uploads'),
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/bmp',
      'image/gif',
      'image/webp',
      'text/plain', // permite a string do selo vinda da área de transferência
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Apenas arquivos de imagem, texto ou PDF são permitidos!'));
  },
});

// Copiado de server.js para manter o mesmo algoritmo de extração de dados de selo
function extrairDadosSeloMelhorado(texto) {
  const seloMatch = texto.match(/SELO\s+DE\s+CONSULTA[:\s]*([A-Z0-9]+)/i);
  const seloConsulta = seloMatch ? seloMatch[1] : '';

  const codigoMatch = texto.match(/(\d{4}\.\d{4}\.\d{4}\.\d{4})/);
  const codigoSeguranca = codigoMatch ? codigoMatch[1] : '';

  let qtdAtosFinal = null;
  const qtdBaseMatch = texto.match(/Quantidade\s+de\s+atos\s+praticados[:\s]*(\d+)/i);
  if (qtdBaseMatch) {
    const qtdBase = qtdBaseMatch[1];
    const linhaAtosMatch = texto.match(new RegExp(qtdBase + "[^\\n]*\\)"));
    if (linhaAtosMatch) {
      qtdAtosFinal = linhaAtosMatch[0].replace(/\s+[a-z]{2,}\s*$/i, '').trim();
    } else {
      qtdAtosFinal = qtdBase;
    }
  }

  let atosPraticadosPor = '';
  const atosPorMatch = texto.match(/por[:\s]*(.*?)(?:\s*-|\n|\r)/i);
  if (atosPorMatch && atosPorMatch[1]) {
    atosPraticadosPor = atosPorMatch[1].trim();
  }

  let valores = '';
  const linha1Match = texto.match(/^.*Emol[:\s].*R\$.*$/im);
  const linha2Match = texto.match(/^.*Total[:\s].*R\$.*$/im);

  let linha1Limpa = '';
  let linha2Limpa = '';

  if (linha1Match) {
    linha1Limpa = linha1Match[0]
      .replace(/.*(Emol[:\s].*)/i, '$1')
      .replace(/- - fETEFGSTAS/i, '')
      .trim();
  }

  if (linha2Match) {
    linha2Limpa = linha2Match[0]
      .replace(/fsTetatras/i, '')
      .trim();
  }

  if (linha1Limpa && linha2Limpa) {
    valores = `${linha1Limpa} - ${linha2Limpa}`;
  } else if (linha1Limpa) {
    valores = linha1Limpa;
  } else if (linha2Limpa) {
    valores = linha2Limpa;
  }

  valores = valores
    .replace(/- 188:/i, '- ISS:')
    .replace(/\s\s+/g, ' ')
    .trim();

  const resultado = {
    seloConsulta,
    codigoSeguranca,
    qtdAtos: qtdAtosFinal,
    atosPraticadosPor,
    valores,
    textoCompleto: texto,
  };

  try { console.log('[OCR] Resultado da extração (v6 - Final):', resultado); } catch (_) {}
  return resultado;
}

function registerExecucaoServicoRoutes(app, opts = {}) {
  const guard = opts.authenticateAdmin || authenticate; // fallback para authenticate simples

  // DELETE /api/execucao-servico/:id
  app.delete('/api/execucao-servico/:id', guard, async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM selos_execucao_servico WHERE execucao_servico_id = $1', [id]);
      const result = await pool.query('DELETE FROM execucao_servico WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Execução de serviço não encontrada' });
      }
      res.json({ message: 'Execução de serviço removida com sucesso', execucao: result.rows[0] });
    } catch (err) {
      try { console.error('Erro ao remover execução de serviço:', err); } catch(_){ }
      res.status(500).json({ error: 'Erro ao remover execução de serviço', details: err.message });
    }
  });

  // POST /api/execucao-servico
  app.post('/api/execucao-servico', guard, async (req, res) => {
    const { protocolo, usuario, data, observacoes } = req.body || {};

    if (!protocolo || !usuario) {
      return res.status(400).json({ error: 'protocolo e usuario são obrigatórios' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO execucao_servico (protocolo, usuario, data, observacoes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [protocolo, usuario, data || new Date(), observacoes || null]
      );
      return res.status(201).json({ execucaoId: result.rows[0].id });
    } catch (err) {
      try { console.error('Erro ao criar execução de serviço:', err); } catch(_){ }
      return res.status(500).json({ error: 'Erro ao criar execução de serviço', details: err.message });
    }
  });

  // GET /api/execucao-servico/:protocolo
  app.get('/api/execucao-servico/:protocolo', guard, async (req, res) => {
    const { protocolo } = req.params;
    try {
      const execucaoResult = await pool.query(
        'SELECT * FROM execucao_servico WHERE protocolo = $1',
        [protocolo]
      );
      if (execucaoResult.rows.length === 0) {
        return res.status(404).json({ error: 'Execução de serviço não encontrada' });
      }
      const execucao = execucaoResult.rows[0];

      const selosResult = await pool.query(
        'SELECT * FROM selos_execucao_servico WHERE execucao_servico_id = $1 ORDER BY id ASC',
        [execucao.id]
      );
      execucao.selos = selosResult.rows;

      return res.json(execucao);
    } catch (err) {
      try { console.error('Erro ao buscar execução de serviço:', err); } catch(_){ }
      return res.status(500).json({ error: 'Erro ao buscar execução de serviço', details: err.message });
    }
  });

  // PUT /api/execucao-servico/:id
  app.put('/api/execucao-servico/:id', guard, async (req, res) => {
    const { id } = req.params;
    const { data, observacoes, status } = req.body || {};
    try {
      const result = await pool.query(
        `UPDATE execucao_servico
         SET data = $1, observacoes = $2, status = $3
         WHERE id = $4
         RETURNING *`,
        [data, observacoes, status, id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Execução não encontrada' });
      }
      res.json({ execucao: result.rows[0] });
    } catch (err) {
      try { console.error('Erro ao atualizar execução:', err); } catch(_){ }
      res.status(500).json({ error: 'Erro ao atualizar execução' });
    }
  });

  // GET /api/selos-execucao-servico/:protocolo (sem autenticação - manter compatibilidade com server.js antigo)
  app.get('/api/selos-execucao-servico/:protocolo', async (req, res) => {
    const { protocolo } = req.params;
    try {
      const result = await pool.query(
        'SELECT * FROM selos_execucao_servico WHERE execucao_servico_id = $1 ORDER BY criado_em DESC',
        [protocolo]
      );
      res.json({ selos: result.rows });
    } catch (err) {
      try { console.error('Erro ao listar selos-execucao-servico:', err); } catch(_){ }
      res.status(500).json({ error: 'Erro ao listar selos-execucao-servico' });
    }
  });

  // PUT /api/selos-execucao-servico/:id (sem autenticação - manter compatibilidade com server.js antigo)
  app.put('/api/selos-execucao-servico/:id', async (req, res) => {
    const { id } = req.params;
    const { selo_consulta, codigo_seguranca, qtd_atos, atos_praticados_por, valores } = req.body || {};
    try {
      const result = await pool.query(
        `UPDATE selos_execucao_servico
         SET selo_consulta = $1,
             codigo_seguranca = $2,
             qtd_atos = $3,
             atos_praticados_por = $4,
             valores = $5
         WHERE id = $6
         RETURNING *`,
        [selo_consulta, codigo_seguranca, qtd_atos, atos_praticados_por, valores, id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Selo não encontrado' });
      }
      res.json({ selo: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar selo' });
    }
  });

  // POST /api/execucaoservico/:execucaoId/selo (observação: path sem hífen conforme original)
app.post('/api/execucaoservico/:execucaoId/selo', guard, upload.single('imagem'), async (req, res) => {
  const { execucaoId } = req.params;

  if (!execucaoId || execucaoId === 'undefined' || execucaoId === '') {
    try { console.error('[BACKEND] execucaoId inválido:', execucaoId); } catch (_) {}
    return res.status(400).json({ error: 'execucaoId inválido' });
  }

  const { originalname, path: tmpPath } = req.file || {};
  const conteudoSelo = typeof req.body?.conteudo_selo === 'string' ? req.body.conteudo_selo.trim() : '';

  // read codigo tributario if provided (supports both form field names)
  let codigoTributario = null;
  if (typeof req.body?.codigo_tributario === 'string' && req.body.codigo_tributario.trim() !== '') {
    codigoTributario = req.body.codigo_tributario.trim();
  } else if (typeof req.body?.codigoTributario === 'string' && req.body.codigoTributario.trim() !== '') {
    codigoTributario = req.body.codigoTributario.trim();
  }

  try { console.log('[BACKEND] Recebido POST /api/execucaoservico/:execucaoId/selo'); } catch(_){ }
  try { console.log('[BACKEND] execucaoId:', execucaoId); } catch(_){ }
  try { console.log('[BACKEND] req.file:', req.file); } catch(_){ }
  try { console.log('[BACKEND] req.body:', req.body); } catch(_){ }

  try {
    let textoParaProcessar = '';

    if (conteudoSelo) {
      try { console.log('[BACKEND] Processando selo recebido via área de transferência.'); } catch(_){ }
      textoParaProcessar = conteudoSelo;
      if (tmpPath) { await fsp.unlink(tmpPath).catch(() => {}); }
    } else {
      if (!req.file) {
        try { console.error('[BACKEND] Nenhum arquivo enviado!'); } catch(_){ }
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      try { console.log('[BACKEND] Nenhum texto direto. Realizando OCR na imagem:', originalname); } catch(_){ }

      const ocrResult = await Tesseract.recognize(tmpPath, 'por', {
        logger: (m) => { try { console.log('[OCR Progress]', m); } catch(_){} },
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ:.,- ()',
      });

      textoParaProcessar = (ocrResult.data.text || '').trim();
      try { console.log('[BACKEND] Texto extraído do OCR:', textoParaProcessar); } catch(_){ }

      await fsp.unlink(tmpPath).catch(() => {});
    }

    if (!textoParaProcessar) {
      try { console.error('[BACKEND] Não foi possível extrair conteúdo do selo.'); } catch(_){ }
      return res.status(400).json({ error: 'Não foi possível extrair conteúdo do selo' });
    }

    const dadosExtraidos = extrairDadosSeloMelhorado(textoParaProcessar);
    try { console.log('[BACKEND] Dados extraídos do selo:', dadosExtraidos); } catch(_){ }

    // Inserção incluindo codigo_tributario quando disponível
    const result = await pool.query(
      `INSERT INTO selos_execucao_servico
        (execucao_servico_id, selo_consulta, codigo_seguranca, qtd_atos, atos_praticados_por, valores, codigo_tributario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        execucaoId,
        dadosExtraidos.seloConsulta,
        dadosExtraidos.codigoSeguranca,
        dadosExtraidos.qtdAtos,
        dadosExtraidos.atosPraticadosPor,
        dadosExtraidos.valores,
        codigoTributario, // pode ser null — o DB aceitará
      ]
    );

    try { console.log('[BACKEND] Selo salvo:', result.rows[0]); } catch(_){ }
    res.json(result.rows[0]);
  } catch (err) {
    try { console.error('[BACKEND] Erro ao processar selo:', err); } catch(_){ }
    res.status(500).json({ error: 'Erro ao processar selo' });
  }
});

  // GET /api/execucao-servico/:execucaoId/selos
app.get('/api/execucao-servico/:execucaoId/selos', guard, async (req, res) => {
  const { execucaoId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id,
              imagem_url AS "imagemUrl",
              selo_consulta AS "seloConsulta",
              codigo_seguranca AS "codigoSeguranca",
              qtd_atos AS "qtdAtos",
              atos_praticados_por AS "atosPraticadosPor",
              valores,
              codigo_tributario AS "codigo_tributario",
              codigo_tributario AS "codigoTributario"
         FROM selos_execucao_servico
        WHERE execucao_servico_id = $1
        ORDER BY id ASC`,
      [execucaoId]
    );
    res.json(result.rows);
  } catch (err) {
    try { console.error('Erro ao buscar selos:', err); } catch(_){ }
    res.status(500).json({ error: 'Erro ao buscar selos eletrônicos' });
  }
});

  // DELETE /api/execucao-servico/:execucaoId/selo/:seloId
  app.delete('/api/execucao-servico/:execucaoId/selo/:seloId', guard, async (req, res) => {
    const { execucaoId, seloId } = req.params;
    try {
      const result = await pool.query(
        `DELETE FROM selos_execucao_servico
          WHERE id = $1 AND execucao_servico_id = $2
          RETURNING *`,
        [seloId, execucaoId]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Selo não encontrado' });
      }
      res.json({ success: true, deleted: result.rows[0] });
    } catch (err) {
      try { console.error('Erro ao deletar selo:', err); } catch(_){ }
      res.status(500).json({ error: 'Erro ao deletar selo eletrônico' });
    }
  });

  // POST /api/teste-ocr (rota de teste de OCR)
  app.post('/api/teste-ocr', upload.single('imagem'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const { path: tmpPath } = req.file;
      try { console.log('[TESTE OCR] Processando arquivo:', tmpPath); } catch(_){ }

      const ocrResult = await Tesseract.recognize(tmpPath, 'por', {
        logger: (m) => { try { console.log('[OCR Progress]', m); } catch(_){} },
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789áéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ:.,- ()',
      });

      const textoOCR = ocrResult.data.text;
      try { console.log('[TESTE OCR] Texto bruto extraído:', textoOCR); } catch(_){ }

      const dadosExtraidos = extrairDadosSeloMelhorado(textoOCR);

      res.json({
        success: true,
        textoOcr: textoOCR,
        dadosExtraidos,
        qualidade: {
          confidence: ocrResult.data.confidence,
          lines: ocrResult.data.lines?.length || 0,
          words: ocrResult.data.words?.length || 0,
        },
      });
    } catch (error) {
      try { console.error('[TESTE OCR] Erro:', error); } catch(_){ }
      res.status(500).json({ error: 'Erro no processamento OCR', details: error.message });
    }
  });
}

module.exports = { registerExecucaoServicoRoutes };
