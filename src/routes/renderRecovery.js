// Rota: POST /admin/render/postgres/:postgresId/recovery
// Dispara recovery point-in-time no Render

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { requireAdminAuth } = require('../middleware/auth');

// Ajuste para pegar a API key do Render do ambiente/config
const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_API_URL = 'https://api.render.com/v1';

// POST /admin/render/postgres/:postgresId/recovery
router.post('/admin/render/postgres/:postgresId/recovery', requireAdminAuth, async (req, res) => {
  const { postgresId } = req.params;
  const { restoreTime } = req.body;
  if (!restoreTime) {
    return res.status(400).json({ error: 'restoreTime é obrigatório' });
  }
  try {
    const response = await fetch(`${RENDER_API_URL}/postgres/${postgresId}/recovery`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ restoreTime })
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao disparar recovery', details: err.message });
  }
});

module.exports = router;
