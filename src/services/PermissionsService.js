import config from '../config';

export async function fetchUserComponents(userId) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${config.apiURL}/users/${userId}/components`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error('Falha ao carregar componentes do usuário');
  }
  return res.json();
}

export async function updateUserComponents(userId, allowedKeys) {
  const token = localStorage.getItem('token');
  const body = { allowedKeys: Array.isArray(allowedKeys) ? allowedKeys : [] };
  const res = await fetch(`${config.apiURL}/users/${userId}/components`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Falha ao salvar permissões');
  }
  return res.json();
}
