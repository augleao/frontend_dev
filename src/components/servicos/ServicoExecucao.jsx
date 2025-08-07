import React, { useState, useEffect } from 'react';
import SeloEletronicoManager from './SeloEletronicoManager';
import config from '../../config';

const statusExecucao = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando', label: 'Aguardando documentos' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' }
];

export default function ServicoExecucao({ form, onChange, pedidoId }) {
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');
  const [selos, setSelos] = useState([]);
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

  // Função para salvar ou alterar execução do serviço
  const salvarOuAlterarExecucao = async () => {
    setSalvando(true);
    setErroSalvar('');
    try {
      const token = localStorage.getItem('token');
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      const body = {
        protocolo: pedidoId,
        usuario: usuario.nome || usuario.email || 'Usuário',
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
    <div
      style={{
        border: '2.5px solid #3498db',
        borderRadius: 16,
        padding: '18px 32px 18px 32px',
        background: '#f5faff',
        boxShadow: '0 2px 12px rgba(52,152,219,0.10)',
        marginBottom: 24,
        width: '100%',
        marginLeft: 0,
        marginRight: 0,
        marginTop: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxSizing: 'border-box'
      }}
    >
      <h3 style={{
        color: '#2471a3',
        fontWeight: 700,
        fontSize: 18,
        margin: 0,
        marginBottom: 12,
        letterSpacing: 0.5
      }}>Execução do Serviço</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <label style={{ color: '#2471a3', fontWeight: 600, fontSize: 13, minWidth: 140, margin: 0 }}>Responsável:</label>
        <span
          style={{
            width: 220,
            display: 'inline-block',
            border: '1.5px solid #aed6f1',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 13,
            height: 32,
            boxSizing: 'border-box',
            background: '#fff',
            color: '#154360',
            fontWeight: 500,
            lineHeight: '24px',
            verticalAlign: 'middle',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis'
          }}
        >
          {(() => {
            const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
            return usuario.nome || usuario.email || 'Usuário';
          })()}
        </span>
        <label style={{ color: '#2471a3', fontWeight: 600, fontSize: 13, minWidth: 60, margin: 0, marginLeft: 16 }}>Data:</label>
        <input
          type="date"
          value={getDataExecucao()}
          onChange={e => onChange('data', e.target.value)}
          style={{
            width: 140,
            border: '1.5px solid #aed6f1',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 13,
            height: 32,
            boxSizing: 'border-box',
            background: '#fff',
            color: '#154360',
            fontWeight: 500
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <label style={{ color: '#2471a3', fontWeight: 600, fontSize: 13, minWidth: 100, margin: 0, marginTop: 4 }}>Observações:</label>
        <textarea
          value={form.execucao.observacoes}
          onChange={e => onChange('observacoes', e.target.value)}
          maxLength={200}
          style={{
            width: 220,
            minHeight: 32,
            border: '1.5px solid #aed6f1',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 13,
            resize: 'vertical',
            boxSizing: 'border-box',
            background: '#fff',
            color: '#154360',
            fontWeight: 500
          }}
        />
      </div>
      {/* Botão Salvar/Alterar Execução */}
      <div style={{ margin: '12px 0' }}>
        <button
          type="button"
          onClick={salvarOuAlterarExecucao}
          disabled={salvando}
          style={{
            padding: '10px 28px',
            background: form.execucao && form.execucao.id ? '#f39c12' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: salvando ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(52,152,219,0.2)'
          }}
        >
          {salvando
            ? (form.execucao && form.execucao.id ? 'Alterando...' : 'Salvando...')
            : (form.execucao && form.execucao.id ? 'Alterar Execução' : 'Salvar Execução')}
        </button>
        {erroSalvar && <span style={{ color: 'red', marginLeft: 16 }}>{erroSalvar}</span>}
      </div>
      {/* Selos Eletrônicos - só aparece após salvar execução */}
      {/* Selos Eletrônicos - só aparece após salvar execução */}
      {form.execucao && form.execucao.id && (
        <>
          <SeloEletronicoManager protocolo={protocolo} onSelosChange={setSelos} />
          {/* Tabela de selos utilizados neste pedido */}
          {selos.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ color: '#6c3483', marginBottom: 8 }}>Selos Utilizados neste Pedido</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
                <thead>
                  <tr style={{ background: '#ede1f7' }}>
                    <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Selo Consulta</th>
                    <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Código de Segurança</th>
                    <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Qtd. Atos</th>
                    <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Atos praticados por</th>
                    <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Valores</th>
                    <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Data/Hora</th>
                    <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {selos.map((selo, idx) => (
                    <tr key={selo.id || idx} style={{ background: idx % 2 === 0 ? '#f8f4fc' : '#fff' }}>
                      <td style={{ padding: 6, fontSize: 12 }}>{selo.selo_consulta}</td>
                      <td style={{ padding: 6, fontSize: 12 }}>{selo.codigo_seguranca}</td>
                      <td style={{ padding: 6, fontSize: 12 }}>{selo.qtd_atos}</td>
                      <td style={{ padding: 6, fontSize: 12 }}>{selo.atos_praticados_por}</td>
                      <td style={{ padding: 6, fontSize: 12 }}>{selo.valores}</td>
                      <td style={{ padding: 6, fontSize: 12 }}>{selo.criado_em ? new Date(selo.criado_em).toLocaleString() : ''}</td>
                      <td style={{ padding: 6, fontSize: 12 }}>
                        <button
                          style={{
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            padding: '4px 10px',
                            fontSize: 12,
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                          title="Excluir selo"
                          onClick={() => excluirSelo(selo)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}