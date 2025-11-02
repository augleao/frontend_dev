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
    observacoes: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(isEdit);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
          observacoes: c.observacoes || c.justificativa || ''
        });
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
        observacoes: form.observacoes
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

            <div style={{ gridColumn: '1 / span 2', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Observações</label>
              <textarea
                value={form.observacoes}
                onChange={e => updateField('observacoes', e.target.value)}
                rows={6}
                placeholder="Observações, justificativa ou detalhes relevantes"
                style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '10px 12px', fontSize: 14, resize: 'vertical' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
