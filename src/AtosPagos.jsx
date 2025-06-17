import React, { useState, useEffect, useRef } from 'react';
import {
  formasPagamento,
  formatarMoeda,
  formatarDataBR,
  gerarRelatorioPDF,
} from './utils';
import DataSelector from './DataSelector';
import CaixaInputs from './CaixaInputs';
import AtoSearch from './AtoSearch';
import FormasPagamento from './FormasPagamento';
import AtosTable from './AtosTableEscrevente';
import FechamentoDiarioButton from './FechamentoDiarioButton';

function AtosPagos() {
  // Todos os estados e funções (handleDataChange, adicionarAto, removerAto, fechamentoDiario, etc)
  // Mantém a lógica igual ao seu código atual

  // Exemplo para fechamentoDiario:
  const fechamentoDiario = async () => {
    // sua lógica atual
  };

  // Outros handlers e useEffects...

  return (
    <div style={{ maxWidth: '100%', margin: '10px auto', padding: 32, background: '#fff', boxShadow: '0 2px 8px #0001', borderRadius: 12 }}>
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Atos Pagos</h2>

      <DataSelector dataSelecionada={dataSelecionada} onChange={handleDataChange} />

      <CaixaInputs
        valorInicialCaixa={valorInicialCaixa}
        setValorInicialCaixa={setValorInicialCaixa}
        depositosCaixa={depositosCaixa}
        setDepositosCaixa={setDepositosCaixa}
        saidasCaixa={saidasCaixa}
        setSaidasCaixa={setSaidasCaixa}
        valorFinalCaixa={calcularValorFinalCaixa()}
      />

      <AtoSearch
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        suggestions={suggestions}
        loadingSuggestions={loadingSuggestions}
        onSelect={setSelectedAto}
      />

      {/* Inputs para quantidade e valor total do ato selecionado */}
      {/* Formas de pagamento */}
      <FormasPagamento
        formasPagamento={formasPagamento}
        pagamentos={pagamentos}
        onQuantidadeChange={handlePagamentoQuantidadeChange}
        onValorChange={handlePagamentoValorChange}
        corFundoPagamentos={corFundoPagamentos}
        selectedAto={selectedAto}
      />

      {/* Botões */}
      <div style={{ textAlign: 'center', marginBottom: 32, display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button
          style={{
            padding: '10px 24px',
            background: '#388e3c',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
          onClick={adicionarAto}
          disabled={
            !selectedAto ||
            quantidade < 1 ||
            !Object.values(pagamentos).some((p) => p.valor > 0) ||
            !valoresIguais(somaPagamentos, valorTotal)
          }
        >
          Adicionar Ato
        </button>

        <FechamentoDiarioButton onClick={fechamentoDiario} />
      </div>

      <h3 style={{ marginBottom: 12 }}>
        Atos Pagos em {dataSelecionada.split('-').reverse().join('/')}
      </h3>

      <AtosTable atos={atos} removerAto={removerAto} />
    </div>
  );
}

export default AtosPagos;