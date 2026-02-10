

import React, { useEffect, useState } from 'react';
import config from './config';
import { getBackupAgendado, saveBackupAgendado } from './backupAgendadoService';

export default function RenderBackupManager() {
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [recoveryInfo, setRecoveryInfo] = useState({});
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [exports, setExports] = useState([]);
  // Estado para backup automático
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupTime, setAutoBackupTime] = useState('02:00'); // padrão 2h da manhã
  const [autoBackupLoading, setAutoBackupLoading] = useState(false);

  // Efeito para agendamento do backup automático
  // Efeito para agendamento do backup automático
  useEffect(() => {
    if (!autoBackupEnabled || !autoBackupTime || backups.length === 0) return;

    let timerId;
    function scheduleNextBackup() {
      const now = new Date();
      const [hh, mm] = autoBackupTime.split(':').map(Number);
      const next = new Date(now);
      next.setHours(hh, mm, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1); // se já passou hoje, agenda para amanhã
      const ms = next - now;
      timerId = setTimeout(() => {
        realizarBackupAgora(backups[0].id, false); // sem confirmação
        scheduleNextBackup(); // agenda o próximo
      }, ms);
    }
    scheduleNextBackup();
    return () => clearTimeout(timerId);
  }, [autoBackupEnabled, autoBackupTime, backups]);

  // Buscar configuração de agendamento ao carregar
  useEffect(() => {
    if (backups.length === 0) return;
    const postgresId = backups[0].id;
    setAutoBackupLoading(true);
    getBackupAgendado(postgresId)
      .then(cfg => {
        if (cfg && typeof cfg.ativo === 'boolean' && typeof cfg.horario === 'string') {
          setAutoBackupEnabled(cfg.ativo);
          setAutoBackupTime(cfg.horario);
        }
      })
      .catch(() => {/* ignora erro, usa padrão */})
      .finally(() => setAutoBackupLoading(false));
  }, [backups]);

  // Realizar backup lógico (export) via API da Render
  const realizarBackupAgora = async (postgresId, confirmar = true) => {
    if (confirmar && !window.confirm('Deseja realmente realizar um backup lógico (export) agora?')) return;
    setBackupMsg('Iniciando backup lógico...');
    try {
      const token = localStorage.getItem('token');
      if (!postgresId) {
        setBackupMsg('ID do Postgres não informado.');
        return;
      }
      console.log('[Backup] Iniciando export para postgresId (via backend):', postgresId);
      const res = await fetch(`${config.apiURL}/admin/render/postgres/${postgresId}/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      console.log('[Backup] Status da resposta:', res.status);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[Backup] Erro ao iniciar backup:', err);
        setBackupMsg('Erro ao iniciar backup lógico: ' + (err.error || res.status));
        return;
      }
      setBackupMsg('Backup lógico solicitado com sucesso! Aguarde alguns minutos e atualize a lista de exports.');
      setTimeout(() => fetchExports(postgresId, token), 5000);
    } catch (err) {
      console.error('[Backup] Erro inesperado:', err);
      setBackupMsg('Erro ao solicitar backup lógico: ' + (err.message || err));
    }
  };

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

      <button
        onClick={() => {
          if (backups.length > 0) realizarBackupAgora(backups[0].id, true);
        }}
        className="btn-gradient btn-gradient-blue"
        style={{ marginBottom: 8 }}
        disabled={backupLoading}
      >
        {backupLoading ? 'Processando...' : 'Realizar Backup Agora'}
      </button>

      {/* Elemento de agendamento de backup automático diário */}
      <div style={{ marginBottom: 18, padding: 12, border: '1px solid #d1ecf1', borderRadius: 8, background: '#f8fafd', maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontWeight: 600, color: '#1976d2' }}>
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              disabled={autoBackupLoading || backups.length === 0}
              onChange={e => setAutoBackupEnabled(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Backup automático diário
          </label>
          {autoBackupEnabled && (
            <>
              <span style={{ fontSize: 13, color: '#333' }}>Horário:</span>
              <input
                type="time"
                value={autoBackupTime}
                disabled={autoBackupLoading || backups.length === 0}
                onChange={e => setAutoBackupTime(e.target.value)}
                style={{ fontSize: 14, padding: '2px 8px', borderRadius: 4, border: '1px solid #b2bec3' }}
              />
            </>
          )}
        </div>
        <button
          className="btn-gradient btn-gradient-blue btn-block btn-compact"
          style={{ marginTop: 10 }}
          disabled={autoBackupLoading || backups.length === 0}
          onClick={async () => {
            if (backups.length > 0) {
              setAutoBackupLoading(true);
              try {
                await saveBackupAgendado(backups[0].id, autoBackupTime, autoBackupEnabled);
                setBackupMsg('Configuração de backup automático salva com sucesso!');
              } catch {
                setBackupMsg('Erro ao salvar configuração de backup automático');
              } finally {
                setAutoBackupLoading(false);
              }
            }
          }}
        >
          Salvar Configurações
        </button>
        {autoBackupEnabled && (
          <div style={{ fontSize: 12, color: '#1976d2', marginTop: 6 }}>
            O backup será realizado automaticamente todos os dias no horário escolhido.
          </div>
        )}
        {autoBackupLoading && (
          <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>Salvando configuração...</div>
        )}
      </div>


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
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => checkRecoveryStatus(service.id)}
                        className="btn-gradient btn-gradient-blue btn-compact"
                        style={{ fontSize: 12 }}
                        disabled={backupLoading || recoveryLoading}
                      >
                        Check Recovery
                      </button>
                      <button
                        onClick={() => {
                          // Só permite disparar se recoveryInfo estiver disponível e for available
                          if (recoveryInfo[service.id] && recoveryInfo[service.id].available) {
                            triggerRecovery(service.id);
                          }
                        }}
                        type="button"
                        className="btn-gradient btn-gradient-orange btn-compact"
                        style={{ fontSize: 12 }}
                        disabled={backupLoading || recoveryLoading || !recoveryInfo[service.id]?.available}
                      >
                        Disparar Recovery Manual
                      </button>
                      <button
                        onClick={() => realizarBackupAgora(service.id)}
                        type="button"
                        className="btn-gradient btn-gradient-green btn-compact"
                        style={{ fontSize: 12 }}
                        disabled={backupLoading || recoveryLoading}
                        title="Solicitar backup lógico (export) agora via API da Render"
                      >
                        Realizar Backup Agora
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* Lista de exports (backups lógicos) - render em estilo moderno */}
        <div style={{ marginTop: 30 }}>
          <h4 style={{ marginBottom: 8 }}>Backups Lógicos (Exports)</h4>
          {exports.length === 0 ? (
            <div style={{ color: '#6c757d', fontSize: 14 }}>Nenhum export disponível para download.</div>
          ) : (
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 0, background: '#f7fafc', padding: '10px 12px', fontSize: 14, fontWeight: 700, color: '#2c3e50' }}>
                <div>Data / Arquivo</div>
                <div style={{ textAlign: 'center' }}>Ações</div>
              </div>
              {exports.map((exp) => (
                <div key={exp.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 0, alignItems: 'center', padding: '10px 12px', borderTop: '1px solid #f1f5f9', fontSize: 13, color: '#334155' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={exp.filename || exp.url}>
                    <div style={{ fontWeight: 600 }}>{new Date(exp.createdAt).toLocaleString('pt-BR')}</div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{exp.filename || (exp.url ? decodeURIComponent(String(exp.url).split('/').pop()) : '')}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                    <a
                      href={exp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gradient btn-gradient-blue btn-compact"
                      style={{ fontSize: 12 }}
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard?.writeText(exp.url); }}
                      className="btn-gradient btn-gradient-orange btn-compact"
                      style={{ fontSize: 12 }}
                    >
                      Copiar link
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
