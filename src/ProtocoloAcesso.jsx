import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProtocoloAcesso() {
  const [protocolo, setProtocolo] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro('');
    if (!protocolo.trim() || !senha.trim()) {
      setErro('Preencha o protocolo e a senha.');
      return;
    }
    // Aqui você pode adicionar uma chamada de API para validar o protocolo/senha
    // Se for válido:
    navigate(`/recibo/${encodeURIComponent(protocolo)}?senha=${encodeURIComponent(senha)}`);
  };

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(44,62,80,0.10)', padding: 32, fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Acessar Protocolo</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600 }}>Protocolo:</label>
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
          <label style={{ fontWeight: 600 }}>Senha:</label>
          <input
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1.5px solid #bdc3c7', fontSize: 15, marginTop: 4 }}
            placeholder="Digite a senha do protocolo"
          />
        </div>
        {erro && <div style={{ color: 'red', marginBottom: 12 }}>{erro}</div>}
        <button type="submit" style={{ width: '100%', background: '#6c3483', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
          Acessar Protocolo
        </button>
      </form>
    </div>
  );
}
