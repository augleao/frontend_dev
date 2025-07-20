import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import config from '../../config';


export default function ListaServicos() {
  const [pedidos, setPedidos] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchPedidos() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${config.apiURL}/pedidos`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Resposta da API:', res);
        const data = await res.json();
        console.log('Dados recebidos:', data);
        setPedidos(data.pedidos || []);
      } catch (err) {
        console.error('Erro ao buscar pedidos:', err);
      }
    }
    fetchPedidos();
  }, []);

  useEffect(() => {
    console.log('Pedidos no estado:', pedidos);
  }, [pedidos]);

  return (
    <div style={{ /* ...estilos... */ }}>
      <div style={{ /* ...container... */ }}>
        <button
          onClick={() => navigate('/manutencao-servicos')}
          style={{
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '12px 32px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(44,62,80,0.12)'
          }}
        >
          + NOVO PEDIDO
        </button>
      </div>
      {/* Tabela de pedidos */}
      <div style={{ marginTop: 24, borderRadius: 12, background: '#f4f6f8', padding: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#e9ecef' }}>
              <th style={{ padding: 8 }}>Protocolo</th>
              <th style={{ padding: 8 }}>Tipo</th>
              <th style={{ padding: 8 }}>Cliente</th>
              <th style={{ padding: 8 }}>Prazo</th>
              <th style={{ padding: 8 }}>Criado em</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p, idx) => {
              console.log('Pedido linha:', p); // <-- log por linha
              return (
                <tr key={p.protocolo} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                  <td style={{ padding: 8 }}>{p.protocolo}</td>
                  <td style={{ padding: 8 }}>{p.tipo}</td>
                  <td style={{ padding: 8 }}>{p.cliente_nome || '-'}</td>
                  <td style={{ padding: 8 }}>{p.prazo || '-'}</td>
                  <td style={{ padding: 8 }}>{p.criado_em ? new Date(p.criado_em).toLocaleString() : '-'}</td>
                </tr>
              );
            })}
            {pedidos.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}