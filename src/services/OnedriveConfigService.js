import config from '../config';

const normalizeConfigPayload = (payload) => {
  if (!payload) return null;
  if (Array.isArray(payload)) {
    return payload[0] || null;
  }
  if (payload.data) {
    if (Array.isArray(payload.data)) {
      return payload.data[0] || null;
    }
    return payload.data;
  }
  if (payload.result) {
    if (Array.isArray(payload.result)) {
      return payload.result[0] || null;
    }
    return payload.result;
  }
  if (payload.config) {
    if (Array.isArray(payload.config)) {
      return payload.config[0] || null;
    }
    return payload.config;
  }
  return payload;
};

const OnedriveConfigService = {
  async getConfig() {
    const token = localStorage.getItem('token');
    const resp = await fetch(`${config.apiURL}/onedrive-config`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (resp.status === 404) return null;
    let data = null;
    try {
      data = await resp.json();
    } catch (err) {
      data = null;
    }
    if (!resp.ok) {
      const msg = data?.message || data?.error || 'Falha ao carregar configuração do OneDrive.';
      throw new Error(msg);
    }
    const normalized = normalizeConfigPayload(data);
    if (!normalized) {
      return null;
    }
    if (!normalized?.clientId && normalized?.client_id) {
      normalized.clientId = normalized.client_id;
    }
    if (!normalized?.clientSecret && normalized?.client_secret) {
      normalized.clientSecret = normalized.client_secret;
    }
    if (!normalized?.redirectUri && normalized?.redirect_uri) {
      normalized.redirectUri = normalized.redirect_uri;
    }
    if (!normalized?.folderPath && normalized?.folder_path) {
      normalized.folderPath = normalized.folder_path;
    }
    if (!normalized?.refreshToken && normalized?.refresh_token) {
      normalized.refreshToken = normalized.refresh_token;
    }
    return normalized;
  },

  async saveConfig(payload, id) {
    const token = localStorage.getItem('token');
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${config.apiURL}/onedrive-config/${encodeURIComponent(id)}` : `${config.apiURL}/onedrive-config`;
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    let data = null;
    try {
      data = await resp.json();
    } catch (err) {
      data = null;
    }
    if (!resp.ok) {
      const msg = data?.message || data?.error || 'Falha ao salvar configuração do OneDrive.';
      throw new Error(msg);
    }
    const normalized = normalizeConfigPayload(data) || {};
    if (!normalized?.clientId && normalized?.client_id) {
      normalized.clientId = normalized.client_id;
    }
    if (!normalized?.clientSecret && normalized?.client_secret) {
      normalized.clientSecret = normalized.client_secret;
    }
    if (!normalized?.redirectUri && normalized?.redirect_uri) {
      normalized.redirectUri = normalized.redirect_uri;
    }
    if (!normalized?.folderPath && normalized?.folder_path) {
      normalized.folderPath = normalized.folder_path;
    }
    if (!normalized?.refreshToken && normalized?.refresh_token) {
      normalized.refreshToken = normalized.refresh_token;
    }
    if (normalized?.id || normalized?._id) {
      return normalized;
    }
    return { ...payload, id: id ?? normalized.id ?? normalized._id ?? null };
  },

  async deleteConfig(id) {
    const token = localStorage.getItem('token');
    const resp = await fetch(`${config.apiURL}/onedrive-config/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (resp.status === 204) return true;
    let data = null;
    try {
      data = await resp.json();
    } catch (err) {
      data = null;
    }
    if (!resp.ok) {
      const msg = data?.message || data?.error || 'Falha ao remover configuração do OneDrive.';
      throw new Error(msg);
    }
    return true;
  }
};

export default OnedriveConfigService;
