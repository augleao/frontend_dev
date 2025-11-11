

import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import config from '../config';

// Função auxiliar para buscar dados da serventia do usuário logado (padrão do sistema)
function getDadosServentia(usuario) {
  return {
    nome: usuario?.serventia_nome || usuario?.serventia || '',
    endereco: usuario?.endereco || '',
    cidade: usuario?.cidade || '',
    telefone: usuario?.telefone || '',
    cnpj: usuario?.cnpj || '',
  };
}


// Função auxiliar para pegar usuário logado (igual MeusRelatorios.jsx)
function getUsuarioLogado() {
  try {
    return JSON.parse(localStorage.getItem('usuario')) || {};
  } catch {
    return {};
  }
}



function RelatorioAtosConciliados() {
  // Função para gerar o PDF do relatório (agora dentro do componente, com acesso ao estado)
  const gerarRelatorioPDF = () => {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 40;

    // Brasão da República (pequeno, à esquerda)
    const brasaoUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Coat_of_arms_of_Brazil.svg/120px-Coat_of_arms_of_Brazil.svg.png';
    // Dados da serventia
    const dadosServentia = getDadosServentia(usuario);

    // Adiciona brasão (imagem externa, precisa ser carregada como base64)
    // Como jsPDF não suporta imagens externas diretamente, faz fetch e converte para base64
    const carregarImagem = (url) =>
      fetch(url)
        .then(r => r.blob())
        .then(blob => new Promise((resolve) => {
          const reader = new window.FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        }));

    carregarImagem(brasaoUrl).then(imgData => {
      // Brasão à esquerda
      doc.addImage(imgData, 'PNG', 30, y, 40, 40);
      // Dados da serventia ao lado
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(dadosServentia.nome, 80, y + 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text([
        dadosServentia.endereco,
        dadosServentia.cidade,
        dadosServentia.telefone ? `Telefone: ${dadosServentia.telefone}` : '',
        dadosServentia.cnpj ? `CNPJ: ${dadosServentia.cnpj}` : ''
      ].filter(Boolean), 80, y + 32);

      y += 55;
      // Linha horizontal
      doc.setLineWidth(1);
      doc.line(30, y, pageWidth - 30, y);
      y += 18;

      // Filtros utilizados
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Filtros Utilizados:', 30, y);
      doc.setFont('helvetica', 'normal');
      y += 16;
      doc.text(`Período: ${periodo.inicio || '--'} a ${periodo.fim || '--'}`, 30, y);
      y += 14;
      doc.text(`Tipo de Atos: ${filtroAtos.length > 0 ? filtroAtos.join(', ') : 'Todos'}`, 30, y);
      y += 14;
      doc.text(`Forma de Pagamento: ${filtroFormas.length > 0 ? filtroFormas.join(', ') : 'Todas'}`, 30, y);
      y += 18;

      // Totalizadores
      doc.setFont('helvetica', 'bold');
      doc.text('Totalizadores:', 30, y);
      doc.setFont('helvetica', 'normal');
      y += 16;
      doc.text(`Total em Dinheiro: R$ ${totalDinheiro.toFixed(2)}`, 30, y);
      y += 14;
      doc.text(`Total em Cartão: R$ ${totalCartao.toFixed(2)}`, 30, y);
      y += 14;
      doc.text(`Total em PIX: R$ ${totalPix.toFixed(2)}`, 30, y);
      y += 14;
      doc.text(`Total em CRC: R$ ${totalCrc.toFixed(2)}`, 30, y);
      y += 14;
      doc.text(`Total em Depósito Prévio: R$ ${totalDepositoPrevio.toFixed(2)}`, 30, y);
      y += 14;
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Geral: R$ ${totalGeral.toFixed(2)}`, 30, y);
      y += 18;

      // Linha horizontal
      doc.setLineWidth(1);
      doc.line(30, y, pageWidth - 30, y);
      y += 18;

      // Dados da tabela (atos filtrados)
      // Monta os dados igual à tabela da tela
      let dadosTabela = [];
      relatorios
        .filter(relatorio => {
          if (periodo.inicio && new Date(relatorio.data_geracao) < new Date(periodo.inicio)) return false;
          if (periodo.fim && new Date(relatorio.data_geracao) > new Date(periodo.fim)) return false;
          return true;
        })
        .forEach(relatorio => {
          let dados;
          try {
            dados = typeof relatorio.dados_relatorio === 'string' ? JSON.parse(relatorio.dados_relatorio) : relatorio.dados_relatorio;
          } catch {
            dados = {};
          }
          const atosFiltrados = filtrarAtos(dados.atos || []);
          atosFiltrados.forEach(ato => {
            dadosTabela.push([
              ato.quantidade,
              ato.codigo,
              ato.descricao,
              `R$ ${Number(ato.valor_total).toFixed(2)}`,
              `R$ ${Number(ato.valor_faltante).toFixed(2)}`,
              `${ato.dinheiro_qtd} / R$ ${Number(ato.dinheiro_valor).toFixed(2)}`,
              `${ato.cartao_qtd} / R$ ${Number(ato.cartao_valor).toFixed(2)}`,
              `${ato.pix_qtd} / R$ ${Number(ato.pix_valor).toFixed(2)}`,
              `${ato.crc_qtd} / R$ ${Number(ato.crc_valor).toFixed(2)}`,
              `${ato.deposito_previo_qtd} / R$ ${Number(ato.deposito_previo_valor).toFixed(2)}`,
              ato.observacoes || ''
            ]);
          });
        });

      // Cabeçalho da tabela
      const head = [[
        'Qtde', 'Código', 'Descrição', 'Valor Total', 'Valor Faltante',
        'Dinheiro', 'Cartão', 'Pix', 'CRC', 'Depósito Prévio', 'Observações']];

      doc.autoTable({
        head,
        body: dadosTabela,
        startY: y,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [118, 75, 162], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        margin: { left: 18, right: 18 },
        tableWidth: 'auto',
      });

      // Abrir PDF em nova guia
      window.open(doc.output('bloburl'), '_blank');
    });
  };
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState({ inicio: '', fim: '' });
  const formasPagamentoPadrao = [
    'Dinheiro',
    'Cartão',
    'PIX',
    'CRC',
    'Depósito Prévio'
  ];
  const [formasPagamento, setFormasPagamento] = useState(formasPagamentoPadrao);
  const [tiposAto, setTiposAto] = useState([]);
  const [filtroFormas, setFiltroFormas] = useState([]);
  const [filtroAtos, setFiltroAtos] = useState([]);
  const usuario = getUsuarioLogado();

  useEffect(() => {
    carregarRelatorios();
    // eslint-disable-next-line
  }, []);

  const carregarRelatorios = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${config.apiURL}/meus-relatorios`;
      // Filtrar por serventia igual MeusRelatorios.jsx
      if (usuario?.serventia) {
        url += `?serventia=${encodeURIComponent(usuario.serventia)}`;
      }
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setRelatorios(data.relatorios || []);
        // Coletar formas de pagamento e tipos de ato únicos considerando apenas relatórios do período
        const formas = new Set();
        const atos = new Set();
        (data.relatorios || [])
          .filter(rel => {
            // Filtro de período pelo campo Data de Geração
            if (periodo.inicio && new Date(rel.data_geracao) < new Date(periodo.inicio)) return false;
            if (periodo.fim && new Date(rel.data_geracao) > new Date(periodo.fim)) return false;
            return true;
          })
          .forEach(rel => {
            let dados;
            try {
              dados = typeof rel.dados_relatorio === 'string' ? JSON.parse(rel.dados_relatorio) : rel.dados_relatorio;
            } catch {
              dados = {};
            }
            (dados.atos || []).forEach(ato => {
              if (ato) {
                // Só adiciona forma se valor > 0
                if (Number(ato.dinheiro_valor || ato.dinheiro || 0) > 0) formas.add('Dinheiro');
                if (Number(ato.cartao_valor || ato.cartao || 0) > 0) formas.add('Cartão');
                if (Number(ato.pix_valor || ato.pix || 0) > 0) formas.add('PIX');
                if (Number(ato.crc_valor || ato.crc || 0) > 0) formas.add('CRC');
                if (Number(ato.deposito_previo_valor || ato.deposito_previo || 0) > 0) formas.add('Depósito Prévio');
                if (ato.descricao) atos.add(ato.descricao);
              }
            });
          });
        // Se não houver relatórios no período, mostrar todas as opções padrão
        if (formas.size === 0) {
          setFormasPagamento(formasPagamentoPadrao);
        } else {
          setFormasPagamento(Array.from(formas));
        }
        // Sempre atualizar os tipos de ato para o período filtrado
        setTiposAto(Array.from(atos));
        // Se o filtro de atos estava com opções que não existem mais, limpa o filtro
        setFiltroAtos(prev => prev.filter(a => atos.has(a)));
      } else {
        alert(data.message || 'Erro ao carregar relatórios.');
      }
    } catch (error) {
      alert('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  // Filtros
  // O filtro de período deve ser aplicado ao campo Data de Geração do relatório, não ao campo data dos atos
  // Filtro de forma de pagamento: corresponde às colunas da tabela
  const formaPagamentoCampos = {
    'Dinheiro': ['dinheiro', 'dinheiro_valor'],
    'Cartão': ['cartao', 'cartao_valor'],
    'PIX': ['pix', 'pix_valor'],
    'CRC': ['crc', 'crc_valor'],
    'Depósito Prévio': ['deposito_previo', 'deposito_previo_valor']
  };

  const filtrarAtos = (atos) => {
    return atos.filter(ato => {
      // Se não há filtro de forma, passa tudo
      let formaOk = true;
      if (filtroFormas.length > 0) {
        formaOk = filtroFormas.some(forma => {
          const campos = formaPagamentoCampos[forma];
          if (!campos) return false;
          // Considera valor > 0 em qualquer campo relacionado à forma
          return campos.some(campo => Number(ato[campo] || 0) > 0);
        });
      }
      const atoOk = filtroAtos.length === 0 || filtroAtos.includes(ato.descricao);
      return formaOk && atoOk;
    });
  };

  // Calcular somatório dos valores filtrados, respeitando filtro de forma de pagamento
  let totalDinheiro = 0, totalCartao = 0, totalPix = 0, totalCrc = 0, totalDepositoPrevio = 0;
  relatorios
    .filter(relatorio => {
      if (periodo.inicio && new Date(relatorio.data_geracao) < new Date(periodo.inicio)) return false;
      if (periodo.fim && new Date(relatorio.data_geracao) > new Date(periodo.fim)) return false;
      return true;
    })
    .forEach(relatorio => {
      let dados;
      try {
        dados = typeof relatorio.dados_relatorio === 'string' ? JSON.parse(relatorio.dados_relatorio) : relatorio.dados_relatorio;
      } catch {
        dados = {};
      }
      (dados.atos || []).forEach(ato => {
        // Aplicar filtros de forma e ato
        let formaOk = true;
        if (filtroFormas.length > 0) {
          // Considera ok se o ato tem valor > 0 em qualquer campo das formas selecionadas
          formaOk = filtroFormas.some(forma => {
            const campos = formaPagamentoCampos[forma];
            if (!campos) return false;
            return campos.some(campo => Number(ato[campo] || 0) > 0);
          });
        }
        const atoOk = filtroAtos.length === 0 || filtroAtos.includes(ato.descricao);
        if (formaOk && atoOk) {
          // Só soma as formas selecionadas (ou todas se nenhum filtro)
          if (filtroFormas.length === 0 || filtroFormas.includes('Dinheiro')) {
            totalDinheiro += Number(ato.dinheiro_valor || ato.dinheiro || 0);
          }
          if (filtroFormas.length === 0 || filtroFormas.includes('Cartão')) {
            totalCartao += Number(ato.cartao_valor || ato.cartao || 0);
          }
          if (filtroFormas.length === 0 || filtroFormas.includes('PIX')) {
            totalPix += Number(ato.pix_valor || ato.pix || 0);
          }
          if (filtroFormas.length === 0 || filtroFormas.includes('CRC')) {
            totalCrc += Number(ato.crc_valor || ato.crc || 0);
          }
          if (filtroFormas.length === 0 || filtroFormas.includes('Depósito Prévio')) {
            totalDepositoPrevio += Number(ato.deposito_previo_valor || ato.deposito_previo || 0);
          }
        }
      });
    });
  // O total geral deve ser a soma apenas das formas filtradas (ou todas se nenhum filtro)
  const totalGeral =
    (filtroFormas.length === 0 || filtroFormas.includes('Dinheiro') ? totalDinheiro : 0) +
    (filtroFormas.length === 0 || filtroFormas.includes('Cartão') ? totalCartao : 0) +
    (filtroFormas.length === 0 || filtroFormas.includes('PIX') ? totalPix : 0) +
    (filtroFormas.length === 0 || filtroFormas.includes('CRC') ? totalCrc : 0) +
    (filtroFormas.length === 0 || filtroFormas.includes('Depósito Prévio') ? totalDepositoPrevio : 0);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '12px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Header */}
        <div style={{
          background: '#d1d5e6',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '10px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.07)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <h1 style={{
            margin: 0,
            color: '#2c3e50',
            fontSize: '26px',
            fontWeight: '600'
          }}>
            🤝 Relatório de Atos Conciliados
          </h1>
        </div>

        {/* Filtros + Somatório */}
        <div style={{
          background: '#d1d5e6',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '10px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr 1fr',
          gap: '24px',
          alignItems: 'flex-start',
        }}>
          {/* Coluna 1: Filtro de datas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 600, color: '#2c3e50', marginRight: 8 }}>Período:</label>
              <input type="date" value={periodo.inicio} onChange={e => { setPeriodo(p => { const novo = { ...p, inicio: e.target.value }; setTimeout(carregarRelatorios, 0); return novo; }); }} style={{ padding: '6px', borderRadius: 6, border: '1px solid #764ba2', fontWeight: 500 }} />
              <span style={{ margin: '0 8px', color: '#888' }}>a</span>
              <input type="date" value={periodo.fim} onChange={e => { setPeriodo(p => { const novo = { ...p, fim: e.target.value }; setTimeout(carregarRelatorios, 0); return novo; }); }} style={{ padding: '6px', borderRadius: 6, border: '1px solid #764ba2', fontWeight: 500 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {[ 
                { label: 'Hoje', fn: () => {
                  const hoje = new Date();
                  const d = hoje.toISOString().slice(0,10);
                  setPeriodo({ inicio: d, fim: d });
                  setTimeout(carregarRelatorios, 0);
                }},
                { label: 'Ontem', fn: () => {
                  const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
                  const d = ontem.toISOString().slice(0,10);
                  setPeriodo({ inicio: d, fim: d });
                  setTimeout(carregarRelatorios, 0);
                }},
                { label: 'Esta Semana', fn: () => {
                  const hoje = new Date();
                  const diaSemana = hoje.getDay() === 0 ? 7 : hoje.getDay();
                  const inicio = new Date(hoje); inicio.setDate(hoje.getDate() - (diaSemana - 1));
                  const fim = new Date(hoje); fim.setDate(inicio.getDate() + 6);
                  setPeriodo({
                    inicio: inicio.toISOString().slice(0,10),
                    fim: fim.toISOString().slice(0,10)
                  });
                  setTimeout(carregarRelatorios, 0);
                }},
                { label: 'Semana Passada', fn: () => {
                  const hoje = new Date();
                  const diaSemana = hoje.getDay() === 0 ? 7 : hoje.getDay();
                  const fim = new Date(hoje); fim.setDate(hoje.getDate() - diaSemana);
                  const inicio = new Date(fim); inicio.setDate(fim.getDate() - 6);
                  setPeriodo({
                    inicio: inicio.toISOString().slice(0,10),
                    fim: fim.toISOString().slice(0,10)
                  });
                  setTimeout(carregarRelatorios, 0);
                }},
                { label: 'Este Mês', fn: () => {
                  const hoje = new Date();
                  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
                  setPeriodo({
                    inicio: inicio.toISOString().slice(0,10),
                    fim: fim.toISOString().slice(0,10)
                  });
                  setTimeout(carregarRelatorios, 0);
                }},
                { label: 'Mês Passado', fn: () => {
                  const hoje = new Date();
                  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                  setPeriodo({
                    inicio: inicio.toISOString().slice(0,10),
                    fim: fim.toISOString().slice(0,10)
                  });
                  setTimeout(carregarRelatorios, 0);
                }},
              ].map(({ label, fn }) => (
                <button
                  key={label}
                  onClick={fn}
                  style={{
                    padding: '4px 12px',
                    background: '#f3f4f6',
                    color: '#4f46e5',
                    border: '1px solid #c7d2fe',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Coluna 2: Filtros de forma de pagamento e atos, um em cima do outro */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontWeight: 600, color: '#2c3e50', marginBottom: 2 }}>Forma de Pagamento:</label>
              <select multiple value={filtroFormas} onChange={e => setFiltroFormas(Array.from(e.target.selectedOptions, o => o.value))} style={{ minWidth: 160, padding: 6, borderRadius: 6, border: '1px solid #764ba2', fontWeight: 500 }}>
                {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontWeight: 600, color: '#2c3e50', marginBottom: 2 }}>Atos:</label>
              <select multiple value={filtroAtos} onChange={e => setFiltroAtos(Array.from(e.target.selectedOptions, o => o.value))} style={{ minWidth: 160, padding: 6, borderRadius: 6, border: '1px solid #764ba2', fontWeight: 500 }}>
                {tiposAto.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {/* Espaço para alinhar o botão abaixo dos filtros */}
            <div style={{ height: 8, display: 'flex', gap: 10, width: '100%' }}>
              <button
                onClick={() => {
                  setPeriodo({ inicio: '', fim: '' });
                  setFiltroFormas([]);
                  setFiltroAtos([]);
                }}
                style={{
                  padding: '10px 22px',
                  background: '#f87171', // vermelho claro
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.10)',
                  alignSelf: 'stretch',
                  marginTop: 12,
                  transition: 'background 0.2s',
                  letterSpacing: 0.5,
                  flex: 1
                }}
                title="Limpar todos os filtros"
              >
                Limpar Filtros
              </button>
              <button
                onClick={gerarRelatorioPDF}
                style={{
                  padding: '10px 22px',
                  background: '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(76, 81, 255, 0.10)',
                  alignSelf: 'stretch',
                  marginTop: 12,
                  transition: 'background 0.2s',
                  letterSpacing: 0.5,
                  flex: 1
                }}
                title="Gerar relatório PDF com os dados filtrados"
              >
                Gerar Relatório PDF
              </button>
            </div>
          </div>
          {/* Coluna 3: Somatório */}
          <div style={{
            width: '100%',
            minWidth: 300,
            background: '#f8f8ff',
            border: '1px solid #c7d2fe',
            borderRadius: 10,
            padding: '14px 12px',
            boxSizing: 'border-box',
            boxShadow: '0 2px 8px rgba(76, 81, 255, 0.06)',
            fontWeight: 600,
            color: '#2c3e50',
            fontSize: 15,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{ fontWeight: 700, color: '#4f46e5', fontSize: 16, marginBottom: 4 }}>Somatório dos Valores</div>
            <div>Total em Dinheiro: <span style={{ color: '#2c3e50' }}>R$ {totalDinheiro.toFixed(2)}</span></div>
            <div>Total em Cartão: <span style={{ color: '#2c3e50' }}>R$ {totalCartao.toFixed(2)}</span></div>
            <div>Total em PIX: <span style={{ color: '#2c3e50' }}>R$ {totalPix.toFixed(2)}</span></div>
            <div>Total em CRC: <span style={{ color: '#2c3e50' }}>R$ {totalCrc.toFixed(2)}</span></div>
            <div>Total em Depósito Prévio: <span style={{ color: '#2c3e50' }}>R$ {totalDepositoPrevio.toFixed(2)}</span></div>
            <div style={{ borderTop: '1px solid #c7d2fe', marginTop: 6, paddingTop: 6, fontWeight: 700, color: '#1e293b' }}>
              Total Geral: <span style={{ color: '#1e293b' }}>R$ {totalGeral.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '12px',
          marginBottom: '10px'
        }}>
          {loading ? (
            <div style={{ color: '#764ba2', fontWeight: 600, fontSize: 18, textAlign: 'center', padding: 32 }}>Carregando...</div>
          ) : relatorios.length === 0 ? (
            <div style={{ color: '#888', fontWeight: 500, fontSize: 18, textAlign: 'center', padding: 32 }}>Nenhum relatório encontrado.</div>
          ) : (
            relatorios
              .filter(relatorio => {
                // Filtro de período pelo campo Data de Geração
                if (periodo.inicio && new Date(relatorio.data_geracao) < new Date(periodo.inicio)) return false;
                if (periodo.fim && new Date(relatorio.data_geracao) > new Date(periodo.fim)) return false;
                return true;
              })
              .map(relatorio => {
              let dados;
              try {
                dados = typeof relatorio.dados_relatorio === 'string' ? JSON.parse(relatorio.dados_relatorio) : relatorio.dados_relatorio;
              } catch {
                dados = {};
              }
              const atosFiltrados = filtrarAtos(dados.atos || []);
              if (atosFiltrados.length === 0) return null;
              // Calcular totais por forma de pagamento
              let totalDinheiro = 0;
              let totalCartao = 0;
              let totalPix = 0;
              let totalCrc = 0;
              let totalDepositoPrevio = 0;
              atosFiltrados.forEach(ato => {
                totalDinheiro += Number(ato.dinheiro_valor || ato.dinheiro || 0);
                totalCartao += Number(ato.cartao_valor || ato.cartao || 0);
                totalPix += Number(ato.pix_valor || ato.pix || 0);
                totalCrc += Number(ato.crc_valor || ato.crc || 0);
                totalDepositoPrevio += Number(ato.deposito_previo_valor || ato.deposito_previo || 0);
              });
              return (
                <div key={relatorio.id} style={{
                  background: '#d1d5e6',
                  border: '1.5px solid #764ba2',
                  borderRadius: 12,
                  boxShadow: '0 2px 10px rgba(76, 81, 255, 0.06)',
                  padding: 16,
                  marginBottom: 0
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 12 }}>
                    <div><strong>ID:</strong> {relatorio.id}</div>
                    <div><strong>Data de Geração:</strong> {new Date(relatorio.data_geracao).toLocaleString('pt-BR')}</div>
                    <div><strong>Responsável:</strong> {dados.responsavel}</div>
                    <div><strong>Total em Dinheiro:</strong> R$ {totalDinheiro.toFixed(2)}</div>
                    <div><strong>Total em Cartão:</strong> R$ {totalCartao.toFixed(2)}</div>
                    <div><strong>Total em PIX:</strong> R$ {totalPix.toFixed(2)}</div>
                    <div><strong>Total em CRC:</strong> R$ {totalCrc.toFixed(2)}</div>
                    <div><strong>Total em Depósito Prévio:</strong> R$ {totalDepositoPrevio.toFixed(2)}</div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <strong style={{ color: '#764ba2' }}>Atos Conciliados:</strong>
                    <div style={{ overflowX: 'auto', marginTop: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, background: 'white' }}>
                        <thead>
                          <tr style={{ background: '#f0f0f0' }}>
                            <th style={{ padding: 8, borderBottom: '2px solid #764ba2' }}>Qtde</th>
                            <th style={{ padding: 8, borderBottom: '2px solid #764ba2' }}>Código</th>
                            <th style={{ padding: 8, borderBottom: '2px solid #764ba2' }}>Descrição</th>
                            <th style={{ padding: 8, borderBottom: '2px solid #764ba2' }}>Valor Total</th>
                            <th style={{ padding: 8, borderBottom: '2px solid #764ba2' }}>Valor Faltante</th>
                            <th style={{ padding: 8, borderBottom: '2px solid #764ba2' }}>Dinheiro</th>
                            <th style={{ padding: 8, borderBottom: '2px solid #764ba2' }}>Cartão</th>
                            <th style={{ padding: 8, borderBottom: '2px solid #764ba2' }}>Pix</th>
                            <th style={{ padding: 8, borderBottom: '2px solid #764ba2' }}>CRC</th>
                            <th style={{ padding: 8, borderBottom: '2px solid #764ba2' }}>Depósito Prévio</th>
                            <th style={{ padding: 8, borderBottom: '2px solid #764ba2' }}>Observações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {atosFiltrados.map((ato, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: 8 }}>{ato.quantidade}</td>
                              <td style={{ padding: 8 }}>{ato.codigo}</td>
                              <td style={{ padding: 8 }}>{ato.descricao}</td>
                              <td style={{ padding: 8 }}>R$ {Number(ato.valor_total).toFixed(2)}</td>
                              <td style={{ padding: 8 }}>R$ {Number(ato.valor_faltante).toFixed(2)}</td>
                              <td style={{ padding: 8 }}>{ato.dinheiro_qtd} / R$ {Number(ato.dinheiro_valor).toFixed(2)}</td>
                              <td style={{ padding: 8 }}>{ato.cartao_qtd} / R$ {Number(ato.cartao_valor).toFixed(2)}</td>
                              <td style={{ padding: 8 }}>{ato.pix_qtd} / R$ {Number(ato.pix_valor).toFixed(2)}</td>
                              <td style={{ padding: 8 }}>{ato.crc_qtd} / R$ {Number(ato.crc_valor).toFixed(2)}</td>
                              <td style={{ padding: 8 }}>{ato.deposito_previo_qtd} / R$ {Number(ato.deposito_previo_valor).toFixed(2)}</td>
                              <td style={{ padding: 8 }}>{ato.observacoes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default RelatorioAtosConciliados;
