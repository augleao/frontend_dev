import React from 'react';
import { formatarMoeda } from './utils';

export default function CaixaInputs({
  valorInicialCaixa,
  valorFinalCaixa,
  ISS, // <-- adicione ISS aqui
}) {
  const inputStyle = {
    width: 150,
    marginLeft: 8,
    padding: 8,
    borderRadius: 6,
    border: '1px solid #ccc',
    textAlign: 'right',
    backgroundColor: '#eee',
    fontSize: '14px',
    fontWeight: '600'
  };

  return (
    <div
      style={{
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
      }}
    >
      <div>
        <label style={{ fontWeight: '600', color: '#2c3e50' }}>Valor Inicial do Caixa:</label>
        <input
          type="text"
          value={formatarMoeda(valorInicialCaixa)}
          readOnly
          style={inputStyle}
        />
      </div>
      <div>
        <label style={{ fontWeight: '600', color: '#2c3e50' }}>Valor Final do Caixa:</label>
        <input
          type="text"
          value={formatarMoeda(valorFinalCaixa)}
          readOnly
          style={inputStyle}
        />
      </div>
      <div>
        <label style={{ fontWeight: '600', color: '#2c3e50' }}>ISS:</label>
        <input
          type="text"
          value={ISS}
          readOnly
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '2px solid #e3f2fd',
            fontSize: '16px',
            backgroundColor: '#f8f9fa',
            color: '#2c3e50',
            fontWeight: '600'
          }}
        />
      </div>
    </div>
  );
}