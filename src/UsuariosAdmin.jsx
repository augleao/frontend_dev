import React, { useEffect, useState } from 'react';
import config from './config';
import { fetchUserComponents, updateUserComponents } from './services/PermissionsService';

export default function UsuariosAdmin() {
  const [usuarios, setUsuarios] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [msg, setMsg] = useState('');
  const [serventiaAtual, setServentiaAtual] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [componentes, setComponentes] = useState([]);
  const [carregandoComponentes, setCarregandoComponentes] = useState(false);
  const [salvandoPermissoes, setSalvandoPermissoes] = useState(false);
  const [msgPermissoes, setMsgPermissoes] = useState('');
  const [erroPermissoes, setErroPermissoes] = useState('');

  useEffect(() => {
    const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || '{}');
    setServentiaAtual(usuarioLocal?.serventia || '');
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    const token = localStorage.getItem('token');
    const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || '{}');
    const serventiaFiltro = usuarioLocal?.serventia;
    const query = serventiaFiltro ? `?serventia=${encodeURIComponent(serventiaFiltro)}` : '';
    const res = await fetch(`${config.apiURL}/admin/usuarios${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const lista = data.usuarios || [];
    // ainda mantemos filtro cliente como safety
    const filtrados = serventiaFiltro ? lista.filter((u) => u.serventia === serventiaFiltro) : lista;
    setUsuarios(filtrados);
  };

  const handleEdit = (usuario) => {
    setEditId(usuario.id);
    setEditData({ ...usuario, password: '' }); // password em branco por padrão
    setMsg('');
    loadPermissoes(usuario.id);
    setModalOpen(true);
  };

  const handleEditChange = (e) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    // Monta objeto apenas com campos relevantes
    const { nome, email, serventia, cargo, status, password } = editData;
    const payload = { nome, email, serventia, cargo, status };
    if (password && password.trim() !== '') payload.password = password;
    const res = await fetch(`${config.apiURL}/admin/usuarios/${editId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setMsg('Usuário atualizado!');
      setEditId(null);
      setModalOpen(false);
      fetchUsuarios();
    } else {
      setMsg('Erro ao atualizar usuário.');
    }
  };

  const loadPermissoes = async (userId) => {
    if (!userId) return;
    setCarregandoComponentes(true);
    setMsgPermissoes('');
    setErroPermissoes('');
    try {
      const data = await fetchUserComponents(userId);
      const mapped = (data.components || []).map((c) => ({ ...c, allowed: Boolean(c.allowed) }));
      setComponentes(mapped);
    } catch (err) {
      setErroPermissoes(err.message || 'Erro ao carregar permissões');
      setComponentes([]);
    } finally {
      setCarregandoComponentes(false);
    }
  };

  const togglePerm = (key) => {
    setComponentes((prev) => prev.map((c) => (c.key === key ? { ...c, allowed: !c.allowed } : c)));
  };

  const salvarPermissoes = async () => {
    if (!editId) return;
    setSalvandoPermissoes(true);
    setMsgPermissoes('');
    setErroPermissoes('');
    try {
      const allowedKeys = componentes.filter((c) => c.allowed).map((c) => c.key);
      await updateUserComponents(editId, allowedKeys);
      setMsgPermissoes('Permissões salvas.');
    } catch (err) {
      setErroPermissoes(err.message || 'Erro ao salvar permissões');
    } finally {
      setSalvandoPermissoes(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/admin/usuarios/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setMsg('Usuário excluído!');
      fetchUsuarios();
    } else {
      setMsg('Erro ao excluir usuário.');
    }
  };

  const actionGroupStyle = { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' };

  return (
    <div style={{ maxWidth: 1000, margin: '40px auto', padding: 20, border: '1px solid #ddd', borderRadius: 8, position: 'relative' }}>
      <h2 style={{ marginBottom: 24 }}>👥 Administração de Usuários</h2>
      {msg && (
        <div style={{ color: msg.includes('Erro') ? 'red' : 'green', marginBottom: 10 }}>{msg}</div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ textAlign: 'center' }}>Nome</th>
            <th style={{ textAlign: 'center' }}>Cargo</th>
            <th style={{ textAlign: 'center' }}>Status</th>
            <th style={{ textAlign: 'center' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id}>
              <td style={{ textAlign: 'center' }}>{usuario.nome}</td>
              <td style={{ textAlign: 'center' }}>{usuario.cargo}</td>
              <td style={{ textAlign: 'center' }}>
                <span style={{
                  color: usuario.status === 'ativo' ? 'green' : 'red',
                  fontWeight: 'bold',
                }}>
                  {usuario.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <div style={actionGroupStyle}>
                  <button
                    type="button"
                    onClick={() => handleEdit(usuario)}
                    className="btn-gradient btn-gradient-blue btn-compact"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(usuario.id)}
                    className="btn-gradient btn-gradient-red btn-compact"
                  >
                    Excluir
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99 }}>
          <div style={{ width: '90%', maxWidth: 960, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Editar Usuário</h3>
              <button className="btn-gradient btn-gradient-red btn-compact" onClick={() => { setModalOpen(false); setEditId(null); }}>
                Fechar
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Nome</span>
                <input name="nome" value={editData.nome || ''} onChange={handleEditChange} style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Email</span>
                <input name="email" value={editData.email || ''} onChange={handleEditChange} style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Serventia</span>
                <input name="serventia" value={editData.serventia || ''} onChange={handleEditChange} style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Cargo</span>
                <select name="cargo" value={editData.cargo || ''} onChange={handleEditChange} style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc' }}>
                  <option value="Registrador">Registrador</option>
                  <option value="Escrevente">Escrevente</option>
                  <option value="Substituto">Substituto</option>
                  <option value="Auxiliar">Auxiliar</option>
                  <option value="Outro">Outro</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Status</span>
                <select name="status" value={editData.status || ''} onChange={handleEditChange} style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc' }}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>Senha (opcional)</span>
                <input type="password" name="password" value={editData.password || ''} onChange={handleEditChange} placeholder="Nova senha" style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc' }} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button type="button" className="btn-gradient btn-gradient-green" onClick={handleSave}>Salvar usuário</button>
              <button type="button" className="btn-gradient btn-gradient-gray" onClick={() => loadPermissoes(editId)}>Recarregar permissões</button>
            </div>

            <div style={{ marginBottom: 8, fontWeight: '700' }}>Permissões</div>
            {erroPermissoes && <div style={{ color: 'red', marginBottom: 8 }}>{erroPermissoes}</div>}
            {msgPermissoes && <div style={{ color: 'green', marginBottom: 8 }}>{msgPermissoes}</div>}
            {carregandoComponentes && <div>Carregando permissões...</div>}
            {!carregandoComponentes && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {componentes.map((c) => (
                  <label key={c.key} style={{ border: '1px solid #e0e0e0', borderRadius: 10, padding: 10, display: 'flex', gap: 8, alignItems: 'flex-start', background: c.allowed ? 'linear-gradient(135deg, rgba(92,169,255,0.12), rgba(61,213,152,0.12))' : '#fff', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!c.allowed} onChange={() => togglePerm(c.key)} style={{ marginTop: 4 }} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{c.description}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {(c.tags || []).map((t) => (
                          <span key={t} style={{ fontSize: 11, background: '#f3f4f6', borderRadius: 6, padding: '2px 6px', color: '#444' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button type="button" className="btn-gradient btn-gradient-blue" onClick={salvarPermissoes} disabled={salvandoPermissoes}>
                {salvandoPermissoes ? 'Salvando...' : 'Salvar permissões'}
              </button>
              <button type="button" className="btn-gradient btn-gradient-orange" onClick={() => setComponentes((prev) => prev.map((c) => ({ ...c, allowed: true })))}>
                Marcar todos
              </button>
              <button type="button" className="btn-gradient btn-gradient-gray" onClick={() => setComponentes((prev) => prev.map((c) => ({ ...c, allowed: false })))}>
                Limpar todos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
