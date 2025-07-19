import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ...pedidosMock e tiposServico...

export default function ListaServicos() {
  const [pedidos, setPedidos] = useState(pedidosMock);
  const navigate = useNavigate();

  // ...restante do código...

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