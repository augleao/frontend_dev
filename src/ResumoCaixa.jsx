import React from 'react';
import CaixaInputs from './CaixaInputs';

export default function ResumoCaixa({
  valorInicialCaixa,
  setValorInicialCaixa,
  depositosCaixa,
  setDepositosCaixa,
  saidasCaixa,
  setSaidasCaixa,
  valorFinalCaixa,
}) {
  return (
    <>
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