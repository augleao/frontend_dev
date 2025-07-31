// FormasPagamento.jsx
import React from 'react';

export default function FormasPagamento({ formasPagamento, pagamentos, onQuantidadeChange, onValorChange, corFundoPagamentos, selectedAto }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {/* Container com fundo acinzentado e bordas arredondadas */}
      <div
        style={{
          backgroundColor: '#f0f0f0',
          borderRadius: 8,
          padding: 10,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
 
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {formasPagamento.map((fp) => (
            <div
              key={fp.key}
              style={{
                backgroundColor: corFundoPagamentos(fp.key),
                borderRadius: 6,
                padding: 8,
                minWidth: 160,
              }}
            >
              <strong style={{ fontSize: 13 }}>{fp.label}</strong>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12 }}>Qtd:</label>
                <input
                  type="number"
                  min={0}
                  value={pagamentos[fp.key].quantidade}
                  onChange={(e) => onQuantidadeChange(fp.key, e.target.value)}
                  disabled={!selectedAto}
                  style={{
                    width: 40,
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    padding: 2,
                    fontSize: 12,
                  }}
                />
                <label style={{ fontSize: 12 }}>Valor:</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pagamentos[fp.key].valor}
                  onChange={(e) => onValorChange(fp.key, e.target.value)}
                  disabled={!selectedAto}
                  style={{
                    width: 70,
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    padding: 2,
                    fontSize: 12,
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