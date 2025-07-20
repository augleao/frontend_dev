import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import config from '../../config';


function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  // Se vier sem separadores, tenta formatar manualmente
  if (/^\d{8,}/.test(dateStr)) {
    // Exemplo: 20250720220810
    const ano = dateStr.slice(0, 4);
    const mes = dateStr.slice(4, 6);
    const dia = dateStr.slice(6, 8);
    const hora = dateStr.slice(8, 10) || '00';
    const min = dateStr.slice(10, 12) || '00';
    const seg = dateStr.slice(12, 14) || '00';
    return `${dia}/${mes}/${ano} às ${hora}:${min}:${seg}`;
  }
  // Padrão ISO
  const d = new Date(dateStr);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const seg = String(d.getSeconds()).padStart(2, '0');
  return `${dia}/${mes}/${ano} às ${hora}:${min}:${seg}`;
}

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
        const data = await res.json();
        console.log('Dados recebidos:', data.pedidos);
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
              <th style={{ padding: 8 }}>Criado em</th>
              <th style={{ padding: 8 }}>Protocolo</th>
              <th style={{ padding: 8 }}>Cliente</th>
              <th style={{ padding: 8 }}>Prazo</th>
              <th style={{ padding: 8 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p, idx) => {
              console.log('Pedido linha:', p); // <-- log por linha
              return (
                <tr key={p.protocolo} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                  <td style={{ padding: 8 }}>{formatDateTime(p.criado_em)}</td>
                  <td style={{ padding: 8 }}>{p.protocolo}</td>
                  <td style={{ padding: 8 }}>{p.cliente?.nome || '-'}</td>
                  <td style={{ padding: 8 }}>{formatDate(p.prazo)}</td>
                  <td style={{ padding: 8 }}>
                    <button
                      style={{
                        background: '#3498db',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 16px',
                        fontWeight: 'bold',
                        fontSize: 14,
                        cursor: 'pointer'
                      }}
                      onClick={() => navigate(`/manutencao-servicos?protocolo=${encodeURIComponent(p.protocolo)}`)}
                    >
                      EDITAR
                    </button>
                  </td>
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