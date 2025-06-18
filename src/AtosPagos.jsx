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
import dayjs from 'dayjs';

function AtosPagos() {
  // Estados
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const hoje = new Date();
    return hoje.toISOString().slice(0, 10);
  });

  const [valorInicialCaixa, setValorInicialCaixa] = useState(0);
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
  const [fechamentos, setFechamentos] = useState([]);
  const debounceTimeout = useRef(null);

  const [nomeUsuario, setNomeUsuario] = useState(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    return usuario?.nome || 'Usuário não identificado';
  });
  const [entradaValor, setEntradaValor] = useState('');
  const [entradaObs, setEntradaObs] = useState('');
  const [saidaValor, setSaidaValor] = useState('');
  const [saidaObs, setSaidaObs] = useState('');

// Função para formatar valor de input para número (ex: "R$ 1.234,56" -> 1234.56)
  const parseValorMoeda = (valorStr) => {
    if (!valorStr) return 0;
    // Remove tudo que não é número ou vírgula/ponto
    const numStr = valorStr.replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(numStr);
    return isNaN(num) ? 0 : num;
  };

  // Função para adicionar entrada no caixa
  const adicionarEntrada = () => {
    const valor = parseValorMoeda(entradaValor);
    if (valor <= 0) {
      alert('Informe um valor válido para a entrada.');
      return;
    }
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario?.nome || 'Usuário não identificado';
    const agora = new Date();

    const novaEntrada = {
      data: agora.toISOString().slice(0, 10),
      hora: agora.toLocaleTimeString('pt-BR', { hour12: false }),
      codigo: '0001',
      descricao: `ENTRADA: ${entradaObs || ''}`.trim(),
      quantidade: 1,
      valor_unitario: valor,
      pagamentos: {}, // vazio conforme solicitado
      usuario: nomeUsuario,
    };

    setAtos((prev) => [...prev, novaEntrada]);
    setEntradaValor('');
    setEntradaObs('');
  };

  const fechamentoDoDia = atos.find((ato) => ato.codigo === '0001');
  const valorFinalCaixa = fechamentoDoDia ? fechamentoDoDia.valor_unitario : 0;

  // Função para adicionar saída no caixa
  const adicionarSaida = () => {
    const valor = parseValorMoeda(saidaValor);
    if (valor <= 0) {
      alert('Informe um valor válido para a saída.');
      return;
    }
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario?.nome || 'Usuário não identificado';
    const agora = new Date();

    const novaSaida = {
      data: agora.toISOString().slice(0, 10),
      hora: agora.toLocaleTimeString('pt-BR', { hour12: false }),
      codigo: '0002',
      descricao: `SAÍDA: ${saidaObs || ''}`.trim(),
      quantidade: 1,
      valor_unitario: valor,
      pagamentos: {}, // vazio conforme solicitado
      usuario: nomeUsuario,
    };

    setAtos((prev) => [...prev, novaSaida]);
    setSaidaValor('');
    setSaidaObs('');
  };

  // Funções auxiliares
  const handleDataChange = (e) => {
    setDataSelecionada(e.target.value);
  };

  const calcularValorFinalCaixa = () => {
    const totalDinheiro = atos.reduce((acc, ato) => {
      const valorDinheiro = parseFloat(ato.pagamentos?.dinheiro?.valor) || 0;
      return acc + valorDinheiro;
    }, 0);
    return valorInicialCaixa + totalDinheiro;
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

  const removerAto = async (index) => {
    const atoParaRemover = atos[index];
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos/${atoParaRemover.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        setAtos(atos.filter((_, i) => i !== index));
      } else {
        alert('Erro ao remover ato.');
      }
    } catch (e) {
      console.error('Erro ao remover ato:', e);
      alert('Erro ao remover ato.');
    }
  };

  //useEffect para buscar o ultimo fechamento do caixa 


useEffect(() => {
  async function buscarFechamentosIntervalo() {
    try {
      const token = localStorage.getItem('token');
      const dataInicio = dayjs(dataSelecionada).subtract(30, 'day').format('YYYY-MM-DD');
      const dataFim = dataSelecionada;

      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos?dataInicio=${dataInicio}&dataFim=${dataFim}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error('Erro ao buscar atos pagos');

      const data = await res.json();
      const atos = data.atosPagos || [];

      // Filtra atos com código '0001' e ordena por data decrescente
      const fechamentos = atos
        .filter((ato) => ato.codigo === '0001')
        .sort((a, b) => (dayjs(b.data).isAfter(dayjs(a.data)) ? 1 : -1));

      if (fechamentos.length > 0) {
        setValorInicialCaixa(fechamentos[0].valor_unitario || 0);
      } else {
        setValorInicialCaixa(0);
      }
    } catch (e) {
      console.error(e);
      setValorInicialCaixa(0);
    }
  }

  buscarFechamentosIntervalo();
}, [dataSelecionada]);

  // useEffect para carregar atos por data
  useEffect(() => {
    async function carregarAtosPorData() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos?data=${dataSelecionada}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (res.ok) {
          setAtos(data.atosPagos || []);
        } else {
          setAtos([]);
        }
      } catch (e) {
        console.error('Erro ao carregar atos pagos:', e);
        setAtos([]);
      }
    }
    carregarAtosPorData();
  }, [dataSelecionada]);

  // useEffect para buscar sugestões com debounce
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos?search=${encodeURIComponent(
            searchTerm
          )}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (res.ok) {
          setSuggestions(data.atos || []);
        } else {
          setSuggestions([]);
        }
      } catch (e) {
        console.error('Erro ao buscar atos:', e);
        setSuggestions([]);
      }
      setLoadingSuggestions(false);
    }, 300);

    return () => clearTimeout(debounceTimeout.current);
  }, [searchTerm]);

  // Função fechamento diário (exemplo simplificado)
  const fechamentoDiario = async () => {
    if (!window.confirm('Confirma o fechamento diário do caixa?')) return;

    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario?.nome || 'Usuário não identificado';

const data = dataSelecionada; // usa a data selecionada pelo usuário
const hora = new Date().toLocaleTimeString('pt-BR', { hour12: false });

    const pagamentosZerados = formasPagamento.reduce((acc, fp) => {
      acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
      return acc;
    }, {});

    const linhasFechamento = [
      {
        data,
        hora,
        codigo: '0000',
        descricao: 'Valor Inicial do Caixa',
        quantidade: 1,
        valor_unitario: valorInicialCaixa,
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,
      },
      {
        data,
        hora,
        codigo: '0001',
        descricao: 'Valor Final do Caixa',
        quantidade: 1,
        valor_unitario: calcularValorFinalCaixa(),
        //valor_total: calcularValorFinalCaixa(),
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,
      },
    ];

    try {
      const token = localStorage.getItem('token');

      for (const linha of linhasFechamento) {
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(linha),
          }
        );

        if (!res.ok) {
          const json = await res.json();
          alert('Erro ao salvar fechamento no banco: ' + (json.message || JSON.stringify(json)));
          return;
        }
      }

      setAtos((prev) => [...prev, ...linhasFechamento]);

      gerarRelatorioPDF({
        dataRelatorio: dataSelecionada.split('-').reverse().join('/'),
        atos,
        valorInicialCaixa,
        responsavel: nomeUsuario,
      });

      alert('Fechamento diário realizado com sucesso!');
    } catch (e) {
      console.error('Erro no fechamento diário:', e);
      alert('Erro ao realizar fechamento diário.');
    }
  };

 // ... seu código anterior permanece igual até o return

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
  valorFinalCaixa={valorFinalCaixa}
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
      <div style={{ display: 'flex', justifyContent: 'flex-startnd' }}>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
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

      {/* Novo container: Adicionar Entrada no Caixa */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          padding: 16,
          backgroundColor: '#f0f0f0',
          borderRadius: 8,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <button
          style={{
            padding: '8px 20px',
            background: '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
          onClick={adicionarEntrada}
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
          }}
        />
        <input
          type="text"
          placeholder="Observações"
          value={entradaObs}
          onChange={(e) => setEntradaObs(e.target.value)}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 6,
            border: '1px solid #ccc',
          }}
        />
      </div>

      {/* Novo container: Adicionar Saída no Caixa */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
          padding: 16,
          backgroundColor: '#f0f0f0',
          borderRadius: 8,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <button
          style={{
            padding: '8px 20px',
            background: '#d32f2f',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
          onClick={adicionarSaida}
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
          }}
        />
        <input
          type="text"
          placeholder="Observações"
          value={saidaObs}
          onChange={(e) => setSaidaObs(e.target.value)}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 6,
            border: '1px solid #ccc',
          }}
        />
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