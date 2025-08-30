
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';


export default function ReciboBusca() {
  ('ReciboBusca: renderizou');
  const [protocolo, setProtocolo] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    ('ReciboBusca: useEffect inicial');
  }, []);


  function handleSubmit(e) {
    e.preventDefault();
    ('ReciboBusca: submit', protocolo);
    if (!protocolo.trim()) {
      setErro('Digite o número do protocolo.');
      return;
    }
    setErro('');
    navigate(`/recibo/${encodeURIComponent(protocolo.trim())}`);
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(44,62,80,0.08)', padding: 32, fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ marginBottom: 16, fontWeight: 700 }}>Consultar Recibo</h2>
      <form onSubmit={handleSubmit}>
        <label style={{ fontWeight: 600, fontSize: 15 }}>Número do protocolo:</label>
        <input
          type="text"
          value={protocolo}
          onChange={e => setProtocolo(e.target.value)}
          placeholder="Digite o protocolo"
          style={{ width: '100%', padding: 10, fontSize: 16, borderRadius: 8, border: '1px solid #bbb', margin: '10px 0 16px 0' }}
        />
        {erro && <div style={{ color: 'red', marginBottom: 8 }}>{erro}</div>}
        <button
          type="submit"
          style={{ width: '100%', background: '#3498db', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
        >
          Ver Recibo
        </button>
      </form>
      <div style={{ marginTop: 24, color: '#666', fontSize: 14 }}>
        Ou escaneie o QR Code do seu comprovante para acessar diretamente.
      </div>
    </div>
  );
}
