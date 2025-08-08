// Serviço para persistir e buscar configuração de backup agendado
// Ajuste a URL conforme seu backend
import config from './config';

export async function getBackupAgendado(postgresId) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${config.apiURL}/admin/backupAgendado/${postgresId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error('Erro ao buscar configuração de backup agendado');
  return res.json();
}

export async function saveBackupAgendado(postgresId, horario, ativo) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${config.apiURL}/admin/backupAgendado/${postgresId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ horario, ativo })
  });
  if (!res.ok) throw new Error('Erro ao salvar configuração de backup agendado');
  return res.json();
}
