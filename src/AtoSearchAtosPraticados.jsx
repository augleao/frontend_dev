import React, { useState, useEffect, useRef } from 'react';
import { formasPagamento } from './utils';
import AtoSearch from './AtoSearch';
import FormasPagamento from './FormasPagamento';
import config from './config'; // ajuste o caminho se necessário
import Toast from './components/Toast';
import { DEFAULT_TOAST_DURATION } from './components/toastConfig';

  // Funções de formatação
  const formatarDataBR = (data) => {
    if (!data) return '';
    // Trata datas no formato ISO (ex: 2025-07-13T00:00:00.000Z)
    const soData = data.split('T')[0];
    const [ano, mes, dia] = soData.split('-');
    return `${dia}-${mes}-${ano}`;
  };

export default function AtoSearchAtosPraticados({ dataSelecionada, nomeUsuario, onAtoAdicionado, resumoRefreshTrigger }) {
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
  const [mensagem, setMensagem] = useState('');
  const mensagemTimeoutRef = useRef(null);

  // Estados para busca de código tributário
  const [codigoTributarioTerm, setCodigoTributarioTerm] = useState('01');
  const [codigoTributarioSuggestions, setCodigoTributarioSuggestions] = useState([]);
  const [loadingCodigoTributario, setLoadingCodigoTributario] = useState(false);
  const [selectedCodigoTributario, setSelectedCodigoTributario] = useState(null);

  const [atosTabela, setAtosTabela] = useState([]);
  const [loadingAtosTabela, setLoadingAtosTabela] = useState(false);
  const [atosParaAdicionar, setAtosParaAdicionar] = useState([]); // <-- MOVIDO PARA O TOPO
  const debounceTimeout = useRef(null);
  const codigoTributarioDebounceTimeout = useRef(null);

  // Função para buscar códigos tributários
  const buscarCodigosTributarios = async (term) => {
    console.debug('[DEBUG] buscarCodigosTributarios called with term:', term);
    if (term.trim() === '') {
      setCodigoTributarioSuggestions([]);
      console.debug('[DEBUG] term vazio, suggestions limpadas');
      return;
    }
    setLoadingCodigoTributario(true);
    try {
      const token = localStorage.getItem('token');
      const url = `${config.apiURL}/codigos-tributarios?s=${encodeURIComponent(term)}`;
      console.debug('[DEBUG] Fetching:', url);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      console.debug('[DEBUG] codigos-tributarios response:', data);
      if (res.ok) {
        setCodigoTributarioSuggestions(data.sugestoes || []);
        console.debug('[DEBUG] setCodigoTributarioSuggestions:', data.sugestoes || []);
      } else {
        setCodigoTributarioSuggestions([]);
        console.debug('[DEBUG] setCodigoTributarioSuggestions: [] (response not ok)');
      }
    } catch (error) {
      console.error('Erro ao buscar códigos tributários:', error);
      setCodigoTributarioSuggestions([]);
    }
    setLoadingCodigoTributario(false);
    console.debug('[DEBUG] setLoadingCodigoTributario(false)');
  };

  // Função para selecionar código tributário
  const handleSelectCodigoTributario = (codigo) => {
    console.log('🏛️ SELECIONANDO CÓDIGO TRIBUTÁRIO:', codigo);
    setSelectedCodigoTributario(codigo);
    setCodigoTributarioTerm(codigo.codigo); // Mostrar apenas o código no campo
    setCodigoTributarioSuggestions([]);
    console.log('✅ CÓDIGO TRIBUTÁRIO SELECIONADO COM SUCESSO');
    console.log('📋 Estado atualizado - selectedCodigoTributario:', codigo);
  };

  // Função para buscar atos da tabela atos_tabela
  const buscarAtosTabela = async () => {
    if (!dataSelecionada) return;
    
    setLoadingAtosTabela(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
  `${config.apiURL}/atos-tabela?data=${dataSelecionada}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (res.ok) {
        // Filtra os atos pelo nomeUsuario (usuário logado)
        const atosFiltrados = (data.atos || []).filter(
          ato => ato.usuario === nomeUsuario
        );
        setAtosTabela(atosFiltrados);
      } else {
        console.error('Erro ao buscar atos da tabela:', data.message);
        setAtosTabela([]);
      }
    } catch (error) {
      console.error('Erro ao buscar atos da tabela:', error);
      setAtosTabela([]);
    }
    setLoadingAtosTabela(false);
  };

  // Função para excluir ato da tabela atos_tabela
  const excluirAto = async (atoId) => {
    if (!atoId) {
      alert('ID do ato não encontrado');
      return;
    }

    if (!window.confirm('Tem certeza que deseja excluir este ato?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
  `${config.apiURL}/atos-tabela/${atoId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        alert('Ato excluído com sucesso!');
        // Recarregar tabela de atos
        buscarAtosTabela();
      } else {
        const data = await res.json();
        alert(`Erro ao excluir ato: ${data.message}`);
      }
    } catch (error) {
      console.error('Erro ao excluir ato:', error);
      alert('Erro ao excluir ato');
    }
  };

  // Função para selecionar ato
  const handleSelectAto = (ato) => {
    console.log('🎯 SELECIONANDO ATO:', ato);
    setSelectedAto(ato);
    setSearchTerm('');
    
    // Reset pagamentos quando selecionar novo ato
    setPagamentos(
      formasPagamento.reduce((acc, fp) => {
        acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
        return acc;
      }, {})
    );
    console.log('✅ ATO SELECIONADO COM SUCESSO');
  };

  // Função para calcular valor total dos pagamentos
  const calcularValorTotalPagamentos = () => {
    return Object.values(pagamentos).reduce((total, pagamento) => {
      return total + (pagamento.valor || 0);
    }, 0);
  };

  // Extrai ISS/ISSQN de um ato retornado pela busca
  const obterISSDoAto = (ato) => {
    if (!ato) return 0;
    const candidates = [
      ato.issqn,
      ato.iss,
      ato.iss_qn,
      ato.issqn_valor,
      ato.valor_issqn,
      ato.valor_iss,
      ato.valorIss,
      ato.valorIssqn
    ];
    const val = candidates.find((v) => v !== undefined && v !== null);
    return Number(val || 0) || 0;
  };

  // Função para adicionar ato à tabela atos_tabela
  const adicionarAto = async () => {
    console.log('🚀 INICIANDO FUNÇÃO ADICIONAR ATO');
    console.log('📊 Estado atual das variáveis:');
    console.log('=== DEBUG ADICIONAR ATO ===');
    console.log('selectedAto:', selectedAto);
    console.log('dataSelecionada:', dataSelecionada);
    console.log('selectedCodigoTributario:', selectedCodigoTributario);
    console.log('quantidade:', quantidade);
    
    if (!selectedAto || !dataSelecionada || !selectedCodigoTributario) {
      console.log('❌ VALIDAÇÃO FALHOU:');
      console.log('- selectedAto:', !!selectedAto, selectedAto);
      console.log('- dataSelecionada:', !!dataSelecionada, dataSelecionada);
      console.log('- selectedCodigoTributario:', !!selectedCodigoTributario, selectedCodigoTributario);
      alert('Selecione um ato, uma data válida e um código tributário');
      return;
    }

    console.log('✅ VALIDAÇÃO PASSOU - Prosseguindo...');

    try {
      const agora = new Date();
      const valorTotalPagamentos = calcularValorTotalPagamentos();
      
      console.log('💰 valorTotalPagamentos:', valorTotalPagamentos);
      console.log('🏛️ selectedCodigoTributario.codigo:', selectedCodigoTributario.codigo);
      
      // Determinar valor dos pagamentos baseado no código tributário
      let valorPagamentos;
      if (selectedCodigoTributario.codigo === '01') {
        console.log('💳 Ato PAGO detectado - verificando pagamentos...');
        // Ato Pago - usar valor total dos pagamentos
        if (valorTotalPagamentos === 0) {
          console.log('❌ Valor de pagamentos é zero para ato pago');
          alert('Para atos pagos, é necessário informar pelo menos uma forma de pagamento');
          return;
        }
        valorPagamentos = valorTotalPagamentos;
        console.log('✅ Valor de pagamentos definido:', valorPagamentos);
      } else {
        // Outros códigos - ISENTO
        valorPagamentos = 'ISENTO';
        console.log('🆓 Ato ISENTO detectado - valor:', valorPagamentos);
      }

      const issValor = obterISSDoAto(selectedAto);
      const valorBase = parseFloat(selectedAto.valor_final) || 0;
      const valorComISS = issValor ? Number((valorBase + issValor).toFixed(2)) : valorBase;

      const atoParaAdicionar = {
        data: dataSelecionada,
        hora: agora.toTimeString().split(' ')[0], // HH:MM:SS
        codigo: selectedAto.codigo,
        tributacao_codigo: selectedCodigoTributario.codigo, // Enviar apenas o código
        descricao: selectedAto.descricao,
        quantidade: quantidade,
        valor_unitario: selectedCodigoTributario.codigo === '01' ? valorComISS : 0,
        valor_final: selectedCodigoTributario.codigo === '01' ? valorComISS : 0,
        issqn: issValor,
        pagamentos: selectedCodigoTributario.codigo === '01' ? pagamentos : {}, // JSON vazio para isentos
        detalhes_pagamentos: selectedCodigoTributario.codigo === '01' ? {
          valor_total: valorTotalPagamentos || valorComISS,
          formas_utilizadas: Object.keys(pagamentos).filter(key => pagamentos[key].valor > 0),
          data_pagamento: dataSelecionada
        } : {}, // JSON vazio para isentos
        usuario: nomeUsuario
      };

      console.log('💵 [AtoSearchAtosPraticados] ISS extraído:', issValor, 'valorBase:', valorBase, 'valorComISS:', valorComISS);

      console.log('📦 Dados a serem enviados para o backend:', atoParaAdicionar);

      const token = localStorage.getItem('token');
      console.log('🔑 Token obtido:', token ? 'SIM' : 'NÃO');
      
      console.log('🌐 Fazendo requisição para o backend...');
      const res = await fetch(
        `${config.apiURL}/atos-tabela`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(atoParaAdicionar),
        }
      );

      console.log('📡 Status da resposta:', res.status);
      const data = await res.json();
      console.log('📥 Resposta do servidor:', data);
      
      if (res.ok) {
        console.log('🎉 ATO ADICIONADO COM SUCESSO!');
        // Limpar formulário
        setSelectedAto(null);
        setQuantidade(1);
        // Mantemos (ou restauramos) o código tributário padrão para facilitar entradas consecutivas.
        // Se já havia um código selecionado, mantemos. Caso contrário, tentamos auto-selecionar
        // o código padrão '01' a partir das sugestões; se não estiver disponível, criamos
        // um objeto mínimo para que o botão permaneça habilitado.
        if (selectedCodigoTributario) {
          // mantém o que já estava selecionado
          setCodigoTributarioTerm(String(selectedCodigoTributario.codigo || '01'));
        } else {
          const defaultCode = codigoTributarioSuggestions.find(c => String(c.codigo) === '01');
          if (defaultCode) {
            handleSelectCodigoTributario(defaultCode);
          } else {
            // cria um objeto mínimo para permitir submissões subsequentes sem forçar retyping
            setSelectedCodigoTributario({ codigo: '01', descricao: '' });
            setCodigoTributarioTerm('01');
          }
        }
        setPagamentos(
          formasPagamento.reduce((acc, fp) => {
            acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
            return acc;
          }, {})
        );
        
  // Recarregar tabela de atos
  console.log('🔄 Recarregando tabela de atos...');
  buscarAtosTabela();

        // Feedback sutil de sucesso
        setMensagem('Ato adicionado com sucesso!');
        if (mensagemTimeoutRef.current) clearTimeout(mensagemTimeoutRef.current);
        mensagemTimeoutRef.current = setTimeout(() => {
          setMensagem('');
          mensagemTimeoutRef.current = null;
        }, DEFAULT_TOAST_DURATION);

        // Notifica o componente pai para recarregar a tabela de "Atos praticados por"
        if (typeof onAtoAdicionado === 'function') {
          try {
            onAtoAdicionado();
          } catch (e) {
            console.warn('onAtoAdicionado callback falhou:', e);
          }
        }
      } else {
        console.error('❌ Erro do servidor:', data);
        alert(`Erro ao adicionar ato: ${data.message}`);
      }
    } catch (error) {
      console.error('💥 Erro ao adicionar ato:', error);
      alert('Erro ao adicionar ato');
    }
  };

  // Função para atualizar quantidade de pagamento
  const handleQuantidadePagamentoChange = (key, qtd) => {
    setPagamentos(prev => ({
      ...prev,
      [key]: { ...prev[key], quantidade: qtd }
    }));
  };

  // Função para atualizar valor de pagamento
  const handleValorPagamentoChange = (key, valor) => {
    setPagamentos(prev => ({
      ...prev,
      [key]: { ...prev[key], valor: valor }
    }));
  };

  // Exemplo de handler no componente pai
  function handleQuantidadeChange(forma, novaQtd) {
    // Limite pela quantidade informada no input principal do formulário
    const qtdMax = quantidade; // <-- use o estado do input principal
    const quantidadeForma = Math.min(Number(novaQtd), qtdMax);

    // Valor unitário do ato
    const valorUnitario = selectedAto?.valor_unitario || selectedAto?.valor_final || 0;

    setPagamentos(prev => ({
      ...prev,
      [forma]: {
        ...prev[forma],
        quantidade: quantidadeForma,
        valor: quantidadeForma * valorUnitario
      }
    }));
  }

  // useEffect para buscar sugestões de atos com debounce
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
  `${config.apiURL}/atos?search=${encodeURIComponent(
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

  // useEffect para buscar códigos tributários com debounce
  useEffect(() => {
    console.debug('[DEBUG] useEffect codigoTributarioTerm:', codigoTributarioTerm);
    if (codigoTributarioDebounceTimeout.current) {
      clearTimeout(codigoTributarioDebounceTimeout.current);
    }
    
    codigoTributarioDebounceTimeout.current = setTimeout(() => {
      buscarCodigosTributarios(codigoTributarioTerm);
    }, 300);
    
    return () => clearTimeout(codigoTributarioDebounceTimeout.current);
  }, [codigoTributarioTerm]);

  // Auto-seleciona qualquer código quando o input casa exatamente com um código das sugestões
  useEffect(() => {
    const term = (codigoTributarioTerm || '').trim().toLowerCase();
    if (!term) return;
    // Não fazer nada se já está selecionado o mesmo código
    if (
      selectedCodigoTributario &&
      String(selectedCodigoTributario.codigo).toLowerCase() === term
    ) {
      return;
    }
    const matchByCode = codigoTributarioSuggestions.find(
      (c) => String(c.codigo).toLowerCase() === term
    );
    if (matchByCode) {
      handleSelectCodigoTributario(matchByCode);
    }
  }, [codigoTributarioSuggestions, codigoTributarioTerm, selectedCodigoTributario]);

  // useEffect para buscar atos da tabela quando a data mudar
  useEffect(() => {
    console.log('📅 useEffect - Data mudou:', dataSelecionada);
    buscarAtosTabela();
  }, [dataSelecionada]);

  // Refresca o resumo quando o trigger externo mudar (ex.: exclusão ou inclusão fora deste componente)
  useEffect(() => {
    if (typeof resumoRefreshTrigger !== 'undefined') {
      console.log('🔁 resumoRefreshTrigger mudou, atualizando resumo de atos...', resumoRefreshTrigger);
      buscarAtosTabela();
    }
  }, [resumoRefreshTrigger]);

  // useEffect para monitorar mudanças no selectedAto
  useEffect(() => {
    console.log('🎯 useEffect - selectedAto mudou:', selectedAto);
  }, [selectedAto]);

  // useEffect para monitorar mudanças no selectedCodigoTributario
  useEffect(() => {
    console.log('🏛️ useEffect - selectedCodigoTributario mudou:', selectedCodigoTributario);
  }, [selectedCodigoTributario]);

  // Log inicial do componente
  useEffect(() => {
    console.log('🚀 COMPONENTE AtoSearchAtosPraticados MONTADO');
    console.log('📊 Props recebidas:');
    console.log('- dataSelecionada:', dataSelecionada);
    console.log('- nomeUsuario:', nomeUsuario);
    return () => {
      if (mensagemTimeoutRef.current) clearTimeout(mensagemTimeoutRef.current);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 /* reduzido de 24 */ }}>
      {/* Formulário de Adição de Atos */}
      <div
        style={{
          backgroundColor: '#f0f0f0',
          borderRadius: 8,
          padding: 10, // reduzido de 16
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12, // reduzido de 24
        }}
      >
        <h3 style={{ margin: 0, color: '#2c3e50', fontSize: 18 /* reduzido de 20 */ }}>🔍 Adicionar Ato Praticado</h3>
        
        {/* Busca de Ato */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 350px', minWidth: 250 }}>
            <AtoSearch
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              suggestions={suggestions}
              loadingSuggestions={loadingSuggestions}
              onSelectAto={handleSelectAto}
            />
          </div>
          
          {/* Quantidade */}
          <div style={{ minWidth: 80, marginTop: '-8px' /* sobe 8px */ }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '4px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Quantidade:
            </label>
            <input
              type="number"
              min="1"
              value={quantidade}
              onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '2px solid #e3f2fd',
                fontSize: '15px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          {/* Código Tributário */}
          <div style={{ minWidth: 140, position: 'relative', marginTop: '-8px' /* sobe 8px */ }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '4px',
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Código Tributário:
            </label>
            <input
              type="text"
              value={codigoTributarioTerm}
              onChange={(e) => setCodigoTributarioTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Try to find a matching suggestion by code or description
                  const match = codigoTributarioSuggestions.find(
                    (c) =>
                      c.codigo.toLowerCase() === codigoTributarioTerm.trim().toLowerCase() ||
                      c.descricao.toLowerCase() === codigoTributarioTerm.trim().toLowerCase()
                  );
                  if (match) {
                    handleSelectCodigoTributario(match);
                  } else {
                    // Optionally: alert or ignore if not found
                  }
                }
              }}
              placeholder="Digite código ou descrição"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '2px solid #e3f2fd',
                fontSize: '15px',
                boxSizing: 'border-box'
              }}
            />

            {loadingCodigoTributario && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '2px solid #e3f2fd',
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  zIndex: 1000,
                  padding: '8px', // reduzido de 12px
                  fontSize: '13px', // reduzido de 14px
                  color: '#666'
                }}
              >
                Carregando códigos...
              </div>
            )}

            {!loadingCodigoTributario && codigoTributarioSuggestions.length > 0 && (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '160px', // reduzido de 200px
                  overflowY: 'auto',
                  background: '#fff',
                  border: '2px solid #e3f2fd',
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  zIndex: 1000,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
              >
                {codigoTributarioSuggestions.map((codigo) => (
                  <li
                    key={codigo.id}
                    onClick={() => handleSelectCodigoTributario(codigo)}
                    style={{ 
                      padding: '8px 12px', // reduzido de 12px 16px
                      cursor: 'pointer', 
                      borderBottom: '1px solid #f0f0f0',
                      fontSize: '13px', // reduzido de 14px
                      transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '2px' /* reduzido de 4px */ }}>
                      {codigo.codigo}
                    </div>
                    <div style={{ color: '#666', fontSize: '12px' /* reduzido de 13px */ }}>
                      {codigo.descricao}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Código Tributário Selecionado */}
        {selectedCodigoTributario && (
          <div style={{
            backgroundColor: '#e3f2fd',
            padding: 10, // reduzido de 16
            borderRadius: 8,
            border: '2px solid #2196f3',
            marginTop: 4 // reduzido de 8
          }}>
            <h4 style={{ margin: '0 0 4px 0', color: '#1976d2', fontSize: 15 /* reduzido de 16 */ }}>Código Tributário Selecionado:</h4>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>
              {selectedCodigoTributario.codigo} - {selectedCodigoTributario.descricao}
            </p>
          </div>
        )}

        {/* Ato Selecionado */}
        {selectedAto && (
          <div style={{
            backgroundColor: '#e8f5e8',
            padding: 10, // reduzido de 16
            borderRadius: 8,
            border: '2px solid #4caf50',
            marginTop: 4 // reduzido de 8
          }}>
            <h4 style={{ margin: '0 0 4px 0', color: '#2e7d32', fontSize: 15 }}>Ato Selecionado:</h4>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>
              {selectedAto.codigo} - {selectedAto.descricao}
            </p>
            <p style={{ margin: '2px 0 0 0', color: '#666', fontSize: 13 }}>
              Valor Unitário: R$ {(parseFloat(selectedAto.valor_final) || 0).toFixed(2)}
            </p>
          </div>
        )}

        {/* Formas de Pagamento - só aparece para código tributário "01" */}
        {selectedCodigoTributario && selectedCodigoTributario.codigo === '01' && selectedAto && (
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: '#2c3e50', fontSize: 15 }}>💳 Formas de Pagamento</h4>
            <FormasPagamento
              formasPagamento={formasPagamento}
              pagamentos={pagamentos}
              onQuantidadeChange={handleQuantidadeChange}
              onValorChange={handleValorPagamentoChange}
              corFundoPagamentos={() => '#fff'}
              selectedAto={selectedAto}
            />
          </div>
        )}

        {/* Botão Adicionar */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 /* reduzido de 12 */ }}>
          <button
            type="button"
            className={`btn-gradient btn-gradient-green btn-compact${(!selectedAto || !selectedCodigoTributario) ? ' btn-muted' : ''}`}
            style={{ minWidth: 180 }}
            onClick={adicionarAto}
            disabled={!selectedAto || !selectedCodigoTributario}
          >
            ➕ Adicionar Ato
          </button>
        </div>

        {/* Toast flutuante */}
        <Toast
          message={mensagem}
          type="success"
          position="bottom-right"
          onClose={() => setMensagem('')}
        />
      </div>

      {/* Container de Atos Agrupados */}
      <div
        style={{
          backgroundColor: '#f8f9fa',
          borderRadius: 8,
          padding: 10, // reduzido de 16
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginTop: 8 // reduzido de 16
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50', fontSize: 16 /* reduzido de 18 */ }}>📊 Resumo de Atos Agrupados - {dataSelecionada}</h3>
        
        {loadingAtosTabela ? (
          <p>Carregando resumo...</p>
        ) : atosTabela.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>Nenhum ato para agrupar.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#e9ecef' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Código</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Tributação</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Descrição</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Qtd Total</th>
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Valor Unit.</th>
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Função para agrupar atos por código e tributação
                  const atosAgrupados = atosTabela.reduce((grupos, ato) => {
                    const chave = `${ato.codigo}-${ato.tributacao_codigo}`;
                    
                    if (!grupos[chave]) {
                      grupos[chave] = {
                        codigo: ato.codigo,
                        tributacao_codigo: ato.tributacao_codigo,
                        tributacao_descricao: ato.tributacao_descricao,
                        descricao: ato.descricao,
                        quantidade_total: 0,
                        valor_unitario: parseFloat(ato.valor_unitario || 0),
                        valor_total: 0
                      };
                    }
                    
                    grupos[chave].quantidade_total += parseInt(ato.quantidade || 0);
                    grupos[chave].valor_total += parseFloat(ato.valor_unitario || 0) * parseInt(ato.quantidade || 0);
                    
                    return grupos;
                  }, {});

                  return Object.values(atosAgrupados).map((grupo, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{grupo.codigo}</td>
                      <td style={{ padding: '12px' }}>
                        {grupo.tributacao_codigo} - {grupo.tributacao_descricao || 'N/A'}
                      </td>
                      <td style={{ padding: '12px' }}>{grupo.descricao}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#2196f3' }}>
                        {grupo.quantidade_total.toString().padStart(2, '0')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {grupo.valor_unitario === 0 ? (
                          'ISENTO'
                        ) : (
                          `R$ ${grupo.valor_unitario.toFixed(2)}`
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                        {grupo.valor_total === 0 ? (
                          'ISENTO'
                        ) : (
                          `R$ ${grupo.valor_total.toFixed(2)}`
                        )}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabela antiga removida: a listagem detalhada agora está na tela principal (AtosPraticados.jsx) */}
    </div>
  );
}
