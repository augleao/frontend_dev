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
  const [codigoTributario, setCodigoTributario] = useState('01'); // Padrão: Ato Pago
  const [atosTabela, setAtosTabela] = useState([]);
  const [loadingAtosTabela, setLoadingAtosTabela] = useState(false);
  const debounceTimeout = useRef(null);

  // Opções de código tributário
  const codigosTributarios = [
    { value: '01', label: '01 - Ato Pago' },
    { value: '02', label: '02 - Ato Gratuito' },
    { value: '03', label: '03 - Ato Isento' },
    { value: '04', label: '04 - Ato com Isenção Parcial' },
  ];

  // Função para buscar atos da tabela atos_tabela
  const buscarAtosTabela = async () => {
    if (!dataSelecionada) return;
    
    setLoadingAtosTabela(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-tabela?data=${dataSelecionada}`,
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
    setSelectedAto(ato);
    setSearchTerm('');
    
    // Reset pagamentos quando selecionar novo ato
    setPagamentos(
      formasPagamento.reduce((acc, fp) => {
        acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
        return acc;
      }, {})
    );
  };

  // Função para calcular valor total dos pagamentos
  const calcularValorTotalPagamentos = () => {
    return Object.values(pagamentos).reduce((total, pagamento) => {
      return total + (pagamento.valor || 0);
    }, 0);
  };

  // Função para adicionar ato à tabela atos_tabela
  const adicionarAto = async () => {
    if (!selectedAto || !dataSelecionada) {
      alert('Selecione um ato e uma data válida');
      return;
    }

    try {
      const agora = new Date();
      const valorTotalPagamentos = calcularValorTotalPagamentos();
      
      // Determinar valor dos pagamentos baseado no código tributário
      let valorPagamentos;
      if (codigoTributario === '01') {
        // Ato Pago - usar valor total dos pagamentos
        if (valorTotalPagamentos === 0) {
          alert('Para atos pagos, é necessário informar pelo menos uma forma de pagamento');
          return;
        }
        valorPagamentos = valorTotalPagamentos;
      } else {
        // Outros códigos - ISENTO
        valorPagamentos = 'ISENTO';
      }

      const atoParaAdicionar = {
        data: dataSelecionada,
        hora: agora.toTimeString().split(' ')[0], // HH:MM:SS
        codigo: selectedAto.codigo,
        tributacao: codigosTributarios.find(ct => ct.value === codigoTributario)?.label || codigoTributario,
        descricao: selectedAto.descricao,
        quantidade: quantidade,
        valor_unitario: selectedAto.valor_final,
        pagamentos: valorPagamentos,
        detalhes_pagamentos: codigoTributario === '01' ? JSON.stringify(pagamentos) : null
      };

      const token = localStorage.getItem('token');
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

      const data = await res.json();
      if (res.ok) {
        // Limpar formulário
        setSelectedAto(null);
        setQuantidade(1);
        setCodigoTributario('01');
        setPagamentos(
          formasPagamento.reduce((acc, fp) => {
            acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
            return acc;
          }, {})
        );
        
        // Recarregar tabela de atos
        buscarAtosTabela();
        
        alert('Ato adicionado com sucesso!');
      } else {
        alert(`Erro ao adicionar ato: ${data.message}`);
      }
    } catch (error) {
      console.error('Erro ao adicionar ato:', error);
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

  // useEffect para buscar atos da tabela quando a data mudar
  useEffect(() => {
    buscarAtosTabela();
  }, [dataSelecionada]);

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
          <div style={{ minWidth: 200 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              Código Tributário:
            </label>
            <select
              value={codigoTributario}
              onChange={(e) => setCodigoTributario(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e3f2fd',
                fontSize: '16px',
                boxSizing: 'border-box',
                backgroundColor: '#fff'
              }}
            >
              {codigosTributarios.map(codigo => (
                <option key={codigo.value} value={codigo.value}>
                  {codigo.label}
                </option>
              ))}
            </select>
          </div>
        </div>

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
        {codigoTributario === '01' && selectedAto && (
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
              background: selectedAto ? '#388e3c' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: selectedAto ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              fontSize: '16px'
            }}
            onClick={adicionarAto}
            disabled={!selectedAto}
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
        <h3 style={{ margin: '0 0 16px 0', color: '#2c3e50' }}>📋 Atos Praticados - {dataSelecionada}</h3>
        
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

