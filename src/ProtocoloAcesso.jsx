import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './buttonGradients.css';

export default function ProtocoloAcesso() {
  const [protocolo, setProtocolo] = useState('');
  const [chave, setChave] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro('');
    if (!protocolo.trim() || !chave.trim()) {
      setErro('Preencha o número do protocolo e a chave de acesso.');
      return;
    }
    // Aqui você pode adicionar uma chamada de API para validar o protocolo/chave
    // Se for válido:
    navigate(`/recibo/${encodeURIComponent(protocolo)}?chave=${encodeURIComponent(chave)}`);
  };

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(44,62,80,0.10)', padding: 32, fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Acessar Protocolo</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600 }}>Número do Protocolo:</label>
          <input
            type="text"
            value={protocolo}
            onChange={e => setProtocolo(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid #bdc3c7', fontSize: 15, marginTop: 4 }}
            placeholder="Digite o número do protocolo"
            autoFocus
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontWeight: 600 }}>Chave de acesso:</label>
          <input
            type="password"
            value={chave}
            onChange={e => setChave(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid #bdc3c7', fontSize: 15, marginTop: 4 }}
            placeholder="Digite a chave de acesso"
          />
        </div>
        {erro && <div style={{ color: 'red', marginBottom: 12 }}>{erro}</div>}
        <button type="submit" className="btn-gradient btn-gradient-blue btn-block">
          Acessar Protocolo
        </button>
      </form>
    </div>
  );
}
