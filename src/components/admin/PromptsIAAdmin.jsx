import React, { useEffect, useState } from 'react';
import config from '../../config';

export default function PromptsIAAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newIdx, setNewIdx] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${config.apiURL}/ia/prompts`);
      if (!r.ok) throw new Error(`Falha ao carregar (${r.status})`);
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(indexador, prompt) {
    setError('');
    try {
      const r = await fetch(`${config.apiURL}/ia/prompts/${encodeURIComponent(indexador)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!r.ok) throw new Error(`Falha ao salvar (${r.status})`);
      await load();
    } catch (e) {
      setError(e.message || 'Erro ao salvar');
    }
  }

  async function remove(indexador) {
    if (!window.confirm(`Apagar prompt "${indexador}"?`)) return;
    setError('');
    try {
      const r = await fetch(`${config.apiURL}/ia/prompts/${encodeURIComponent(indexador)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`Falha ao apagar (${r.status})`);
      await load();
    } catch (e) {
      setError(e.message || 'Erro ao apagar');
    }
  }

  async function addNew() {
    const idx = (newIdx || '').trim().toLowerCase();
    const pr = (newPrompt || '').trim();
    if (!idx || pr.length < 5) {
      alert('Preencha indexador e prompt (mín. 5 caracteres).');
      return;
    }
    await save(idx, pr);
    setNewIdx('');
    setNewPrompt('');
  }

  const container = {
    maxWidth: 1000,
    margin: '40px auto',
    padding: 20,
    border: '1px solid #ddd',
    borderRadius: 8,
    background: '#fff'
  };

  return (
    <div style={container}>
      <h2 style={{ marginTop: 0 }}>Prompts da IA</h2>
      <p style={{ color: '#555' }}>
        Gerencie os prompts utilizados pelos endpoints de IA. Use placeholders como
        {' '}
        <code>{'{{texto}}'}</code>,{' '}
        <code>{'{{tipo}}'}</code> e{' '}
        <code>{'{{legislacao_bullets}}'}</code>.
      </p>
      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>Erro: {error}</div>}

      <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Adicionar novo</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', marginBottom: 8 }}>
          <input
            placeholder="indexador (ex.: identificar_mandado)"
            value={newIdx}
            onChange={e => setNewIdx(e.target.value)}
            style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
          />
        </div>
        <textarea
          placeholder="prompt"
          value={newPrompt}
          onChange={e => setNewPrompt(e.target.value)}
          rows={8}
          style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6, fontFamily: 'monospace' }}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button onClick={addNew} style={{ padding: '8px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Salvar</button>
          <button onClick={() => { setNewIdx(''); setNewPrompt(''); }} style={{ padding: '8px 16px', background: '#888', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Limpar</button>
        </div>
      </div>

      {loading ? (
        <div>Carregando…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {items.length === 0 && <div>Nenhum prompt cadastrado.</div>}
          {items.map((it, idx) => (
            <PromptRow key={it.indexador + idx} item={it} onSave={save} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

function PromptRow({ item, onSave, onDelete }) {
  const [val, setVal] = useState(item.prompt || '');
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 16 }}>{item.indexador}</strong>
        <small style={{ color: '#666' }}>Atualizado: {new Date(item.updated_at).toLocaleString()}</small>
      </div>
      <textarea
        value={val}
        onChange={e => setVal(e.target.value)}
        rows={8}
        style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6, fontFamily: 'monospace' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => onSave(item.indexador, val)} style={{ padding: '8px 16px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Salvar</button>
        <button onClick={() => onDelete(item.indexador)} style={{ padding: '8px 16px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Apagar</button>
      </div>
    </div>
  );
}
