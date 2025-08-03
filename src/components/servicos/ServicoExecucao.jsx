import React from 'react';
import SeloEletronicoManager from './SeloEletronicoManager';

const statusExecucao = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando', label: 'Aguardando documentos' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' }
];

export default function ServicoExecucao({ form, onChange, pedidoId }) {
  // Log para depuração do form e do pedidoId
  console.log('[DEBUG][ServicoExecucao] form recebido:', form);
  console.log('[DEBUG][ServicoExecucao] pedidoId recebido via prop:', pedidoId);
  console.log('[DEBUG][ServicoExecucao] form.execucao.id:', form?.execucao?.id);
  console.log('[DEBUG][ServicoExecucao] form.id:', form?.id);
  
  // Preferir pedidoId da prop, senão usar form.execucao.id
  const pedidoIdFinal = pedidoId || (form && form.execucao && form.execucao.id);
  console.log('[DEBUG][ServicoExecucao] pedidoIdFinal usado:', pedidoIdFinal);
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
      {/* Selos Eletrônicos - área de colagem/upload e tabela de selos extraídos */}
      <SeloEletronicoManager pedidoId={pedidoIdFinal} />
    </div>
  );
}