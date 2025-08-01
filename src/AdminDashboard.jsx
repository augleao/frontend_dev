import React, { useEffect, useState } from 'react';
import config from './config';
import { Link } from 'react-router-dom';
import { apiURL } from './config';

export default function AdminDashboard() {
  const [usuarios, setUsuarios] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [msg, setMsg] = useState('');
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [recoveryInfo, setRecoveryInfo] = useState({});
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Estilos dos botões (mesmo padrão do ImportarAtos)
  const buttonStyle = {
    padding: '10px 24px',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: 16,
    transition: 'background 0.2s',
  };

  const buttonDisabledStyle = {
    ...buttonStyle,
    background: '#ccc',
    cursor: 'not-allowed',
  };

  const buttonEditStyle = {
    ...buttonStyle,
    background: '#2196f3',
  };

  const buttonSaveStyle = {
    ...buttonStyle,
    background: '#388e3c',
  };

  const buttonCancelStyle = {
    ...buttonStyle,
    background: '#d32f2f',
  };

  const buttonDeleteStyle = {
    ...buttonStyle,
    background: '#f44336',
  };

  const buttonBackupStyle = {
    ...buttonStyle,
    background: '#ff9800',
  };

  const buttonRecoveryStyle = {
    ...buttonStyle,
    background: '#9c27b0',
  };

  const buttonCheckStyle = {
    ...buttonStyle,
    background: '#607d8b',
  };

  useEffect(() => {
    fetchUsuarios();
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
  }, []);

  const fetchUsuarios = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/admin/usuarios`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setUsuarios(data.usuarios || []);
  };

  const fetchBackups = async () => {
    try {
      setBackupLoading(true);
      const token = localStorage.getItem('token');
      console.log('[fetchBackups] Fazendo requisição para:', `${config.apiURL}/admin/render/postgres`);
      const response = await fetch(`${config.apiURL}/admin/render/postgres`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('[fetchBackups] Status da resposta:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[fetchBackups] Dados recebidos:', data);
        setBackups(data.bancos || []);
        setBackupMsg('');
        // Buscar recovery info de todos os bancos
        if (Array.isArray(data.bancos)) {
          data.bancos.forEach((banco) => {
            fetchRecoveryInfo(banco.id, token);
          });
        }
      } else if (response.status === 404) {
        setBackupMsg('Endpoints de backup não implementados no backend ainda');
        console.warn('Rota /admin/render/postgres não encontrada - implemente no backend');
      } else {
        // Tentar ler como JSON, se falhar, ler como texto
        try {
          const errorData = await response.json();
          console.error('[fetchBackups] Erro JSON:', errorData);
          setBackupMsg('Erro ao carregar bancos do Render: ' + (errorData.message || 'Erro desconhecido'));
        } catch (jsonError) {
          const errorText = await response.text();
          console.error('[fetchBackups] Resposta do servidor (texto):', errorText.substring(0, 200));
          setBackupMsg(`Erro do servidor (${response.status}): Resposta não é JSON válido`);
        }
      }
    } catch (error) {
      setBackupMsg('Erro de conexão com o servidor: ' + error.message);
      console.error('[fetchBackups] Erro ao buscar bancos:', error);
    } finally {
      setBackupLoading(false);
    }
  };
  // Função auxiliar para buscar recovery info de um banco
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

  const createBackup = async (serviceId) => {
    try {
      setBackupLoading(true);
      setBackupMsg('Criando backup...');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.apiURL}/admin/render/services/${serviceId}/backup`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBackupMsg('Backup criado com sucesso!');
        setTimeout(() => fetchBackups(), 2000);
      } else if (response.status === 404) {
        setBackupMsg('Endpoint de backup não implementado no backend ainda');
      } else {
        try {
          const errorData = await response.json();
          setBackupMsg('Erro ao criar backup: ' + (errorData.message || 'Erro desconhecido'));
        } catch (jsonError) {
          setBackupMsg(`Erro do servidor (${response.status}): Resposta não é JSON válido`);
        }
      }
    } catch (error) {
      setBackupMsg('Erro de conexão: ' + error.message);
      console.error('Erro ao criar backup:', error);
    } finally {
      setBackupLoading(false);
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
        setRecoveryInfo(prev => ({
          ...prev,
          [postgresId]: data
        }));
        setBackupMsg(`Status de recuperação verificado para ${postgresId}`);
        return data;
      } else if (response.status === 404) {
        setBackupMsg('Endpoint de recovery não implementado no backend ainda');
      } else {
        try {
          const errorData = await response.json();
          setBackupMsg('Erro ao verificar status de recuperação: ' + (errorData.message || 'Erro desconhecido'));
        } catch (jsonError) {
          setBackupMsg(`Erro do servidor (${response.status}): Resposta não é JSON válido`);
        }
      }
    } catch (error) {
      setBackupMsg('Erro de conexão ao verificar recuperação: ' + error.message);
      console.error('Erro ao verificar recovery:', error);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const triggerRecovery = async (postgresId) => {
    if (!window.confirm(`Tem certeza que deseja iniciar a recuperação point-in-time para o serviço ${postgresId}?\n\nEsta operação pode afetar a disponibilidade do banco de dados.`)) {
      return;
    }

    try {
      setRecoveryLoading(true);
      setBackupMsg('Iniciando recuperação point-in-time...');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.apiURL}/admin/render/postgres/${postgresId}/recovery`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Adicione parâmetros específicos se necessário
          // timestamp: new Date().toISOString() // exemplo
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setBackupMsg('Recuperação point-in-time iniciada com sucesso!');
        console.log('Recovery response:', data);
        // Atualizar status após iniciar recovery
        setTimeout(() => checkRecoveryStatus(postgresId), 3000);
      } else if (response.status === 404) {
        setBackupMsg('Endpoint de recovery não implementado no backend ainda');
      } else {
        try {
          const errorData = await response.json();
          setBackupMsg('Erro ao iniciar recuperação: ' + (errorData.message || 'Erro desconhecido'));
        } catch (jsonError) {
          setBackupMsg(`Erro do servidor (${response.status}): Resposta não é JSON válido`);
        }
      }
    } catch (error) {
      setBackupMsg('Erro de conexão ao iniciar recuperação: ' + error.message);
      console.error('Erro ao iniciar recovery:', error);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleEdit = (usuario) => {
    setEditId(usuario.id);
    setEditData({ ...usuario });
    setMsg('');
  };

  const handleEditChange = (e) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/admin/usuarios/${editId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(editData),
    });
    if (res.ok) {
      setMsg('Usuário atualizado!');
      setEditId(null);
      fetchUsuarios();
    } else {
      setMsg('Erro ao atualizar usuário.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/admin/usuarios/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setMsg('Usuário excluído!');
      fetchUsuarios();
    } else {
      setMsg('Erro ao excluir usuário.');
    }
  };

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '40px auto',
        padding: 20,
        border: '1px solid #ddd',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          <Link
            to="/admin/editar-combos"
            style={{
              padding: '10px 20px',
              background: '#8e44ad',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: 16,
            }}
          >
            Editar Combos
          </Link>
          <Link
            to="/admin/importar-atos"
            style={{
              padding: '10px 20px',
              background: '#1976d2',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: 16,
            }}
          >
            Editar Atos (Tabelas 07/08)
          </Link>
        </div>
        <h2 style={{ margin: 0 }}>Painel de Administração</h2>
      </div>

      {/* Seção de Gerenciamento de Backups */}
      <div
        style={{
          background: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: 8,
          padding: 20,
          marginBottom: 30,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, color: '#495057' }}>🗄️ Gerenciamento de Backups (PostgreSQL - Render)</h3>
          <button
            onClick={fetchBackups}
            style={buttonStyle}
            disabled={backupLoading}
          >
            {backupLoading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>

        {backupMsg && (
          <div
            style={{
              color: backupMsg.includes('Erro') ? '#dc3545' : '#28a745',
              background: backupMsg.includes('Erro') ? '#f8d7da' : '#d4edda',
              border: `1px solid ${backupMsg.includes('Erro') ? '#f5c6cb' : '#c3e6cb'}`,
              borderRadius: 4,
              padding: 10,
              marginBottom: 15,
            }}
          >
            {backupMsg}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #dee2e6' }}>
            <thead>
              <tr style={{ background: '#e9ecef' }}>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>
                  Serviço
                </th>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>
                  Tipo
                </th>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>
                  Status
                </th>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>
                  Recovery Status
                </th>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    style={{
                      padding: 20,
                      textAlign: 'center',
                      color: '#6c757d',
                      borderBottom: '1px solid #dee2e6',
                    }}
                  >
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
                    <td style={{ padding: 12, borderBottom: '1px solid #dee2e6' }}>
                      {service.type}
                    </td>
                    <td style={{ padding: 12, borderBottom: '1px solid #dee2e6' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 'bold',
                          background: service.status === 'available' ? '#d4edda' : '#f8d7da',
                          color: service.status === 'available' ? '#155724' : '#721c24',
                        }}
                      >
                        {service.status || 'unknown'}
                      </span>
                    </td>
                    <td style={{ padding: 12, borderBottom: '1px solid #dee2e6' }}>
                      {recoveryInfo[service.id] ? (
                        <div>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 'bold',
                              background: recoveryInfo[service.id].available ? '#e1f5fe' : '#fff3e0',
                              color: recoveryInfo[service.id].available ? '#01579b' : '#e65100',
                            }}
                          >
                            {recoveryInfo[service.id].available ? 'Disponível' : 'Indisponível'}
                          </span>
                          {recoveryInfo[service.id].lastBackup && (
                            <div style={{ fontSize: 10, color: '#6c757d', marginTop: 4 }}>
                              Último backup: {new Date(recoveryInfo[service.id].lastBackup).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#6c757d', fontSize: 12 }}>Não verificado</span>
                      )}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => createBackup(service.id)}
                          style={{ ...buttonBackupStyle, fontSize: 12, padding: '6px 12px' }}
                          disabled={backupLoading || recoveryLoading}
                        >
                          Backup
                        </button>
                        <button
                          onClick={() => checkRecoveryStatus(service.id)}
                          style={{ ...buttonCheckStyle, fontSize: 12, padding: '6px 12px' }}
                          disabled={backupLoading || recoveryLoading}
                        >
                          Check Recovery
                        </button>
                        <button
                          onClick={() => triggerRecovery(service.id)}
                          style={{ ...buttonRecoveryStyle, fontSize: 12, padding: '6px 12px' }}
                          disabled={backupLoading || recoveryLoading || !recoveryInfo[service.id]?.available}
                        >
                          Point-in-Time Recovery
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            background: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: 4,
            padding: 12,
            fontSize: 14,
            color: '#856404',
          }}
        >
          <strong>ℹ️ Informações sobre Backup e Recovery:</strong>
          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
            <li><strong>Backup:</strong> Os backups são armazenados automaticamente pelo Render</li>
            <li><strong>Check Recovery:</strong> Verifica se a recuperação point-in-time está disponível</li>
            <li><strong>Point-in-Time Recovery:</strong> Restaura o banco para um ponto específico no tempo</li>
            <li><strong>Atenção:</strong> Recovery pode afetar a disponibilidade do banco durante o processo</li>
            <li>Verifique o painel do Render para mais detalhes sobre os backups e recovery status</li>
          </ul>
          <div style={{ 
            background: '#f8d7da', 
            border: '1px solid #f5c6cb', 
            borderRadius: 4, 
            padding: 8, 
            marginTop: 10,
            color: '#721c24'
          }}>
            <strong>⚠️ Aviso:</strong> Operações de recovery são críticas. Sempre confirme antes de executar.
          </div>
          <div style={{ 
            background: '#d1ecf1', 
            border: '1px solid #bee5eb', 
            borderRadius: 4, 
            padding: 8, 
            marginTop: 10,
            color: '#0c5460'
          }}>
            <strong>🔧 Status:</strong> {backups.length === 0 && backupMsg.includes('não implementado') ? 
              'Endpoints do Render não implementados no backend ainda. Implemente as rotas mencionadas acima.' : 
              'Sistema funcionando normalmente.'
            }
          </div>
        </div>
      </div>

      {/* Seção de Administração de Usuários */}
      <div>
        <h3 style={{ marginBottom: 16, color: '#495057' }}>👥 Administração de Usuários</h3>
        {msg && (
          <div
            style={{
              color: msg.includes('Erro') ? 'red' : 'green',
              marginBottom: 10,
            }}
          >
            {msg}
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th>Nome</th>
              <th>Email</th>
              <th>Serventia</th>
              <th>Cargo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td>
                  {editId === usuario.id ? (
                    <input
                      name="nome"
                      value={editData.nome}
                      onChange={handleEditChange}
                      style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                    />
                  ) : (
                    usuario.nome
                  )}
                </td>
                <td>{usuario.email}</td>
                <td>
                  {editId === usuario.id ? (
                    <input
                      name="serventia"
                      value={editData.serventia}
                      onChange={handleEditChange}
                      style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                    />
                  ) : (
                    usuario.serventia
                  )}
                </td>
                <td>
                  {editId === usuario.id ? (
                    <select
                      name="cargo"
                      value={editData.cargo}
                      onChange={handleEditChange}
                      style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                    >
                      <option value="Registrador">Registrador</option>
                      <option value="Escrevente">Escrevente</option>
                      <option value="Substituto">Substituto</option>
                      <option value="Auxiliar">Auxiliar</option>
                      <option value="Outro">Outro</option>
                    </select>
                  ) : (
                    usuario.cargo
                  )}
                </td>
                <td>
                  {editId === usuario.id ? (
                    <>
                      <button onClick={handleSave} style={buttonSaveStyle}>
                        Salvar
                      </button>
                      <button onClick={() => setEditId(null)} style={buttonCancelStyle}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleEdit(usuario)} style={buttonEditStyle}>
                        Editar
                      </button>
                      <button onClick={() => handleDelete(usuario.id)} style={{ ...buttonDeleteStyle, marginLeft: 8 }}>
                        Excluir
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}