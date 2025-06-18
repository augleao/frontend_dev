// CaixaInputs.jsx
import React from 'react';

export default function CaixaInputs({
  valorInicialCaixa,
  setValorInicialCaixa,
  depositosCaixa,
  setDepositosCaixa,
  saidasCaixa,
  setSaidasCaixa,
  valorFinalCaixa,
}) {
  const inputStyle = {
    width: 120,
    marginLeft: 8,
    padding: 6,
    borderRadius: 6,
    border: '1px solid #ccc',
    textAlign: 'right',
  };

  return (
    <div
      style={{
        backgroundColor: '#f0f0f0', // fundo acinzentado
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // sombra leve
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
      }}
    >
      <div>
        <label>Valor Inicial do Caixa:</label>
        <input
          type="number"
          value={valorInicialCaixa}
          onChange={(e) => setValorInicialCaixa(parseFloat(e.target.value) || 0)}
          style={inputStyle}
        />
      </div>
      <div>
        <label>Depósitos do Caixa:</label>
        <input
          type="number"
          value={depositosCaixa}
          onChange={(e) => setDepositosCaixa(parseFloat(e.target.value) || 0)}
          style={inputStyle}
        />
      </div>
      <div>
        <label>Saídas do Caixa:</label>
        <input
          type="number"
          value={saidasCaixa}
          onChange={(e) => setSaidasCaixa(parseFloat(e.target.value) || 0)}
          style={inputStyle}
        />
      </div>
      <div>
        <label>Valor Final do Caixa:</label>
        <input
          type="text"
          value={`R$ ${valorFinalCaixa.toFixed(2)}`}
          readOnly
          style={{ ...inputStyle, backgroundColor: '#eee' }}
        />
      </div>
    </div>
  );
}