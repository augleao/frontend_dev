import React from 'react';

const statusExecucao = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando', label: 'Aguardando documentos' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' }
];

export default function ServicoExecucao({ form, onChange }) {
  return (
    <div
      style={{
        border: '2px solid #3498db',
        borderRadius: 12,
        padding: 24,
        background: '#fafcff',
        boxShadow: '0 2px 8px rgba(52,152,219,0.08)',
        marginBottom: 24
      }}
    >
      <h3>Execução do Serviço</h3>
      <label>Status de execução:</label>
      <select value={form.execucao.status} onChange={e => onChange('status', e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
        {statusExecucao.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <label>Observações internas:</label>
      <textarea value={form.execucao.observacoes} onChange={e => onChange('observacoes', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>Funcionário responsável:</label>
      <input type="text" value={form.execucao.responsavel} onChange={e => onChange('responsavel', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
    </div>
  );
}