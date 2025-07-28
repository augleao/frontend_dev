import React, { useEffect, useState } from 'react';

export default function ServicoConferencia({ protocolo }) {
  const [usuario, setUsuario] = useState('');
  const [status, setStatus] = useState('conferido');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [conferencias, setConferencias] = useState([]);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    // Recupera usuário logado do localStorage
    const usuarioLogado = JSON.parse(localStorage.getItem('usuario') || '{}');
    setUsuario(usuarioLogado.nome || usuarioLogado.email || 'Usuário');
  }, []);

  useEffect(() => {
    if (protocolo) {
      fetchConferencias();
    }
    // eslint-disable-next-line
  }, [protocolo]);

  async function fetchConferencias() {
    setErro(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/conferencias?protocolo=${encodeURIComponent(protocolo)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setConferencias(data.conferencias || []);
      } else {
        setConferencias([]);
      }
    } catch (err) {
      setErro('Erro ao buscar conferências.');
      setConferencias([]);
    }
  }

  async function handleSalvar() {
    setSalvando(true);
    setErro(null);
    try {
      const token = localStorage.getItem('token');
      const body = JSON.stringify({
        protocolo,
        usuario,
        status,
        observacao
      });
      const res = await fetch('/api/conferencias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body
      });
      if (res.ok) {
        setObservacao('');
        setStatus('conferido');
        fetchConferencias();
      } else {
        setErro('Erro ao salvar conferência.');
      }
    } catch (err) {
      setErro('Erro ao salvar conferência.');
    }
    setSalvando(false);
  }

  return (
    <div style={{
      border: '3px solid #9b59b6',
      borderRadius: 24,
      background: '#fdf8feff',
      padding: 12,
      marginBottom: 18,
      boxShadow: '0 6px 32px rgba(155,89,182,0.10)'
    }}>
      <h3 style={{ color: '#6c3483', fontWeight: 700, fontSize: 20, margin: 0, marginBottom: 12 }}>Conferência</h3>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ color: '#6c3483', fontWeight: 600 }}>Usuário responsável:</label><br />
          <span style={{ fontWeight: 600 }}>{usuario}</span>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ color: '#6c3483', fontWeight: 600 }}>Status da conferência:</label><br />
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', border: '1.5px solid #d6d6f5', borderRadius: 6, padding: '8px 12px', fontSize: 16, boxSizing: 'border-box' }}>
            <option value="conferido">Conferido</option>
            <option value="retificado">Retificado</option>
          </select>
        </div>
        <div style={{ flex: 2, minWidth: 200 }}>
          <label style={{ color: '#6c3483', fontWeight: 600 }}>Observações:</label><br />
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            maxLength={200}
            style={{ width: '100%', border: '1.5px solid #d6d6f5', borderRadius: 6, padding: '8px 12px', fontSize: 16, minHeight: 40, boxSizing: 'border-box' }}
            placeholder="Observações da conferência..."
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', minWidth: 120 }}>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando || !status}
            style={{ background: '#9b59b6', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 24px', fontWeight: 'bold', fontSize: 16, cursor: 'pointer', marginTop: 18 }}
          >
            {salvando ? 'Salvando...' : 'Salvar Conferência'}
          </button>
        </div>
      </div>
      {erro && <div style={{ color: 'red', marginBottom: 8 }}>{erro}</div>}
      <h4 style={{ color: '#6c3483', fontWeight: 600, fontSize: 16, margin: '12px 0 8px 0' }}>Histórico de Conferências</h4>
      <div style={{ overflowX: 'auto', background: '#f5e6fa', borderRadius: 8, border: '2px solid #9b59b6', boxShadow: '0 2px 8px rgba(155,89,182,0.06)', padding: '8px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'transparent' }}>
          <thead>
            <tr style={{ background: '#ede1f7' }}>
              <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 12 }}>Data/Hora</th>
              <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 12 }}>Usuário</th>
              <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 12 }}>Status</th>
              <th style={{ padding: 6, color: '#6c3483', fontWeight: 700, fontSize: 12 }}>Observação</th>
            </tr>
          </thead>
          <tbody>
            {conferencias.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#aaa', padding: 12 }}>Nenhuma conferência registrada.</td></tr>
            ) : (
              conferencias.map((c, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? '#f8f4fc' : 'transparent' }}>
                  <td style={{ padding: 6 }}>{c.dataHora ? new Date(c.dataHora).toLocaleString() : '-'}</td>
                  <td style={{ padding: 6 }}>{c.usuario}</td>
                  <td style={{ padding: 6 }}>{c.status === 'conferido' ? 'Conferido' : 'Retificado'}</td>
                  <td style={{ padding: 6 }}>{c.observacao}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
