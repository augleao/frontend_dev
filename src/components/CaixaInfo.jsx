import React from 'react';
import { formatarMoeda } from './utilsAtos';

export default function CaixaInfo({
  responsavel, setResponsavel,
  ISS, setISS,
  valorInicialCaixa, setValorInicialCaixa,
  depositosCaixa, setDepositosCaixa,
  saidasCaixa, setSaidasCaixa,
  observacoesGerais, setObservacoesGerais,
  valorFinalCaixa
}) {
  // Estilo para campos somente leitura (informação)
  const infoStyle = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '15px',
    backgroundColor: 'transparent',
    color: '#2c3e50',
    fontWeight: '600',
    marginBottom: '4px',
    minHeight: '32px',
    lineHeight: '1.4'
  };

  // Estilo para inputs editáveis
  const inputStyle = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1.5px solid #e3f2fd',
    fontSize: '15px',
    marginBottom: '4px',
    backgroundColor: '#f0f0f0',
    color: '#2c3e50',
    fontWeight: '600',
    minHeight: '32px',
    lineHeight: '1.4'
  };

  return (
    <div className="atos-table-caixa-container" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <div style={{ flex: '1 1 140px', minWidth: 120, maxWidth: 200 }}>
        <label style={{ fontSize: 13, color: '#555' }}>Responsável:</label>
        <div style={infoStyle}>{responsavel}</div>
      </div>
      <div style={{ flex: '1 1 80px', minWidth: 80, maxWidth: 120 }}>
        <label style={{ fontSize: 13, color: '#555' }}>ISS (%):</label>
        <div style={infoStyle}>{ISS}</div>
      </div>
      <div style={{ flex: '1 1 120px', minWidth: 100, maxWidth: 160 }}>
        <label style={{ fontSize: 13, color: '#555' }}>Valor Final do Caixa:</label>
        <div style={infoStyle}>{formatarMoeda(valorFinalCaixa)}</div>
      </div>
      <div style={{ flex: '1 1 120px', minWidth: 100, maxWidth: 160 }}>
        <label style={{ fontSize: 13, color: '#555' }}>Valor Inicial do Caixa:</label>
        <input
          type="text"
          value={formatarMoeda(valorInicialCaixa)}
          onChange={e => setValorInicialCaixa(Number(e.target.value.replace(/\D/g, '')))}
          placeholder="R$ 0,00"
          style={inputStyle}
        />
      </div>
      <div style={{ flex: '1 1 120px', minWidth: 100, maxWidth: 160 }}>
        <label style={{ fontSize: 13, color: '#555' }}>Depósitos do Caixa:</label>
        <input
          type="text"
          value={formatarMoeda(depositosCaixa)}
          onChange={e => setDepositosCaixa(Number(e.target.value.replace(/\D/g, '')))}
          placeholder="R$ 0,00"
          style={inputStyle}
        />
      </div>
      <div style={{ flex: '1 1 120px', minWidth: 100, maxWidth: 160 }}>
        <label style={{ fontSize: 13, color: '#555' }}>Saídas do Caixa:</label>
        <input
          type="text"
          value={formatarMoeda(saidasCaixa)}
          onChange={e => setSaidasCaixa(Number(e.target.value.replace(/\D/g, '')))}
          placeholder="R$ 0,00"
          style={inputStyle}
        />
      </div>
      <div style={{ flex: '1 1 100%', minWidth: 180 }}>
        <label style={{ fontSize: 13, color: '#555', verticalAlign: 'top' }}>OBS:</label>
        <textarea
          value={observacoesGerais}
          onChange={e => setObservacoesGerais(e.target.value)}
          placeholder="Observações gerais do relatório"
          style={{
            width: '100%',
            height: '60px',
            resize: 'vertical',
            marginTop: 4,
            background: '#f0f0f0',
            borderRadius: '6px',
            border: '1.5px solid #e3f2fd',
            fontSize: '15px',
            color: '#2c3e50',
            fontWeight: '600',
            padding: '6px 10px'
          }}
        />
      </div>
    </div>
  );
}