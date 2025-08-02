import React, { useEffect, useState } from 'react';
import config from './config';

export default function RenderBackupManager() {
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [recoveryInfo, setRecoveryInfo] = useState({});
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [exports, setExports] = useState([]);

  useEffect(() => {
    // Forçar exibição apenas do banco dpg-d13h6lbipnbc73ba1j80-a
    const forcedBanco = {
      id: 'dpg-d13h6lbipnbc73ba1j80-a',
      name: 'Banco Principal',
      type: 'postgres',
      status: 'available'
    };
    setBackups([forcedBanco]);
    const token = localStorage.getItem('token');
    fetchRecoveryInfo(forcedBanco.id, token);
    fetchExports(forcedBanco.id, token);
  }, []);

  const fetchBackups = async () => {
    try {
      setBackupLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.apiURL}/admin/render/postgres`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setBackups(data.bancos || []);
        setBackupMsg('');
        if (Array.isArray(data.bancos)) {
          data.bancos.forEach((banco) => {
            fetchRecoveryInfo(banco.id, token);
          });
        }
      } else if (response.status === 404) {
        setBackupMsg('Endpoints de backup não implementados no backend ainda');
      } else {
        try {
          const errorData = await response.json();
          setBackupMsg('Erro ao carregar bancos do Render: ' + (errorData.message || 'Erro desconhecido'));
        } catch {
          setBackupMsg(`Erro do servidor (${response.status}): Resposta não é JSON válido`);
        }
      }
    } catch (error) {
      setBackupMsg('Erro de conexão com o servidor: ' + error.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const fetchRecoveryInfo = async (postgresId, token) => {
    try {
      const response = await fetch(`${config.apiURL}/admin/render/postgres/${postgresId}/recovery`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRecoveryInfo(prev => ({ ...prev, [postgresId]: data }));
      } else {
        setRecoveryInfo(prev => ({ ...prev, [postgresId]: { available: false } }));
      }
    } catch (error) {
      setRecoveryInfo(prev => ({ ...prev, [postgresId]: { available: false, error: error.message } }));
    }
  };

  const fetchExports = async (postgresId, token) => {
    try {
      const response = await fetch(`${config.apiURL}/admin/render/postgres/${postgresId}/exports`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setExports(data.exports || []);
      } else {
        setExports([]);
      }
    } catch (error) {
      setExports([]);
    }
  };

  const checkRecoveryStatus = async (postgresId) => {
    try {
      setRecoveryLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.apiURL}/admin/render/postgres/${postgresId}/recovery`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRecoveryInfo(prev => ({ ...prev, [postgresId]: data }));
        setBackupMsg(`Status de recuperação verificado para ${postgresId}`);
        return data;
      } else if (response.status === 404) {
        setBackupMsg('Endpoint de recovery não implementado no backend ainda');
      } else {
        try {
          const errorData = await response.json();
          setBackupMsg('Erro ao verificar status de recuperação: ' + (errorData.message || 'Erro desconhecido'));
        } catch {
          setBackupMsg(`Erro do servidor (${response.status}): Resposta não é JSON válido`);
        }
      }
    } catch (error) {
      setBackupMsg('Erro de conexão ao verificar recuperação: ' + error.message);
    } finally {
      setRecoveryLoading(false);
    }
  };

  // triggerRecovery só pode ser chamado manualmente
  const triggerRecovery = async (postgresId) => {
    if (!window.confirm(`Tem certeza que deseja iniciar a recuperação point-in-time para o serviço ${postgresId}?\n\nEsta operação pode afetar a disponibilidade do banco de dados.`)) {
      return;
    }
    try {
      setRecoveryLoading(true);
      setBackupMsg('Iniciando recuperação point-in-time...');
      const token = localStorage.getItem('token');
      // Parâmetro obrigatório: restoreTime (agora)
      const now = new Date();
      const restoreTime = now.toISOString();
      const body = { restoreTime };
      const response = await fetch(`${config.apiURL}/admin/render/postgres/${postgresId}/recovery`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        const data = await response.json();
        setBackupMsg('Recuperação point-in-time iniciada com sucesso!');
        setTimeout(() => checkRecoveryStatus(postgresId), 3000);
      } else if (response.status === 404) {
        setBackupMsg('Endpoint de recovery não implementado no backend ainda');
      } else {
        try {
          const errorData = await response.json();
          setBackupMsg('Erro ao iniciar recuperação: ' + (errorData.message || 'Erro desconhecido'));
        } catch {
          setBackupMsg(`Erro do servidor (${response.status}): Resposta não é JSON válido`);
        }
      }
    } catch (error) {
      setBackupMsg('Erro de conexão ao iniciar recuperação: ' + error.message);
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2 style={{ marginBottom: 24 }}>🗄️ Gerenciamento de Backups (PostgreSQL - Render)</h2>
      <button onClick={fetchBackups} style={{ marginBottom: 16, padding: '8px 18px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', fontSize: 15 }} disabled={backupLoading}>
        {backupLoading ? 'Carregando...' : 'Atualizar'}
      </button>

      {/* Botão de recovery manual está na tabela abaixo */}
      {backupMsg && (
        <div style={{ color: backupMsg.includes('Erro') ? '#dc3545' : '#28a745', background: backupMsg.includes('Erro') ? '#f8d7da' : '#d4edda', border: `1px solid ${backupMsg.includes('Erro') ? '#f5c6cb' : '#c3e6cb'}`, borderRadius: 4, padding: 10, marginBottom: 15 }}>
          {backupMsg}
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #dee2e6' }}>
          <thead>
            <tr style={{ background: '#e9ecef' }}>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Serviço</th>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Tipo</th>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Status</th>
              <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Recovery Status</th>
              <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {backups.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: 20, textAlign: 'center', color: '#6c757d', borderBottom: '1px solid #dee2e6' }}>
                  {backupLoading ? 'Carregando serviços...' : 'Nenhum serviço PostgreSQL encontrado'}
                </td>
              </tr>
            ) : (
              backups.map((service) => (
                <tr key={service.id}>
                  <td style={{ padding: 12, borderBottom: '1px solid #dee2e6' }}>
                    <strong>{service.name}</strong>
                    <br />
                    <small style={{ color: '#6c757d' }}>ID: {service.id}</small>
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #dee2e6' }}>{service.type}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #dee2e6' }}>
                    <span style={{ padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 'bold', background: service.status === 'available' ? '#d4edda' : '#f8d7da', color: service.status === 'available' ? '#155724' : '#721c24' }}>{service.status || 'unknown'}</span>
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #dee2e6' }}>
                    {recoveryInfo[service.id] ? (
                      <div>
                        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 'bold', background: recoveryInfo[service.id].available ? '#e1f5fe' : '#fff3e0', color: recoveryInfo[service.id].available ? '#01579b' : '#e65100' }}>{recoveryInfo[service.id].available ? 'Disponível' : 'Indisponível'}</span>
                        {recoveryInfo[service.id].lastBackup && (
                          <div style={{ fontSize: 10, color: '#6c757d', marginTop: 4 }}>Último backup: {new Date(recoveryInfo[service.id].lastBackup).toLocaleDateString('pt-BR')}</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#6c757d', fontSize: 12 }}>Não verificado</span>
                    )}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => checkRecoveryStatus(service.id)} style={{ background: '#607d8b', color: '#fff', fontSize: 12, padding: '6px 12px', border: 'none', borderRadius: 8, fontWeight: 'bold' }} disabled={backupLoading || recoveryLoading}>Check Recovery</button>
                      <button
                        onClick={() => {
                          // Só permite disparar se recoveryInfo estiver disponível e for available
                          if (recoveryInfo[service.id] && recoveryInfo[service.id].available) {
                            triggerRecovery(service.id);
                          }
                        }}
                        style={{ background: '#9c27b0', color: '#fff', fontSize: 12, padding: '6px 12px', border: 'none', borderRadius: 8, fontWeight: 'bold', opacity: (backupLoading || recoveryLoading || !recoveryInfo[service.id]?.available) ? 0.5 : 1, cursor: (backupLoading || recoveryLoading || !recoveryInfo[service.id]?.available) ? 'not-allowed' : 'pointer' }}
                        disabled={backupLoading || recoveryLoading || !recoveryInfo[service.id]?.available}
                      >
                        Disparar Recovery Manual
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* Lista de exports (backups lógicos) */}
        <div style={{ marginTop: 30 }}>
          <h4 style={{ marginBottom: 8 }}>Backups Lógicos (Exports)</h4>
          {exports.length === 0 ? (
            <div style={{ color: '#6c757d', fontSize: 14 }}>Nenhum export disponível para download.</div>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {exports.map((exp) => (
                <li key={exp.id} style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#333' }}>{new Date(exp.createdAt).toLocaleString('pt-BR')} -</span>
                  <a href={exp.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, color: '#1976d2', fontWeight: 'bold', textDecoration: 'underline' }}>Download</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div style={{ background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: 4, padding: 12, fontSize: 14, color: '#856404' }}>
        <strong>ℹ️ Informações sobre Backup e Recovery:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li><strong>Backup:</strong> Os backups são armazenados automaticamente pelo Render</li>
          <li><strong>Check Recovery:</strong> Verifica se a recuperação point-in-time está disponível</li>
          <li><strong>Point-in-Time Recovery:</strong> Restaura o banco para um ponto específico no tempo</li>
          <li><strong>Atenção:</strong> Recovery pode afetar a disponibilidade do banco durante o processo</li>
          <li>Verifique o painel do Render para mais detalhes sobre os backups e recovery status</li>
        </ul>
        <div style={{ background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: 4, padding: 8, marginTop: 10, color: '#721c24' }}>
          <strong>⚠️ Aviso:</strong> Operações de recovery são críticas. Sempre confirme antes de executar.
        </div>
        <div style={{ background: '#d1ecf1', border: '1px solid #bee5eb', borderRadius: 4, padding: 8, marginTop: 10, color: '#0c5460' }}>
          <strong>🔧 Status:</strong> {backups.length === 0 && backupMsg.includes('não implementado') ? 'Endpoints do Render não implementados no backend ainda. Implemente as rotas mencionadas acima.' : 'Sistema funcionando normalmente.'}
        </div>
      </div>
    </div>
  );
}
