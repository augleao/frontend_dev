import React from 'react';

export default function MensagemStatus({ mensagem }) {
  if (!mensagem) return null;
  return (
    <div style={{
      marginTop: 12,
      color: mensagem.includes('sucesso') ? '#155724' : '#721c24',
      background: mensagem.includes('sucesso') ? '#d4edda' : '#f8d7da',
      borderRadius: 6,
      padding: 10,
    }}>
      {mensagem}
    </div>
  );
}