import React, { useState, useEffect } from 'react';

export default function PesquisaAtosPraticados() {
  // Estados para os filtros de busca
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [nomeEscrevente, setNomeEscrevente] = useState('');
  const [codigoAto, setCodigoAto] = useState('');
  const [tipoTributacao, setTipoTributacao] = useState('');
  
  // Estados para os dados e controle
  const [atosPraticados, setAtosPraticados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalRegistros, setTotalRegistros] = useState(0);
  
  // Estados para sugestões de busca
  const [sugestoesEscrevente, setSugestoesEscrevente] = useState([]);
  const [sugestoesCodigo, setSugestoesCodigo] = useState([]);
  const [sugestoesTributacao, setSugestoesTributacao] = useState([]);

  // Função para buscar atos praticados
  const buscarAtosPraticados = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Construir parâmetros de busca
      const params = new URLSearchParams();
      if (dataInicial) params.append('dataInicial', dataInicial);
      if (dataFinal) params.append('dataFinal', dataFinal);
      if (nomeEscrevente) params.append('usuario', nomeEscrevente);
      if (codigoAto) params.append('codigo', codigoAto);
      if (tipoTributacao) params.append('tributacao', tipoTributacao);
      
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-tabela/pesquisa?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      const data = await res.json();
      if (res.ok) {
        setAtosPraticados(data.atos || []);
        setTotalRegistros(data.total || 0);
      } else {
        console.error('Erro ao buscar atos:', data.message);
        setAtosPraticados([]);
        setTotalRegistros(0);
      }
    } catch (error) {
      console.error('Erro ao buscar atos praticados:', error);
      setAtosPraticados([]);
      setTotalRegistros(0);
    }
    setLoading(false);
  };

  // Função para buscar sugestões de escreventes
  const buscarSugestoesEscrevente = async (termo) => {
    if (termo.length < 2) {
      setSugestoesEscrevente([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-tabela/usuarios?search=${encodeURIComponent(termo)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      const data = await res.json();
      if (res.ok) {
        setSugestoesEscrevente(data.usuarios || []);
      }
    } catch (error) {
      console.error('Erro ao buscar sugestões de escrevente:', error);
    }
  };

  // Função para buscar sugestões de códigos
  const buscarSugestoesCodigo = async (termo) => {
    if (termo.length < 1) {
      setSugestoesCodigo([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos?search=${encodeURIComponent(termo)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      const data = await res.json();
      if (res.ok) {
        setSugestoesCodigo(data.atos || []);
      }
    } catch (error) {
      console.error('Erro ao buscar sugestões de código:', error);
    }
  };

  // Função para buscar sugestões de tributação
  const buscarSugestoesTributacao = async (termo) => {
    if (termo.length < 1) {
      setSugestoesTributacao([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/codigos-gratuitos?search=${encodeURIComponent(termo)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      const data = await res.json();
      if (res.ok) {
        setSugestoesTributacao(data.codigos || []);
      }
    } catch (error) {
      console.error('Erro ao buscar sugestões de tributação:', error);
    }
  };

  // Função para limpar filtros
  const limparFiltros = () => {
    setDataInicial('');
    setDataFinal('');
    setNomeEscrevente('');
    setCodigoAto('');
    setTipoTributacao('');
    setAtosPraticados([]);
    setTotalRegistros(0);
    setSugestoesEscrevente([]);
    setSugestoesCodigo([]);
    setSugestoesTributacao([]);
  };

  // Função para formatar data brasileira
  const formatarDataBR = (data) => {
    if (!data) return '';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Função para formatar valor monetário
  const formatarValor = (valor) => {
    if (!valor) return 'R$ 0,00';
    return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
  };

  // Função para formatar pagamentos
  const formatarPagamentos = (pagamentos, detalhes_pagamentos) => {
    if (!pagamentos || Object.keys(pagamentos).length === 0) {
      return 'ISENTO';
    }
    
    // Se tem detalhes_pagamentos, usar o valor_total
    if (detalhes_pagamentos && detalhes_pagamentos.valor_total) {
      return formatarValor(detalhes_pagamentos.valor_total);
    }
    
    // Senão, somar os valores dos pagamentos
    const total = Object.values(pagamentos).reduce((acc, pagamento) => {
      return acc + (parseFloat(pagamento.valor) || 0);
    }, 0);
    
    return total > 0 ? formatarValor(total) : 'ISENTO';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 20 }}>
      {/* Container de Filtros */}
      <div
        style={{
          backgroundColor: '#f8f9fa',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        <h2 style={{ margin: '0 0 24px 0', color: '#2c3e50', fontSize: '24px' }}>
          🔍 Pesquisa de Atos Praticados TESTE
        </h2>
        
        {/* Linha 1: Período de Datas */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 200 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              📅 Data Inicial:
            </label>
            <input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
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
          
          <div style={{ minWidth: 200 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              📅 Data Final:
            </label>
            <input
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
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
        </div>

        {/* Linha 2: Nome do Escrevente */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: '600',
            color: '#2c3e50'
          }}>
            👤 Nome do Escrevente:
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={nomeEscrevente}
              onChange={(e) => {
                setNomeEscrevente(e.target.value);
                buscarSugestoesEscrevente(e.target.value);
              }}
              placeholder="Digite o nome do escrevente"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e3f2fd',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
            
            {sugestoesEscrevente.length > 0 && (
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
                {sugestoesEscrevente.map((usuario, index) => (
                  <li
                    key={index}
                    onClick={() => {
                      setNomeEscrevente(usuario);
                      setSugestoesEscrevente([]);
                    }}
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
                    {usuario}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Linha 3: Código do Ato e Tipo de Tributação */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 250, position: 'relative' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              📋 Código do Ato:
            </label>
            <input
              type="text"
              value={codigoAto}
              onChange={(e) => {
                setCodigoAto(e.target.value);
                buscarSugestoesCodigo(e.target.value);
              }}
              placeholder="Digite código ou descrição do ato"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e3f2fd',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
            
            {sugestoesCodigo.length > 0 && (
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
                {sugestoesCodigo.map((ato) => (
                  <li
                    key={ato.codigo}
                    onClick={() => {
                      setCodigoAto(ato.codigo);
                      setSugestoesCodigo([]);
                    }}
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
                      {ato.codigo}
                    </div>
                    <div style={{ color: '#666', fontSize: '13px' }}>
                      {ato.descricao}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div style={{ flex: 1, minWidth: 250, position: 'relative' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600',
              color: '#2c3e50'
            }}>
              🏛️ Tipo de Tributação:
            </label>
            <input
              type="text"
              value={tipoTributacao}
              onChange={(e) => {
                setTipoTributacao(e.target.value);
                buscarSugestoesTributacao(e.target.value);
              }}
              placeholder="Digite código ou descrição da tributação"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e3f2fd',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
            
            {sugestoesTributacao.length > 0 && (
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
                {sugestoesTributacao.map((tributacao) => (
                  <li
                    key={tributacao.codigo}
                    onClick={() => {
                      setTipoTributacao(tributacao.codigo);
                      setSugestoesTributacao([]);
                    }}
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
                      {tributacao.codigo}
                    </div>
                    <div style={{ color: '#666', fontSize: '13px' }}>
                      {tributacao.descricao}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-start' }}>
          <button
            onClick={buscarAtosPraticados}
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: loading ? '#ccc' : '#2196f3',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '16px',
              transition: 'background-color 0.2s ease'
            }}
          >
            {loading ? '🔄 Buscando...' : '🔍 Buscar Atos'}
          </button>
          
          <button
            onClick={limparFiltros}
            style={{
              padding: '12px 24px',
              background: '#6c757d',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px',
              transition: 'background-color 0.2s ease'
            }}
          >
            🗑️ Limpar Filtros
          </button>
        </div>
      </div>

      {/* Resultado da Busca */}
      {totalRegistros > 0 && (
        <div style={{ 
          backgroundColor: '#e8f5e8', 
          padding: 12, 
          borderRadius: 8, 
          border: '2px solid #4caf50',
          textAlign: 'center'
        }}>
          <strong style={{ color: '#2e7d32' }}>
            📊 {totalRegistros} ato(s) encontrado(s)
          </strong>
        </div>
      )}

      {/* Tabela de Resultados */}
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '20px' }}>
          📋 Resultados da Pesquisa
        </h3>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            <div style={{ fontSize: '18px', marginBottom: 10 }}>🔄</div>
            Carregando atos praticados...
          </div>
        ) : atosPraticados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666', fontStyle: 'italic' }}>
            Nenhum ato praticado encontrado com os filtros aplicados.
            <br />
            Tente ajustar os critérios de busca.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', minWidth: '80px' }}>ID</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', minWidth: '100px' }}>Data</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', minWidth: '80px' }}>Hora</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', minWidth: '80px' }}>Código</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', minWidth: '120px' }}>Tributação</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', minWidth: '200px' }}>Descrição</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd', minWidth: '80px' }}>Qtd</th>
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd', minWidth: '120px' }}>Valor Unit.</th>
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd', minWidth: '120px' }}>Pagamentos</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', minWidth: '150px' }}>Usuário</th>
                </tr>
              </thead>
              <tbody>
                {atosPraticados.map((ato) => (
                  <tr key={ato.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{ato.id}</td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{formatarDataBR(ato.data)}</td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{ato.hora}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold', fontSize: '14px' }}>{ato.codigo}</td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      {ato.tributacao} - {ato.tributacao_descricao || 'N/A'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{ato.descricao}</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px' }}>{ato.quantidade}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px' }}>
                      {parseFloat(ato.valor_unitario || 0) === 0 ? (
                        <span style={{ color: '#666', fontStyle: 'italic' }}>ISENTO</span>
                      ) : (
                        formatarValor(ato.valor_unitario)
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>
                      {formatarPagamentos(ato.pagamentos, ato.detalhes_pagamentos)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{ato.usuario}</td>
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

