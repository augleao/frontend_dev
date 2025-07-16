import React from 'react';

export default function ServicoEntrada({ form, tiposServico, onChange }) {
  return (
    <div>
      <h3>Entrada do Serviço</h3>
      <label>Número de Protocolo:</label>
      <input type="text" value={form.protocolo} readOnly style={{ width: '100%', marginBottom: 8 }} />
      <label>Tipo de Serviço:</label>
      <select value={form.tipo} onChange={e => onChange('tipo', e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
        <option value="">Selecione...</option>
        {tiposServico.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <label>Descrição:</label>
      <input type="text" value={form.descricao} onChange={e => onChange('descricao', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>Prazo estimado:</label>
      <input type="date" value={form.prazo} onChange={e => onChange('prazo', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
    </div>
  );
}