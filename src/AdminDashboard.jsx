import React, { useEffect, useState } from 'react';
import config from './config';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
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
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setUsuarios(data.usuarios || []);
  };

  const handleEdit = (usuario) => {
    setEditId(usuario.id);
    setEditData({ ...usuario });
    setMsg('');
  };

  const handleEditChange = (e) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/admin/usuarios/${editId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(editData)
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
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setMsg('Usuário excluído!');
      fetchUsuarios();
    } else {
      setMsg('Erro ao excluir usuário.');
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Administração de Usuários</h2>
        <Link
          to="/admin/importar-atos"
          style={{
            padding: '10px 20px',
            background: '#1976d2',
            color: '#fff',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: 16
          }}
        >
          Importar Atos (Tabelas 07/08)
        </Link>
      </div>
      {msg && <div style={{ color: msg.includes('Erro') ? 'red' : 'green', marginBottom: 10 }}>{msg}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th>Nome</th>
            <th>Email</th>
            <th>Serventia</th>
            <th>Cargo</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map(usuario => (
            <tr key={usuario.id}>
              <td>
                {editId === usuario.id ? (
                  <input name="nome" value={editData.nome} onChange={handleEditChange} />
                ) : (
                  usuario.nome
                )}
              </td>
              <td>{usuario.email}</td>
              <td>
                {editId === usuario.id ? (
                  <input name="serventia" value={editData.serventia} onChange={handleEditChange} />
                ) : (
                  usuario.serventia
                )}
              </td>
              <td>
                {editId === usuario.id ? (
                  <select name="cargo" value={editData.cargo} onChange={handleEditChange}>
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
              <td>
                {editId === usuario.id ? (
                  <>
                    <button onClick={handleSave}>Salvar</button>
                    <button onClick={() => setEditId(null)} style={{ marginLeft: 8 }}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleEdit(usuario)}>Editar</button>
                    <button onClick={() => handleDelete(usuario.id)} style={{ marginLeft: 8, color: 'red' }}>Excluir</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}