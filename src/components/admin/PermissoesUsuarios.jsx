import React, { useEffect, useMemo, useState } from 'react';
import { FaToggleOn, FaToggleOff, FaSave, FaSync, FaUsers } from 'react-icons/fa';
import config from '../../config';
import { fetchUserComponents, updateUserComponents } from '../../services/PermissionsService';

export default function PermissoesUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [components, setComponents] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    setLoadingUsers(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/admin/usuarios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Não foi possível carregar usuários');
      const data = await res.json();
      setUsuarios(data.usuarios || []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar usuários');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadComponents = async (userId) => {
    setLoadingComponents(true);
    setMessage('');
    setError('');
    try {
      const data = await fetchUserComponents(userId);
      const mapped = (data.components || []).map((c) => ({ ...c, allowed: Boolean(c.allowed) }));
      setComponents(mapped);
    } catch (err) {
      setError(err.message || 'Erro ao carregar componentes');
      setComponents([]);
    } finally {
      setLoadingComponents(false);
    }
  };

  const toggleComponent = (key) => {
    setComponents((prev) => prev.map((c) => (c.key === key ? { ...c, allowed: !c.allowed } : c)));
  };

  const selectAll = () => setComponents((prev) => prev.map((c) => ({ ...c, allowed: true })));
  const clearAll = () => setComponents((prev) => prev.map((c) => ({ ...c, allowed: false })));

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const allowedKeys = components.filter((c) => c.allowed).map((c) => c.key);
      await updateUserComponents(selectedUserId, allowedKeys);
      setMessage('Permissões salvas com sucesso.');
    } catch (err) {
      setError(err.message || 'Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  const selectedUser = useMemo(() => usuarios.find((u) => u.id === selectedUserId), [usuarios, selectedUserId]);

  return (
    <div style={{ maxWidth: 1100, margin: '32px auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <FaUsers />
        <h2 style={{ margin: 0 }}>Permissões dos Usuários</h2>
      </div>

      {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
      {message && <div style={{ color: 'green', marginBottom: 10 }}>{message}</div>}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <label htmlFor="userSelect" style={{ fontWeight: '600' }}>Usuário:</label>
        <select
          id="userSelect"
          disabled={loadingUsers}
          value={selectedUserId || ''}
          onChange={(e) => {
            const id = Number(e.target.value) || null;
            setSelectedUserId(id);
            if (id) loadComponents(id);
            else setComponents([]);
          }}
          style={{ minWidth: 260, padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
        >
          <option value="">Selecione</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome} — {u.cargo} ({u.serventia})
            </option>
          ))}
        </select>
        <button type="button" className="btn-gradient btn-gradient-blue" onClick={loadUsuarios} disabled={loadingUsers}>
          <FaSync style={{ marginRight: 6 }} /> Atualizar lista
        </button>
      </div>

      {selectedUser && (
        <div style={{ marginBottom: 12, color: '#555' }}>
          Editando permissões de <strong>{selectedUser.nome}</strong> ({selectedUser.cargo})
        </div>
      )}

      {loadingComponents && <div>Carregando componentes...</div>}

      {selectedUserId && !loadingComponents && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn-gradient btn-gradient-green" onClick={selectAll}>
              <FaToggleOn style={{ marginRight: 6 }} /> Marcar todos
            </button>
            <button type="button" className="btn-gradient btn-gradient-orange" onClick={clearAll}>
              <FaToggleOff style={{ marginRight: 6 }} /> Limpar todos
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {components.map((c) => (
              <label
                key={c.key}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  background: c.allowed ? 'linear-gradient(135deg, rgba(92,169,255,0.12), rgba(61,213,152,0.12))' : '#fff',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={!!c.allowed}
                  onChange={() => toggleComponent(c.key)}
                  style={{ marginTop: 4 }}
                />
                <div>
                  <div style={{ fontWeight: '700' }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: '#555', margin: '4px 0' }}>{c.description}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(c.tags || []).map((t) => (
                      <span key={t} style={{ fontSize: 11, background: '#f3f4f6', borderRadius: 6, padding: '2px 6px', color: '#444' }}>{t}</span>
                    ))}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <button type="button" className="btn-gradient btn-gradient-blue" onClick={handleSave} disabled={saving}>
              <FaSave style={{ marginRight: 6 }} /> {saving ? 'Salvando...' : 'Salvar Permissões'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
