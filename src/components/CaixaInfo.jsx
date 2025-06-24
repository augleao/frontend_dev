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
  return (
    <div className="atos-table-caixa-container">
      <div>
        <label>Responsável: </label>
        <div
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
        >
          {responsavel}
        </div>
      </div>
      <div>
        <label>ISS (%): </label>
        <input type="number" value={ISS} onChange={e => setISS(e.target.value)} placeholder="Ex: 3" step="0.01" min="0" />
      </div>
      <div>
        <label>Valor Inicial do Caixa: </label>
        <input type="text" value={formatarMoeda(valorInicialCaixa)} onChange={e => setValorInicialCaixa(Number(e.target.value.replace(/\D/g, '')))} placeholder="R$ 0,00" />
      </div>
      <div>
        <label>Depósitos do Caixa: </label>
        <input type="text" value={formatarMoeda(depositosCaixa)} onChange={e => setDepositosCaixa(Number(e.target.value.replace(/\D/g, '')))} placeholder="R$ 0,00" />
      </div>
      <div>
        <label>Saídas do Caixa: </label>
        <input type="text" value={formatarMoeda(saidasCaixa)} onChange={e => setSaidasCaixa(Number(e.target.value.replace(/\D/g, '')))} placeholder="R$ 0,00" />
      </div>
      <div>
        <label>Valor Final do Caixa: </label>
        <input type="text" readOnly value={formatarMoeda(valorFinalCaixa)} />
      </div>
      <div>
        <label style={{ verticalAlign: 'top' }}>OBS: </label>
        <textarea
          value={observacoesGerais}
          onChange={e => setObservacoesGerais(e.target.value)}
          placeholder="Observações gerais do relatório"
          style={{ width: '450px', height: '100px', resize: 'vertical' }}
        />
      </div>
    </div>
  );
}