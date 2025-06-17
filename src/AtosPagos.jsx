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
import UsuarioInfo from './UsuarioInfo'; // Importe o componente

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

    const { data, hora } = (() => {
      const agora = new Date();
      return {
        data: agora.toISOString().slice(0, 10),
        hora: agora.toLocaleTimeString('pt-BR', { hour12: false }),
      };
    })();

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
        codigo: '0000',
        descricao: 'Depósitos do Caixa',
        quantidade: 1,
        valor_unitario: depositosCaixa,
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,
      },
      {
        data,
        hora,
        codigo: '0000',
        descricao: 'Saídas do Caixa',
        quantidade: 1,
        valor_unitario: saidasCaixa,
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,
      },
      {
        data,
        hora,
        codigo: '0000',
        descricao: 'Valor Final do Caixa',
        quantidade: 1,
        valor_unitario: calcularValorFinalCaixa(),
        valor_total: calcularValorFinalCaixa(),
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
        depositosCaixa,
        saidasCaixa,
        responsavel: nomeUsuario,
      });

      alert('Fechamento diário realizado com sucesso!');
    } catch (e) {
      console.error('Erro no fechamento diário:', e);
      alert('Erro ao realizar fechamento diário.');
    }
  };

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
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Atos Pagos e Selados ao Longo do Dia</h2>
 
 <UsuarioInfo nomeUsuario={nomeUsuario} /> {/* Use o componente aqui */}
 
      <DataSelector dataSelecionada={dataSelecionada} onChange={handleDataChange} />

     

      <AtoSearch
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        suggestions={suggestions}
        loadingSuggestions={loadingSuggestions}
        onSelect={setSelectedAto}
      />

      <FormasPagamento
        formasPagamento={formasPagamento}
        pagamentos={pagamentos}
        onQuantidadeChange={handlePagamentoQuantidadeChange}
        onValorChange={handlePagamentoValorChange}
        corFundoPagamentos={corFundoPagamentos}
        selectedAto={selectedAto}
      />

            <CaixaInputs
        valorInicialCaixa={valorInicialCaixa}
        setValorInicialCaixa={setValorInicialCaixa}
        depositosCaixa={depositosCaixa}
        setDepositosCaixa={setDepositosCaixa}
        saidasCaixa={saidasCaixa}
        setSaidasCaixa={setSaidasCaixa}
        valorFinalCaixa={calcularValorFinalCaixa()}
      />

      <div
        style={{
          textAlign: 'center',
          marginBottom: 32,
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
        }}
      >
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