import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import config from '../../config';
import Toast from '../Toast';
import { DEFAULT_TOAST_DURATION } from '../toastConfig';

export default function AverbacaoManutencao() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdicao = Boolean(id);

  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    tipo: '',
    descricao: '',
    ressarcivel: false,
    observacoes: ''
  });
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const toastTimerRef = useRef(null);

  const showToast = (type, message) => {
    setToastType(type);
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
      toastTimerRef.current = null;
    }, DEFAULT_TOAST_DURATION);
  };

  useEffect(() => {
    if (!isEdicao) return;
    const fetchItem = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const item = data?.averbacao || data;
          setForm({
            data: (item.data || new Date().toISOString().slice(0, 10)).slice(0,10),
            tipo: item.tipo || '',
            descricao: item.descricao || '',
            ressarcivel: Boolean(item.ressarcivel),
            observacoes: item.observacoes || ''
          });
        }
      } catch (e) {}
      setLoading(false);
    };
    fetchItem();
  }, [id, isEdicao]);

  const salvar = async () => {
    try {
      const token = localStorage.getItem('token');
      const payload = { ...form };
      const url = isEdicao
        ? `${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(id)}`
        : `${config.apiURL}/averbacoes-gratuitas`;
      const method = isEdicao ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const t = await res.text();
        showToast('error', t || 'Erro ao salvar.');
        return;
      }
      showToast('success', 'Averbação salva com sucesso!');
      setTimeout(() => navigate('/averbacoes-gratuitas', { state: { message: 'Averbação salva com sucesso!', type: 'success' } }), 400);
    } catch (e) {
      showToast('error', 'Erro ao salvar.');
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{
        background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(44,62,80,0.12)', padding: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12
      }}>
        <h2 style={{ margin: 0 }}>{isEdicao ? 'Editar Averbação Gratuita' : 'Nova Averbação Gratuita'}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/averbacoes-gratuitas')} style={{ padding: '8px 12px' }}>Cancelar</button>
          <button onClick={salvar} style={{ background: '#27ae60', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600 }}>
            Salvar
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(44,62,80,0.12)', padding: 16 }}>
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <form onSubmit={e => { e.preventDefault(); salvar(); }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label>Data</label>
                <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label>Tipo</label>
                <input type="text" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} placeholder="Ex.: Averbação de casamento" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label>Ressarcível?</label>
                <select value={form.ressarcivel ? 'sim' : 'nao'} onChange={e => setForm(f => ({ ...f, ressarcivel: e.target.value === 'sim' }))}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label>Descrição</label>
              <textarea rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label>Observações</label>
              <textarea rows={3} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

