const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middlewares/auth');
const service = require('../services/onedriveConfigService');

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const mapRow = (row) => ({
  id: row.id,
  clientId: row.client_id,
  clientSecret: row.client_secret,
  redirectUri: row.redirect_uri,
  tenant: row.tenant,
  folderPath: row.folder_path,
  refreshToken: row.refresh_token,
  driveId: row.drive_id,
  sharepointDriveId: row.drive_id
});

function sanitizeFolderPath(input) {
  if (input === undefined || input === null) return undefined;
  const normalized = String(input).trim().replace(/^[/\\]+/g, '');
  return normalized;
}

function sanitizeDriveId(input) {
  if (input === undefined || input === null) return undefined;
  const value = String(input).trim();
  return value || '';
}

function extractPayload(body = {}) {
  const payload = { ...body };
  if (!hasOwn(payload, 'driveId') && hasOwn(payload, 'sharepointDriveId')) {
    payload.driveId = payload.sharepointDriveId;
  }
  if (hasOwn(payload, 'sharepointDriveId')) {
    delete payload.sharepointDriveId;
  }
  return payload;
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

router.get('/', ensureAuth, async (req, res) => {
  try {
    const row = await service.getConfig();
    if (!row) {
      return res.sendStatus(404);
    }

    res.json(mapRow(row));
  } catch (err) {
    console.error('Erro ao buscar configuração do OneDrive:', err);
    res.status(500).json({ message: 'Erro interno ao buscar configuração.' });
  }
});

router.post('/', ensureAuth, async (req, res) => {
  const payload = extractPayload(req.body || {});
  const { clientId, clientSecret, redirectUri, tenant, refreshToken } = payload;
  const normalizedFolder = sanitizeFolderPath(payload.folderPath);
  const normalizedDriveId = sanitizeDriveId(payload.driveId);

  // validation & normalization
  if (!clientId || !clientSecret || !redirectUri || !refreshToken || !normalizedFolder || !normalizedDriveId) {
    return res.status(400).json({ message: 'Campos obrigatórios: clientId, clientSecret, redirectUri, refreshToken, folderPath, driveId.' });
  }

  try {
    const existing = await service.getConfig();
    if (existing) return res.status(409).json({ message: 'Configuração já cadastrada.' });

    const inserted = await service.createConfig({
      clientId: clientId,
      clientSecret: clientSecret,
      redirectUri: redirectUri,
      tenant: tenant || 'consumers',
      refreshToken: refreshToken,
      folderPath: normalizedFolder || 'Averbacoes',
      driveId: normalizedDriveId
    });

    res.status(201).json({ config: mapRow(inserted) });
  } catch (err) {
    console.error('Erro ao criar configuração do OneDrive:', err);
    res.status(500).json({ message: 'Erro interno ao salvar configuração.' });
  }
});

router.put('/:id', ensureAuth, async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  const payload = extractPayload(req.body || {});
  const updates = {};

  if (hasOwn(payload, 'clientId')) {
    updates.client_id = payload.clientId;
  }
  if (hasOwn(payload, 'clientSecret')) {
    updates.client_secret = payload.clientSecret;
  }
  if (hasOwn(payload, 'redirectUri')) {
    updates.redirect_uri = payload.redirectUri;
  }
  if (hasOwn(payload, 'tenant')) {
    updates.tenant = payload.tenant;
  }
  if (hasOwn(payload, 'refreshToken')) {
    updates.refresh_token = payload.refreshToken;
  }
  if (hasOwn(payload, 'folderPath')) {
    const sanitized = sanitizeFolderPath(payload.folderPath);
    if (!sanitized) {
      return res.status(400).json({ message: 'folderPath não pode ser vazio.' });
    }
    updates.folder_path = sanitized;
  }
  if (hasOwn(payload, 'driveId')) {
    const sanitizedDrive = sanitizeDriveId(payload.driveId);
    if (!sanitizedDrive) {
      return res.status(400).json({ message: 'driveId não pode ser vazio.' });
    }
    updates.drive_id = sanitizedDrive;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
  }

  try {
    const updated = await service.updateConfig(id, updates);
    if (!updated) return res.status(404).json({ message: 'Configuração não encontrada.' });
    res.json({ config: mapRow(updated) });
  } catch (err) {
    console.error('Erro ao atualizar configuração do OneDrive:', err);
    res.status(500).json({ message: 'Erro interno ao atualizar configuração.' });
  }
});

router.delete('/:id', ensureAuth, async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const rows = await service.deleteConfig(id);
    if (!rows) return res.status(404).json({ message: 'Configuração não encontrada.' });
    res.sendStatus(204);
  } catch (err) {
    console.error('Erro ao remover configuração do OneDrive:', err);
    res.status(500).json({ message: 'Erro interno ao remover configuração.' });
  }
});

module.exports = router;
