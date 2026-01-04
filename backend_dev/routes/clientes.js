const pool = require('../db');

function registerClientesRoutes(app) {
  // Buscar clientes
  app.get('/api/clientes', async (req, res) => {
    try {
      const search = req.query.search || '';
      const result = await pool.query(
        `SELECT * FROM clientes
         WHERE nome ILIKE $1 OR cpf ILIKE $1
         ORDER BY nome LIMIT 10`,
        [`%${search}%`]
      );
      return res.json({ clientes: result.rows });
    } catch (err) {
      try { console.error('Erro ao buscar clientes:', err); } catch(_){}
      return res.status(500).json({ error: 'Erro ao buscar clientes.' });
    }
  });

  // Salvar novo cliente
  app.post('/api/clientes', async (req, res) => {
    try {
      const { nome, cpf, endereco, telefone, email } = req.body || {};
      const result = await pool.query(
        `INSERT INTO clientes (nome, cpf, endereco, telefone, email)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [nome, cpf, endereco, telefone, email]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      try { console.error('Erro ao salvar cliente:', err); } catch(_){}
      return res.status(500).json({ error: 'Erro ao salvar cliente.' });
    }
  });

  // Atualizar cliente existente
  app.put('/api/clientes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

      const { nome, cpf, endereco, telefone, email } = req.body || {};
      if (!cpf || String(cpf).trim() === '') {
        return res.status(400).json({ error: 'CPF/CNPJ é obrigatório.' });
      }
      const cpfTrim = String(cpf).trim();

      // Checa duplicidade de CPF/CNPJ em outro cliente
      const dupCheck = await pool.query(
        'SELECT id FROM clientes WHERE cpf = $1 AND id <> $2',
        [cpfTrim, id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Já existe um cliente cadastrado com este CPF/CNPJ.' });
      }

      const update = await pool.query(
        `UPDATE clientes
           SET nome = $1,
               cpf = $2,
               endereco = $3,
               telefone = $4,
               email = $5
         WHERE id = $6
         RETURNING *`,
        [nome || '', cpfTrim, endereco || '', telefone || '', email || '', id]
      );

      if (update.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado.' });
      }
      return res.json(update.rows[0]);
    } catch (err) {
      try { console.error('Erro ao atualizar cliente:', err); } catch(_){}
      return res.status(500).json({ error: 'Erro interno ao atualizar cliente.' });
    }
  });

  // Apagar cliente
  app.delete('/api/clientes/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
      return res.json({ success: true });
    } catch (err) {
      try { console.error('Erro ao apagar cliente:', err); } catch(_){}
      return res.status(500).json({ error: 'Erro ao apagar cliente.' });
    }
  });
}

module.exports = { registerClientesRoutes };
