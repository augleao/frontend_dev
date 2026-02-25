import React, { useState, useEffect } from 'react';
import { apiURL } from './config';
import './components/admin/AtosTabelaManager.css';

function ImportarAtos() {
  const [atos, setAtos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [editIndex, setEditIndex] = useState(null);
  const [editAto, setEditAto] = useState({});
  const [novoAto, setNovoAto] = useState({ codigo: '', descricao: '', emol_bruto: '', recompe: '', emol_liquido: '', issqn: '', taxa_fiscal: '', valor_final: '' });

  const actionGroupStyle = { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' };

  // validação semelhante à usada em AtosTabelaManager
  const round2 = (value) => {
    if (!Number.isFinite(value)) return NaN;
    return Number(value.toFixed(2));
  };
  const almostEqual = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(round2(a) - round2(b)) < 0.01;
  const ALWAYS_VALID_CODES = new Set(['7110', '7120', '7130']);
  const validateRowLocal = (row) => {
    const codigo = String(row.codigo ?? '').trim();
    const emolBruto = parseFloat(row.emol_bruto);
    const recompe = parseFloat(row.recompe);
    const emolLiquido = parseFloat(row.emol_liquido);
    const issqn = parseFloat(row.issqn);
    const taxaFiscal = parseFloat(row.taxa_fiscal) || 0;
    const valorFinal = parseFloat(row.valor_final);

    if (!Number.isFinite(emolBruto)) return { ok: false, motivo: 'Emol. bruto ausente' };

    const isJuizDePaz = ['11', '12', '13'].includes(codigo);
    const recompeCalc = isJuizDePaz ? 0 : round2(emolBruto * 0.07);
    const emolLiquidoCalc = isJuizDePaz ? round2(emolBruto) : round2(emolBruto - recompeCalc);
    const issqnCalc = isJuizDePaz ? 0 : round2(emolLiquidoCalc * 0.03);
    const valorFinalCalc = isJuizDePaz
      ? round2(emolBruto)
      : round2(recompeCalc + emolLiquidoCalc + issqnCalc + (Number.isFinite(taxaFiscal) ? taxaFiscal : 0));

    const fieldMismatch = {
      recompe: !almostEqual(recompe, recompeCalc),
      emolLiquido: !almostEqual(emolLiquido, emolLiquidoCalc),
      issqn: !almostEqual(issqn, issqnCalc),
      valorFinal: !almostEqual(valorFinal, valorFinalCalc)
    };

    const ok = !fieldMismatch.recompe && !fieldMismatch.emolLiquido && !fieldMismatch.issqn && !fieldMismatch.valorFinal;
    return { ok, esperado: { recompeCalc, emolLiquidoCalc, issqnCalc, valorFinalCalc }, fields: fieldMismatch };
  };
  const [validationResults, setValidationResults] = useState({});

  // Busca os atos do backend ao montar o componente
  // Função para buscar atos do backend
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
        // computa validações ao carregar
        const results = {};
        (data.atos || []).forEach((r) => {
          const codeStr = String(r.codigo ?? '').trim();
          if (ALWAYS_VALID_CODES.has(codeStr)) {
            results[r.codigo] = { ok: true, fields: {} };
          } else {
            results[r.codigo] = validateRowLocal(r);
          }
        });
        setValidationResults(results);
      } else {
        setMsg(data.message || 'Erro ao carregar atos.');
      }
    } catch (err) {
      setMsg('Erro ao carregar atos.');
    }
    setLoading(false);
  };
  useEffect(() => {
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
      // Log do payload enviado (mascarando token)
      console.log('➡️ [ImportarAtos] PUT', `${apiURL}/atos/${editAto.id}`, { payload: editAto, tokenPresent: !!token });
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
      setMsg('Ato salvo com sucesso!');
      await fetchAtos(); // Recarrega a lista após salvar (recalcula validação)
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
        // Log do payload por ato
        console.log('➡️ [ImportarAtos] PUT (batch)', `${apiURL}/atos/${ato.id}`, { payload: ato, tokenPresent: !!token });
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
      // recarrega e recalcula validações
      await fetchAtos();
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
      // Log do payload de criação
      console.log('➡️ [ImportarAtos] POST', `${apiURL}/atos`, { payload: novoAto, tokenPresent: !!token });
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
      <h2>Tabelas 07 e 08 em uso (TJMG)</h2>

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
      <div className="atm-card" style={{ marginBottom: 20 }}>
        <div className="atm-card-head">
          <h3>Inserir Novo Ato</h3>
          <p style={{ margin: 0, color: 'var(--atm-muted)' }}>Preencha os campos e clique em cadastrar.</p>
        </div>
        <form className="atm-form" onSubmit={handleNovoAtoSubmit}>
          <label>
            Emol. bruto
            <input type="number" step="0.01" name="emol_bruto" value={novoAto.emol_bruto} onChange={handleNovoAtoChange} />
          </label>
          <label>
            Recompe
            <input type="number" step="0.01" name="recompe" value={novoAto.recompe} onChange={handleNovoAtoChange} />
          </label>
          <label>
            Emol. líquido
            <input type="number" step="0.01" name="emol_liquido" value={novoAto.emol_liquido} onChange={handleNovoAtoChange} />
          </label>
          <label>
            ISSQN
            <input type="number" step="0.01" name="issqn" value={novoAto.issqn} onChange={handleNovoAtoChange} />
          </label>
          <label>
            TFJ
            <input type="number" step="0.01" name="taxa_fiscal" value={novoAto.taxa_fiscal} onChange={handleNovoAtoChange} />
          </label>
          <label>
            Valor final
            <input type="number" step="0.01" name="valor_final" value={novoAto.valor_final} onChange={handleNovoAtoChange} />
          </label>
          <label>
            Código
            <input type="text" name="codigo" value={novoAto.codigo} onChange={handleNovoAtoChange} required />
          </label>
          <label>
            Descrição
            <textarea name="descricao" value={novoAto.descricao} onChange={handleNovoAtoChange} required />
          </label>
          <button type="submit" className="btn-gradient btn-gradient-green" disabled={loading}>
            {loading ? 'Cadastrando...' : 'Cadastrar Ato'}
          </button>
        </form>
      </div>

      {atos.length > 0 && (
        <>
          <section className="atm-preview">
            <div className="atm-preview-table">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Emol. bruto</th>
                  <th>Recompe</th>
                  <th>Emol. líquido</th>
                  <th>ISSQN</th>
                  <th>TFJ</th>
                  <th>Valor final</th>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {atos.map((ato, idx) => {
                  if (!ato) return null;
                  const validation = validationResults[String(ato.codigo)];
                  const rowClass = validation?.ok === true ? 'atm-row-valid' : validation?.ok === false ? 'atm-row-invalid' : '';
                  return (
                    <tr key={ato.id} className={rowClass}>
                      <td style={{ border: '1px solid rgba(4,17,27,0.08)', padding: 12 }}>
                        {editIndex === idx ? (
                          <input name="emol_bruto" value={editAto.emol_bruto || ''} onChange={handleEditChange} type="number" step="0.01" />
                        ) : (
                          ato.emol_bruto !== null && ato.emol_bruto !== undefined ? `R$ ${Number(ato.emol_bruto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
                        )}
                      </td>
                      <td style={{ border: '1px solid rgba(4,17,27,0.08)', padding: 12 }}>
                        {editIndex === idx ? (
                          <input name="recompe" value={editAto.recompe || ''} onChange={handleEditChange} type="number" step="0.01" />
                        ) : (
                          ato.recompe !== null && ato.recompe !== undefined ? `R$ ${Number(ato.recompe).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
                        )}
                      </td>
                      <td style={{ border: '1px solid rgba(4,17,27,0.08)', padding: 12 }}>
                        {editIndex === idx ? (
                          <input name="emol_liquido" value={editAto.emol_liquido || ''} onChange={handleEditChange} type="number" step="0.01" />
                        ) : (
                          ato.emol_liquido !== null && ato.emol_liquido !== undefined ? `R$ ${Number(ato.emol_liquido).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
                        )}
                      </td>
                      <td style={{ border: '1px solid rgba(4,17,27,0.08)', padding: 12 }}>
                        {editIndex === idx ? (
                          <input name="issqn" value={editAto.issqn || ''} onChange={handleEditChange} type="number" step="0.01" />
                        ) : (
                          ato.issqn !== null && ato.issqn !== undefined ? `R$ ${Number(ato.issqn).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
                        )}
                      </td>
                      <td style={{ border: '1px solid rgba(4,17,27,0.08)', padding: 12 }}>
                        {editIndex === idx ? (
                          <input name="taxa_fiscal" value={editAto.taxa_fiscal || ''} onChange={handleEditChange} type="number" step="0.01" />
                        ) : (
                          ato.taxa_fiscal !== null && ato.taxa_fiscal !== undefined ? `R$ ${Number(ato.taxa_fiscal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
                        )}
                      </td>
                      <td style={{ border: '1px solid rgba(4,17,27,0.08)', padding: 12 }}>
                        {editIndex === idx ? (
                          <input name="valor_final" value={editAto.valor_final || ''} onChange={handleEditChange} type="number" step="0.01" />
                        ) : (
                          ato.valor_final !== null && ato.valor_final !== undefined ? `R$ ${Number(ato.valor_final).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
                        )}
                      </td>
                      <td style={{ border: '1px solid rgba(4,17,27,0.08)', padding: 12 }}>{ato.codigo}</td>
                      <td style={{ border: '1px solid rgba(4,17,27,0.08)', padding: 12 }}>
                        {editIndex === idx ? (
                          <textarea name="descricao" value={editAto.descricao || ''} onChange={handleEditChange} style={{ width: '100%', minHeight: 60 }} />
                        ) : (
                          ato.descricao || ''
                        )}
                      </td>
                      <td style={{ border: '1px solid rgba(4,17,27,0.08)', padding: 12, textAlign: 'center' }}>
                        {editIndex === idx ? (
                          <div style={actionGroupStyle}>
                            <button type="button" onClick={handleEditSave} className="btn-gradient btn-gradient-green btn-compact">Salvar</button>
                            <button type="button" onClick={() => setEditIndex(null)} className="btn-gradient btn-gradient-red btn-compact">Cancelar</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => handleEdit(idx)} className="btn-gradient btn-gradient-blue btn-compact">Editar</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </section>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={loading}
              className="btn-gradient btn-gradient-green"
            >
              {loading ? 'Salvando...' : 'Salvar todas alterações'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ImportarAtos;