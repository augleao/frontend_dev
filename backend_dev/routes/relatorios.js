// routes/relatorios.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, ensureAuth } = require('../middlewares/auth');

// Salvar relatório (protegida)
router.post('/salvar-relatorio', authenticate, async (req, res) => {
  const { dadosRelatorio, data_geracao: dataGeracaoInput } = req.body;

  if (!dadosRelatorio) {
    return res.status(400).json({ message: 'Dados do relatório são obrigatórios.' });
  }

  try {
    // Busca os dados do usuário logado
    const userResult = await pool.query(
      'SELECT email, cargo, serventia FROM public.users WHERE id = $1',
      [req.user.id]
    );

    if (!userResult.rowCount) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    const user = userResult.rows[0];

    // Salva o relatório no banco
    // Usa a data recebida do frontend ou cai para a data atual
    const dataGeracao = dataGeracaoInput || new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO relatorios (user_id, email, cargo, serventia, dados_relatorio, data_geracao) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, data_geracao`,
      [req.user.id, user.email, user.cargo, user.serventia, JSON.stringify(dadosRelatorio), dataGeracao]
    );

    res.json({
      message: 'Relatório salvo com sucesso!',
      relatorio_id: result.rows[0].id,
      data_geracao: result.rows[0].data_geracao
    });

  } catch (err) {
    console.error('Erro ao salvar relatório:', err);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Listar relatórios do usuário (protegida)
router.get('/meus-relatorios', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, cargo, serventia, data_geracao, dados_relatorio 
       FROM relatorios 
       WHERE user_id = $1 
       ORDER BY data_geracao DESC`,
      [req.user.id]
    );

    res.json({ relatorios: result.rows });

  } catch (err) {
    console.error('Erro ao buscar relatórios:', err);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Excluir relatório (protegida)
router.delete('/excluir-relatorio/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    // Registrador pode excluir qualquer relatório; demais só os próprios
    let query = 'DELETE FROM relatorios WHERE id = $1 AND user_id = $2';
    let params = [id, req.user.id];

    if (req.user && req.user.cargo === 'Registrador') {
      query = 'DELETE FROM relatorios WHERE id = $1';
      params = [id];
    }

    const result = await pool.query(query, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Relatório não encontrado ou não pertence a este usuário.' });
    }
    res.json({ message: 'Relatório excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir relatório:', error);
    res.status(500).json({ message: 'Erro ao excluir relatório.' });
  }
});

// Rota exclusiva para Registrador
router.get('/todos', ensureAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, cargo, serventia, data_geracao, dados_relatorio 
       FROM relatorios 
       ORDER BY data_geracao DESC`
    );
    res.json({ relatorios: result.rows });
  } catch (err) {
    console.error('Erro ao buscar todos os relatórios:', err);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

module.exports = router;