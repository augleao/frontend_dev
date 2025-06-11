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
      console.log('Resposta do backend:', data);
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
        // Limpa os arquivos selecionados
        setTabela07(null);
        setTabela08(null);
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
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            Tabela 07 (PDF):
          </label>
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={e => handleFileChange(e, '07')}
            style={{ padding: 8, border: '1px solid #ddd', borderRadius: 4, width: '100%', maxWidth: 400 }}
          />
          {tabela07 && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Arquivo selecionado: {tabela07.name}</div>}
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            Tabela 08 (PDF):
          </label>
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={e => handleFileChange(e, '08')}
            style={{ padding: 8, border: '1px solid #ddd', borderRadius: 4, width: '100%', maxWidth: 400 }}
          />
          {tabela08 && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Arquivo selecionado: {tabela08.name}</div>}
        </div>
        
        <button
          onClick={handleUpload}
          disabled={loading || !tabela07 || !tabela08}
          style={{ 
            marginTop: 16, 
            padding: '12px 24px', 
            background: loading || !tabela07 || !tabela08 ? '#ccc' : '#1976d2', 
            color: '#fff', 
            border: 'none', 
            borderRadius: 8, 
            cursor: loading || !tabela07 || !tabela08 ? 'not-allowed' : 'pointer', 
            fontWeight: 'bold',
            fontSize: 16
          }}
        >
          {loading ? 'Processando...' : 'Extrair Atos'}
        </button>
      </div>
      
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
      
      {atos.length > 0 && (
        <>
          <h3 style={{ marginBottom: 16 }}>Atos extraídos ({atos.length} encontrados)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fafafa' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ border: '1px solid #ddd', padding: 12, textAlign: 'left' }}>Código</th>
                  <th style={{ border: '1px solid #ddd', padding: 12, textAlign: 'left' }}>Descrição</th>
                  <th style={{ border: '1px solid #ddd', padding: 12, textAlign: 'left' }}>Valor Final</th>
                  <th style={{ border: '1px solid #ddd', padding: 12, textAlign: 'left' }}>Origem</th>
                  <th style={{ border: '1px solid #ddd', padding: 12, textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {atos.map((ato, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
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
                          name="valor_final"
                          value={editAto.valor_final}
                          onChange={handleEditChange}
                          type="number"
                          step="0.01"
                          style={{ width: '100%', padding: 4, border: '1px solid #ccc', borderRadius: 4 }}
                        />
                      ) : (
                        `R$ ${Number(ato.valor_final).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      )}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: 12 }}>{ato.origem}</td>
                    <td style={{ border: '1px solid #ddd', padding: 12, textAlign: 'center' }}>
                      {editIndex === idx ? (
                        <>
                          <button 
                            onClick={handleEditSave} 
                            style={{ marginRight: 8, padding: '4px 8px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Salvar
                          </button>
                          <button 
                            onClick={() => setEditIndex(null)}
                            style={{ padding: '4px 8px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => handleEdit(idx)}
                          style={{ padding: '4px 8px', background: '#2196f3', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Editar
                        </button>
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
              style={{ 
                padding: '12px 32px', 
                background: loading ? '#ccc' : '#388e3c', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 8, 
                cursor: loading ? 'not-allowed' : 'pointer', 
                fontWeight: 'bold', 
                fontSize: 18 
              }}
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