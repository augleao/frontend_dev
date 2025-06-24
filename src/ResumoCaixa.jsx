import React from 'react';
import CaixaInputs from './CaixaInputs';

export default function ResumoCaixa({
  azulFundo,
  valorInicialCaixa,
  setValorInicialCaixa,
  depositosCaixa,
  setDepositosCaixa,
  saidasCaixa,
  setSaidasCaixa,
  valorFinalCaixa,
  ISS,
}) {
  return (
    <>
      <CaixaInputs
        valorInicialCaixa={valorInicialCaixa}
        valorFinalCaixa={valorFinalCaixa}
        ISS={ISS}
      />
    </>
  );
}