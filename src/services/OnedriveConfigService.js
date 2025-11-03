import config from '../config';

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
    return data;
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
    return data;
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
