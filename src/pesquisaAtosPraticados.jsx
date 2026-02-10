import React, { useState, useEffect } from 'react';
import { apiURL } from './config';
import { formasPagamento, formatarMoeda } from './utils';

export default function PesquisaAtosPraticados() {
  // Estados para os filtros de busca
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [nomeEscrevente, setNomeEscrevente] = useState('');
  const [codigoAto, setCodigoAto] = useState('');
  const [tipoTributacao, setTipoTributacao] = useState('');
  const [formaPagamentoFiltro, setFormaPagamentoFiltro] = useState('');
  
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
      (usuarioLogado.cargo === 'Substituto' || usuarioLogado.cargo === 'Registrador') &&
      usuarios.length > 0
    ) {
      const escreventeValido = usuarios.find(
        (u) =>
          (u.nome || u.email) === nomeEscrevente &&
          u.serventia === usuarioLogado.serventia
      );
      console.log('🔎 escreventeValido (mesma serventia do responsável):', escreventeValido);
      if (!escreventeValido) {
        setNomeEscrevente('');
        console.log('🧹 Limpando nomeEscrevente pois não pertence à mesma serventia do responsável');
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
      if (formaPagamentoFiltro) params.append('formaPagamento', formaPagamentoFiltro);
      
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

        // Se backend não suportou o filtro por forma, aplicamos client-side
        if (formaPagamentoFiltro) {
          const fk = String(formaPagamentoFiltro).toLowerCase();
          atos = atos.filter(ato => atoContemForma(ato, fk));
          total = atos.length;
        }

        // Aplicar filtro de tributação 'Pago' ou 'Gratuito' client-side quando necessário
        if (tipoTributacao === 'Pago') {
          // Backend pode já ter retornado apenas os '01' se suportou o param; garantir
          atos = atos.filter(ato => String(ato.tributacao) === '01');
          total = atos.length;
        } else if (tipoTributacao === 'Gratuito') {
          atos = atos.filter(ato => String(ato.tributacao) !== '01');
          total = atos.length;
        }

        // Se for Substituto e nenhum escrevente foi selecionado, filtra só os atos da sua serventia
        if (
          usuarioLogado &&
          (usuarioLogado.cargo === 'Substituto' || usuarioLogado.cargo === 'Registrador') &&
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
    setFormaPagamentoFiltro('');
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

  // Função para definir período de hoje
  const definirHoje = () => {
    const hoje = new Date();
    const dataStr = hoje.toISOString().split('T')[0];
    setDataInicial(dataStr);
    setDataFinal(dataStr);
  };

  // Funções de formatação
  const formatarDataBR = (data) => {
    if (!data) return '';
    // Trata datas no formato ISO (ex: 2025-07-13T00:00:00.000Z)
    const soData = data.split('T')[0];
    const [ano, mes, dia] = soData.split('-');
    return `${dia}-${mes}-${ano}`;
  };

  const formatarValor = (valor) => {
    if (!valor || parseFloat(valor) === 0) return 'ISENTO';
    return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
  };

  const escolherFormaLabel = (formaKeyOrName) => {
    if (!formaKeyOrName) return null;
    const key = String(formaKeyOrName).toLowerCase();
    const found = formasPagamento.find(fp => fp.key === key || fp.label.toLowerCase() === key);
    if (found) return found.label.toUpperCase();
    return String(formaKeyOrName).toUpperCase();
  };

  const parseDetalhesPossiveis = (det) => {
    if (!det) return null;
    if (typeof det === 'string') {
      try { return JSON.parse(det); } catch { return det; }
    }
    return det;
  };

  const atoContemForma = (ato, formaKey) => {
    if (!formaKey) return true;
    const fk = String(formaKey).toLowerCase();
    const detalhes = parseDetalhesPossiveis(ato.detalhes_pagamentos);
    const detectarFormaEmDetalhes = (det) => {
      if (!det) return false;
      if (typeof det === 'string') {
        try { return detectarFormaEmDetalhes(JSON.parse(det)); } catch { return det.toLowerCase().includes(fk); }
      }
      if (Array.isArray(det)) {
        return det.some(d => {
          const f = String(d?.forma || d?.forma_pagamento || d?.tipo || (d?.formas_utilizadas && d.formas_utilizadas[0]) || '').toLowerCase();
          if (f && f.includes(fk)) return true;
          return false;
        });
      }
      if (typeof det === 'object') {
        if (Array.isArray(det.formas_utilizadas) && det.formas_utilizadas.length > 0) {
          return det.formas_utilizadas.some(f => String(f).toLowerCase() === fk);
        }
        if (det.forma && String(det.forma).toLowerCase() === fk) return true;
        // chaves como dinheiro/cartao/pix
        if (det[fk] !== undefined) {
          const v = det[fk];
          const num = Number((typeof v === 'object' ? v.valor : v) ?? 0) || 0;
          return num > 0;
        }
        return Object.keys(det).some(k => String(k).toLowerCase() === fk);
      }
      return false;
    };

    if (detectarFormaEmDetalhes(detalhes)) return true;

    const pagamentos = ato.pagamentos;
    if (!pagamentos) return false;
    if (Array.isArray(pagamentos)) {
      return pagamentos.some(p => String(p?.forma || p?.forma_pagamento || p?.tipo || '').toLowerCase().includes(fk));
    }
    // objeto por formas
    if (pagamentos[fk] !== undefined) {
      const entry = pagamentos[fk];
      const num = Number(entry?.valor ?? entry ?? 0) || 0;
      return num > 0;
    }
    return Object.values(pagamentos).some(v => {
      if (!v) return false;
      if (typeof v === 'object') return String(v.forma || v.forma_pagamento || v.tipo || '').toLowerCase().includes(fk);
      return false;
    });
  };

  const formatarPagamentos = (pagamentos, detalhes_pagamentos) => {
    const detalhes = parseDetalhesPossiveis(detalhes_pagamentos);

    // Se não houver pagamentos nem detalhes
    if ((!pagamentos || Object.keys(pagamentos).length === 0) && !detalhes) return 'ISENTO';

    // Priorizar detalhes_pagamentos quando disponíveis
    if (detalhes) {
      // Caso comum: objeto com valor_total e formas_utilizadas
      if (typeof detalhes === 'object' && (detalhes.valor_total || detalhes.valor || detalhes.amount)) {
        const valor = Number(detalhes.valor_total ?? detalhes.valor ?? detalhes.amount ?? 0) || 0;
        let forma = null;
        if (Array.isArray(detalhes.formas_utilizadas) && detalhes.formas_utilizadas.length > 0) {
          forma = detalhes.formas_utilizadas[0];
        } else if (detalhes.forma) {
          forma = detalhes.forma;
        } else {
          // procurar primeira chave com valor
          for (const k of Object.keys(detalhes)) {
            const v = detalhes[k];
            const num = Number((typeof v === 'object' ? v.valor : v) ?? 0) || 0;
            if (num > 0) { forma = k; break; }
          }
        }
        const formaLabel = escolherFormaLabel(forma);
        return `Valor: ${formatarMoeda(valor)}${formaLabel ? ' - ' + formaLabel : ''}`;
      }

      // Se for array de pagamentos importados -> pegar primeiro
      if (Array.isArray(detalhes) && detalhes.length > 0) {
        const first = detalhes.find(d => d && (d.valor || d.valor_pago || d.amount || d.valor_total)) || detalhes[0];
        const valor = Number(first.valor ?? first.valor_pago ?? first.amount ?? first.valor_total ?? 0) || 0;
        const formaLabel = escolherFormaLabel(first.forma || first.forma_pagamento || first.tipo || null);
        return `Valor: ${formatarMoeda(valor)}${formaLabel ? ' - ' + formaLabel : ''}`;
      }
    }

    // Fallback para `pagamentos` (objeto por formas ou array)
    if (pagamentos) {
      if (Array.isArray(pagamentos) && pagamentos.length > 0) {
        const p = pagamentos[0];
        const valor = Number(p.valor ?? p.valor_pago ?? p.amount ?? 0) || 0;
        const formaLabel = escolherFormaLabel(p.forma || p.forma_pagamento || p.tipo || null);
        return `Valor: ${formatarMoeda(valor)}${formaLabel ? ' - ' + formaLabel : ''}`;
      }

      if (typeof pagamentos === 'object') {
        for (const fp of formasPagamento) {
          const entry = pagamentos[fp.key];
          const num = Number(entry?.valor ?? entry ?? 0) || 0;
          if (num > 0) return `Valor: ${formatarMoeda(num)} - ${fp.label.toUpperCase()}`;
        }

        // Somar tudo como fallback
        const total = Object.values(pagamentos).reduce((acc, pagamento) => acc + (parseFloat(pagamento?.valor ?? pagamento) || 0), 0);
        if (total > 0) return `Valor: ${formatarMoeda(total)}`;
      }
    }

    return 'ISENTO';
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
          padding: '12px',
          marginBottom: '10px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}>
          <h1 style={{ 
            margin: 0, 
            color: '#2c3e50',
            fontSize: '22px',
            fontWeight: '600',
            textAlign: 'center'
          }}>
            🔍 Pesquisa de Atos Praticados
          </h1>
          <p style={{
            textAlign: 'center',
            color: '#666',
            margin: '4px 0 0 0',
            fontSize: '13px'
          }}>
            Consulte atos praticados por período, escrevente, código e tributação
          </p>
        </div>

        {/* Container de Filtros */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '14px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            color: '#2c3e50', 
            fontSize: '20px',
            fontWeight: '600'
          }}>
            📋 Filtros de Busca
          </h3
          >
          
          {/* Linha 1: Período de Datas */}
          <div style={{ marginBottom: '10px' }}>
            <h4 style={{ 
              margin: '0 0 8px 0', 
              color: '#34495e', 
              fontSize: '16px',
              fontWeight: '600'
            }}>
              📅 Período de Datas
            </h4>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '200px', flex: 1 }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '4px', 
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
                    padding: '8px',
                    borderRadius: '6px',
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
                  marginBottom: '4px', 
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
                    padding: '8px',
                    borderRadius: '6px',
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
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-gradient btn-gradient-blue btn-compact"
                onClick={definirUltimos30Dias}
              >
                📅 Últimos 30 dias
              </button>
              <button
                type="button"
                className="btn-gradient btn-gradient-green btn-compact"
                onClick={definirHoje}
              >
                📅 Hoje
              </button>
              
              <button
                type="button"
                className="btn-gradient btn-gradient-orange btn-compact"
                onClick={definirMesAtual}
              >
                📅 Mês atual
              </button>
            </div>
          </div>

          {/* Linha 2: Outros Filtros */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '4px', 
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
                  padding: '8px',
                  borderRadius: '6px',
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
                    if (usuarioLogado.cargo === 'Substituto' || usuarioLogado.cargo === 'Registrador') {
                      const mesmoCartorio = u.serventia === usuarioLogado.serventia;
                      console.log(
                        `🔍 ${usuarioLogado.cargo} vê ${u.nome || u.email} (serventia: ${u.serventia})?`,
                        mesmoCartorio
                      );
                      return mesmoCartorio;
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
                marginBottom: '4px', 
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
                  padding: '8px',
                  borderRadius: '6px',
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
                marginBottom: '4px', 
                fontWeight: '500',
                color: '#2c3e50',
                fontSize: '14px'
              }}>
                🏛️ Tipo de Tributação:
              </label>
              <select
                value={tipoTributacao}
                onChange={(e) => setTipoTributacao(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '2px solid #e3f2fd',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s ease',
                  background: '#fff'
                }}
                onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                onBlur={(e) => e.target.style.borderColor = '#e3f2fd'}
              >
                <option value="">Todos</option>
                <option value="Pago">Pago (tributação 01)</option>
                <option value="Gratuito">Gratuito (outras tributações)</option>
              </select>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '4px', 
                fontWeight: '500',
                color: '#2c3e50',
                fontSize: '14px'
              }}>
                💳 Forma de Pagamento:
              </label>
              <select
                value={formaPagamentoFiltro}
                onChange={e => setFormaPagamentoFiltro(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '2px solid #e3f2fd',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s ease',
                  background: '#fff'
                }}
                onFocus={e => e.target.style.borderColor = '#2196f3'}
                onBlur={e => e.target.style.borderColor = '#e3f2fd'}
              >
                <option value="">Todas as formas</option>
                {formasPagamento.map(fp => (
                  <option key={fp.key} value={fp.key}>{fp.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn-gradient btn-gradient-blue${loading ? ' btn-muted' : ''}`}
              style={{ minWidth: 160 }}
              onClick={buscarAtosPraticados}
              disabled={loading}
            >
              {loading ? '🔄 Buscando...' : '🔍 Buscar Atos'}
            </button>
            
            <button
              type="button"
              className="btn-gradient btn-gradient-orange"
              style={{ minWidth: 160 }}
              onClick={limparFiltros}
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

        {/* Tabela de Resumo Agrupado */}
        {atosPraticados.length > 0 && (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            padding: '30px',
            marginBottom: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#2c3e50', 
              fontSize: '20px',
              fontWeight: '600'
            }}>
              📊 Resumo de Atos Agrupados
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#e3f2fd' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #2196f3', fontWeight: '600', color: '#1976d2' }}>Código</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #2196f3', fontWeight: '600', color: '#1976d2' }}>Descrição</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', borderBottom: '2px solid #2196f3', fontWeight: '600', color: '#1976d2' }}>Quantidade Total</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', borderBottom: '2px solid #2196f3', fontWeight: '600', color: '#1976d2' }}>Valor Total</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', borderBottom: '2px solid #2196f3', fontWeight: '600', color: '#1976d2' }}>Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Agrupar atos por código
                    const atosAgrupados = {};
                    
                    atosPraticados.forEach(ato => {
                      const codigo = ato.codigo;
                      
                      if (!atosAgrupados[codigo]) {
                        atosAgrupados[codigo] = {
                          codigo: codigo,
                          descricao: ato.descricao,
                          quantidadeTotal: 0,
                          valorTotal: 0,
                          registros: 0
                        };
                      }
                      
                      atosAgrupados[codigo].quantidadeTotal += parseInt(ato.quantidade) || 0;
                      atosAgrupados[codigo].registros += 1;
                      
                      // Calcular valor total dos pagamentos
                      let valorPagamento = 0;
                      if (ato.detalhes_pagamentos && ato.detalhes_pagamentos.valor_total) {
                        valorPagamento = parseFloat(ato.detalhes_pagamentos.valor_total) || 0;
                      } else if (ato.pagamentos && Object.keys(ato.pagamentos).length > 0) {
                        valorPagamento = Object.values(ato.pagamentos).reduce((acc, pagamento) => {
                          return acc + (parseFloat(pagamento.valor) || 0);
                        }, 0);
                      }
                      
                      atosAgrupados[codigo].valorTotal += valorPagamento;
                    });
                    
                    // Converter para array e ordenar por código
                    return Object.values(atosAgrupados)
                      .sort((a, b) => a.codigo.localeCompare(b.codigo))
                      .map((grupo, index) => (
                        <tr key={grupo.codigo} style={{ 
                          borderBottom: '1px solid #bbdefb',
                          backgroundColor: index % 2 === 0 ? '#fff' : '#f8fafe'
                        }}>
                          <td style={{ padding: '12px 8px', fontWeight: 'bold', color: '#1976d2' }}>{grupo.codigo}</td>
                          <td style={{ padding: '12px 8px', maxWidth: '300px', wordWrap: 'break-word' }}>{grupo.descricao}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', color: '#2e7d32' }}>{grupo.quantidadeTotal}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', color: '#1976d2' }}>
                            {grupo.valorTotal > 0 
                              ? `R$ ${grupo.valorTotal.toFixed(2).replace('.', ',')}`
                              : 'ISENTO'
                            }
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', color: '#666' }}>{grupo.registros}</td>
                        </tr>
                      ));
                  })()}
                </tbody>
              </table>
            </div>
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