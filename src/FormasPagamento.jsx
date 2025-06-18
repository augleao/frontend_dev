// FormasPagamento.jsx
import React from 'react';

export default function FormasPagamento({ formasPagamento, pagamentos, onQuantidadeChange, onValorChange, corFundoPagamentos, selectedAto }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {/* Container com fundo acinzentado e bordas arredondadas */}
      <div
        style={{
          backgroundColor: '#f0f0f0',
          borderRadius: 8,
          padding: 16,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <h4 style={{ marginBottom: 8 }}>Formas de Pagamento</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
          {formasPagamento.map((fp) => (
            <div
              key={fp.key}
              style={{
                backgroundColor: corFundoPagamentos(fp.key),
                borderRadius: 8,
                padding: 12,
                minWidth: 180,
              }}
            >
              <strong>{fp.label}</strong>
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13 }}>Qtd:</label>
                <input
                  type="number"
                  min={0}
                  value={pagamentos[fp.key].quantidade}
                  onChange={(e) => onQuantidadeChange(fp.key, e.target.value)}
                  disabled={!selectedAto}
                  style={{
                    width: 50,
                    marginLeft: 4,
                    marginRight: 8,
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    padding: 4,
                  }}
                />
                <label style={{ fontSize: 13 }}>Valor:</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pagamentos[fp.key].valor}
                  onChange={(e) => onValorChange(fp.key, e.target.value)}
                  disabled={!selectedAto}
                  style={{
                    width: 80,
                    marginLeft: 4,
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    padding: 4,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}