import React, { useEffect, useState } from 'react';
import config from '../../config';
import AtoSearch from '../../AtoSearch';

export default function EditarCombos() {
  const [atos, setAtos] = useState([]);
  const [combos, setCombos] = useState([]);
  const [novoCombo, setNovoCombo] = useState({ nome: '', atosIds: [] });
  const [msg, setMsg] = useState('');
  const [buscaAto, setBuscaAto] = useState('');
  const [atosBusca, setAtosBusca] = useState([]);
  const [atoSelecionado, setAtoSelecionado] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    fetchCombos();
  }, []);

  const fetchCombos = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/admin/combos/listar`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setCombos(data.combos || []);
  };

  // Buscar sugestões ao digitar
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    const token = localStorage.getItem('token');
    fetch(
      `${config.apiURL}/admin/atos?busca=${encodeURIComponent(searchTerm)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then((res) => res.json())
      .then((data) => {
        setSuggestions(data.atos || []);
        setLoadingSuggestions(false);
      })
      .catch(() => setLoadingSuggestions(false));
  }, [searchTerm]);

  const buscarAtos = async () => {
    if (!buscaAto.trim()) return;
    const token = localStorage.getItem('token');
    const res = await fetch(
      `${config.apiURL}/admin/atos?busca=${encodeURIComponent(buscaAto)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    setAtosBusca(data.atos || []);
  };

  const handleComboChange = (e) => {
    const { name, value } = e.target;
    setNovoCombo((c) => ({ ...c, [name]: value }));
  };

  const handleAtoSelecionado = (ato) => {
    if (ato && !novoCombo.atosIds.includes(ato.id)) {
      setNovoCombo((c) => ({
        ...c,
        atosIds: [...c.atosIds, ato.id],
        atosDetalhes: [...(c.atosDetalhes || []), ato],
      }));
    }
  };

  const handleRemoverAto = (id) => {
    setNovoCombo((c) => ({
      ...c,
      atosIds: c.atosIds.filter((aid) => aid !== id),
      atosDetalhes: (c.atosDetalhes || []).filter((a) => a.id !== id),
    }));
  };

  const handleSalvarCombo = async (e) => {
    e.preventDefault();
    if (!novoCombo.nome || novoCombo.atosIds.length === 0) {
      setMsg('Preencha o nome e adicione ao menos um ato.');
      return;
    }
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiURL}/admin/combos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nome: novoCombo.nome,
        atosIds: novoCombo.atosIds,
      }),
    });
    if (res.ok) {
      setMsg('Combo criado com sucesso!');
      setNovoCombo({ nome: '', atosIds: [], atosDetalhes: [] });
      fetchCombos();
    } else {
      setMsg('Erro ao criar combo.');
    }
  };

  return (
    <div
      style={{
        maxWidth: 800,
        margin: '40px auto',
        padding: 20,
        border: '1px solid #ddd',
        borderRadius: 8,
        background: '#fff',
      }}
    >
      <h2 style={{ marginBottom: 18 }}>Editar Combos de Atos</h2>
      {msg && (
        <div
          style={{
            color: msg.includes('Erro') ? 'red' : 'green',
            marginBottom: 10,
          }}
        >
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
            style={{
              width: '100%',
              padding: 8,
              borderRadius: 6,
              border: '1px solid #ccc',
              marginTop: 4,
            }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600 }}>
            Buscar ato por código ou descrição:
          </label>
          <AtoSearch onSelect={handleAtoSelecionado} />
        </div>
        {Array.isArray(novoCombo.atosDetalhes) && novoCombo.atosDetalhes.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 600 }}>Atos adicionados ao combo:</label>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                marginTop: 6,
              }}
            >
              {novoCombo.atosDetalhes.map((a) => (
                <li
                  key={a.id}
                  style={{
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>
                    {a.codigo} - {a.nome}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoverAto(a.id)}
                    style={{
                      background: '#e74c3c',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '2px 10px',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
            cursor: 'pointer',
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