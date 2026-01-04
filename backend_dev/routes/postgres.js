const pool = require('../db');

function registerPostgresRoutes(app) {
  // Buscar config de backup agendado
  app.get('/api/:postgresId/backup-agendado', async (req, res) => {
    const { postgresId } = req.params;
    try {
      const { rows } = await pool.query(
        'SELECT horario, ativo FROM backup_agendado WHERE postgres_id = $1',
        [postgresId]
      );
      if (rows.length === 0) return res.json({ horario: '02:00', ativo: false });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar configuração', details: err.message });
    }
  });

  // Criar/atualizar config de backup agendado
  app.post('/api/:postgresId/backup-agendado', async (req, res) => {
    const { postgresId } = req.params;
    const { horario, ativo } = req.body;
    try {
      const { rows } = await pool.query(
        `INSERT INTO backup_agendado (postgres_id, horario, ativo, atualizado_em)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (postgres_id)
         DO UPDATE SET horario = $2, ativo = $3, atualizado_em = NOW()
         RETURNING horario, ativo`,
        [postgresId, horario, ativo]
      );
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao salvar configuração', details: err.message });
    }
  });
}

module.exports = { registerPostgresRoutes };
