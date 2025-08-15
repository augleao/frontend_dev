import React, { useState } from 'react';

export default function ConfigurarServentia({ onClose }) {
  const [caixaUnificado, setCaixaUnificado] = useState(false);

  return (
    <div style={{ padding: 32, maxWidth: 500 }}>
      <h2 style={{ marginBottom: 24 }}>Configurar Serventia</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <label style={{ fontWeight: 600, fontSize: 16 }}>
          Caixa Unificado?
        </label>
        <span
          style={{
            background: '#eee',
            borderRadius: '50%',
            width: 22,
            height: 22,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            cursor: 'pointer',
            marginLeft: 4
          }}
          title="Caso esta opção esteja marcada, todos os lançamentos feitos pelos escreventes serão lançados em um único caixa. Caso esteja desmarcado, cada escrevente terá seu próprio caixa."
        >
          ?
        </span>
        <input
          type="checkbox"
          checked={caixaUnificado}
          onChange={e => setCaixaUnificado(e.target.checked)}
          style={{ marginLeft: 12, width: 20, height: 20 }}
        />
      </div>
      <button
        onClick={onClose}
        style={{
          padding: '8px 24px',
          background: '#888',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontWeight: 600,
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        Fechar
      </button>
    </div>
  );
}
