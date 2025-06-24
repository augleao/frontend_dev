import React, { useState } from 'react';
import CaixaInputs from './CaixaInputs';

export default function ResumoCaixa({
  azulFundo,
  depositosCaixa,
  setDepositosCaixa,
  saidasCaixa,
  setSaidasCaixa,
  valorFinalCaixa,
  ISS,
}) {
  // No componente pai, armazene o valor como string:
  const [valorInicialCaixa, setValorInicialCaixa] = useState('');

  return (
    <>
      <CaixaInputs
        valorInicialCaixa={valorInicialCaixa}
        valorFinalCaixa={valorFinalCaixa}
        ISS={ISS}
      />
      {/* No input:
      <input
        type="text"
        value={valorInicialCaixa}
        onChange={e => setValorInicialCaixa(e.target.value.replace(/[^0-9,\.]/g, ''))}
        placeholder="R$ 0,00"
        style={inputStyle}
      /> */}
    </>
  );
}