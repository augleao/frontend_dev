import React, { useState, useEffect, useRef } from 'react';
import {
  formasPagamento,
  formatarMoeda,
  formatarDataBR,
  gerarRelatorioPDFAtosPraticados,
} from './utils';
import DataSelector from './DataSelector';
import AtoSearchAtosPraticados from './AtoSearchAtosPraticados';
import FormasPagamento from './FormasPagamento';
import AtosTable from './AtosTableEscrevente';
import FechamentoDiarioButton from './FechamentoDiarioButton';
import dayjs from 'dayjs';
import { apiURL } from './config';
import TributacaoSearch from './TributacaoSearch'; // Adicione esta linha no topo
//import { gerarRelatorioPDFAtosPraticados } from './components/RelatorioPDF';

function AtosPraticados() {
  // Estados
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    const hoje = new Date();
    // Corrige para o fuso local
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  });


  const [percentualISS, setPercentualISS] = useState(0); // Estado para ISS
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [tributacao, setTributacao] = useState(''); // Adicione este estado

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
    console.log('🧑 nomeUsuario recebido atosPraticados:', usuario);
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

  // Funções auxiliares
  const handleDataChange = (e) => {
    setDataSelecionada(e.target.value);
  };



  const valoresIguais = (a, b, tolerancia = 0.01) => Math.abs(a - b) < tolerancia;

  const somaPagamentos = Object.values(pagamentos).reduce(
    (acc, p) => acc + (parseFloat(p.valor) || 0),
    0
  );

  // Aplicar ISS no valor total
  const valorTotal = 0; // Removido o uso de selectedAto
  // const valorTotal = selectedAto ? calcularValorComISS((selectedAto.valor_final ?? 0) * quantidade) : 0;

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

      const valorUnitarioComISS = 0; // Removido o uso de selectedAto
      // const valorUnitarioComISS = selectedAto ? calcularValorComISS(selectedAto.valor_final ?? 0) : 0;

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
      const valorUnitarioComISS = 0; // Removido o uso de selectedAto
      // const valorUnitarioComISS = selectedAto ? calcularValorComISS(selectedAto.valor_final ?? 0) : 0;

      formasPagamento.forEach((fp) => {
        if (!novo[fp.key].manual) {
          novo[fp.key].valor = valorUnitarioComISS * novo[fp.key].quantidade;
        }
      });

      return novo;
    });
  };



  const removerAto = async (index) => {
    const atoParaRemover = atos[index];
    
    // Verificar se o ato tem ID (foi salvo no backend)
    if (atoParaRemover.id) {
      // Ato existe no backend, precisa deletar lá também
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${apiURL}/atos-praticados/${atoParaRemover.id}`,
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

  // Função para carregar atos do backend
  const carregarDadosPraticadosDaData = async () => {
    try {
      const token = localStorage.getItem('token');
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      const nomeLogado = usuario?.nome || usuario?.email;

      const resAtos = await fetch(
        `${apiURL}/atos-praticados?data=${dataSelecionada}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (resAtos.ok) {
        const dataAtos = await resAtos.json();
        // Suporte para diferentes formatos de retorno
        const listaAtos = Array.isArray(dataAtos)
          ? dataAtos
          : Array.isArray(dataAtos.CaixaDiario)
            ? dataAtos.CaixaDiario
            : [];
        // Filtra os atos pelo usuário logado
        const atosFiltrados = listaAtos.filter(
          ato => ato.usuario === nomeLogado
        );
        setAtos(atosFiltrados);
      }
    } catch (e) {
      console.error('Erro ao carregar dados da data:', e);
    }
  };

// Adicione este useEffect:
useEffect(() => {
  carregarDadosPraticadosDaData();
}, []);

  // useEffect para carregar atos ao mudar a data
  useEffect(() => {
    let isMounted = true;
    carregarDadosPraticadosDaData();
    return () => { isMounted = false; };
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
          `${apiURL}/codigos-tributarios?search=${encodeURIComponent(
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
    const dataAtual = dataSelecionada;
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

    const atoFechamento = {
      data: dataAtual,
      hora: hora,
      codigo: '0001',
      descricao: 'FECHAMENTO DIÁRIO DOS ATOS',
      quantidade: 1,
      valor_unitario: 0, // Não usa valor final do caixa
      pagamentos: pagamentosZerados,
      usuario: nomeUsuario,
    };

    try {
      const token = localStorage.getItem('token');
      console.log('Enviando fechamento ao backend:', atoFechamento);
      const res = await fetch(
        `${apiURL}/atos-praticados`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(atoFechamento),
        }
      );
      const resText = await res.text();
      console.log('Resposta do backend ao salvar fechamento:', res.status, resText);

      if (!res.ok) {
        alert('Erro ao salvar fechamento no banco: ' + resText);
        return;
      }

      await carregarDadosPraticadosDaData();
      alert('Fechamento diário realizado com sucesso!');

      // Gere o PDF no frontend:
      gerarRelatorioPDFAtosPraticados({
        dataRelatorio: dataSelecionada,
        atos,
        depositosCaixa: atos.filter(a => a.codigo === '0003'), // entradas manuais
        saidasCaixa: atos.filter(a => a.codigo === '0002'),    // saídas manuais
        responsavel: nomeUsuario,
        ISS: percentualISS,
        observacoesGerais: '' // ou outro campo se desejar
      });
    } catch (e) {
      alert('Erro ao realizar fechamento diário: ' + e.message);
      console.error('Erro ao realizar fechamento diário:', e);
    }
  };

  // ISS automático conforme serventia do usuário
useEffect(() => {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  if (usuario?.serventia === 'RCPN de Campanha') {
    setPercentualISS(3);
  } else if (usuario?.serventia === 'RCPN de Lavras') {
    setPercentualISS(0);
  } else {
    setPercentualISS(0);
  }
}, []);

  // Função para importar atos praticados
  const importarAtosPraticados = async () => {
    try {
      const token = localStorage.getItem('token');
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      const serventiaUsuario = usuario?.serventia;

      if (!serventiaUsuario) {
        alert('Usuário não tem serventia configurada');
        return;
      }

      // 1. Verificar se a serventia tem caixa unificado
      const resConfig = await fetch(`${apiURL}/serventia-config/${encodeURIComponent(serventiaUsuario)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!resConfig.ok) {
        alert('Erro ao verificar configuração da serventia');
        return;
      }

      const configData = await resConfig.json();
      const caixaUnificado = configData?.caixa_unificado;

      if (!caixaUnificado) {
        alert('Esta serventia não possui caixa unificado configurado. Não é possível importar atos de outros usuários.');
        return;
      }

      // 2. Buscar todos os usuários da mesma serventia
      const resUsuarios = await fetch(`${apiURL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!resUsuarios.ok) {
        alert('Erro ao buscar usuários da serventia');
        return;
      }

      const usuariosData = await resUsuarios.json();
      const usuariosDaServentia = (usuariosData.usuarios || []).filter(u => u.serventia === serventiaUsuario);
      const nomesUsuarios = usuariosDaServentia.map(u => u.nome);

      if (nomesUsuarios.length === 0) {
        alert('Nenhum usuário encontrado para esta serventia');
        return;
      }

      // 3. Importar atos da tabela selos_execucao_servico
      const resImportar = await fetch(`${apiURL}/atos-praticados/importar-servicos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          data: dataSelecionada,
          usuarios: nomesUsuarios,
          serventia: serventiaUsuario
        })
      });

      if (!resImportar.ok) {
        const errorData = await resImportar.json();
        alert('Erro ao importar atos: ' + (errorData.message || 'Erro desconhecido'));
        return;
      }

      const resultData = await resImportar.json();
      alert(`Importação concluída! ${resultData.atosImportados || 0} atos foram importados.`);

      // Recarregar os dados após a importação
      await carregarDadosPraticadosDaData();

    } catch (error) {
      console.error('Erro ao importar atos praticados:', error);
      alert('Erro ao importar atos: ' + error.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '12px', // reduzido de 20px
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
          padding: '16px', // reduzido de 25px
          marginBottom: '12px', // reduzido de 20px
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px' // reduzido de 15px
        }}>      <h1 style={{ 
          margin: 0, 
          color: '#2c3e50',
          fontSize: '24px', // reduzido de 28px
          fontWeight: '600'
        }}>
          🔗 Atos Praticados Neste Dia
        </h1>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', // reduzido de 15px
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px' // reduzido de 8px
          }}>
            <span style={{ color: '#666', fontSize: '13px' }}>👤 Usuário:</span>
            <input
              type="text"
              value={nomeUsuario}
              readOnly
              tabIndex={-1}
              style={{
                padding: '6px 10px', // reduzido de 8px 12px
                borderRadius: '8px',
                border: '2px solid rgb(0, 0, 0)',
                backgroundColor: '#e3f2fd',
                fontWeight: '600',
                color: '#000',
                fontSize: '13px', // reduzido de 14px
                pointerEvents: 'none',
              }}
            />
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px' // reduzido de 8px
          }}>
            <span style={{ color: '#666', fontSize: '13px' }}>📅</span>
            <DataSelector dataSelecionada={dataSelecionada} onChange={handleDataChange} />
          </div>
        </div>
      </div>

      {/* Layout Principal - Grid Responsivo */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '12px', // reduzido de 20px
        marginBottom: '12px', // reduzido de 20px
        maxWidth: '100%',
        overflow: 'hidden'
      }}>
        {/* Seção de Adição de Atos */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px', // reduzido de 25px
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h3 style={{
              margin: '0',
              color: '#2c3e50',
              fontSize: '16px',
              fontWeight: '600',
              borderBottom: '2px solid #27ae60',
              paddingBottom: '6px'
            }}>
              ➕ Adicionar Ato
            </h3>
            <button
              onClick={importarAtosPraticados}
              style={{
                background: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(52, 152, 219, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = '#2980b9'}
              onMouseOut={(e) => e.target.style.background = '#3498db'}
            >
              📥 Importar Atos
            </button>
          </div>
          {/* Integração do AtoSearchAtosPraticados */}
          <AtoSearchAtosPraticados
            dataSelecionada={dataSelecionada}
            nomeUsuario={nomeUsuario}
          />
        </div>
      </div>
    </div>
  </div>
);
}

export default AtosPraticados;

