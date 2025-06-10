import React, { useState } from 'react';

function ImportarAtos() {
  const [tabela07, setTabela07] = useState(null);
  const [tabela08, setTabela08] = useState(null);
  const [atos, setAtos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [editIndex, setEditIndex] = useState(null);
  const [editAto, setEditAto] = useState({});

  // Handler para upload dos arquivos
  const handleFileChange = (e, tabela) => {
    if (tabela === '07') setTabela07(e.target.files[0]);
    if (tabela === '08') setTabela08(e.target.files[0]);
  };

  // Envia os arquivos para o backend e recebe os atos extraídos
  const handleUpload = async () => {
    if (!tabela07 || !tabela08) {
      setMsg('Envie os dois arquivos PDF.');
      return;
    }
    setLoading(true);
    setMsg('');
    const formData = new FormData();
    formData.append('tabela07', tabela07);
    formData.append('tabela08', tabela08);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/importar-atos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setAtos(data.atos);
        setMsg('Atos extraídos! Confira e edite se necessário.');
      } else {
        setMsg(data.message || 'Erro ao extrair atos.');
      }
    } catch (err) {
      setMsg('Erro ao enviar arquivos.');
    }
    setLoading(false);
  };

  // Editar ato
  const handleEdit = (idx) => {
    setEditIndex(idx);
    setEditAto({ ...atos[idx] });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditAto({ ...editAto, [name]: value });
  };

  const handleEditSave = () => {
    setAtos(atos.map((ato, idx) => idx === editIndex ? editAto : ato));
    setEditIndex(null);
    setEditAto({});
  };

  // Salvar no sistema
  const handleSalvar = async () => {
    setLoading(true);
    setMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/salvar-atos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ atos }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg('Atos salvos com sucesso!');
        setAtos([]);
      } else {
        setMsg(data.message || 'Erro ao salvar atos.');
      }
    } catch (err) {
      setMsg('Erro ao salvar atos.');
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', padding: 32 }}>
      <h2>Importar Atos das Tabelas 07 e 08 (TJMG)</h2>
      <div style={{ marginBottom: 24 }}>
        <label>
          Tabela 07 (PDF):{' '}
          <input type="file" accept="application/pdf" onChange={e => handleFileChange(e, '07')} />
        </label>
        <br />
        <label>
          Tabela 08 (PDF):{' '}
          <input type="file" accept="application/pdf" onChange={e => handleFileChange(e, '08')} />
        </label>
        <br />
        <button
          onClick={handleUpload}
          disabled={loading || !tabela07 || !tabela08}
          style={{ marginTop: 16, padding: '10px 24px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Processando...' : 'Extrair Atos'}
        </button>
      </div>
      {msg && <div style={{ marginBottom: 16, color: msg.includes('sucesso') ? 'green' : 'red' }}>{msg}</div>}
      {atos.length > 0 && (
        <>
          <h3>Atos extraídos</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fafafa' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>Código</th>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>Descrição</th>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>Valor Final</th>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>Origem</th>
                  <th style={{ border: '1px solid #ddd', padding: 8 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {atos.map((ato, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #ddd', padding: 8 }}>
                      {editIndex === idx ? (
                        <input name="codigo" value={editAto.codigo} onChange={handleEditChange} />
                      ) : (
                        ato.codigo
                      )}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: 8 }}>
                      {editIndex === idx ? (
                        <input name="descricao" value={editAto.descricao} onChange={handleEditChange} style={{ width: 300 }} />
                      ) : (
                        ato.descricao
                      )}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: 8 }}>
                      {editIndex === idx ? (
                        <input
                          name="valor_final"
                          value={editAto.valor_final}
                          onChange={handleEditChange}
                          type="number"
                          step="0.01"
                        />
                      ) : (
                        `R$ ${Number(ato.valor_final).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      )}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: 8 }}>{ato.origem}</td>
                    <td style={{ border: '1px solid #ddd', padding: 8 }}>
                      {editIndex === idx ? (
                        <>
                          <button onClick={handleEditSave} style={{ marginRight: 8 }}>Salvar</button>
                          <button onClick={() => setEditIndex(null)}>Cancelar</button>
                        </>
                      ) : (
                        <button onClick={() => handleEdit(idx)}>Editar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              onClick={handleSalvar}
              disabled={loading}
              style={{ padding: '10px 32px', background: '#388e3c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 18 }}
            >
              {loading ? 'Salvando...' : 'Salvar no Sistema'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ImportarAtos;