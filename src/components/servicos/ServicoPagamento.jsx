import React from 'react';

const statusPagamento = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Pago' }
];

export default function ServicoPagamento({ form, onChange }) {
  const inputStyle = {
    width: '100%', 
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid #cbd5e0',
    fontSize: '14px',
    backgroundColor: 'white',
    transition: 'border-color 0.2s ease',
    marginBottom: 16
  };

  const labelStyle = {
    fontWeight: '600', 
    color: '#4a5568',
    fontSize: '14px',
    display: 'block',
    marginBottom: 6
  };

  return (
    <div
      style={{
        background: '#f8fafc',
        borderRadius: 16,
        padding: 28,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        marginBottom: 24,
        border: '1px solid #e2e8f0'
      }}
    >
      <h3 style={{
        color: '#2d3748',
        fontSize: '20px',
        fontWeight: '700',
        marginBottom: 20,
        borderBottom: '2px solid #667eea',
        paddingBottom: 8
      }}>Pagamento</h3>
      
      <label style={labelStyle}>Status do pagamento:</label>
      <select 
        value={form.pagamento.status} 
        onChange={e => onChange('status', e.target.value)} 
        style={inputStyle}
      >
        {statusPagamento.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      
      <label style={labelStyle}>Valor total do serviço:</label>
      <input 
        type="number" 
        value={form.pagamento.valorTotal} 
        onChange={e => onChange('valorTotal', e.target.value)} 
        style={inputStyle} 
      />
      
      <label style={labelStyle}>Valor pago:</label>
      <input 
        type="number" 
        value={form.pagamento.valorPago} 
        onChange={e => onChange('valorPago', e.target.value)} 
        style={inputStyle} 
      />
      
      <label style={labelStyle}>Data do pagamento:</label>
      <input 
        type="date" 
        value={form.pagamento.data} 
        onChange={e => onChange('data', e.target.value)} 
        style={inputStyle} 
      />
      
      <label style={labelStyle}>Forma de pagamento:</label>
      <select 
        value={form.pagamento.forma} 
        onChange={e => onChange('forma', e.target.value)} 
        style={inputStyle}
      >
        <option value="">Selecione...</option>
        <option value="dinheiro">Dinheiro</option>
        <option value="cartao">Cartão</option>
        <option value="pix">PIX</option>
        <option value="boleto">Boleto</option>
      </select>
      
      {form.pagamento.status === 'pago' && (
        <div style={{ 
          marginTop: 16, 
          padding: '12px 16px',
          background: '#f0fff4',
          border: '1px solid #68d391',
          borderRadius: 8,
          color: '#22543d', 
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          ✅ Recibo digital gerado para protocolo {form.protocolo}
        </div>
      )}
    </div>
  );
}