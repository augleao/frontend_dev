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

  const [valorFinalCaixa, setValorFinalCaixa] = useState(0);

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
  };  // useEffect para buscar o último fechamento do caixa do dia anterior ou mais próximo
  useEffect(() => {
    async function buscarValorInicialCaixa() {
      try {
        const token = localStorage.getItem("token");
        let dataBusca = dayjs(dataSelecionada).subtract(1, "day");
        let foundValor = 0;

        // Loop para buscar o ato 0001 do dia anterior ou do dia mais próximo para trás
        for (let i = 0; i < 30; i++) { // Limita a busca a 30 dias para evitar loops infinitos
          const dataFormatada = dataBusca.format("YYYY-MM-DD");
          const res = await fetch(
            `${process.env.REACT_APP_API_URL || "https://backend-dev-ypsu.onrender.com"}/api/atos-pagos?data=${dataFormatada}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (res.ok) {
            const data = await res.json();
            const atosDoDia = data.atosPagos || [];
            const fechamentoDiaAnterior = atosDoDia.find((ato) => ato.codigo === "0001");

            if (fechamentoDiaAnterior) {
              foundValor = fechamentoDiaAnterior.valor_unitario || 0;
              break; // Encontrou, pode sair do loop
            }
          }
          dataBusca = dataBusca.subtract(1, "day"); // Volta mais um dia
        }
        setValorInicialCaixa(foundValor);
      } catch (e) {
        console.error("Erro ao buscar valor inicial do caixa:", e);
        setValorInicialCaixa(0);
      }
    }

    buscarValorInicialCaixa();
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
          console.log("Atos carregados para a data selecionada:", data.atosPagos);
          const fechamentoDoDiaAtual = data.atosPagos.find((ato) => ato.codigo === "0001");
          console.log("Ato 0001 encontrado para a data selecionada (Valor Final do Caixa):", fechamentoDoDiaAtual);
          setValorFinalCaixa(fechamentoDoDiaAtual ? fechamentoDoDiaAtual.valor_unitario : 0);
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

    const fechamentoDiario = async () => {
    const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
    const nomeUsuario = usuario?.nome || "Usuário não identificado";
    const dataAtual = dataSelecionada; // Usa a data selecionada pelo usuário

    // Verifica se já existe um ato 0001 para o dia e usuário
    const existeFechamento = atos.some(
      (ato) =>
        ato.codigo === "0001" &&
        ato.data === dataAtual &&
        ato.usuario === nomeUsuario
    );

    if (existeFechamento) {
      alert("Já existe um fechamento de caixa (código 0001) para este usuário e data.");
      return;
    }

    if (!window.confirm("Confirma o fechamento diário do caixa?")) return;

    const hora = new Date().toLocaleTimeString("pt-BR", { hour12: false });

    const pagamentosZerados = formasPagamento.reduce((acc, fp) => {
      acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
      return acc;
    }, {});

    const linhasFechamento = [
      {
        data: dataAtual,
        descricao: 'Valor Inicial do Caixa',
        quantidade: 1,
        valor_unitario: valorInicialCaixa,
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,
      },
      {
        data: dataAtual,
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

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <h1 style={{ 
          margin: 0, 
          color: '#2c3e50',
          fontSize: '28px',
          fontWeight: '600'
        }}>
          💰 Movimento Diário do Caixa
        </h1>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '15px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: '#666', fontSize: '14px' }}>👤 Usuário:</span>
            <input
              type="text"
              value={nomeUsuario}
              readOnly
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '2px solid #e3f2fd',
                backgroundColor: '#f8f9fa',
                fontWeight: '600',
                color: '#2c3e50',
                fontSize: '14px'
              }}
            />
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: '#666', fontSize: '14px' }}>📅 Data:</span>
            <DataSelector dataSelecionada={dataSelecionada} onChange={handleDataChange} />
          </div>
        </div>
      </div>

      {/* Resumo do Caixa */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '25px',
        marginBottom: '20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          color: '#2c3e50',
          fontSize: '20px',
          fontWeight: '600',
          borderBottom: '2px solid #3498db',
          paddingBottom: '10px'
        }}>
          📊 Resumo do Caixa
        </h2>
        <CaixaInputs 
          valorInicialCaixa={valorInicialCaixa} 
          valorFinalCaixa={valorFinalCaixa} 
        />
      </div>

      {/* Layout Principal - Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        
        {/* Seção de Adição de Atos */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '25px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ 
            margin: '0 0 20px 0', 
            color: '#2c3e50',
            fontSize: '18px',
            fontWeight: '600',
            borderBottom: '2px solid #27ae60',
            paddingBottom: '10px'
          }}>
            ➕ Adicionar Ato
          </h3>
          
          <div style={{ marginBottom: '20px' }}>
            <AtoSearch
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              suggestions={suggestions}
              loadingSuggestions={loadingSuggestions}
              onSelectAto={handleSelectAto}
            />
          </div>

          {selectedAto && (
            <div style={{
              background: '#f8f9fa',
              border: '2px solid #27ae60',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#27ae60' }}>
                Ato Selecionado:
              </h4>
              <p style={{ margin: '0', fontWeight: '600' }}>
                {selectedAto.codigo} - {selectedAto.descricao}
              </p>
              <p style={{ margin: '5px 0 0 0', color: '#666' }}>
                Valor: {formatarMoeda(selectedAto.valor_final)}
              </p>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Quantidade:
            </label>
            <input
              type="number"
              min="1"
              value={quantidade}
              onChange={(e) => handleQuantidadeChange(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e3f2fd',
                fontSize: '16px'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <FormasPagamento
              formasPagamento={formasPagamento}
              pagamentos={pagamentos}
              onQuantidadeChange={handlePagamentoQuantidadeChange}
              onValorChange={handlePagamentoValorChange}
              corFundoPagamentos={corFundoPagamentos}
              selectedAto={selectedAto}
            />
          </div>

          {selectedAto && (
            <div style={{
              background: valoresIguais(somaPagamentos, valorTotal) ? '#d4edda' : '#f8d7da',
              border: `2px solid ${valoresIguais(somaPagamentos, valorTotal) ? '#27ae60' : '#dc3545'}`,
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontWeight: '600' }}>Valor Total:</span>
                <span style={{ fontWeight: '600' }}>{formatarMoeda(valorTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '600' }}>Soma Pagamentos:</span>
                <span style={{ fontWeight: '600' }}>{formatarMoeda(somaPagamentos)}</span>
              </div>
            </div>
          )}

          <button
            onClick={adicionarAto}
            disabled={!selectedAto || !valoresIguais(somaPagamentos, valorTotal)}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: selectedAto && valoresIguais(somaPagamentos, valorTotal) ? '#27ae60' : '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: selectedAto && valoresIguais(somaPagamentos, valorTotal) ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s ease'
            }}
          >
            ➕ Adicionar Ato
          </button>
        </div>

        {/* Seção de Entradas e Saídas Manuais */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '25px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ 
            margin: '0 0 20px 0', 
            color: '#2c3e50',
            fontSize: '18px',
            fontWeight: '600',
            borderBottom: '2px solid #f39c12',
            paddingBottom: '10px'
          }}>
            💸 Entradas e Saídas Manuais
          </h3>

          {/* Entrada Manual */}
          <div style={{
            background: '#f8f9fa',
            border: '2px solid #27ae60',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#27ae60' }}>
              📈 Entrada de Valor
            </h4>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Valor:
              </label>
              <input
                type="text"
                value={entradaValor}
                onChange={(e) => setEntradaValor(e.target.value)}
                placeholder="R$ 0,00"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e3f2fd',
                  fontSize: '16px'
                }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Observação:
              </label>
              <input
                type="text"
                value={entradaObs}
                onChange={(e) => setEntradaObs(e.target.value)}
                placeholder="Descrição da entrada"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e3f2fd',
                  fontSize: '16px'
                }}
              />
            </div>
            <button
              onClick={adicionarEntrada}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              ➕ Adicionar Entrada
            </button>
          </div>

          {/* Saída Manual */}
          <div style={{
            background: '#f8f9fa',
            border: '2px solid #e74c3c',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#e74c3c' }}>
              📉 Saída de Valor
            </h4>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Valor:
              </label>
              <input
                type="text"
                value={saidaValor}
                onChange={(e) => setSaidaValor(e.target.value)}
                placeholder="R$ 0,00"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e3f2fd',
                  fontSize: '16px'
                }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Observação:
              </label>
              <input
                type="text"
                value={saidaObs}
                onChange={(e) => setSaidaObs(e.target.value)}
                placeholder="Descrição da saída"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e3f2fd',
                  fontSize: '16px'
                }}
              />
            </div>
            <button
              onClick={adicionarSaida}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              ➖ Adicionar Saída
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Atos */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '25px',
        marginBottom: '20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ 
          margin: '0 0 20px 0', 
          color: '#2c3e50',
          fontSize: '18px',
          fontWeight: '600',
          borderBottom: '2px solid #9b59b6',
          paddingBottom: '10px'
        }}>
          📋 Atos do Dia
        </h3>
        <AtosTable atos={atos} onRemover={removerAto} />
      </div>

      {/* Botão de Fechamento */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '25px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <FechamentoDiarioButton onClick={fechamentoDiario} />
      </div>
    </div>
  );
}

export default AtosPagos;

