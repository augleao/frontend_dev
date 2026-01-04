const fetch = global.fetch || require('node-fetch');

function registerAdminRenderPostgresRoutes(app, { authenticateAdmin }) {
  const RENDER_API_KEY = process.env.RENDER_API_KEY;
  const RENDER_API_URL = process.env.RENDER_API_URL || 'https://api.render.com/v1';

  // Lista bancos Postgres no Render
  app.get('/api/admin/render/postgres', authenticateAdmin, async (req, res) => {
    try {
      const response = await fetch(`${RENDER_API_URL}/postgres`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${RENDER_API_KEY}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        return res.json({ bancos: data });
      }
      const rawBody = await response.text();
      let errorData;
      try { errorData = JSON.parse(rawBody); } catch { errorData = { raw: rawBody }; }
      return res.status(response.status).json({
        message: 'Erro ao buscar bancos postgres do Render',
        error: errorData,
      });
    } catch (error) {
      try { console.error('Erro ao buscar bancos postgres:', error); } catch(_){}
      return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
  });

  // Info de recovery de um Postgres
  app.get('/api/admin/render/postgres/:postgresId/recovery', authenticateAdmin, async (req, res) => {
    const { postgresId } = req.params;
    try {
      const response = await fetch(`${RENDER_API_URL}/postgres/${postgresId}/recovery`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${RENDER_API_KEY}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      const rawBody = await response.text();
      let errorData;
      try { errorData = JSON.parse(rawBody); } catch { errorData = { raw: rawBody }; }
      return res.status(response.status).json({
        message: 'Erro ao buscar recovery info do banco Postgres',
        error: errorData,
      });
    } catch (error) {
      try { console.error('Erro ao buscar recovery info:', error); } catch(_){}
      return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
  });

  // Lista exports do Postgres
  app.get('/api/admin/render/postgres/:postgresId/exports', authenticateAdmin, async (req, res) => {
    const { postgresId } = req.params;
    try {
      const response = await fetch(`${RENDER_API_URL}/postgres/${postgresId}/export`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${RENDER_API_KEY}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        return res.json({ exports: data });
      }
      const rawBody = await response.text();
      let errorData;
      try { errorData = JSON.parse(rawBody); } catch { errorData = { raw: rawBody }; }
      return res.status(response.status).json({
        message: 'Erro ao buscar exports do banco Postgres',
        error: errorData,
      });
    } catch (error) {
      try { console.error('Erro ao buscar exports:', error); } catch(_){}
      return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
  });

  // Disparar recovery (path sem /api preservado conforme original)
  app.post('/admin/render/postgres/:postgresId/recovery', authenticateAdmin, async (req, res) => {
    const { postgresId } = req.params;
    const { restoreTime } = req.body;
    try { console.log('[RECOVERY][POSTGRES] Iniciando backup automático para postgresId:', postgresId, 'restoreTime:', restoreTime); } catch(_){ }
    if (!restoreTime) {
      try { console.warn('[RECOVERY][POSTGRES] restoreTime não informado'); } catch(_){ }
      return res.status(400).json({ error: 'restoreTime é obrigatório' });
    }
    try {
      const response = await fetch(`${RENDER_API_URL}/postgres/${postgresId}/recovery`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RENDER_API_KEY}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ restoreTime }),
      });
      const text = await response.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      try { console.log('[RECOVERY][POSTGRES] Status:', response.status); } catch(_){ }
      try { console.log('[RECOVERY][POSTGRES] Resposta:', data); } catch(_){ }
      if (!response.ok) return res.status(response.status).json(data);
      return res.json(data);
    } catch (err) {
      try { console.error('[RECOVERY][POSTGRES] Erro ao disparar recovery:', err); } catch(_){ }
      return res.status(500).json({ error: 'Erro ao disparar recovery', details: err.message });
    }
  });

  // Disparar export
  app.post('/api/admin/render/postgres/:postgresId/export', authenticateAdmin, async (req, res) => {
    const { postgresId } = req.params;
    if (!RENDER_API_KEY) {
      return res.status(500).json({ error: 'RENDER_API_KEY não configurado no backend.' });
    }
    try {
      try { console.log('[EXPORT][POSTGRES] Iniciando exportação para postgresId:', postgresId); } catch(_){ }
      const response = await fetch(`${RENDER_API_URL}/postgres/${postgresId}/export`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RENDER_API_KEY}`,
          Accept: 'application/json',
        },
      });
      const text = await response.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      try { console.log('[EXPORT][POSTGRES] Status:', response.status); } catch(_){ }
      try { console.log('[EXPORT][POSTGRES] Resposta:', data); } catch(_){ }
      if (!response.ok) return res.status(response.status).json(data);
      return res.json(data);
    } catch (err) {
      try { console.error('[EXPORT][POSTGRES] Erro ao solicitar exportação:', err); } catch(_){ }
      return res.status(500).json({ message: 'internal server error', details: err.message });
    }
  });
}

module.exports = { registerAdminRenderPostgresRoutes };
