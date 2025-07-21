import React from 'react';

const statusPagamento = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Pago' }
];

export default function ServicoPagamento({ form, onChange }) {
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
      <h3>Pagamento</h3>
      <label>Status do pagamento:</label>
      <select value={form.pagamento.status} onChange={e => onChange('status', e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
        {statusPagamento.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <label>Valor total do serviço:</label>
      <input type="number" value={form.pagamento.valorTotal} onChange={e => onChange('valorTotal', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>Valor pago:</label>
      <input type="number" value={form.pagamento.valorPago} onChange={e => onChange('valorPago', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>Data do pagamento:</label>
      <input type="date" value={form.pagamento.data} onChange={e => onChange('data', e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      <label>Forma de pagamento:</label>
      <select value={form.pagamento.forma} onChange={e => onChange('forma', e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
        <option value="">Selecione...</option>
        <option value="dinheiro">Dinheiro</option>
        <option value="cartao">Cartão</option>
        <option value="pix">PIX</option>
        <option value="boleto">Boleto</option>
      </select>
      {form.pagamento.status === 'pago' && (
        <div style={{ marginTop: 8, color: '#27ae60', fontWeight: '600' }}>
          Recibo digital gerado para protocolo {form.protocolo}
        </div>
      )}
    </div>
  );
}