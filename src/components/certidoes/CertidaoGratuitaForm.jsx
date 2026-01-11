import React, { useEffect, useMemo, useState } from 'react';
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
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{isEdit ? 'Editar Certidão Gratuita' : 'Nova Certidão Gratuita'}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/certidoes-gratuitas')}
            style={{ background: '#95a5a6', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}
          >
            Voltar
          </button>
          <button
            onClick={handleSave}
            disabled={loading || loadingInitial}
            style={{ background: '#27ae60', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', fontWeight: 600, cursor: loading || loadingInitial ? 'not-allowed' : 'pointer', opacity: loading || loadingInitial ? 0.7 : 1 }}
          >
            {isEdit ? 'Salvar Alterações' : 'Salvar' }
          </button>
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
              <label style={{ fontSize: 12, fontWeight: 600 }}>Requerente</label>
              <input
                type="text"
                value={form.requerente}
                onChange={e => updateField('requerente', e.target.value)}
                placeholder="Nome do requerente"
                style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '10px 12px', fontSize: 14 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Tipo de Certidão</label>
              <input
                type="text"
                value={form.tipo}
                onChange={e => updateField('tipo', e.target.value)}
                placeholder="Ex.: Nascimento, Casamento, Óbito ..."
                style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '10px 12px', fontSize: 14 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Status</label>
              <select
                value={form.status}
                onChange={e => updateField('status', e.target.value)}
                style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '10px 12px', fontSize: 14 }}
              >
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="EMITIDA">Emitida</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Nome do Registrado</label>
              <input
                type="text"
                value={form.registrado}
                onChange={e => updateField('registrado', e.target.value)}
                placeholder="Nome do Registrado"
                style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '10px 12px', fontSize: 14 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Número do Livro</label>
                <input type="text" value={form.livro} onChange={e => updateField('livro', e.target.value)} placeholder="Livro" style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '10px 12px' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Número da Folha</label>
                <input type="text" value={form.folha} onChange={e => updateField('folha', e.target.value)} placeholder="Folha" style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '10px 12px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Número do Termo</label>
                <input type="text" value={form.termo} onChange={e => updateField('termo', e.target.value)} placeholder="Termo" style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '10px 12px' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Data de Emissão</label>
                <input type="date" value={form.data_emissao} onChange={e => updateField('data_emissao', e.target.value)} style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '10px 12px' }} />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Observações</label>
              <textarea
                value={form.observacoes}
                onChange={e => updateField('observacoes', e.target.value)}
                rows={6}
                placeholder="Observações, justificativa ou detalhes relevantes"
                style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '10px 12px', fontSize: 14, resize: 'vertical' }}
              />
            </div>

            {/* Selos eletrônicos - seção baseada em ServicoExecucao.jsx */}
            <div style={{ gridColumn: '1 / -1', marginTop: 6 }}>
              <h4 style={{ color: '#2c3e50', marginBottom: 8 }}>Selos Utilizados neste Pedido</h4>

              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <input value={newSelo.selo_consulta} onChange={e => setNewSelo({ ...newSelo, selo_consulta: e.target.value })} placeholder="Selo" style={{ padding: '8px 10px', borderRadius: 6, border: '1.5px solid #bdc3c7' }} />
                <input value={newSelo.codigo_seguranca} onChange={e => setNewSelo({ ...newSelo, codigo_seguranca: e.target.value })} placeholder="Código de Segurança" style={{ padding: '8px 10px', borderRadius: 6, border: '1.5px solid #bdc3c7' }} />
                <input value={newSelo.qtd_atos} onChange={e => setNewSelo({ ...newSelo, qtd_atos: e.target.value })} placeholder="Qtd. Atos" style={{ width: 100, padding: '8px 10px', borderRadius: 6, border: '1.5px solid #bdc3c7' }} />
                <input value={newSelo.atos_praticados_por} onChange={e => setNewSelo({ ...newSelo, atos_praticados_por: e.target.value })} placeholder="Praticado por" style={{ padding: '8px 10px', borderRadius: 6, border: '1.5px solid #bdc3c7' }} />
                <input value={newSelo.valores} onChange={e => setNewSelo({ ...newSelo, valores: e.target.value })} placeholder="Valores" style={{ padding: '8px 10px', borderRadius: 6, border: '1.5px solid #bdc3c7', flex: 1, minWidth: 180 }} />
                <button onClick={() => {
                  if (!newSelo.selo_consulta && !newSelo.codigo_seguranca) return;
                  setSelos(prev => [{ ...newSelo, criado_em: new Date().toISOString(), id: Math.random().toString(36).slice(2) }, ...prev]);
                  setNewSelo({ selo_consulta: '', codigo_seguranca: '', qtd_atos: '', atos_praticados_por: '', valores: '' });
                }} style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Adicionar Selo</button>
              </div>

              {selos.length > 0 ? (
                <div className="servico-table-container" style={{ overflowX: 'auto' }}>
                  <table className="servico-table" style={{ width: '100%', background: '#fff', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#e1e9ff' }}>
                        <th style={{ padding: 6, fontSize: 12, color: '#2c3e50' }}>Selo Consulta</th>
                        <th style={{ padding: 6, fontSize: 12, color: '#2c3e50' }}>Código de Segurança</th>
                        <th style={{ padding: 6, fontSize: 12, color: '#2c3e50' }}>Qtd. Atos</th>
                        <th style={{ padding: 6, fontSize: 12, color: '#2c3e50' }}>Atos praticados por</th>
                        <th style={{ padding: 6, fontSize: 12, color: '#2c3e50' }}>Valores</th>
                        <th style={{ padding: 6, fontSize: 12, color: '#2c3e50' }}>Data/Hora</th>
                        <th style={{ padding: 6, fontSize: 12, color: '#2c3e50' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selos.map((selo, idx) => (
                        <tr key={selo.id || idx} style={{ background: idx % 2 === 0 ? '#f7fbff' : '#fff' }}>
                          <td style={{ padding: 6, fontSize: 12 }}>{selo.selo_consulta || ''}</td>
                          <td style={{ padding: 6, fontSize: 12 }}>{selo.codigo_seguranca || ''}</td>
                          <td style={{ padding: 6, fontSize: 12 }}>{selo.qtd_atos || ''}</td>
                          <td style={{ padding: 6, fontSize: 12 }}>{selo.atos_praticados_por || ''}</td>
                          <td style={{ padding: 6, fontSize: 12 }}>{selo.valores || ''}</td>
                          <td style={{ padding: 6, fontSize: 12 }}>{selo.criado_em ? new Date(selo.criado_em).toLocaleString() : ''}</td>
                          <td style={{ padding: 6, fontSize: 12 }}>
                            <button onClick={() => setSelos(prev => prev.filter(s => s.id !== selo.id))} style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 8px', cursor: 'pointer' }}>Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: '#7f8c8d' }}>Nenhum selo adicionado.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
