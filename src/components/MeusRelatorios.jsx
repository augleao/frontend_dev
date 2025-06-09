import React, { useState, useEffect } from 'react';
import config from '../config';

function MeusRelatorios() {
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarRelatorios();
    // eslint-disable-next-line
  }, []);

  const carregarRelatorios = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.apiURL}/meus-relatorios`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setRelatorios(data.relatorios);
      } else {
        alert(data.message || 'Erro ao carregar relatórios.');
      }
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      alert('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  // Função para excluir relatório
  const excluirRelatorio = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este relatório?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.apiURL}/excluir-relatorio/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setRelatorios(relatorios.filter(r => r.id !== id));
      } else {
        const data = await response.json();
        alert(data.message || 'Erro ao excluir relatório.');
      }
    } catch (error) {
      alert('Erro de conexão ao excluir relatório.');
    }
  };

  if (loading) {
    return <div>Carregando relatórios...</div>;
  }

  if (relatorios.length === 0) {
    return <div style={{ padding: '20px' }}><h2>Meus Relatórios</h2><p>Nenhum relatório encontrado.</p></div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Meus Relatórios</h2>
      {relatorios.map(relatorio => {
        let dados;
        try {
          dados = typeof relatorio.dados_relatorio === 'string'
            ? JSON.parse(relatorio.dados_relatorio)
            : relatorio.dados_relatorio;
        } catch {
          dados = {};
        }
        return (
          <div
            key={relatorio.id}
            style={{
              border: '1px solid #ccc',
              borderRadius: 8,
              marginBottom: 24,
              padding: 16,
              position: 'relative'
            }}
          >
            <button
              onClick={() => excluirRelatorio(relatorio.id)}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: '#d32f2f',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '4px 10px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
              title="Excluir relatório"
            >
              Excluir
            </button>
            <div><strong>ID:</strong> {relatorio.id}</div>
            <div><strong>Data de Geração:</strong> {new Date(relatorio.data_geracao).toLocaleString('pt-BR')}</div>
            <div><strong>Serventia:</strong> {dados.serventia || relatorio.serventia}</div>
            <div><strong>Cargo:</strong> {dados.cargo || relatorio.cargo}</div>
            <div><strong>Responsável:</strong> {dados.responsavel}</div>
            <div><strong>ISS (%):</strong> {dados.iss_percentual}</div>
            <div><strong>Valor Inicial do Caixa:</strong> R$ {Number(dados.valor_inicial_caixa).toFixed(2)}</div>
            <div><strong>Depósitos do Caixa:</strong> R$ {Number(dados.depositos_caixa).toFixed(2)}</div>
            <div><strong>Saídas do Caixa:</strong> R$ {Number(dados.saidas_caixa).toFixed(2)}</div>
            <div><strong>Valor Final do Caixa:</strong> R$ {Number(dados.valor_final_caixa).toFixed(2)}</div>
            <div style={{ marginTop: 12 }}>
              <strong>Atos:</strong>
              {dados.atos && dados.atos.length > 0 ? (
                <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: '#f0f0f0' }}>
                      <th>Qtde</th>
                      <th>Código</th>
                      <th>Descrição</th>
                      <th>Valor Total</th>
                      <th>Valor Faltante</th>
                      <th>Dinheiro</th>
                      <th>Cartão</th>
                      <th>Pix</th>
                      <th>CRC</th>
                      <th>Depósito Prévio</th>
                      <th>Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.atos.map((ato, idx) => (
                      <tr key={idx}>
                        <td>{ato.quantidade}</td>
                        <td>{ato.codigo}</td>
                        <td>{ato.descricao}</td>
                        <td>R$ {Number(ato.valor_total).toFixed(2)}</td>
                        <td>R$ {Number(ato.valor_faltante).toFixed(2)}</td>
                        <td>{ato.dinheiro_qtd} / R$ {Number(ato.dinheiro_valor).toFixed(2)}</td>
                        <td>{ato.cartao_qtd} / R$ {Number(ato.cartao_valor).toFixed(2)}</td>
                        <td>{ato.pix_qtd} / R$ {Number(ato.pix_valor).toFixed(2)}</td>
                        <td>{ato.crc_qtd} / R$ {Number(ato.crc_valor).toFixed(2)}</td>
                        <td>{ato.deposito_previo_qtd} / R$ {Number(ato.deposito_previo_valor).toFixed(2)}</td>
                        <td>{ato.observacoes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div>Nenhum ato registrado.</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MeusRelatorios;