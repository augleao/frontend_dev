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
  // Estados
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const hoje = new Date();
    return hoje.toISOString().slice(0, 10);
  });

  const [valorInicialCaixa, setValorInicialCaixa] = useState(0);
  const [depositosCaixa, setDepositosCaixa] = useState(0);
  const [saidasCaixa, setSaidasCaixa] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedAto, setSelectedAto] = useState(null);

  const [pagamentos, setPagamentos] = useState(
    formasPagamento.reduce((acc, fp) => {
      acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
      return acc;
    }, {})
  );

  const [quantidade, setQuantidade] = useState(1);
  const [atos, setAtos] = useState([]);

  const debounceTimeout = useRef(null);

  const [nomeUsuario, setNomeUsuario] = useState(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    return usuario?.nome || 'Usuário não identificado';
  });

  // Novos estados para entradas e saídas manuais
  const [entradaValor, setEntradaValor] = useState('');
  const [entradaObs, setEntradaObs] = useState('');
  const [saidaValor, setSaidaValor] = useState('');
  const [saidaObs, setSaidaObs] = useState('');

  // Funções auxiliares
  const handleDataChange = (e) => {
    setDataSelecionada(e.target.value);
  };

  const calcularValorFinalCaixa = () => {
    const totalDinheiro = atos.reduce((acc, ato) => {
      const valorDinheiro = parseFloat(ato.pagamentos?.dinheiro?.valor) || 0;
      return acc + valorDinheiro;
    }, 0);
    return valorInicialCaixa + totalDinheiro - depositosCaixa - saidasCaixa;
  };

  const valoresIguais = (a, b, tolerancia = 0.01) => Math.abs(a - b) < tolerancia;

  const somaPagamentos = Object.values(pagamentos).reduce(
    (acc, p) => acc + (parseFloat(p.valor) || 0),
    0
  );

  const valorTotal = selectedAto ? (selectedAto.valor_final ?? 0) * quantidade : 0;

  const corFundoPagamentos = (key) => {
    const metodosParaValidar = ['dinheiro', 'cartao', 'pix', 'crc', 'depositoPrevio'];
    if (!metodosParaValidar.includes(key)) return '#ffd1d1';
    return valoresIguais(somaPagamentos, valorTotal) ? '#d4edda' : '#ffd1d1';
  };

  const handlePagamentoQuantidadeChange = (key, qtd) => {
    qtd = parseInt(qtd);
    if (isNaN(qtd) || qtd < 0) qtd = 0;

    setPagamentos((prev) => {
      const novo = { ...prev };
      novo[key].quantidade = qtd;

      const valorUnitario = selectedAto?.valor_final ?? 0;

      if (!novo[key].manual) {
        novo[key].valor = valorUnitario * qtd;
      }

      return novo;
    });
  };

  const handlePagamentoValorChange = (key, valor) => {
    valor = parseFloat(valor);
    if (isNaN(valor) || valor < 0) valor = 0;

    setPagamentos((prev) => ({
      ...prev,
      [key]: { ...prev[key], valor: valor, manual: true },
    }));
  };

  const handleQuantidadeChange = (qtd) => {
    qtd = parseInt(qtd);
    if (isNaN(qtd) || qtd < 1) qtd = 1;
    setQuantidade(qtd);

    setPagamentos((prev) => {
      const novo = { ...prev };
      const valorUnitario = selectedAto?.valor_final ?? 0;

      formasPagamento.forEach((fp) => {
        if (!novo[fp.key].manual) {
          novo[fp.key].valor = valorUnitario * novo[fp.key].quantidade;
        }
      });

      return novo;
    });
  };

  const handleSelectAto = (ato) => {
    setSelectedAto(ato);
    setSearchTerm(''); // Limpa o campo de busca
  };

  const adicionarAto = async () => {
    if (!selectedAto) {
      alert('Selecione um ato válido.');
      return;
    }
    const algumPagamento = Object.values(pagamentos).some((p) => p.valor > 0);
    if (quantidade < 1 || !algumPagamento) {
      alert('Informe quantidade válida e pelo menos um valor de pagamento.');
      return;
    }

    if (!valoresIguais(somaPagamentos, valorTotal)) {
      alert('A soma dos pagamentos deve ser igual ao Valor Total do ato.');
      return;
    }

    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario?.nome || 'Usuário não identificado';

    const novoAto = {
      data: dataSelecionada,
      hora: new Date().toLocaleTimeString(),
      codigo: selectedAto.codigo,
      descricao: selectedAto.descricao,
      quantidade,
      valor_unitario: selectedAto.valor_final ?? 0,
      pagamentos,
      usuario: nomeUsuario,
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(novoAto),
        }
      );
      if (res.ok) {
        setAtos((prev) => [...prev, novoAto]);
        setSelectedAto(null);
        setSearchTerm('');
        setQuantidade(1);
        setPagamentos(
          formasPagamento.reduce((acc, fp) => {
            acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
            return acc;
          }, {})
        );
        setSuggestions([]);
      } else {
        alert('Erro ao salvar ato.');
      }
    } catch (e) {
      console.error('Erro ao salvar ato:', e);
      alert('Erro ao salvar ato.');
    }
  };

  // Função para adicionar entrada manual no caixa
  const adicionarEntradaManual = () => {
    const valor = parseFloat(entradaValor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      alert('Informe um valor válido para a entrada.');
      return;
    }
    const descricao = entradaObs.trim() || '';
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario?.nome || 'Usuário não identificado';
    const agora = new Date();

    const novaEntrada = {
      data: agora.toISOString().slice(0, 10),
      hora: agora.toLocaleTimeString(),
      codigo: '0001',
      descricao: `ENTRADA: ${descricao}`,
      quantidade: 1,
      valor_unitario: valor,
      pagamentos: {},
      usuario: nomeUsuario,
    };

    setAtos((prev) => [...prev, novaEntrada]);
    setEntradaValor('');
    setEntradaObs('');
  };

  // Função para adicionar saída manual no caixa
  const adicionarSaidaManual = () => {
    const valor = parseFloat(saidaValor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      alert('Informe um valor válido para a saída.');
      return;
    }
    const descricao = saidaObs.trim() || '';
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario?.nome || 'Usuário não identificado';
    const agora = new Date();

    const novaSaida = {
      data: agora.toISOString().slice(0, 10),
      hora: agora.toLocaleTimeString(),
      codigo: '0002',
      descricao: `SAÍDA: ${descricao}`,
      quantidade: 1,
      valor_unitario: valor,
      pagamentos: {},
      usuario: nomeUsuario,
    };

    setAtos((prev) => [...prev, novaSaida]);
    setSaidaValor('');
    setSaidaObs('');
  };

  // ... restante do seu código (useEffects, removerAto, fechamentoDiario, etc.)

  return (
    <div
      style={{
        maxWidth: '100%',
        margin: '10px auto',
        padding: 32,
        background: '#fff',
        boxShadow: '0 2px 8px #0001',
        borderRadius: 12,
      }}
    >
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Movimento Diário do Caixa</h2>

      {/* Nome do usuário */}
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

      {/* Container único para AtoSearch + Quantidade, FormasPagamento e Botão */}
      <div
        style={{
          backgroundColor: '#f0f0f0',
          borderRadius: 8,
          padding: 16,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          position: 'relative',
        }}
      >
        {/* Linha com AtoSearch e Quantidade */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 350px', minWidth: 350 }}>
            <AtoSearch
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              suggestions={suggestions}
              loadingSuggestions={loadingSuggestions}
              onSelect={handleSelectAto}
              quantidade={quantidade}
              onQuantidadeChange={handleQuantidadeChange}
            />
          </div>
        </div>

        {/* Formas de Pagamento */}
        <FormasPagamento
          formasPagamento={formasPagamento}
          pagamentos={pagamentos}
          onQuantidadeChange={handlePagamentoQuantidadeChange}
          onValorChange={handlePagamentoValorChange}
          corFundoPagamentos={corFundoPagamentos}
          selectedAto={selectedAto}
        />

        {/* Botão Adicionar Ato alinhado à direita */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
        </div>

        {/* Novos containers para Entrada e Saída no Caixa */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          {/* Entrada no Caixa */}
          <div
            style={{
              backgroundColor: '#e0e0e0',
              borderRadius: 8,
              padding: 16,
              flex: '1 1 45%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <button
              style={{
                padding: '10px 16px',
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
              }}
              onClick={adicionarEntradaManual}
            >
              Adicionar Entrada no Caixa
            </button>
            <input
              type="text"
              placeholder="Valor (R$)"
              value={entradaValor}
              onChange={(e) => setEntradaValor(e.target.value)}
              style={{
                width: 120,
                padding: 8,
                borderRadius: 6,
                border: '1px solid #ccc',
                textAlign: 'right',
                fontSize: 14,
              }}
            />
            <input
              type="text"
              placeholder="Observações"
              value={entradaObs}
              onChange={(e) => setEntradaObs(e.target.value)}
              style={{
                flexGrow: 1,
                padding: 8,
                borderRadius: 6,
                border: '1px solid #ccc',
                fontSize: 14,
              }}
            />
          </div>

          {/* Saída no Caixa */}
          <div
            style={{
              backgroundColor: '#e0e0e0',
              borderRadius: 8,
              padding: 16,
              flex: '1 1 45%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <button
              style={{
                padding: '10px 16px',
                background: '#d32f2f',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
              }}
              onClick={adicionarSaidaManual}
            >
              Adicionar Saída no Caixa
            </button>
            <input
              type="text"
              placeholder="Valor (R$)"
              value={saidaValor}
              onChange={(e) => setSaidaValor(e.target.value)}
              style={{
                width: 120,
                padding: 8,
                borderRadius: 6,
                border: '1px solid #ccc',
                textAlign: 'right',
                fontSize: 14,
              }}
            />
            <input
              type="text"
              placeholder="Observações"
              value={saidaObs}
              onChange={(e) => setSaidaObs(e.target.value)}
              style={{
                flexGrow: 1,
                padding: 8,
                borderRadius: 6,
                border: '1px solid #ccc',
                fontSize: 14,
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          textAlign: 'center',
          marginBottom: 32,
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
        }}
      >
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