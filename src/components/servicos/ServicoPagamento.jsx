import React from 'react';

const statusPagamento = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Pago' }
];

export default function ServicoPagamento({ form, onChange, valorTotal = 0 }) {
  const inputStyle = {
    width: '100%', 
    padding: '12px 16px',
    borderRadius: 8,
    border: '3px solid #b30202ff',
    fontSize: '14px',
    backgroundColor: 'white',
    transition: 'border-color 0.2s ease',
    marginBottom: 16,
    '&:focus': {
      borderColor: '#e53e3e',
      outline: 'none',
      boxShadow: '0 0 0 3px rgba(229,62,62,0.1)'
    }
  };

  const labelStyle = {
    fontWeight: '600', 
    color: '#742a2a',
    fontSize: '14px',
    display: 'block',
    marginBottom: 6
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer'
  };

  return (
    <div
      style={{
        background: '#fef5f5',
        borderRadius: 16,
        padding: 28,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        marginBottom: 24,
        border: '3px solid #8b1a1a'
      }}
    >
      <h3 style={{
        color: '#742a2a',
        fontSize: '20px',
        fontWeight: '700',
        marginBottom: 20,
        borderBottom: '2px solid #e53e3e',
        paddingBottom: 8
      }}>💳 Informações de Pagamento</h3>
      
      {/* Valor a ser pago */}
      <div style={{
        marginBottom: 20,
        textAlign: 'left'
      }}>
        <span style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#742a2a',
          marginRight: 12
        }}>
          Valor a ser pago:
        </span>
        <span style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#e53e3e',
          fontFamily: 'monospace'
        }}>
          R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      
      <label style={labelStyle}>Status do pagamento:</label>
      <select 
        value={form.pagamento.status} 
        onChange={e => onChange('status', e.target.value)} 
        style={selectStyle}
      >
        {statusPagamento.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      
      <label style={labelStyle}>Valor total do serviço:</label>
      <input 
        type="number" 
        value={form.pagamento.valorTotal} 
        onChange={e => onChange('valorTotal', e.target.value)} 
        style={inputStyle}
        placeholder="R$ 0,00"
      />
      
      <label style={labelStyle}>Valor pago:</label>
      <input 
        type="number" 
        value={form.pagamento.valorPago} 
        onChange={e => onChange('valorPago', e.target.value)} 
        style={inputStyle}
        placeholder="R$ 0,00"
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
        style={selectStyle}
      >
        <option value="">Selecione uma forma de pagamento...</option>
        <option value="dinheiro">💵 Dinheiro</option>
        <option value="cartao">💳 Cartão</option>
        <option value="pix">📱 PIX</option>
        <option value="boleto">📄 Boleto</option>
      </select>
      
      {form.pagamento.status === 'pago' && (
        <div style={{ 
          marginTop: 20, 
          padding: 16,
          background: 'linear-gradient(135deg, #c53030 0%, #9b2c2c 100%)',
          color: '#fff',
          borderRadius: 8,
          fontWeight: '600',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(197,48,48,0.3)'
        }}>
          ✅ Recibo digital gerado para protocolo {form.protocolo}
        </div>
      )}
      
      {/* Cálculo do valor pendente */}
      {form.pagamento.valorTotal && form.pagamento.valorPago && (
        <div style={{
          marginTop: 20,
          padding: 16,
          background: '#fff5f5',
          border: '1px solid #feb2b2',
          borderRadius: 8
        }}>
          <div style={{ 
            fontSize: '14px', 
            color: '#742a2a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span><strong>Valor Total:</strong></span>
            <span style={{ fontWeight: 'bold' }}>R$ {parseFloat(form.pagamento.valorTotal || 0).toFixed(2)}</span>
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: '#742a2a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8
          }}>
            <span><strong>Valor Pago:</strong></span>
            <span style={{ fontWeight: 'bold' }}>R$ {parseFloat(form.pagamento.valorPago || 0).toFixed(2)}</span>
          </div>
          <hr style={{ margin: '12px 0', border: '1px solid #feb2b2' }} />
          <div style={{ 
            fontSize: '16px', 
            color: '#742a2a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 'bold'
          }}>
            <span>Valor Pendente:</span>
            <span style={{ 
              color: parseFloat(form.pagamento.valorTotal || 0) - parseFloat(form.pagamento.valorPago || 0) <= 0 ? '#38a169' : '#e53e3e'
            }}>
              R$ {(parseFloat(form.pagamento.valorTotal || 0) - parseFloat(form.pagamento.valorPago || 0)).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}