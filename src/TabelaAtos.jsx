import React from 'react';
import AtosTable from './CaixaTableEscrevente';

export default function TabelaAtos({ atos, removerAto }) {
  return <AtosTable atos={atos} removerAto={removerAto} />;
}