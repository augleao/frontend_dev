import React, { useState, useEffect } from 'react';
import { atualizarSeloExecucaoServico } from './ServicoSeloService';

import ClipboardImageUpload from './ClipboardImageUpload';
import SeloFileUpload from './SeloFileUpload';
import config from '../../config';
import './servicos.css';

const palette = {
    primary: '#1d4ed8',
    primaryDark: '#1e3a8a',
    softBg: '#eef5ff',
    softBorder: '#d6e4ff',
    text: '#0f172a'
  };

const statusExecucao = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando', label: 'Aguardando documentos' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' }
];

export default function ServicoExecucao({ form, onChange, pedidoId, onStatusChange, onAvancarEtapa }) {
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');
  const [selos, setSelos] = useState([]);
  // Edição inline de selo
  const [editingSeloId, setEditingSeloId] = useState(null);
  const [editSelo, setEditSelo] = useState({});
  const protocolo = form.protocolo;

  // Buscar selos do pedido ao montar ou quando protocolo mudar
  useEffect(() => {
    if (protocolo) {
      const token = localStorage.getItem('token');
      fetch(`${config.apiURL}/selos-execucao-servico/${encodeURIComponent(protocolo)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setSelos(data.selos || []))
        .catch(() => setSelos([]));
    }
  }, [protocolo, form.execucao && form.execucao.id]);

  // Buscar execução salva ao montar ou quando protocolo mudar
  useEffect(() => {
    if (protocolo) {
      const token = localStorage.getItem('token');
      console.log('[Execucao][EFFECT] Buscando execução salva para protocolo:', protocolo);
      fetch(`${config.apiURL}/execucao-servico/${encodeURIComponent(protocolo)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          console.log('[Execucao][EFFECT] Status da resposta:', res.status);
          return res.ok ? res.json() : null;
        })
        .then(data => {
          console.log('[Execucao][EFFECT] Dados recebidos do backend (sempre mostra):', data);
          if (data && (data.id || data.status || data.responsavel || data.usuario)) {
            // Mapeia 'usuario' do backend para 'responsavel' no frontend
            const execucaoAtualizada = {
              ...data,
              responsavel: data.responsavel || data.usuario || ''
            };
            // Só chama onChange se o id mudou (ou se não havia execucao)
            const idAtual = form.execucao && form.execucao.id;
            if (
              typeof onChange === 'function' &&
              execucaoAtualizada.id &&
              execucaoAtualizada.id !== idAtual
            ) {
              console.log('[Execucao][EFFECT] Chamando onChange para atualizar execucao:', execucaoAtualizada);
              if (execucaoAtualizada && typeof execucaoAtualizada === 'object') {
                Object.entries(execucaoAtualizada).forEach(([k, v]) => {
                  console.log(`[Execucao][EFFECT] campo ${k}:`, v);
                });
              }
              onChange('execucao', execucaoAtualizada);
            }
          } else {
            console.log('[Execucao][EFFECT] Nenhuma execução encontrada no backend para este protocolo.');
          }
        })
        .catch((e) => {
          console.error('[Execucao][EFFECT] Erro ao buscar execução salva:', e);
        });
    } else {
      console.log('[Execucao][EFFECT] Não buscou execução: protocolo=', protocolo, 'form.execucao=', form.execucao);
    }
  }, [protocolo, onChange]);
  // Função para salvar ou alterar execução do serviço
  const salvarOuAlterarExecucao = async () => {
    setSalvando(true);
    setErroSalvar('');
  try {
      const token = localStorage.getItem('token');
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      const usuarioNome = usuario.nome || usuario.email || 'Usuário';
      const body = {
        protocolo: pedidoId,
        usuario: usuarioNome,
        ...form.execucao,
        pedidoId: pedidoId
      };
      const method = form.execucao && form.execucao.id ? 'PUT' : 'POST';
      const url = method === 'PUT'
        ? `${config.apiURL}/execucao-servico/${form.execucao.id}`
        : `${config.apiURL}/execucao-servico`;
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Erro ao salvar execução do serviço');
      const data = await res.json();
      // Sempre atualiza o form.execucao no componente pai
      if (data && data.execucao && typeof onChange === 'function') {
        onChange('execucao', data.execucao);
      } else if (data && data.execucaoId && typeof onChange === 'function') {
        // fallback para casos antigos
        onChange('execucao', { ...form.execucao, id: data.execucaoId });
      }

      // Após salvar execução, registra status 'aguardando_entrega' na tabela pedido_status
      if (pedidoId) {
        try {
          await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(pedidoId)}/status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              status: 'Aguardando Entrega',
              usuario: usuarioNome
            })
          });
        } catch (e) {
          // Apenas loga, não bloqueia o fluxo
          console.error('[Execucao] Erro ao registrar status aguardando_entrega:', e);
        }
        // Atualiza status no componente pai
        if (typeof onStatusChange === 'function') {
          onStatusChange('Aguardando Entrega');
        }
        // Avança para a próxima etapa (entrega) após salvar execução
        if (typeof onAvancarEtapa === 'function') {
          onAvancarEtapa();
        }
      }
    } catch (err) {
      setErroSalvar(err.message || 'Erro desconhecido');
    }
    setSalvando(false);
  };

  // Garante formato yyyy-MM-dd para o campo data
  const getDataExecucao = () => {
    const raw = form.execucao.data;
    if (!raw) return new Date().toISOString().slice(0, 10);
    if (typeof raw === 'string' && raw.length >= 10) {
      // Se vier no formato ISO, extrai só a parte da data
      if (raw.includes('T')) return raw.split('T')[0];
      // Se já está no formato yyyy-MM-dd, retorna direto
      return raw.slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  };

  // Função para excluir selo
  const excluirSelo = async (selo) => {
    if (!window.confirm('Tem certeza que deseja excluir este selo?')) return;
    try {
      const token = localStorage.getItem('token');
      // O backend espera execucaoId = protocolo (string) e seloId
      const execucaoId = form.protocolo;
      if (!execucaoId || !selo.id) {
        alert('Dados insuficientes para exclusão.');
        return;
      }
      const res = await fetch(`${config.apiURL}/execucao-servico/${encodeURIComponent(execucaoId)}/selo/${selo.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Erro ao excluir selo: ' + (err.error || res.status));
        return;
      }
      setSelos(prev => prev.filter(s => s.id !== selo.id));
    } catch (err) {
      alert('Erro ao excluir selo.');
    }
  };

  return (
    <div className="servico-section">
      <div className="servico-header" style={{ background: palette.softBg, border: `1px solid ${palette.softBorder}`, borderRadius: 10, padding: '10px 12px' }}>
        <h3 className="servico-title" style={{ color: palette.primary, margin: 0 }}>Execução do Serviço</h3>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ color: palette.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>Responsável:</label>
          <span
            style={{
              color: palette.primary,
              fontWeight: 600,
              fontSize: 13,
              background: 'transparent'
            }}
          >
            {(() => {
              const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
              return usuario.nome || usuario.email || 'Usuário';
            })()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 16 }}>
          <label style={{ color: palette.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>Data:</label>
          <input
            type="date"
            value={getDataExecucao()}
            onChange={e => onChange('data', e.target.value)}
            style={{
              width: 140,
              border: `1.5px solid ${palette.softBorder}`,
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 13,
              height: 32,
              boxSizing: 'border-box',
              background: '#fff',
              color: palette.text,
              fontWeight: 500
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 16 }}>
          <label style={{ color: palette.primary, fontWeight: 600, fontSize: 13, margin: 0 }}>Observações:</label>
          <textarea
            value={form.execucao.observacoes}
            onChange={e => onChange('observacoes', e.target.value)}
            maxLength={200}
            style={{
              width: 220,
              minHeight: 32,
              border: `1.5px solid ${palette.softBorder}`,
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 13,
              resize: 'vertical',
              boxSizing: 'border-box',
              background: '#fff',
              color: palette.text,
              fontWeight: 500
            }}
          />
          {form.execucao && form.execucao.id && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, margin: '8px 0' }}>
              <ClipboardImageUpload
                protocolo={protocolo}
                onUpload={() => {
                  if (protocolo) {
                    const token = localStorage.getItem('token');
                    fetch(`${config.apiURL}/selos-execucao-servico/${encodeURIComponent(protocolo)}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    })
                      .then(res => res.json())
                      .then(data => setSelos(data.selos || []))
                      .catch(() => setSelos([]));
                  }
                }}
              />
              <SeloFileUpload
                protocolo={protocolo}
                onUpload={() => {
                  if (protocolo) {
                    const token = localStorage.getItem('token');
                    fetch(`${config.apiURL}/selos-execucao-servico/${encodeURIComponent(protocolo)}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    })
                      .then(res => res.json())
                      .then(data => setSelos(data.selos || []))
                      .catch(() => setSelos([]));
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
      {/* Botões de ação Execução */}
      <div className="servico-actions" style={{ justifyContent: 'flex-start' }}>
        {!(form.execucao && form.execucao.id) ? (
          <button
            type="button"
            onClick={salvarOuAlterarExecucao}
            disabled={salvando}
            className="btn btn-primary"
          >
            {salvando ? 'Salvando...' : 'Salvar Execução'}
          </button>
        ) : (
          <button
            type="button"
            onClick={async () => {
              const token = localStorage.getItem('token');
              const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
              const usuarioNome = usuario.nome || usuario.email || 'Usuário';
              try {
                // Exclui a execução salva
                if (form.execucao && form.execucao.id) {
                  const res = await fetch(`${config.apiURL}/execucao-servico/${form.execucao.id}`, {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    alert('Erro ao excluir execução: ' + (err.error || res.status));
                    return;
                  }
                }
                // Atualiza o status do pedido
                await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(pedidoId)}/status`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    status: 'Aguardando Execução',
                    usuario: usuarioNome
                  })
                });
                // Limpa a execução do form para reabilitar o botão salvar
                if (typeof onChange === 'function') {
                  onChange('execucao', {});
                }
                alert('Execução cancelada e status do pedido alterado para "Aguardando Execução".');
              } catch (e) {
                alert('Erro ao cancelar execução ou atualizar status do pedido.');
              }
            }}
            className="btn btn-danger"
          >
            Cancelar Execução
          </button>
        )}
        {erroSalvar && <span style={{ color: 'red', marginLeft: 16 }}>{erroSalvar}</span>}
      </div>
      {/* Selos Eletrônicos - só aparece após salvar execução */}
      {/* Selos Eletrônicos - só aparece após salvar execução */}
  {/* (Bloco removido: Selos Eletrônicos) */}
      {/* Tabela de selos utilizada neste pedido - sempre no final do componente */}
      {form.execucao && form.execucao.id && selos.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ color: palette.primaryDark, marginBottom: 2 }}>Selos Utilizados neste Pedido</h4>
          <div className="servico-table-container">
          <table className="servico-table" style={{ background: '#fff' }}>
            <thead>
              <tr style={{ background: '#e1e9ff' }}>
                <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Selo Consulta</th>
                <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Código de Segurança</th>
                <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Qtd. Atos</th>
                <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Atos praticados por</th>
                <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Valores</th>
                <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Data/Hora</th>
                <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {selos.map((selo, idx) => {
                const isEditing = editingSeloId === selo.id;
                return (
                  <tr key={selo.id || idx} style={{ background: idx % 2 === 0 ? palette.softBg : '#fff' }}>
                    <td style={{ padding: 2, fontSize: isEditing ? 13 : 12 }}>
                      {isEditing ? (
                        <input value={editSelo.selo_consulta || ''} onChange={e => setEditSelo({ ...editSelo, selo_consulta: e.target.value })} style={{ width: 80, fontSize: 9, padding: '1px 2px' }} placeholder="Selo" />
                      ) : (<span style={{ fontSize: 11 }}>{selo.selo_consulta || selo.seloConsulta || ''}</span>)}
                    </td>
                    <td style={{ padding: 2, fontSize: isEditing ? 13 : 12 }}>
                      {isEditing ? (
                        <input value={editSelo.codigo_seguranca || ''} onChange={e => setEditSelo({ ...editSelo, codigo_seguranca: e.target.value })} style={{ width: 120, fontSize: 9, padding: '1px 2px' }} placeholder="Código" />
                      ) : (<span style={{ fontSize: 11 }}>{selo.codigo_seguranca || selo.codigoSeguranca || ''}</span>)}
                    </td>
                    <td style={{ padding: 2, fontSize: isEditing ? 13 : 12 }}>
                      {isEditing ? (
                        <input value={editSelo.qtd_atos || ''} onChange={e => setEditSelo({ ...editSelo, qtd_atos: e.target.value })} style={{ width: 40, fontSize: 9, padding: '1px 2px' }} placeholder="Qtd" />
                      ) : (<span style={{ fontSize: 11 }}>{selo.qtd_atos || selo.qtdAtos || ''}</span>)}
                    </td>
                    <td style={{ padding: 2, fontSize: isEditing ? 13 : 12 }}>
                      {isEditing ? (
                        <input value={editSelo.atos_praticados_por || ''} onChange={e => setEditSelo({ ...editSelo, atos_praticados_por: e.target.value })} style={{ width: 100, fontSize: 9, padding: '1px 2px' }} placeholder="Praticado por" />
                      ) : (<span style={{ fontSize: 11 }}>{selo.atos_praticados_por || selo.atosPraticadosPor || ''}</span>)}
                    </td>
                    <td style={{ padding: 2, fontSize: isEditing ? 13 : 12 }}>
                      {isEditing ? (
                        <input
                          value={editSelo.valores || ''}
                          onChange={e => setEditSelo({ ...editSelo, valores: e.target.value })}
                          style={{ width: 320, fontSize: 9, padding: '1px 2px' }}
                          placeholder="Valores"
                        />
                      ) : (
                        <span style={{ fontSize: 11 }}>{selo.valores || ''}</span>
                      )}
                    </td>
                    <td style={{ padding: 2, fontSize: 12 }}>{selo.criado_em ? new Date(selo.criado_em).toLocaleString() : ''}</td>
                    <td style={{ padding: 2, fontSize: 12, display: 'flex', gap: 6 }}>
                      {isEditing ? (
                        <>
                          <button
                            style={{ background: '#388e3c', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            title="Salvar"
                            onClick={async () => {
                              try {
                                await atualizarSeloExecucaoServico(selo.id, editSelo);
                                setSelos(prevSelos =>
                                  prevSelos.map(s =>
                                    s.id === selo.id ? { ...s, ...editSelo } : s
                                  )
                                );
                                setEditingSeloId(null);
                                setEditSelo({});
                              } catch (error) {
                                alert('Erro ao salvar selo: ' + error.message);
                              }
                            }}
                          >Salvar</button>
                          <button
                            style={{ background: '#aaa', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            title="Cancelar"
                            onClick={() => { setEditingSeloId(null); setEditSelo({}); }}
                          >Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button
                            style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            title="Editar selo"
                            onClick={() => { setEditingSeloId(selo.id); setEditSelo({ ...selo }); }}
                          >Editar</button>
                          <button
                            style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            title="Excluir selo"
                            onClick={() => excluirSelo(selo)}
                          >Excluir</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}