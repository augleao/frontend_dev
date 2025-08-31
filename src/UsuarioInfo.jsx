// UsuarioInfo.jsx
import React, { useState } from 'react';


function UsuarioInfo({ nomeUsuario, usuarioId, statusInicial }) {
  const [status, setStatus] = useState(statusInicial); // 'ativo' ou 'inativo'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleToggleStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const novoStatus = status === 'ativo' ? 'inativo' : 'ativo';
      const response = await fetch(`/api/admin/usuarios/${usuarioId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar status');
      setStatus(novoStatus);
    } catch (err) {
      setError('Falha ao atualizar status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <input
        type="text"
        value={nomeUsuario}
        readOnly
        style={{
          width: 320,
          textAlign: 'center',
          fontSize: 16,
          padding: 8,
          borderRadius: 6,
          border: '1px solid #1976d2',
          background: '#f5faff',
          color: '#1976d2',
          fontWeight: 'bold',
        }}
      />
      <div style={{ marginTop: 12 }}>
        <span style={{
          color: status === 'ativo' ? 'green' : 'red',
          fontWeight: 'bold',
          marginRight: 16,
        }}>
          {status === 'ativo' ? 'Ativo' : 'Inativo'}
        </span>
        <button
          onClick={handleToggleStatus}
          disabled={loading}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: 'none',
            background: status === 'ativo' ? '#d32f2f' : '#388e3c',
            color: '#fff',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Salvando...' : status === 'ativo' ? 'Desativar' : 'Ativar'}
        </button>
      </div>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  );
}

export default UsuarioInfo;