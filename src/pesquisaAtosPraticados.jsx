import React, { useState, useEffect } from 'react';
import { apiURL } from './config';

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
  const [mensagem, setMensagem] = useState('');

  // Novo estado para lista de usuários
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioLogado, setUsuarioLogado] = useState(null);

  // Buscar usuário logado ao montar o componente
  useEffect(() => {
    const userStr = localStorage.getItem('usuario');
    if (userStr) {
      try {
        setUsuarioLogado(JSON.parse(userStr));
      } catch {
        setUsuarioLogado(null);
      }
    }
  }, []);

  // Buscar usuários cadastrados ao montar o componente
  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiURL}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          console.log('🛑 Dados brutos dos usuários:', data.usuarios);
          setUsuarios(data.usuarios || []);
        } else {
          setUsuarios([]);
        }
      } catch {
        setUsuarios([]);
      }
    };
    fetchUsuarios();
  }, []);

  // Atualiza o filtro para o próprio usuário caso não seja Registrador/Substituto
  useEffect(() => {
    console.log('👤 usuarioLogado:', usuarioLogado);
    console.log('👥 usuarios:', usuarios);
    console.log('✍️ nomeEscrevente:', nomeEscrevente);

    if (
      usuarioLogado &&
      usuarioLogado.cargo &&
      usuarioLogado.cargo !== 'Registrador' &&
      usuarioLogado.cargo !== 'Substituto'
    ) {
      setNomeEscrevente(usuarioLogado.nome || usuarioLogado.email);
      console.log('🔒 Escrevente comum: setNomeEscrevente para', usuarioLogado.nome || usuarioLogado.email);
    }
    // Se for Substituto, só limpa se o escrevente não for da mesma serventia
    if (
      usuarioLogado &&
      usuarioLogado.cargo === 'Substituto' &&
      usuarios.length > 0
    ) {
      const escreventeValido = usuarios.find(
        (u) =>
          (u.nome || u.email) === nomeEscrevente &&
          u.serventia === usuarioLogado.serventia
      );
      console.log('🔎 escreventeValido:', escreventeValido);
      if (!escreventeValido) {
        setNomeEscrevente('');
        console.log('🧹 Limpando nomeEscrevente pois não pertence à serventia do Substituto');
      }
    }
  }, [usuarioLogado, usuarios, nomeEscrevente]);

  // Função principal para buscar atos praticados
  const buscarAtosPraticados = async () => {
    // Validação básica
    if (!dataInicial && !dataFinal && !nomeEscrevente && !codigoAto && !tipoTributacao) {
      setMensagem('Por favor, preencha pelo menos um filtro de busca.');
      return;
    }

    setLoading(true);
    setMensagem('');
    
    try {
      const token = localStorage.getItem('token');
      
      // Construir parâmetros de busca
      const params = new URLSearchParams();
      if (dataInicial) params.append('dataInicial', dataInicial);
      if (dataFinal) params.append('dataFinal', dataFinal);
      if (nomeEscrevente.trim()) params.append('usuario', nomeEscrevente.trim());
      if (codigoAto.trim()) params.append('codigo', codigoAto.trim());
      if (tipoTributacao.trim()) params.append('tributacao', tipoTributacao.trim());
      
      console.log('🔍 Buscando atos com parâmetros:', params.toString());
      
      const res = await fetch(
        `${apiURL}/busca-atos/pesquisa?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      const data = await res.json();
      console.log('📊 Resposta da API:', data);
      
      if (res.ok) {
        let atos = data.atos || [];
        let total = data.total || 0;

        // Se for Substituto e nenhum escrevente foi selecionado, filtra só os atos da sua serventia
        if (
          usuarioLogado &&
          usuarioLogado.cargo === 'Substituto' &&
          !nomeEscrevente // nenhum escrevente selecionado
        ) {
          // Pegue os nomes dos escreventes da mesma serventia
          const escreventesDaServentia = usuarios
            .filter(u => u.serventia === usuarioLogado.serventia)
            .map(u => u.nome || u.email);

          atos = atos.filter(ato => escreventesDaServentia.includes(ato.usuario));
          total = atos.length;
        }

        setAtosPraticados(atos);
        setTotalRegistros(total);

        if (total === 0) {
          setMensagem('Nenhum ato encontrado com os filtros aplicados.');
        } else {
          setMensagem(`${total} ato(s) encontrado(s).`);
        }
      } else {
        console.error('❌ Erro ao buscar atos:', data.message);
        setAtosPraticados([]);
        setTotalRegistros(0);
        setMensagem(`Erro: ${data.message || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('❌ Erro na requisição:', error);
      setAtosPraticados([]);
      setTotalRegistros(0);
      setMensagem('Erro de conexão com o servidor.');
    }
    
    setLoading(false);
  };

  // Função para limpar todos os filtros
  const limparFiltros = () => {
    setDataInicial('');
    setDataFinal('');
    setNomeEscrevente('');
    setCodigoAto('');
    setTipoTributacao('');
    setAtosPraticados([]);
    setTotalRegistros(0);
    setMensagem('');
  };

  // Função para definir período padrão (últimos 30 dias)
  const definirUltimos30Dias = () => {
    const hoje = new Date();
    const dataFinalStr = hoje.toISOString().split('T')[0];
    
    const dataInicial = new Date();
    dataInicial.setDate(hoje.getDate() - 30);
    const dataInicialStr = dataInicial.toISOString().split('T')[0];
    
    setDataInicial(dataInicialStr);
    setDataFinal(dataFinalStr);
  };

  // Função para definir período do mês atual
  const definirMesAtual = () => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    
    setDataInicial(primeiroDia.toISOString().split('T')[0]);
    setDataFinal(ultimoDia.toISOString().split('T')[0]);
  };

  // Funções de formatação
  const formatarDataBR = (data) => {
    if (!data) return '';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const formatarValor = (valor) => {
    if (!valor || parseFloat(valor) === 0) return 'ISENTO';
    return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
  };

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
    
    return formatarValor(total);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '25px',
          marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}>
          <h1 style={{ 
            margin: 0, 
            color: '#2c3e50',
            fontSize: '28px',
            fontWeight: '600',
            textAlign: 'center'
          }}>
            🔍 Pesquisa de Atos Praticados
          </h1>
          <p style={{
            textAlign: 'center',
            color: '#666',
            margin: '8px 0 0 0',
            fontSize: '16px'
          }}>
            Consulte atos praticados por período, escrevente, código e tributação
          </p>
        </div>

        {/* Container de Filtros */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '30px',
          marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}>
          <h3 style={{ 
            margin: '0 0 24px 0', 
            color: '#2c3e50', 
            fontSize: '20px',
            fontWeight: '600'
          }}>
            📋 Filtros de Busca
          </h3>
          
          {/* Linha 1: Período de Datas */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ 
              margin: '0 0 16px 0', 
              color: '#34495e', 
              fontSize: '16px',
              fontWeight: '600'
            }}>
              📅 Período de Datas
            </h4>
            
            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '200px', flex: 1 }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  Data Inicial:
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
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                  onBlur={(e) => e.target.style.borderColor = '#e3f2fd'}
                />
              </div>
              
              <div style={{ minWidth: '200px', flex: 1 }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500',
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  Data Final:
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
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                  onBlur={(e) => e.target.style.borderColor = '#e3f2fd'}
                />
              </div>
            </div>

            {/* Botões de período rápido */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={definirUltimos30Dias}
                style={{
                  padding: '8px 16px',
                  background: '#e3f2fd',
                  color: '#1976d2',
                  border: '1px solid #bbdefb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#bbdefb';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#e3f2fd';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                📅 Últimos 30 dias
              </button>
              
              <button
                onClick={definirMesAtual}
                style={{
                  padding: '8px 16px',
                  background: '#e8f5e8',
                  color: '#2e7d32',
                  border: '1px solid #c8e6c9',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#c8e6c9';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#e8f5e8';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                📅 Mês atual
              </button>
            </div>
          </div>

          {/* Linha 2: Outros Filtros */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '500',
                color: '#2c3e50',
                fontSize: '14px'
              }}>
                👤 Nome do Escrevente:
              </label>
              <select
                value={nomeEscrevente}
                onChange={e => {
                  setNomeEscrevente(e.target.value);
                  console.log('✍️ Alterado nomeEscrevente para:', e.target.value);
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e3f2fd',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s ease',
                  background: '#fff'
                }}
                onFocus={e => e.target.style.borderColor = '#2196f3'}
                onBlur={e => e.target.style.borderColor = '#e3f2fd'}
                disabled={
                  usuarioLogado &&
                  usuarioLogado.cargo &&
                  usuarioLogado.cargo !== 'Registrador' &&
                  usuarioLogado.cargo !== 'Substituto'
                }
              >
                <option value="">Selecione um escrevente</option>
                {usuarios
                  .filter(u => {
                    if (!usuarioLogado) return true;
                    if (usuarioLogado.cargo === 'Substituto') {
                      const result = u.serventia === usuarioLogado.serventia;
                      console.log(
                        `🔍 Substituto vê ${u.nome || u.email} (serventia: ${u.serventia})?`,
                        result
                      );
                      return result;
                    }
                    return true;
                  })
                  .map((u) => (
                    <option key={u.id} value={u.nome || u.email}>
                      {u.nome || u.email}
                    </option>
                  ))}
              </select>
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '500',
                color: '#2c3e50',
                fontSize: '14px'
              }}>
                📋 Código do Ato:
              </label>
              <input
                type="text"
                value={codigoAto}
                onChange={(e) => setCodigoAto(e.target.value)}
                placeholder="Digite o código do ato"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e3f2fd',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                onBlur={(e) => e.target.style.borderColor = '#e3f2fd'}
              />
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '500',
                color: '#2c3e50',
                fontSize: '14px'
              }}>
                🏛️ Tipo de Tributação:
              </label>
              <input
                type="text"
                value={tipoTributacao}
                onChange={(e) => setTipoTributacao(e.target.value)}
                placeholder="Digite o código da tributação"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e3f2fd',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                onBlur={(e) => e.target.style.borderColor = '#e3f2fd'}
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={buscarAtosPraticados}
              disabled={loading}
              style={{
                padding: '14px 28px',
                background: loading ? '#ccc' : '#2196f3',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '16px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.background = '#1976d2';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 16px rgba(33, 150, 243, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.background = '#2196f3';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.3)';
                }
              }}
            >
              {loading ? '🔄 Buscando...' : '🔍 Buscar Atos'}
            </button>
            
            <button
              onClick={limparFiltros}
              style={{
                padding: '14px 28px',
                background: '#6c757d',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '16px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(108, 117, 125, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#5a6268';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(108, 117, 125, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#6c757d';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(108, 117, 125, 0.3)';
              }}
            >
              🗑️ Limpar Filtros
            </button>
          </div>
        </div>

        {/* Mensagem de Status */}
        {mensagem && (
          <div style={{ 
            backgroundColor: totalRegistros > 0 ? '#e8f5e8' : '#fff3cd', 
            padding: '16px', 
            borderRadius: '8px', 
            border: `2px solid ${totalRegistros > 0 ? '#4caf50' : '#ffc107'}`,
            textAlign: 'center',
            marginBottom: '20px',
            fontSize: '16px',
            fontWeight: '500',
            color: totalRegistros > 0 ? '#2e7d32' : '#856404'
          }}>
            {totalRegistros > 0 ? '📊' : '⚠️'} {mensagem}
          </div>
        )}

        {/* Tabela de Resultados */}
        {atosPraticados.length > 0 && (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            padding: '30px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#2c3e50', 
              fontSize: '20px',
              fontWeight: '600'
            }}>
              📋 Resultados da Pesquisa ({totalRegistros} atos)
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: '600', color: '#495057' }}>ID</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Data</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Hora</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Código</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Tributação</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Descrição</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', borderBottom: '2px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Qtd</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', borderBottom: '2px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Valor Unit.</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', borderBottom: '2px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Pagamentos</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: '600', color: '#495057' }}>Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {atosPraticados.map((ato, index) => (
                    <tr key={ato.id} style={{ 
                      borderBottom: '1px solid #dee2e6',
                      backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa'
                    }}>
                      <td style={{ padding: '12px 8px' }}>{ato.id}</td>
                      <td style={{ padding: '12px 8px' }}>{formatarDataBR(ato.data)}</td>
                      <td style={{ padding: '12px 8px' }}>{ato.hora}</td>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold', color: '#2196f3' }}>{ato.codigo}</td>
                      <td style={{ padding: '12px 8px' }}>
                        {ato.tributacao} {ato.tributacao_descricao && `- ${ato.tributacao_descricao}`}
                      </td>
                      <td style={{ padding: '12px 8px', maxWidth: '300px', wordWrap: 'break-word' }}>{ato.descricao}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>{ato.quantidade}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold' }}>
                        {formatarValor(ato.valor_unitario)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', color: '#27ae60' }}>
                        {formatarPagamentos(ato.pagamentos, ato.detalhes_pagamentos)}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: '500' }}>{ato.usuario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}