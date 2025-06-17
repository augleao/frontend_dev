// UsuarioInfo.jsx
import React from 'react';

function UsuarioInfo({ nomeUsuario }) {
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
    </div>
  );
}

export default UsuarioInfo;