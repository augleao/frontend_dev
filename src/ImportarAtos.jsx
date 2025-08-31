import React, { useState, useEffect } from 'react';
import { apiURL } from './config';

function ImportarAtos() {
  const [atos, setAtos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [editIndex, setEditIndex] = useState(null);
  const [editAto, setEditAto] = useState({});
  const [novoAto, setNovoAto] = useState({ codigo: '', descricao: '' });

  // Estilos dos botões
  const buttonStyle = {
    padding: '10px 24px',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 8,
    transition: 'background 0.2s'
  };
  const buttonDisabledStyle = { ...buttonStyle, background: '#ccc', cursor: 'not-allowed' };
  const buttonEditStyle = { ...buttonStyle, background: '#2196f3' };
  const buttonSaveStyle = { ...buttonStyle, background: '#388e3c' };
  const buttonCancelStyle = { ...buttonStyle, background: '#d32f2f' };

  // Busca os atos do backend ao montar o componente
  useEffect(() => {
    const fetchAtos = async () => {
      setLoading(true);
      setMsg('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiURL}/atos`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setAtos(data.atos);
        } else {
          setMsg(data.message || 'Erro ao carregar atos.');
        }
      } catch (err) {
        setMsg('Erro ao carregar atos.');
      }
      setLoading(false);
    };
    fetchAtos();
  }, []);

  // Editar ato
  const handleEdit = (idx) => {
    setEditIndex(idx);
    setEditAto({ ...atos[idx] });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditAto({ ...editAto, [name]: value });
  };

  const handleEditSave = async () => {
    setLoading(true);
    setMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiURL}/atos/${editAto.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editAto),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.message || 'Erro ao salvar ato.');
        setLoading(false);
        return;
      }
      setAtos(atos.map((ato, idx) => idx === editIndex ? data.ato : ato));
      setMsg('Ato salvo com sucesso!');
    } catch (err) {
      setMsg('Erro ao salvar ato.');
    }
    setEditIndex(null);
    setEditAto({});
    setLoading(false);
  };

  // Salvar alterações no backend (um por um)
  const handleSalvar = async () => {
    setLoading(true);
    setMsg('');
    try {
      const token = localStorage.getItem('token');
      for (const ato of atos) {
        const res = await fetch(`${apiURL}/atos/${ato.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(ato),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Erro ao salvar ato.');
        }
      }
      setMsg('Atos salvos com sucesso!');
    } catch (err) {
      setMsg(err.message || 'Erro ao salvar atos.');
    }
    setLoading(false);
  };

  // Manipular a mudança nos campos do novo ato
  const handleNovoAtoChange = (e) => {
    const { name, value } = e.target;
    setNovoAto({ ...novoAto, [name]: value });
  };

  // Enviar o novo ato para o backend
  const handleNovoAtoSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiURL}/atos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(novoAto),
      });
      const data = await res.json();
      if (res.ok) {
        setAtos([...atos, data.ato]);
        setNovoAto({ codigo: '', descricao: '' });
        setMsg('Ato cadastrado com sucesso!');
      } else {
        setMsg(data.message || 'Erro ao cadastrar ato.');
      }
    } catch (err) {
      setMsg('Erro ao cadastrar ato.');
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', padding: 32 }}>
      <h2>Editar Atos das Tabelas 07 e 08 (TJMG)</h2>

      {msg && (
        <div style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 4,
          background: msg.includes('sucesso') ? '#e8f5e8' : '#ffeaea',
          color: msg.includes('sucesso') ? '#2e7d32' : '#d32f2f',
          border: `1px solid ${msg.includes('sucesso') ? '#4caf50' : '#f44336'}`
        }}>
          {msg}
        </div>
      )}

      {loading && <p>Carregando...</p>}

      {!loading && atos.length === 0 && <p>Nenhum ato encontrado.</p>}

      {/* Formulário para inserir um novo ato */}
      <h3 style={{ marginBottom: 16 }}>Inserir Novo Ato</h3>
      <form onSubmit={handleNovoAtoSubmit} style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>Código:</label>
          <input
            type="text"
            name="codigo"
            value={novoAto.codigo}
            onChange={handleNovoAtoChange}
            style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
            required
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>Descrição:</label>
          <textarea
            name="descricao"
            value={novoAto.descricao}
            onChange={handleNovoAtoChange}
            style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
            required
          />
        </div>
        <button type="submit" disabled={loading} style={loading ? buttonDisabledStyle : buttonStyle}>
          {loading ? 'Cadastrando...' : 'Cadastrar Ato'}
        </button>
      </form>

      {atos.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fafafa' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ border: '1px solid #ddd', padding: 12, textAlign: 'left' }}>Código</th>
                  <th style={{ border: '1px solid #ddd', padding: 12, textAlign: 'left' }}>Descrição</th>
                  <th style={{ border: '1px solid #ddd', padding: 12, textAlign: 'left' }}>Emol. Bruto</th>
                  <th style={{ border: '1px solid #ddd', padding: 12, textAlign: 'left' }}>ISSQN</th>
                  <th style={{ border: '1px solid #ddd', padding: 12, textAlign: 'left' }}>Taxa Fiscal</th>
                  <th style={{ border: '1px solid #ddd', padding: 12, textAlign: 'left' }}>Valor Final</th>
                  <th style={{ border: '1px solid #ddd', padding: 12, textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {atos.map((ato, idx) => {
                  if (!ato) return null;
                  return (
                    <tr key={ato.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                      <td style={{ border: '1px solid #ddd', padding: 12 }}>
                        {editIndex === idx ? (
                          <input
                            name="codigo"
                            value={editAto.codigo}
                            onChange={handleEditChange}
                            style={{ width: '100%', padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                          />
                        ) : (
                          ato.codigo
                        )}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: 12 }}>
                        {editIndex === idx ? (
                          <textarea
                            name="descricao"
                            value={editAto.descricao}
                            onChange={handleEditChange}
                            style={{ width: '100%', minWidth: 300, padding: 4, border: '1px solid #ccc', borderRadius: 4, minHeight: 60 }}
                          />
                        ) : (
                          ato.descricao
                        )}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: 12 }}>
                        {editIndex === idx ? (
                          <input
                            name="emol_bruto"
                            value={editAto.emol_bruto || ''}
                            onChange={handleEditChange}
                            type="number"
                            step="0.01"
                            style={{ width: '100%', padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                          />
                        ) : (
                          ato.emol_bruto !== null && ato.emol_bruto !== undefined
                            ? `R$ ${Number(ato.emol_bruto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : ''
                        )}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: 12 }}>
                        {editIndex === idx ? (
                          <input
                            name="issqn"
                            value={editAto.issqn || ''}
                            onChange={handleEditChange}
                            type="number"
                            step="0.01"
                            style={{ width: '100%', padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                          />
                        ) : (
                          ato.issqn !== null && ato.issqn !== undefined
                            ? `R$ ${Number(ato.issqn).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : ''
                        )}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: 12 }}>
                        {editIndex === idx ? (
                          <input
                            name="taxa_fiscal"
                            value={editAto.taxa_fiscal || ''}
                            onChange={handleEditChange}
                            type="number"
                            step="0.01"
                            style={{ width: '100%', padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                          />
                        ) : (
                          ato.taxa_fiscal !== null && ato.taxa_fiscal !== undefined
                            ? `R$ ${Number(ato.taxa_fiscal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : ''
                        )}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: 12 }}>
                        {editIndex === idx ? (
                          <input
                            name="valor_final"
                            value={editAto.valor_final || ''}
                            onChange={handleEditChange}
                            type="number"
                            step="0.01"
                            style={{ width: '100%', padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                          />
                        ) : (
                          ato.valor_final !== null && ato.valor_final !== undefined
                            ? `R$ ${Number(ato.valor_final).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : ''
                        )}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: 12, textAlign: 'center' }}>
                        {editIndex === idx ? (
                          <>
                            <button onClick={handleEditSave} style={{
              padding: '10px 20px',
              background: '#1976d2',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: 16
            }}>Salvar</button>
                            <button onClick={() => setEditIndex(null)} style={buttonCancelStyle}>Cancelar</button>
                          </>
                        ) : (
                          <button onClick={() => handleEdit(idx)} style={{
              padding: '10px 20px',
              background: '#1976d2',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: 16
            }}>Editar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button onClick={handleSalvar} disabled={loading} style={loading ? buttonDisabledStyle : buttonSaveStyle}>
              {loading ? 'Salvando...' : 'Salvar todas alterações'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ImportarAtos;