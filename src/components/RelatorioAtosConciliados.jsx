import React, { useState, useEffect } from 'react';
import config from '../config';

function RelatorioAtosConciliados() {
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState({ inicio: '', fim: '' });
  const [formasPagamento, setFormasPagamento] = useState([]);
  const [tiposAto, setTiposAto] = useState([]);
  const [filtroFormas, setFiltroFormas] = useState([]);
  const [filtroAtos, setFiltroAtos] = useState([]);

  useEffect(() => {
    carregarRelatorios();
    // eslint-disable-next-line
  }, []);

  const carregarRelatorios = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${config.apiURL}/meus-relatorios`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setRelatorios(data.relatorios || []);
        // Coletar formas de pagamento e tipos de ato únicos
        const formas = new Set();
        const atos = new Set();
        (data.relatorios || []).forEach(rel => {
          let dados;
          try {
            dados = typeof rel.dados_relatorio === 'string' ? JSON.parse(rel.dados_relatorio) : rel.dados_relatorio;
          } catch {
            dados = {};
          }
          (dados.atos || []).forEach(ato => {
            if (ato) {
              if (ato.forma_pagamento) formas.add(ato.forma_pagamento);
              if (ato.descricao) atos.add(ato.descricao);
            }
          });
        });
        setFormasPagamento(Array.from(formas));
        setTiposAto(Array.from(atos));
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
  const filtrarAtos = (atos) => {
    return atos.filter(ato => {
      const dentroPeriodo = (!periodo.inicio || new Date(ato.data) >= new Date(periodo.inicio)) && (!periodo.fim || new Date(ato.data) <= new Date(periodo.fim));
      const formaOk = filtroFormas.length === 0 || filtroFormas.includes(ato.forma_pagamento);
      const atoOk = filtroAtos.length === 0 || filtroAtos.includes(ato.descricao);
      return dentroPeriodo && formaOk && atoOk;
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Relatório de Atos Conciliados</h2>
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <label>Período: </label>
          <input type="date" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))} />
          <span> a </span>
          <input type="date" value={periodo.fim} onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))} />
        </div>
        <div>
          <label>Forma de Pagamento: </label>
          <select multiple value={filtroFormas} onChange={e => setFiltroFormas(Array.from(e.target.selectedOptions, o => o.value))}>
            {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label>Atos: </label>
          <select multiple value={filtroAtos} onChange={e => setFiltroAtos(Array.from(e.target.selectedOptions, o => o.value))}>
            {tiposAto.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      {loading ? <div>Carregando...</div> : (
        <div>
          {relatorios.length === 0 ? <div>Nenhum relatório encontrado.</div> : (
            relatorios.map(relatorio => {
              let dados;
              try {
                dados = typeof relatorio.dados_relatorio === 'string' ? JSON.parse(relatorio.dados_relatorio) : relatorio.dados_relatorio;
              } catch {
                dados = {};
              }
              const atosFiltrados = filtrarAtos(dados.atos || []);
              if (atosFiltrados.length === 0) return null;
              return (
                <div key={relatorio.id} style={{ border: '1px solid #ccc', borderRadius: 8, marginBottom: 24, padding: 16 }}>
                  <div><strong>ID:</strong> {relatorio.id}</div>
                  <div><strong>Data de Geração:</strong> {new Date(relatorio.data_geracao).toLocaleString('pt-BR')}</div>
                  <div><strong>Serventia:</strong> {dados.serventia || relatorio.serventia}</div>
                  <div><strong>Responsável:</strong> {dados.responsavel}</div>
                  <div style={{ marginTop: 12 }}>
                    <strong>Atos Conciliados:</strong>
                    <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ background: '#f0f0f0' }}>
                          <th>Data</th>
                          <th>Descrição</th>
                          <th>Forma de Pagamento</th>
                          <th>Valor Total</th>
                          <th>Observações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atosFiltrados.map((ato, idx) => (
                          <tr key={idx}>
                            <td>{ato.data ? new Date(ato.data).toLocaleDateString('pt-BR') : '-'}</td>
                            <td>{ato.descricao}</td>
                            <td>{ato.forma_pagamento}</td>
                            <td>R$ {Number(ato.valor_total).toFixed(2)}</td>
                            <td>{ato.observacoes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default RelatorioAtosConciliados;
