import React from 'react';
import { formatarMoeda } from './utilsAtos';

export default function CaixaInfo({
  responsavel, setResponsavel,
  ISS, setISS,
  valorInicialCaixa, setValorInicialCaixa,
  depositosCaixa, setDepositosCaixa,
  saidasCaixa, setSaidasCaixa,
  observacoesGerais, setObservacoesGerais,
}) {
  // Estilo para campos somente leitura (informação)
  const infoStyle = {
    width: '100%',
    padding: '4px 6px',
    borderRadius: '4px',
    border: 'none',
    fontSize: '13px',
    backgroundColor: 'transparent',
    color: '#2c3e50',
    fontWeight: '600',
    marginBottom: '2px',
    minHeight: '24px',
    lineHeight: '1.2'
  };

  // Estilo para inputs editáveis (menor)
  const inputStyle = {
    width: '100%',
    padding: '4px 6px',
    borderRadius: '4px',
    border: '1px solid #e3f2fd',
    fontSize: '13px',
    marginBottom: '2px',
    backgroundColor: '#f0f0f0',
    color: '#2c3e50',
    fontWeight: '600',
    minHeight: '24px',
    lineHeight: '1.2'
  };

  const valorFinalCaixa = Number(valorInicialCaixa) + Number(depositosCaixa) - Number(saidasCaixa);

  return (
    <div className="atos-table-caixa-container" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      <div style={{ flex: '1 1 120px', minWidth: 90, maxWidth: 140 }}>
        <label style={{ fontSize: 13, color: '#fff' }}>Responsável:</label>
        <div style={infoStyle}>{responsavel}</div>
      </div>
      <div style={{ flex: '1 1 60px', minWidth: 60, maxWidth: 90 }}>
        <label style={{ fontSize: 13, color: '#fff' }}>ISS (%):</label>
        <div style={infoStyle}>{ISS}</div>
      </div>
      <div style={{ flex: '1 1 100px', minWidth: 80, maxWidth: 120 }}>
        <label style={{ fontSize: 13, color: '#fff' }}>Valor Final do Caixa:</label>
        <div style={infoStyle}>{formatarMoeda(valorFinalCaixa)}</div>
      </div>
      <div style={{ flex: '1 1 100px', minWidth: 80, maxWidth: 120 }}>
        <label style={{ fontSize: 13, color: '#fff' }}>Valor Inicial:</label>
        <input
          type="number"
          step="0.01"
          value={valorInicialCaixa}
          onChange={e => setValorInicialCaixa(Number(e.target.value))}
          placeholder="0.00"
          style={inputStyle}
        />
      </div>
      <div style={{ flex: '1 1 100px', minWidth: 80, maxWidth: 120 }}>
        <label style={{ fontSize: 13, color: '#fff' }}>Depósitos:</label>
        <input
          type="number"
          step="0.01"
          value={depositosCaixa}
          onChange={e => setDepositosCaixa(Number(e.target.value))}
          placeholder="0.00"
          style={inputStyle}
        />
      </div>
      <div style={{ flex: '1 1 100px', minWidth: 80, maxWidth: 120 }}>
        <label style={{ fontSize: 13, color: '#fff' }}>Saídas:</label>
        <input
          type="number"
          step="0.01"
          value={saidasCaixa}
          onChange={e => setSaidasCaixa(Number(e.target.value))}
          placeholder="0.00"
          style={inputStyle}
        />
      </div>
      <div style={{ flex: '1 1 100%', minWidth: 120 }}>
        <label style={{ fontSize: 13, color: '#fff', verticalAlign: 'top' }}>OBS:</label>
        <textarea
          value={observacoesGerais}
          onChange={e => setObservacoesGerais(e.target.value)}
          placeholder="Observações gerais do relatório"
          style={{
            width: '100%',
            height: '40px',
            resize: 'vertical',
            marginTop: 2,
            background: '#f0f0f0',
            borderRadius: '4px',
            border: '1px solid #e3f2fd',
            fontSize: '13px',
            color: '#2c3e50',
            fontWeight: '600',
            padding: '4px 6px'
          }}
        />
      </div>
    </div>
  );
}