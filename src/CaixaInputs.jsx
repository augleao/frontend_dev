import React, { useState } from 'react';
import { formatarMoeda } from './utils';

export default function CaixaInputs({
  valorInicialCaixa: valorInicialCaixaProp,
  valorFinalCaixa,
  ISS,
  depositosCaixa,
  saidasCaixa,
  setValorInicialCaixa,
  setDepositosCaixa,
  setSaidasCaixa
}) {
  const inputStyle = {
    width: '100%',
    padding: 8,
    borderRadius: 6,
    border: '1px solid #ccc',
    textAlign: 'right',
    backgroundColor: '#eee',
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: 4
  };

  const infoStyle = {
    width: '100%',
    padding: 8,
    borderRadius: 6,
    border: 'none',
    textAlign: 'right',
    backgroundColor: 'transparent',
    fontSize: '15px',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8
  };

  const labelStyle = {
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
    fontSize: '15px'
  };

  // Supondo que ISS é um número (ex: 3 para 3%)
  const somaDinheiroAtos = Array.isArray(atos)
    ? atos
        .filter(ato => ato.formaPagamento === 'Dinheiro')
        .reduce(
          (soma, ato) =>
            soma + Number(ato.valor) + (Number(ato.valor) * (Number(ISS) / 100)),
          0
        )
    : 0;

  return (
    <div
      style={{
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 24,
        alignItems: 'end'
      }}
    >
      <div>
        <label style={labelStyle}>Valor Inicial do Caixa</label>
        <input
          type="number"
          step="0.01"
          value={valorInicialCaixaProp}
          onChange={e => setValorInicialCaixa(Number(e.target.value))}
          placeholder="0.00"
          style={inputStyle}
        />
        <div style={infoStyle}>{formatarMoeda(valorInicialCaixaProp)}</div>
      </div>
      <div>
        <label style={labelStyle}>Depósitos do Caixa</label>
        <input
          type="number"
          step="0.01"
          value={depositosCaixa}
          onChange={e => setDepositosCaixa(Number(e.target.value))}
          placeholder="0.00"
          style={inputStyle}
        />
        <div style={infoStyle}>{formatarMoeda(depositosCaixa)}</div>
      </div>
      <div>
        <label style={labelStyle}>Saídas do Caixa</label>
        <input
          type="number"
          step="0.01"
          value={saidasCaixa}
          onChange={e => setSaidasCaixa(Number(e.target.value))}
          placeholder="0.00"
          style={inputStyle}
        />
        <div style={infoStyle}>{formatarMoeda(saidasCaixa)}</div>
      </div>      
      <div>
        <label style={labelStyle}>Valor Final do Caixa</label>
        <div style={{
          ...infoStyle,
          backgroundColor: '#e3fcec',
          color: '#218838',
          fontWeight: 'bold',
          fontSize: '17px'
        }}>
          {formatarMoeda(valorFinalCaixa)}
        </div>
      </div>
    </div>
  );
}