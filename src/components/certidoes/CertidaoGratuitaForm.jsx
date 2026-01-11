import React, { useEffect, useMemo, useState } from 'react';
import { atualizarSeloExecucaoServico } from '../servicos/ServicoSeloService';
import ClipboardImageUpload from '../servicos/ClipboardImageUpload';
import SeloFileUpload from '../servicos/SeloFileUpload';
import './certidao.css';
import { useNavigate, useParams } from 'react-router-dom';
import config from '../../config';

export default function CertidaoGratuitaForm() {
  const { id } = useParams(); // protocolo/id quando em edição
  const isEdit = useMemo(() => Boolean(id), [id]);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    requerente: '',
    tipo: '',
    status: 'EM_ANDAMENTO',
    observacoes: '',
    registrado: '',
    livro: '',
    folha: '',
    termo: '',
    data_emissao: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(isEdit);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selos, setSelos] = useState([]);
  const [newSelo, setNewSelo] = useState({ selo_consulta: '', codigo_seguranca: '', qtd_atos: '', atos_praticados_por: '', valores: '' });
  const [editingSeloId, setEditingSeloId] = useState(null);
  const [editSelo, setEditSelo] = useState({});

  const palette = {
    primary: '#1d4ed8',
    primaryDark: '#1e3a8a',
    softBg: '#eef5ff',
    softBorder: '#d6e4ff',
    text: '#0f172a'
  };

  useEffect(() => {
    async function fetchExisting() {
      if (!isEdit) return;
      setLoadingInitial(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${config.apiURL}/certidoes-gratuitas/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Falha ao carregar a certidão.');
        const data = await res.json();
        const c = data.certidao || data || {};
        setForm({
          requerente: c.requerente?.nome || c.requerente || '',
          tipo: c.tipo || c.tipo_certidao || '',
          status: c.status || c.situacao || 'EM_ANDAMENTO',
          observacoes: c.observacoes || c.justificativa || '',
          registrado: c.registrado || c.nome_registrado || '',
          livro: c.livro || c.numero_livro || '',
          folha: c.folha || c.numero_folha || '',
          termo: c.termo || c.numero_termo || '',
          data_emissao: c.data_emissao || c.dataEmissao || ''
        });
        setSelos(data.selos || c.selos || []);
      } catch (e) {
        setError(e.message || 'Erro ao carregar a certidão.');
      }
      setLoadingInitial(false);
    }
    fetchExisting();
  }, [id, isEdit]);

    // Buscar selos ao montar ou quando id mudar
    useEffect(() => {
      if (id) {
        const token = localStorage.getItem('token');
        fetch(`${config.apiURL}/selos-execucao-servico/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => setSelos(data.selos || []))
          .catch(() => setSelos([]));
      }
    }, [id]);

    const excluirSelo = async (selo) => {
      if (!window.confirm('Tem certeza que deseja excluir este selo?')) return;
      try {
        const token = localStorage.getItem('token');
        const execucaoId = id;
        if (!execucaoId || !selo.id) {
          alert('Dados insuficientes para exclusão.');
          return;
        }
        const res = await fetch(`${config.apiURL}/execucao-servico/${encodeURIComponent(execucaoId)}/selo/${selo.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert('Erro ao excluir selo: ' + (err.error || res.status));
          return;
        }
        setSelos(prev => prev.filter(s => s.id !== selo.id));
      } catch (err) {
        alert('Erro ao excluir selo.');
      }
    };

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function validate() {
    if (!form.requerente?.trim()) return 'Informe o nome do requerente.';
    if (!form.tipo?.trim()) return 'Informe o tipo de certidão.';
    return '';
  }

  async function handleSave() {
    setError('');
    setMessage('');
    const v = validate();
    if (v) { setError(v); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        requerente: form.requerente,
        tipo: form.tipo,
        status: form.status,
        observacoes: form.observacoes,
        registrado: form.registrado,
        livro: form.livro,
        folha: form.folha,
        termo: form.termo,
        data_emissao: form.data_emissao,
        selos
      };
      const url = isEdit
        ? `${config.apiURL}/certidoes-gratuitas/${encodeURIComponent(id)}`
        : `${config.apiURL}/certidoes-gratuitas`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'Falha ao salvar a certidão.');
      }
      setMessage('Certidão salva com sucesso.');
      // Retorna para a lista após breve intervalo
      setTimeout(() => navigate('/certidoes-gratuitas'), 600);
    } catch (e) {
      setError(e.message || 'Erro ao salvar a certidão.');
    }
    setLoading(false);
  }

  return (
    <div className="certidao-container">
      <div className="certidao-header">
        <h2 className="certidao-title">{isEdit ? 'Editar Certidão Gratuita' : 'Nova Certidão Gratuita'}</h2>
        <div className="certidao-actions">
          <button onClick={() => navigate('/certidoes-gratuitas')} className="btn btn-secondary">Voltar</button>
          <button onClick={handleSave} disabled={loading || loadingInitial} className="btn btn-primary">{isEdit ? 'Salvar Alterações' : 'Salvar'}</button>
        </div>
      </div>

      {(error || message) && (
        <div style={{ marginBottom: 12 }}>
          {error && (
            <div style={{ background: '#fdecea', color: '#c0392b', border: '1px solid #e74c3c', padding: '10px 12px', borderRadius: 6 }}>{error}</div>
          )}
          {message && (
            <div style={{ background: '#eafaf1', color: '#27ae60', border: '1px solid #2ecc71', padding: '10px 12px', borderRadius: 6 }}>{message}</div>
          )}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(44,62,80,0.12)' }}>
        {loadingInitial ? (
          <div style={{ color: '#7f8c8d' }}>Carregando informações...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="field-label">Requerente</label>
              <input
                className="certidao-input"
                type="text"
                value={form.requerente}
                onChange={e => updateField('requerente', e.target.value)}
                placeholder="Nome do requerente"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="field-label">Tipo de Certidão</label>
              <input className="certidao-input" type="text" value={form.tipo} onChange={e => updateField('tipo', e.target.value)} placeholder="Ex.: Nascimento, Casamento, Óbito ..." />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="field-label">Status</label>
              <select className="certidao-select" value={form.status} onChange={e => updateField('status', e.target.value)}>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="EMITIDA">Emitida</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="field-label">Nome do Registrado</label>
              <input className="certidao-input" type="text" value={form.registrado} onChange={e => updateField('registrado', e.target.value)} placeholder="Nome do Registrado" />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="field-label">Número do Livro</label>
                <input className="certidao-input" type="text" value={form.livro} onChange={e => updateField('livro', e.target.value)} placeholder="Livro" />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="field-label">Número da Folha</label>
                <input className="certidao-input" type="text" value={form.folha} onChange={e => updateField('folha', e.target.value)} placeholder="Folha" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="field-label">Número do Termo</label>
                <input className="certidao-input" type="text" value={form.termo} onChange={e => updateField('termo', e.target.value)} placeholder="Termo" />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="field-label">Data de Emissão</label>
                <input className="certidao-input" type="date" value={form.data_emissao} onChange={e => updateField('data_emissao', e.target.value)} />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="field-label">Observações</label>
              <textarea className="certidao-textarea" value={form.observacoes} onChange={e => updateField('observacoes', e.target.value)} rows={6} placeholder="Observações, justificativa ou detalhes relevantes" />
            </div>

            {/* Selos eletrônicos - UI copiada de ServicoExecucao.jsx */}
            <div style={{ gridColumn: '1 / -1', marginTop: 6 }}>
              <h4 style={{ color: palette.primaryDark, marginBottom: 2 }}>Selos Utilizados neste Pedido</h4>

              {isEdit && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <ClipboardImageUpload
                    protocolo={id}
                    onUpload={() => {
                      if (id) {
                        const token = localStorage.getItem('token');
                        fetch(`${config.apiURL}/selos-execucao-servico/${encodeURIComponent(id)}`, {
                          headers: { Authorization: `Bearer ${token}` }
                        })
                          .then(res => res.json())
                          .then(data => setSelos(data.selos || []))
                          .catch(() => setSelos([]));
                      }
                    }}
                  />
                  <SeloFileUpload
                    protocolo={id}
                    onUpload={() => {
                      if (id) {
                        const token = localStorage.getItem('token');
                        fetch(`${config.apiURL}/selos-execucao-servico/${encodeURIComponent(id)}`, {
                          headers: { Authorization: `Bearer ${token}` }
                        })
                          .then(res => res.json())
                          .then(data => setSelos(data.selos || []))
                          .catch(() => setSelos([]));
                      }
                    }}
                  />
                </div>
              )}

              {isEdit && selos.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="servico-table-container">
                    <table className="servico-table" style={{ background: '#fff' }}>
                      <thead>
                        <tr style={{ background: '#e1e9ff' }}>
                          <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Selo Consulta</th>
                          <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Código de Segurança</th>
                          <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Qtd. Atos</th>
                          <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Atos praticados por</th>
                          <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Valores</th>
                          <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Data/Hora</th>
                          <th style={{ padding: 6, fontSize: 12, color: palette.primaryDark }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selos.map((selo, idx) => {
                          const isEditing = editingSeloId === selo.id;
                          return (
                            <tr key={selo.id || idx} style={{ background: idx % 2 === 0 ? palette.softBg : '#fff' }}>
                              <td style={{ padding: 2, fontSize: isEditing ? 13 : 12 }}>
                                {isEditing ? (
                                  <input value={editSelo.selo_consulta || ''} onChange={e => setEditSelo({ ...editSelo, selo_consulta: e.target.value })} style={{ width: 80, fontSize: 9, padding: '1px 2px' }} placeholder="Selo" />
                                ) : (
                                  <span style={{ fontSize: 11 }}>{selo.selo_consulta || selo.seloConsulta || ''}</span>
                                )}
                              </td>
                              <td style={{ padding: 2, fontSize: isEditing ? 13 : 12 }}>
                                {isEditing ? (
                                  <input value={editSelo.codigo_seguranca || ''} onChange={e => setEditSelo({ ...editSelo, codigo_seguranca: e.target.value })} style={{ width: 120, fontSize: 9, padding: '1px 2px' }} placeholder="Código" />
                                ) : (
                                  <span style={{ fontSize: 11 }}>{selo.codigo_seguranca || selo.codigoSeguranca || ''}</span>
                                )}
                              </td>
                              <td style={{ padding: 2, fontSize: isEditing ? 13 : 12 }}>
                                {isEditing ? (
                                  <input value={editSelo.qtd_atos || ''} onChange={e => setEditSelo({ ...editSelo, qtd_atos: e.target.value })} style={{ width: 40, fontSize: 9, padding: '1px 2px' }} placeholder="Qtd" />
                                ) : (
                                  <span style={{ fontSize: 11 }}>{selo.qtd_atos || selo.qtdAtos || ''}</span>
                                )}
                              </td>
                              <td style={{ padding: 2, fontSize: isEditing ? 13 : 12 }}>
                                {isEditing ? (
                                  <input value={editSelo.atos_praticados_por || ''} onChange={e => setEditSelo({ ...editSelo, atos_praticados_por: e.target.value })} style={{ width: 100, fontSize: 9, padding: '1px 2px' }} placeholder="Praticado por" />
                                ) : (
                                  <span style={{ fontSize: 11 }}>{selo.atos_praticados_por || selo.atosPraticadosPor || ''}</span>
                                )}
                              </td>
                              <td style={{ padding: 2, fontSize: isEditing ? 13 : 12 }}>
                                {isEditing ? (
                                  <input value={editSelo.valores || ''} onChange={e => setEditSelo({ ...editSelo, valores: e.target.value })} style={{ width: 320, fontSize: 9, padding: '1px 2px' }} placeholder="Valores" />
                                ) : (
                                  <span style={{ fontSize: 11 }}>{selo.valores || ''}</span>
                                )}
                              </td>
                              <td style={{ padding: 2, fontSize: 12 }}>{selo.criado_em ? new Date(selo.criado_em).toLocaleString() : ''}</td>
                              <td style={{ padding: 2, fontSize: 12, display: 'flex', gap: 6 }}>
                                {isEditing ? (
                                  <>
                                    <button
                                      style={{ background: '#388e3c', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                      title="Salvar"
                                      onClick={async () => {
                                        try {
                                          await atualizarSeloExecucaoServico(selo.id, editSelo);
                                          setSelos(prevSelos => prevSelos.map(s => s.id === selo.id ? { ...s, ...editSelo } : s));
                                          setEditingSeloId(null);
                                          setEditSelo({});
                                        } catch (error) {
                                          alert('Erro ao salvar selo: ' + error.message);
                                        }
                                      }}
                                    >Salvar</button>
                                    <button
                                      style={{ background: '#aaa', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                      title="Cancelar"
                                      onClick={() => { setEditingSeloId(null); setEditSelo({}); }}
                                    >Cancelar</button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                      title="Editar selo"
                                      onClick={() => { setEditingSeloId(selo.id); setEditSelo({ ...selo }); }}
                                    >Editar</button>
                                    <button
                                      style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                      title="Excluir selo"
                                      onClick={() => excluirSelo(selo)}
                                    >Excluir</button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {!isEdit && selos.length === 0 && (
                <div style={{ color: '#7f8c8d' }}>Nenhum selo adicionado.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
