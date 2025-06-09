import React, { useState, useEffect } from 'react';
import config from '../config';

function MeusRelatorios() {
  console.log("Componente MeusRelatorios foi renderizado!");
  const [relatorios, setRelatorios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarRelatorios();
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

  if (loading) {
    return <div>Carregando relatórios...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Meus Relatórios</h2>
      
      {relatorios.length === 0 ? (
        <p>Nenhum relatório encontrado.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>ID</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Data/Hora</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Serventia</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Cargo</th>
              <th style={{ padding: '10px', border: '1px solid #ddd' }}>Atos</th>
            </tr>
          </thead>
          <tbody>
            {relatorios.map(relatorio => (
              <tr key={relatorio.id}>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{relatorio.id}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                  {new Date(relatorio.data_geracao).toLocaleString('pt-BR')}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{relatorio.serventia}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{relatorio.cargo}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                  {(() => {
  try {
    const dados = typeof relatorio.dados_relatorio === 'string'
      ? JSON.parse(relatorio.dados_relatorio)
      : relatorio.dados_relatorio;
    return (dados.atos?.length || 0) + ' atos';
  } catch {
    return '-';
  }
})()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default MeusRelatorios;