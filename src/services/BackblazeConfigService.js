import { apiURL } from '../config';

const endpointBase = `${apiURL}/config/backblaze`;

const getConfig = async () => {
  const token = localStorage.getItem('token');
  const res = await fetch(endpointBase, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Erro ao buscar configuração Backblaze');
  return res.json();
};

const saveConfig = async (payload, id = null) => {
  const token = localStorage.getItem('token');
  const url = id ? `${endpointBase}/${id}` : endpointBase;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Erro ao salvar configuração Backblaze');
  }
  return res.json();
};

const deleteConfig = async (id) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${endpointBase}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Erro ao remover configuração Backblaze');
  }
  return res.json();
};

export default {
  getConfig,
  saveConfig,
  deleteConfig
};
