import React, { useState, useEffect } from 'react';
import { apiURL } from './config';

export default function ClienteModal({ isOpen, onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newCpf, setNewCpf] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setClients([]);
    setError('');
    const t = setTimeout(() => {
      fetchClients(search);
    }, 250);
    return () => clearTimeout(t);
  }, [search, isOpen]);

  async function fetchClients(q) {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const url = `${apiURL}/rg/clientes${q ? `?search=${encodeURIComponent(q)}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Falha ao buscar clientes');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.items || data.clientes || []);
      setClients(list);
    } catch (e) {
      console.error('Erro fetchClients', e);
      setError('Não foi possível carregar clientes');
    } finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!newNome || !newNome.trim()) return setError('Nome é obrigatório');
    setCreating(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const payload = { nome: newNome.trim(), cpf: newCpf.trim() };
      const res = await fetch(`${apiURL}/rg/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Erro ao criar cliente');
      }
      const created = await res.json();
      onSelect(created);
      onClose();
    } catch (e) {
      console.error('Erro criar cliente', e);
      setError('Erro ao salvar cliente');
    } finally { setCreating(false); }
  }

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ width: 720, maxWidth: '96%', background: 'white', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Selecionar ou criar Cliente</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="Buscar por nome ou CPF" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, padding: 8 }} />
          <button onClick={() => fetchClients(search)} style={{ padding: '8px 12px' }}>Buscar</button>
        </div>

        <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #eee', padding: 8, marginBottom: 8 }}>
          {loading ? <div>Carregando...</div> : (
            clients.length ? clients.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid #f2f2f2' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{c.cpf || ''}</div>
                </div>
                <div>
                  <button onClick={() => { onSelect(c); onClose(); }} style={{ padding: '6px 10px' }}>Selecionar</button>
                </div>
              </div>
            )) : <div style={{ color: '#666' }}>Nenhum cliente encontrado.</div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Criar novo cliente</div>
          {error && <div style={{ color: 'red', marginBottom: 6 }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 8, marginBottom: 8 }}>
            <input placeholder="Nome" value={newNome} onChange={(e) => setNewNome(e.target.value)} />
            <input placeholder="CPF" value={newCpf} onChange={(e) => setNewCpf(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 12px' }}>Cancelar</button>
            <button onClick={handleCreate} disabled={creating} className="btn-gradient btn-gradient-green" style={{ padding: '8px 12px' }}>{creating ? 'Salvando...' : 'Salvar e Selecionar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
