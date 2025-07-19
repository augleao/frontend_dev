import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const pedidosMock = [
  {
    id: 1,
    protocolo: 'PRT-123456',
    cliente: 'João Silva',
    tipo: 'Certidão de Nascimento',
    status: 'Em andamento',
    prazo: '2025-07-20',
    valor: 120.0
  },
  {
    id: 2,
    protocolo: 'PRT-654321',
    cliente: 'Maria Souza',
    tipo: 'Reconhecimento de Firma',
    status: 'Concluído',
    prazo: '2025-07-18',
    valor: 80.0
  }
];

export default function ListaServicos() {
  const [pedidos, setPedidos] = useState(pedidosMock);
  const navigate = useNavigate();

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
      {/* ...restante da tabela... */}
    </div>
  );
}