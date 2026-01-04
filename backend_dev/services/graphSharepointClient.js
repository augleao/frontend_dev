const axios = require('axios');
const onedriveConfigService = require('./onedriveConfigService');

let cachedToken = null;
let cachedExpiry = 0;

function ensureEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

async function resolveDriveId() {
  if (!process.env.SHAREPOINT_DRIVE_ID && onedriveConfigService && typeof onedriveConfigService.ensureSharepointDriveId === 'function') {
    await onedriveConfigService.ensureSharepointDriveId();
  }
  return ensureEnv('SHAREPOINT_DRIVE_ID');
}

function formatGraphError(err) {
  if (!err) return 'Erro desconhecido do Microsoft Graph';
  const data = err.response && err.response.data ? err.response.data : null;
  if (data && data.error) {
    const msg = data.error.message || JSON.stringify(data.error);
    return `Microsoft Graph: ${msg}`;
  }
  if (err.message) return err.message;
  return 'Falha ao chamar Microsoft Graph';
}

async function getAccessToken() {
  const tenantId = ensureEnv('AZURE_TENANT_ID');
  const clientId = ensureEnv('AZURE_CLIENT_ID');
  const clientSecret = ensureEnv('AZURE_CLIENT_SECRET');

  const now = Date.now();
  if (cachedToken && cachedExpiry > now + 30000) {
    return cachedToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams();
  body.append('client_id', clientId);
  body.append('client_secret', clientSecret);
  body.append('scope', 'https://graph.microsoft.com/.default');
  body.append('grant_type', 'client_credentials');

  try {
    const response = await axios.post(tokenUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    const { access_token: token, expires_in: expiresIn } = response.data || {};
    if (!token) throw new Error('Resposta sem access_token');
    cachedToken = token;
    cachedExpiry = now + (Number(expiresIn || 3600) * 1000);
    return token;
  } catch (err) {
    const formatted = formatGraphError(err);
    try { console.error('Erro ao obter access token do Graph:', formatted); } catch (_) {}
    throw new Error(`Falha ao obter token do Graph: ${formatted}`);
  }
}

function buildItemPath(filename, folderPath) {
  const safeFolder = folderPath ? String(folderPath).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
  const segments = safeFolder ? safeFolder.split('/').filter(Boolean) : [];
  const encodedSegments = segments.map((segment) => encodeURIComponent(segment));
  const encodedName = encodeURIComponent(filename).replace(/\+/g, '%20');
  const pathParts = encodedSegments.concat(encodedName);
  return pathParts.join('/');
}

async function createUploadSession(filename, folderPath = '') {
  const driveId = await resolveDriveId();
  const token = await getAccessToken();
  const itemPath = buildItemPath(filename, folderPath);
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${itemPath}:/createUploadSession`;
  const payload = {
    item: {
      '@microsoft.graph.conflictBehavior': 'replace',
      name: filename,
    },
  };
  try {
    const response = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000,
    });
    if (!response.data || !response.data.uploadUrl) {
      throw new Error('Upload session inválida');
    }
    return response.data;
  } catch (err) {
    const formatted = formatGraphError(err);
    try { console.error('Erro ao criar upload session no Graph:', formatted); } catch (_) {}
    throw new Error(`Falha ao criar upload session: ${formatted}`);
  }
}

async function uploadFile(uploadUrl, buffer) {
  if (!uploadUrl) throw new Error('uploadUrl obrigatório');
  if (!buffer || !buffer.length) throw new Error('Arquivo vazio');

  const chunkSize = 320 * 1024; // 320 KB
  const total = buffer.length;
  let start = 0;
  let lastResponse = null;

  while (start < total) {
    const end = Math.min(start + chunkSize, total);
    const chunk = buffer.slice(start, end);
    const contentRange = `bytes ${start}-${end - 1}/${total}`;
    try {
      const response = await axios.put(uploadUrl, chunk, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': chunk.length,
          'Content-Range': contentRange,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000,
      });
      lastResponse = response.data;
      if (response.data && response.data.error) {
        const formatted = JSON.stringify(response.data.error);
        throw new Error(`Graph retornou erro durante upload: ${formatted}`);
      }
    } catch (err) {
      const formatted = formatGraphError(err);
      try { console.error('Erro no upload para Graph:', formatted); } catch (_) {}
      throw new Error(`Falha ao enviar arquivo para Graph: ${formatted}`);
    }
    start = end;
  }

  if (!lastResponse || !lastResponse.id) {
    throw new Error('Upload concluído sem metadata do arquivo.');
  }
  return lastResponse;
}

async function uploadPdfToSharepoint(buffer, filename, folderPath) {
  const session = await createUploadSession(filename, folderPath);
  const driveItem = await uploadFile(session.uploadUrl, buffer);
  return {
    webUrl: driveItem.webUrl,
    id: driveItem.id,
    size: driveItem.size,
    name: driveItem.name || filename,
    response: driveItem,
  };
}

async function deleteFile(itemId) {
  const driveId = await resolveDriveId();
  const token = await getAccessToken();
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`;
  try {
    await axios.delete(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
  } catch (err) {
    const formatted = formatGraphError(err);
    try { console.error('Erro ao remover arquivo do Graph:', formatted); } catch (_) {}
    throw new Error(`Falha ao remover arquivo no Graph: ${formatted}`);
  }
}

module.exports = {
  getAccessToken,
  createUploadSession,
  uploadFile,
  uploadPdfToSharepoint,
  deleteFile,
};
