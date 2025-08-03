import React, { useState } from 'react';
import SeloEletronicoManager from './SeloEletronicoManager';
import config from '../../config';

const statusExecucao = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando', label: 'Aguardando documentos' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' }
];

export default function ServicoExecucao({ form, onChange, pedidoId }) {
  const [execucaoSalva, setExecucaoSalva] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');
  const [execucaoId, setExecucaoId] = useState(pedidoId || (form && form.execucao && form.execucao.id));

  // Função para salvar execução do serviço
  const salvarExecucao = async () => {
    setSalvando(true);
    setErroSalvar('');
    try {
      const token = localStorage.getItem('token');
      const body = {
        protocolo: pedidoId, // ou outro identificador necessário
        ...form.execucao,
        pedidoId: pedidoId
      };
      const res = await fetch(`${config.apiURL}/execucaoservico`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Erro ao salvar execução do serviço');
      const data = await res.json();
      setExecucaoSalva(true);
      setExecucaoId(data.execucaoId || pedidoId); // backend deve retornar o id salvo
    } catch (err) {
      setErroSalvar(err.message || 'Erro desconhecido');
    }
    setSalvando(false);
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
          value={form.execucao.data || new Date().toISOString().slice(0, 10)}
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
      {/* Botão Salvar Execução */}
      {!execucaoSalva && (
        <div style={{ margin: '12px 0' }}>
          <button
            type="button"
            onClick={salvarExecucao}
            disabled={salvando}
            style={{
              padding: '10px 28px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: salvando ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(52,152,219,0.2)'
            }}
          >
            {salvando ? 'Salvando...' : 'Salvar Execução'}
          </button>
          {erroSalvar && <span style={{ color: 'red', marginLeft: 16 }}>{erroSalvar}</span>}
        </div>
      )}
      {/* Selos Eletrônicos - só aparece após salvar execução */}
      {execucaoSalva && (
        <SeloEletronicoManager pedidoId={execucaoId} />
      )}
    </div>
  );
}