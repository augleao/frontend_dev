import { apiURL } from './config';
// Retorna uma Promise que resolve para um Map de idUsuario -> usuario (com campo serventia)
export async function getUsuariosMap() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${apiURL}/admin/usuarios`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  const map = new Map();
  (data.usuarios || []).forEach(u => {
    map.set(u.id, u);
  });
  return map;
}
