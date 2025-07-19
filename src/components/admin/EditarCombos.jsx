import React, { useEffect, useState } from 'react';
import config from '../../config';

export default function EditarCombos() {
  const [atos, setAtos] = useState([]);
  const [combos, setCombos] = useState([]);
  const [novoCombo, setNovoCombo] = useState({ nome: '', atosIds: [] });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchAtos();
    fetchCombos();
  }, []);

  const fetchAtos = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/admin/atos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setAtos(data.atos || []);
  };

  const fetchCombos = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/admin/combos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setCombos(data.combos || []);
  };

  const handleComboChange = (e) => {
    const { name, value } = e.target;
    setNovoCombo((c) => ({ ...c, [name]: value }));
  };

  const handleAtoSelect = (id) => {
    setNovoCombo((c) =>
      c.atosIds.includes(id)
        ? { ...c, atosIds: c.atosIds.filter((aid) => aid !== id) }
        : { ...c, atosIds: [...c.atosIds, id] }
    );
  };

  const handleSalvarCombo = async (e) => {
    e.preventDefault();
    if (!novoCombo.nome || novoCombo.atosIds.length === 0) {
      setMsg('Preencha o nome e selecione ao menos um ato.');
      return;
    }
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/admin/combos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(novoCombo),
    });
    if (res.ok) {
      setMsg('Combo criado com sucesso!');
      setNovoCombo({ nome: '', atosIds: [] });
      fetchCombos();
    } else {
      setMsg('Erro ao criar combo.');
    }
  };

  return (
    <div style={{
      maxWidth: 800,
      margin: '40px auto',
      padding: 20,
      border: '1px solid #ddd',
      borderRadius: 8,
      background: '#fff'
    }}>
      <h2 style={{ marginBottom: 18 }}>Editar Combos de Atos</h2>
      {msg && (
        <div style={{
          color: msg.includes('Erro') ? 'red' : 'green',
          marginBottom: 10,
        }}>
          {msg}
        </div>
      )}
      <form onSubmit={handleSalvarCombo} style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600 }}>Nome do Combo:</label>
          <input
            name="nome"
            value={novoCombo.nome}
            onChange={handleComboChange}
            required
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600 }}>Selecione os Atos:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {atos.map((ato) => (
              <label key={ato.id} style={{ background: '#f8f8f8', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={novoCombo.atosIds.includes(ato.id)}
                  onChange={() => handleAtoSelect(ato.id)}
                  style={{ marginRight: 6 }}
                />
                {ato.nome}
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          style={{
            padding: '10px 24px',
            background: '#27ae60',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 'bold',
            fontSize: 16,
            cursor: 'pointer'
          }}
        >
          Salvar Combo
        </button>
      </form>
      <h3 style={{ marginBottom: 10 }}>Combos já criados</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th>Nome do Combo</th>
            <th>Atos</th>
          </tr>
        </thead>
        <tbody>
          {combos.map((combo) => (
            <tr key={combo.id}>
              <td>{combo.nome}</td>
              <td>
                {combo.atos && combo.atos.length > 0
                  ? combo.atos.map((a) => a.nome).join(', ')
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}