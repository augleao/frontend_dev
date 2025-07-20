import React from 'react';

export default function ServicoEntrega({ form, onChange }) {
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
      <h3>Entrega do Serviço</h3>
      <label>Data da entrega:</label>
      <input type="date" value={form.entrega.data} onChange={e => onChange('data', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>Hora da entrega:</label>
      <input type="time" value={form.entrega.hora} onChange={e => onChange('hora', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>Retirado por:</label>
      <input type="text" value={form.entrega.retiradoPor} onChange={e => onChange('retiradoPor', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>Documento de retirada:</label>
      <input type="text" value={form.entrega.documentoRetirada} onChange={e => onChange('documentoRetirada', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>
        <input type="checkbox" checked={form.entrega.assinaturaDigital} onChange={e => onChange('assinaturaDigital', e.target.checked)} />
        Confirmação de entrega via assinatura digital
      </label>
    </div>
  );
}