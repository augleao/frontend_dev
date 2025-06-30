import React, { useEffect, useState } from 'react';
import { apiURL } from './config';

function MeusFechamentos() {
  const [fechamentos, setFechamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const nomeUsuario = usuario?.nome || '';

  useEffect(() => {
    async function fetchFechamentos() {
      setLoading(true);
      setErro('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${apiURL}/meus-fechamentos`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setFechamentos(data.fechamentos || []);
      } catch (e) {
        setErro(e.message);
      }
      setLoading(false);
    }
    fetchFechamentos();
  }, [nomeUsuario]);

  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      padding: 24,
      margin: '32px auto',
      maxWidth: 900,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
    }}>
      <h2 style={{ marginBottom: 18, color: '#2c3e50' }}>🗂️ Meus Fechamentos de Caixa</h2>
      {loading && <div>Carregando...</div>}
      {erro && <div style={{ color: 'red' }}>{erro}</div>}
      {!loading && fechamentos.length === 0 && <div>Nenhum fechamento encontrado.</div>}
      {!loading && fechamentos.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={{ padding: 8, borderBottom: '1px solid #ddd' }}>Data</th>
              <th style={{ padding: 8, borderBottom: '1px solid #ddd' }}>Hora</th>
              <th style={{ padding: 8, borderBottom: '1px solid #ddd' }}>Valor Inicial</th>
              <th style={{ padding: 8, borderBottom: '1px solid #ddd' }}>Valor Final</th>
              <th style={{ padding: 8, borderBottom: '1px solid #ddd' }}>Descrição</th>
            </tr>
          </thead>
          <tbody>
            {fechamentos.map((f, idx) => (
              <tr key={f.data + f.hora + f.codigo + idx}>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  {f.data ? new Date(f.data).toLocaleDateString('pt-BR') : ''}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{f.hora || ''}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  {f.valor_inicial
                    ? Number(f.valor_inicial).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : '-'}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                  {Number(f.total_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{f.descricao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default MeusFechamentos;