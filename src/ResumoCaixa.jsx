import React from 'react';
import DataSelector from './DataSelector';
import CaixaInputs from './CaixaInputs';

export default function ResumoCaixa({
  dataSelecionada,
  setDataSelecionada,
  valorInicialCaixa,
  setValorInicialCaixa,
  depositosCaixa,
  setDepositosCaixa,
  saidasCaixa,
  setSaidasCaixa,
  valorFinalCaixa,
  nomeUsuario,
}) {
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <input
          type="text"
          value={nomeUsuario}
          readOnly
          style={{
            width: 320,
            textAlign: 'center',
            fontSize: 16,
            padding: 8,
            borderRadius: 6,
            border: '1px solid #1976d2',
            background: '#f5faff',
            color: '#1976d2',
            fontWeight: 'bold',
          }}
        />
      </div>

      <DataSelector dataSelecionada={dataSelecionada} onChange={(e) => setDataSelecionada(e.target.value)} />

      <CaixaInputs
        valorInicialCaixa={valorInicialCaixa}
        setValorInicialCaixa={setValorInicialCaixa}
        depositosCaixa={depositosCaixa}
        setDepositosCaixa={setDepositosCaixa}
        saidasCaixa={saidasCaixa}
        setSaidasCaixa={setSaidasCaixa}
        valorFinalCaixa={valorFinalCaixa}
      />
    </>
  );
}