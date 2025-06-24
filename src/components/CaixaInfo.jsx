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
    padding: '12px',
    borderRadius: '8px',
    border: '2px solid #e3f2fd',
    fontSize: '16px',
    backgroundColor: '#f8f9fa',
    color: '#2c3e50',
    fontWeight: '600',
    marginBottom: '8px'
  };

  // Estilo para inputs editáveis
  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '2px solid #e3f2fd',
    fontSize: '16px',
    marginBottom: '8px'
  };

  return (
    <div className="atos-table-caixa-container" style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
      <div style={{ flex: '1 1 220px', minWidth: 220 }}>
        <label>Responsável: </label>
        <div style={infoStyle}>{responsavel}</div>
      </div>
      <div style={{ flex: '1 1 120px', minWidth: 120 }}>
        <label>ISS (%): </label>
        <div style={infoStyle}>{ISS}</div>
      </div>
      <div style={{ flex: '1 1 180px', minWidth: 180 }}>
        <label>Valor Final do Caixa: </label>
        <div style={infoStyle}>{formatarMoeda(valorFinalCaixa)}</div>
      </div>
      <div style={{ flex: '1 1 180px', minWidth: 180 }}>
        <label>Valor Inicial do Caixa: </label>
        <input
          type="text"
          value={formatarMoeda(valorInicialCaixa)}
          onChange={e => setValorInicialCaixa(Number(e.target.value.replace(/\D/g, '')))}
          placeholder="R$ 0,00"
          style={inputStyle}
        />
      </div>
      <div style={{ flex: '1 1 180px', minWidth: 180 }}>
        <label>Depósitos do Caixa: </label>
        <input
          type="text"
          value={formatarMoeda(depositosCaixa)}
          onChange={e => setDepositosCaixa(Number(e.target.value.replace(/\D/g, '')))}
          placeholder="R$ 0,00"
          style={inputStyle}
        />
      </div>
      <div style={{ flex: '1 1 180px', minWidth: 180 }}>
        <label>Saídas do Caixa: </label>
        <input
          type="text"
          value={formatarMoeda(saidasCaixa)}
          onChange={e => setSaidasCaixa(Number(e.target.value.replace(/\D/g, '')))}
          placeholder="R$ 0,00"
          style={inputStyle}
        />
      </div>
      <div style={{ flex: '1 1 100%', minWidth: 220 }}>
        <label style={{ verticalAlign: 'top' }}>OBS: </label>
        <textarea
          value={observacoesGerais}
          onChange={e => setObservacoesGerais(e.target.value)}
          placeholder="Observações gerais do relatório"
          style={{ width: '100%', height: '100px', resize: 'vertical', marginTop: 4 }}
        />
      </div>
    </div>
  );
}