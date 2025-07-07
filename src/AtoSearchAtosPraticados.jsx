import React, { useState, useEffect, useRef } from 'react';
import { formasPagamento } from './utils';
import AtoSearch from './AtoSearch';
import FormasPagamento from './FormasPagamento';

export default function AtoSearchAtosPraticados({ dataSelecionada, nomeUsuario }) {
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
  
  // Estados para busca de código tributário
  const [codigoTributarioTerm, setCodigoTributarioTerm] = useState('');
  const [codigoTributarioSuggestions, setCodigoTributarioSuggestions] = useState([]);
  const [loadingCodigoTributario, setLoadingCodigoTributario] = useState(false);
  const [selectedCodigoTributario, setSelectedCodigoTributario] = useState(null);
  
  const [atosTabela, setAtosTabela] = useState([]);
  const [loadingAtosTabela, setLoadingAtosTabela] = useState(false);
  const debounceTimeout = useRef(null);
  const codigoTributarioDebounceTimeout = useRef(null);

  // Função para buscar códigos tributários
  const buscarCodigosTributarios = async (term) => {
    if (term.trim() === '') {
      setCodigoTributarioSuggestions([]);
      return;
    }
    
    setLoadingCodigoTributario(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/codigos-gratuitos?search=${encodeURIComponent(term)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (res.ok) {
        setCodigoTributarioSuggestions(data.codigos || []);
      } else {
        setCodigoTributarioSuggestions([]);
      }
    } catch (error) {
      console.error('Erro ao buscar códigos tributários:', error);
      setCodigoTributarioSuggestions([]);
    }
    setLoadingCodigoTributario(false);
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
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/atos-tabela?data=${dataSelecionada}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (res.ok) {
        setAtosTabela(data.atos || []);
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

      const atoParaAdicionar = {
        data: dataSelecionada,
        hora: agora.toTimeString().split(' ')[0], // HH:MM:SS
        codigo: selectedAto.codigo,
        tributacao: `${selectedCodigoTributario.codigo} - ${selectedCodigoTributario.descricao}`,
        descricao: selectedAto.descricao,
        quantidade: quantidade,
        valor_unitario: selectedAto.valor_final,
        pagamentos: valorPagamentos,
        detalhes_pagamentos: selectedCodigoTributario.codigo === '01' ? JSON.stringify(pagamentos) : null
      };

      console.log('📦 Dados a serem enviados para o backend:', atoParaAdicionar);

      const token = localStorage.getItem('token');
      console.log('🔑 Token obtido:', token ? 'SIM' : 'NÃO');
      
      console.log('🌐 Fazendo requisição para o backend...');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-tabela`,
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
        setSelectedCodigoTributario(null);
        setCodigoTributarioTerm('');
        setPagamentos(
          formasPagamento.reduce((acc, fp) => {
            acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
            return acc;
          }, {})
        );
        
        // Recarregar tabela de atos
        console.log('🔄 Recarregando tabela de atos...');
        buscarAtosTabela();
        
        alert('Ato adicionado com sucesso!');
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

  // useEffect para buscar códigos tributários com debounce
  useEffect(() => {
    if (codigoTributarioDebounceTimeout.current) {
      clearTimeout(codigoTributarioDebounceTimeout.current);
    }
    
    codigoTributarioDebounceTimeout.current = setTimeout(() => {
      buscarCodigosTributarios(codigoTributarioTerm);
    }, 300);
    
    return () => clearTimeout(codigoTributarioDebounceTimeout.current);
  }, [codigoTributarioTerm]);

  // useEffect para buscar atos da tabela quando a data mudar
  useEffect(() => {
    console.log('📅 useEffect - Data mudou:', dataSelecionada);
    buscarAtosTabela();
  }, [dataSelecionada]);

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
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Formulário de Adição de Atos */}
      <div
        style={{
          backgroundColor: '#f0f0f0',
          borderRadius: 8,
          padding: 16,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <h3 style={{ margin: 0, color: '#2c3e50' }}>🔍 Adicionar Ato Praticado</h3>
        
        {/* Busca de Ato */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 350px', minWidth: 350 }}>
            <AtoSearch
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              suggestions={suggestions}
              loadingSuggestions={loadingSuggestions}
              onSelectAto={handleSelectAto}
            />
          </div>
          
          {/* Quantidade */}
          <div style={{ minWidth: 100 }}>
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
              onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e3f2fd',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          {/* Código Tributário */}
          <div style={{ minWidth: 200, position: 'relative' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Código Tributário:
            </label>
            <input
              type="text"
              value={codigoTributarioTerm}
              onChange={(e) => setCodigoTributarioTerm(e.target.value)}
              placeholder="Digite código ou descrição"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e3f2fd',
                fontSize: '16px',
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
                  padding: '12px',
                  fontSize: '14px',
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
                  maxHeight: '200px',
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
                      padding: '12px 16px', 
                      cursor: 'pointer', 
                      borderBottom: '1px solid #f0f0f0',
                      fontSize: '14px',
                      transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '4px' }}>
                      {codigo.codigo}
                    </div>
                    <div style={{ color: '#666', fontSize: '13px' }}>
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
            padding: 16,
            borderRadius: 8,
            border: '2px solid #2196f3'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>Código Tributário Selecionado:</h4>
            <p style={{ margin: 0, fontWeight: 'bold' }}>
              {selectedCodigoTributario.codigo} - {selectedCodigoTributario.descricao}
            </p>
          </div>
        )}

        {/* Ato Selecionado */}
        {selectedAto && (
          <div style={{
            backgroundColor: '#e8f5e8',
            padding: 16,
            borderRadius: 8,
            border: '2px solid #4caf50'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32' }}>Ato Selecionado:</h4>
            <p style={{ margin: 0, fontWeight: 'bold' }}>
              {selectedAto.codigo} - {selectedAto.descricao}
            </p>
            <p style={{ margin: '4px 0 0 0', color: '#666' }}>
              Valor Unitário: R$ {(parseFloat(selectedAto.valor_final) || 0).toFixed(2)}
            </p>
          </div>
        )}

        {/* Formas de Pagamento - só aparece para código tributário "01" */}
        {selectedCodigoTributario && selectedCodigoTributario.codigo === '01' && selectedAto && (
          <div>
            <h4 style={{ margin: '0 0 16px 0', color: '#2c3e50' }}>💳 Formas de Pagamento</h4>
            <FormasPagamento
              formasPagamento={formasPagamento}
              pagamentos={pagamentos}
              onQuantidadeChange={handleQuantidadePagamentoChange}
              onValorChange={handleValorPagamentoChange}
              corFundoPagamentos={() => '#fff'}
              selectedAto={selectedAto}
            />
          </div>
        )}

        {/* Botão Adicionar */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            style={{
              padding: '12px 24px',
              background: (selectedAto && selectedCodigoTributario) ? '#388e3c' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: (selectedAto && selectedCodigoTributario) ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              fontSize: '16px'
            }}
            onClick={() => {
              console.log('🖱️ BOTÃO ADICIONAR ATO CLICADO');
              console.log('📊 Estado no momento do clique:');
              console.log('- selectedAto:', selectedAto);
              console.log('- selectedCodigoTributario:', selectedCodigoTributario);
              console.log('- dataSelecionada:', dataSelecionada);
              adicionarAto();
            }}
            disabled={!selectedAto || !selectedCodigoTributario}
          >
            ➕ Adicionar Ato
          </button>
        </div>
      </div>

      {/* Tabela de Atos Praticados */}
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 8,
          padding: 16,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50' }}>📋 Atos Praticados neste dia:</h3>
        
        {loadingAtosTabela ? (
          <p>Carregando atos...</p>
        ) : atosTabela.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>Nenhum ato praticado encontrado para esta data.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Data</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Hora</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Código</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Tributação</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Descrição</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Qtd</th>
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Valor Unit.</th>
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Pagamentos</th>
                </tr>
              </thead>
              <tbody>
                {atosTabela.map((ato, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{ato.data}</td>
                    <td style={{ padding: '12px' }}>{ato.hora}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{ato.codigo}</td>
                    <td style={{ padding: '12px' }}>{ato.tributacao}</td>
                    <td style={{ padding: '12px' }}>{ato.descricao}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{ato.quantidade}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      R$ {parseFloat(ato.valor_unitario || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                      {typeof ato.pagamentos === 'string' ? ato.pagamentos : `R$ ${parseFloat(ato.pagamentos || 0).toFixed(2)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
