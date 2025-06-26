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
  const [valorFinalCaixa, setValorFinalCaixa] = useState(0); // Deixe só esta!
  const [percentualISS, setPercentualISS] = useState(0); // Estado para ISS
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
  const adicionarEntrada = async () => {
    const valor = parseValorMoeda(entradaValor);
    if (valor <= 0) {
      alert('Informe um valor válido para a entrada.');
      return;
    }
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario?.nome || 'Usuário não identificado';
    const agora = new Date();

    const novaEntrada = {
      data: dataSelecionada, // Usar a data selecionada
      hora: agora.toLocaleTimeString('pt-BR', { hour12: false }),
      codigo: '0003',
      descricao: `ENTRADA: ${entradaObs || ''}`.trim(),
      quantidade: 1,
      valor_unitario: valor,
      pagamentos: {}, // vazio conforme solicitado
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
          body: JSON.stringify(novaEntrada),
        }
      );

      if (res.ok) {
        setAtos((prev) => [...prev, novaEntrada]);
        setEntradaValor('');
        setEntradaObs('');
        console.log('Entrada manual salva com sucesso:', novaEntrada);
      } else {
        const errorData = await res.json();
        console.error('Erro ao salvar entrada:', errorData);
        alert('Erro ao salvar entrada: ' + (errorData.message || 'Erro desconhecido'));
      }
    } catch (e) {
      console.error('Erro ao salvar entrada:', e);
      alert('Erro ao salvar entrada: ' + e.message);
    }
  };

  // Função para adicionar saída no caixa
  const adicionarSaida = async () => {
    const valor = parseValorMoeda(saidaValor);
    if (valor <= 0) {
      alert('Informe um valor válido para a saída.');
      return;
    }
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario?.nome || 'Usuário não identificado';
    const agora = new Date();

    const novaSaida = {
      data: dataSelecionada, // Usar a data selecionada
      hora: agora.toLocaleTimeString('pt-BR', { hour12: false }),
      codigo: '0002',
      descricao: `SAÍDA: ${saidaObs || ''}`.trim(),
      quantidade: 1,
      valor_unitario: valor,
      pagamentos: {}, // vazio conforme solicitado
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
          body: JSON.stringify(novaSaida),
        }
      );

      if (res.ok) {
        setAtos((prev) => [...prev, novaSaida]);
        setSaidaValor('');
        setSaidaObs('');
        console.log('Saída manual salva com sucesso:', novaSaida);
      } else {
        const errorData = await res.json();
        console.error('Erro ao salvar saída:', errorData);
        alert('Erro ao salvar saída: ' + (errorData.message || 'Erro desconhecido'));
      }
    } catch (e) {
      console.error('Erro ao salvar saída:', e);
      alert('Erro ao salvar saída: ' + e.message);
    }
  };

  // Funções auxiliares
  const handleDataChange = (e) => {
    setDataSelecionada(e.target.value);
  };

  const calcularValorFinalCaixa = () => {
    // Soma todos os valores em dinheiro dos atos normais
    const totalDinheiro = atos.reduce((acc, ato) => {
      const valorDinheiro = parseFloat(ato.pagamentos?.dinheiro?.valor) || 0;
      return acc + valorDinheiro;
    }, 0);

    // Soma as entradas manuais (código 0003)
    const totalEntradas = atos.reduce((acc, ato) => {
      if (ato.codigo === '0003') {
        const valorEntrada = parseFloat(ato.valor_unitario) || 0;
        return acc + valorEntrada;
      }
      return acc;
    }, 0);

    // Subtrai as saídas manuais (código 0002)
    const totalSaidas = atos.reduce((acc, ato) => {
      if (ato.codigo === '0002') {
        const valorSaida = parseFloat(ato.valor_unitario) || 0;
        return acc + valorSaida;
      }
      return acc;
    }, 0);

    const valorFinal = valorInicialCaixa + totalDinheiro + totalEntradas - totalSaidas;
    
    console.log("Cálculo do Valor Final do Caixa:");
    console.log("- Valor Inicial:", valorInicialCaixa);
    console.log("- Total Dinheiro (atos):", totalDinheiro);
    console.log("- Total Entradas (0003):", totalEntradas);
    console.log("- Total Saídas (0002):", totalSaidas);
    console.log("- Valor Final Calculado:", valorFinal);

    return isNaN(valorFinal) ? 0 : valorFinal;
  };

  // Função para calcular valor com ISS
  const calcularValorComISS = (valorBase) => {
    if (!valorBase || percentualISS === 0) return valorBase;
    const valorComISS = valorBase * (1 + percentualISS / 100);
    console.log(`Valor base: ${valorBase}, ISS: ${percentualISS}%, Valor final: ${valorComISS}`);
    return valorComISS;
  };

  const valoresIguais = (a, b, tolerancia = 0.01) => Math.abs(a - b) < tolerancia;

  const somaPagamentos = Object.values(pagamentos).reduce(
    (acc, p) => acc + (parseFloat(p.valor) || 0),
    0
  );

  // Aplicar ISS no valor total
  const valorTotal = selectedAto ? calcularValorComISS((selectedAto.valor_final ?? 0) * quantidade) : 0;

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

      const valorUnitarioComISS = selectedAto ? calcularValorComISS(selectedAto.valor_final ?? 0) : 0;

      if (!novo[key].manual) {
        novo[key].valor = valorUnitarioComISS * qtd;
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
      const valorUnitarioComISS = selectedAto ? calcularValorComISS(selectedAto.valor_final ?? 0) : 0;

      formasPagamento.forEach((fp) => {
        if (!novo[fp.key].manual) {
          novo[fp.key].valor = valorUnitarioComISS * novo[fp.key].quantidade;
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

    // Calcular valor unitário com ISS
    const valorUnitarioComISS = calcularValorComISS(selectedAto.valor_final ?? 0);

    const novoAto = {
      data: dataSelecionada,
      hora: new Date().toLocaleTimeString(),
      codigo: selectedAto.codigo,
      descricao: selectedAto.descricao,
      quantidade,
      valor_unitario: valorUnitarioComISS, // Salvar valor com ISS
      valor_original: selectedAto.valor_final, // Manter valor original para referência
      percentual_iss: percentualISS, // Salvar percentual aplicado
      pagamentos: Object.fromEntries(
        Object.entries(pagamentos).map(([key, value]) => [
          key,
          { quantidade: value.quantidade, valor: value.valor },
        ])
      ),
      usuario: nomeUsuario,
    };

    console.log('Ato a ser salvo:', novoAto);
    console.log('Valor original:', selectedAto.valor_final);
    console.log('Valor com ISS:', valorUnitarioComISS);
    console.log('Percentual ISS aplicado:', percentualISS);

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
    
    // Verificar se o ato tem ID (foi salvo no backend)
    if (atoParaRemover.id) {
      // Ato existe no backend, precisa deletar lá também
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
          console.log('Ato removido do backend e da lista local:', atoParaRemover);
        } else {
          const errorData = await res.json();
          console.error('Erro ao remover ato do backend:', errorData);
          alert('Erro ao remover ato: ' + (errorData.message || 'Erro desconhecido'));
        }
      } catch (e) {
        console.error('Erro ao remover ato:', e);
        alert('Erro ao remover ato: ' + e.message);
      }
    } else {
      // Ato só existe localmente, remover apenas da lista
      setAtos(atos.filter((_, i) => i !== index));
      console.log('Ato removido apenas da lista local (não tinha ID):', atoParaRemover);
    }
  };

  // useEffect unificado para carregar dados da data selecionada
  useEffect(() => {
    let isMounted = true; // Flag para evitar atualizações se componente foi desmontado
    
    async function carregarDadosDaData() {
      try {
        const token = localStorage.getItem('token');
        
        // 1. Carregar atos do dia selecionado
        const resAtos = await fetch(
          `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos?data=${dataSelecionada}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        if (resAtos.ok && isMounted) {
          const dataAtos = await resAtos.json();
          setAtos(dataAtos.atosPagos || []);
          console.log("Atos carregados para a data selecionada:", dataAtos.atosPagos);
          
          // Verificar se há fechamento do dia atual
          const fechamentoDoDiaAtual = dataAtos.atosPagos.find((ato) => ato.codigo === "0001");
          console.log("Ato 0001 encontrado para a data selecionada (Valor Final do Caixa):", fechamentoDoDiaAtual);
          setValorFinalCaixa(fechamentoDoDiaAtual ? fechamentoDoDiaAtual.valor_unitario : 0);
        }
      } catch (e) {
        console.error('Erro ao carregar dados da data:', e);
        
      }
    }

    carregarDadosDaData();

    // Cleanup function para evitar atualizações em componente desmontado
    return () => {
      isMounted = false;
    };
  }, [dataSelecionada]); // Apenas quando a data muda

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
    const valorFinalCalculado = calcularValorFinalCaixa();

    // Validações antes de enviar
    if (isNaN(valorFinalCalculado)) {
      alert("Erro no cálculo do valor final do caixa. Verifique os dados e tente novamente.");
      return;
    }

    const pagamentosZerados = formasPagamento.reduce((acc, fp) => {
      acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
      return acc;
    }, {});

    // Criar apenas o ato de fechamento (código 0001) com o valor final do caixa
    const atoFechamento = {
      data: dataAtual,
      hora: hora,
      codigo: '0001',
      descricao: 'Valor Final do Caixa',
      quantidade: 1,
      valor_unitario: Number(valorFinalCalculado.toFixed(2)), // Garantir que é um número válido
      pagamentos: pagamentosZerados,
      usuario: nomeUsuario,
    };

    console.log("Dados do fechamento a serem enviados:", atoFechamento);
    console.log("Valor unitário (tipo):", typeof atoFechamento.valor_unitario, atoFechamento.valor_unitario);

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
          body: JSON.stringify(atoFechamento),
        }
      );

      console.log("Status da resposta:", res.status);

      if (!res.ok) {
        const json = await res.json();
        console.error("Erro do backend:", json);
        alert('Erro ao salvar fechamento no banco: ' + (json.message || JSON.stringify(json)));
        return;
      }

      const responseData = await res.json();
      console.log("Resposta do backend:", responseData);

      // Adiciona o ato de fechamento à lista local
      setAtos((prev) => [...prev, atoFechamento]);

      gerarRelatorioPDF({
        dataRelatorio: dataSelecionada.split('-').reverse().join('/'),
        atos,
        valorInicialCaixa,
        responsavel: nomeUsuario,
      });

      alert('Fechamento diário realizado com sucesso!');
    } catch (e) {
      console.error('Erro no fechamento diário:', e);
      alert('Erro ao realizar fechamento diário: ' + e.message);
    }
  };

  const salvarValorInicialCaixa = async () => {
    // Remove qualquer ato 0005 já existente para o dia
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario?.nome || 'Usuário não identificado';

    // Se não digitou nada, não salva
    if (!valorInicialCaixa || valorInicialCaixa <= 0) return;

    // Verifica se já existe um ato 0005 para o dia e usuário
    const existe = atos.find(
      (ato) =>
        ato.codigo === '0005' &&
        ato.data === dataSelecionada &&
        ato.usuario === nomeUsuario
    );

    // Se já existe e o valor não mudou, não faz nada
    if (existe && existe.valor_unitario === valorInicialCaixa) return;

    // Se já existe, remove do backend e da lista local
    if (existe && existe.id) {
      try {
        const token = localStorage.getItem('token');
        await fetch(
          `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos/${existe.id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (e) {
        console.error('Erro ao remover valor inicial antigo:', e);
      }
    }

    // Remove localmente
    setAtos((prev) => prev.filter(
      (ato) =>
        !(ato.codigo === '0005' && ato.data === dataSelecionada && ato.usuario === nomeUsuario)
    ));

    // Salva novo valor inicial no backend
    const novoAto = {
      data: dataSelecionada,
      hora: new Date().toLocaleTimeString(),
      codigo: '0005',
      descricao: 'Valor Inicial do Caixa',
      quantidade: 1,
      valor_unitario: Number(valorInicialCaixa),
      pagamentos: {},
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
        const salvo = await res.json();
        setAtos((prev) => [...prev, { ...novoAto, id: salvo.id }]);
      } else {
        alert('Erro ao salvar valor inicial do caixa.');
      }
    } catch (e) {
      console.error('Erro ao salvar valor inicial do caixa:', e);
      alert('Erro ao salvar valor inicial do caixa: ' + e.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      {/* Container Principal */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%'
      }}>
        
        {/* Header */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '25px',
          marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px'
        }}>      <h1 style={{ 
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
            <span style={{ color: '#666', fontSize: '14px' }}>📅</span>
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
        
        {/* Campo para ISS */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: '#f8f9fa',
          border: '2px solid #3498db',
          borderRadius: '8px'
        }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: '600',
            color: '#2c3e50'
          }}>
            📊 Percentual de ISS (%):
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={percentualISS}
            onChange={(e) => setPercentualISS(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            style={{
              width: '150px',
              padding: '12px',
              borderRadius: '8px',
              border: '2px solid #e3f2fd',
              fontSize: '16px',
              fontWeight: '600'
            }}
          />
          <span style={{ marginLeft: '10px', color: '#666', fontSize: '14px' }}>
            {percentualISS > 0 ? `(Os valores dos atos serão acrescidos de ${percentualISS}%)` : '(ISS desabilitado)'}
          </span>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '600',
            color: '#2c3e50'
          }}>
            Valor Inicial do Caixa:
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={valorInicialCaixa}
            onChange={e => setValorInicialCaixa(parseFloat(e.target.value) || 0)}
            onBlur={salvarValorInicialCaixa}
            style={{
              width: '150px',
              padding: '12px',
              borderRadius: '8px',
              border: '2px solid #e3f2fd',
              fontSize: '16px',
              fontWeight: '600'
            }}
          />
        </div>
      </div>

      {/* Layout Principal - Grid Responsivo */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '20px',
        marginBottom: '20px',
        maxWidth: '100%',
        overflow: 'hidden'
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
                Valor base: {formatarMoeda(selectedAto.valor_final)}
                {percentualISS > 0 && (
                  <span style={{ color: '#3498db', fontWeight: '600' }}>
                    {' '}+ ISS {percentualISS}% = {formatarMoeda(calcularValorComISS(selectedAto.valor_final))}
                  </span>
                )}
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
                placeholder="Ex. Troco, abertura de caixa, outras entradas"
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
                placeholder="Ex. Depósitos, retiradas, outras saídas."
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

      {/* Botão de Fechamento */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '25px',
        marginBottom: '20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <FechamentoDiarioButton onClick={fechamentoDiario} />
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
      
      </div> {/* Fim do Container Principal */}
    </div> 
  );
}

export default AtosPagos;

