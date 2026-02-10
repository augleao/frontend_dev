import React, { useEffect, useState } from 'react';
import config from './config';

export default function UsuariosAdmin() {
  const [usuarios, setUsuarios] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/admin/usuarios`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setUsuarios(data.usuarios || []);
  };

  const handleEdit = (usuario) => {
    setEditId(usuario.id);
    setEditData({ ...usuario, password: '' }); // password em branco por padrão
    setMsg('');
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
      fetchUsuarios();
    } else {
      setMsg('Erro ao atualizar usuário.');
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

  const actionGroupStyle = { display: 'flex', gap: 8, flexWrap: 'wrap' };

  return (
    <div style={{ maxWidth: 1000, margin: '40px auto', padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2 style={{ marginBottom: 24 }}>👥 Administração de Usuários</h2>
      {msg && (
        <div style={{ color: msg.includes('Erro') ? 'red' : 'green', marginBottom: 10 }}>{msg}</div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th>Nome</th>
            <th>Email</th>
            <th>Serventia</th>
            <th>Cargo</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id}>
              <td>
                {editId === usuario.id ? (
                  <input
                    name="nome"
                    value={editData.nome}
                    onChange={handleEditChange}
                    style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                  />
                ) : (
                  usuario.nome
                )}
              </td>
              <td>
                {editId === usuario.id ? (
                  <input
                    name="email"
                    value={editData.email}
                    onChange={handleEditChange}
                    style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                  />
                ) : (
                  usuario.email
                )}
              </td>
              <td>
                {editId === usuario.id ? (
                  <input
                    name="serventia"
                    value={editData.serventia}
                    onChange={handleEditChange}
                    style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                  />
                ) : (
                  usuario.serventia
                )}
              </td>
              <td>
                {editId === usuario.id ? (
                  <select
                    name="cargo"
                    value={editData.cargo}
                    onChange={handleEditChange}
                    style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                  >
                    <option value="Registrador">Registrador</option>
                    <option value="Escrevente">Escrevente</option>
                    <option value="Substituto">Substituto</option>
                    <option value="Auxiliar">Auxiliar</option>
                    <option value="Outro">Outro</option>
                  </select>
                ) : (
                  usuario.cargo
                )}
              </td>
              {/* Campo de senha para edição */}
              {editId === usuario.id && (
                <td colSpan={2} style={{ paddingTop: 8, paddingBottom: 8 }}>
                  <input
                    type="password"
                    name="password"
                    value={editData.password}
                    onChange={handleEditChange}
                    placeholder="Nova senha (opcional)"
                    style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                  />
                </td>
              )}
              <td>
                {editId === usuario.id ? (
                  <select
                    name="status"
                    value={editData.status}
                    onChange={handleEditChange}
                    style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                ) : (
                  <span style={{
                    color: usuario.status === 'ativo' ? 'green' : 'red',
                    fontWeight: 'bold',
                  }}>
                    {usuario.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                )}
              </td>
              <td>
                {editId === usuario.id ? (
                  <div style={actionGroupStyle}>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="btn-gradient btn-gradient-green btn-compact"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="btn-gradient btn-gradient-red btn-compact"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
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
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
