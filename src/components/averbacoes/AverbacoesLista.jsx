import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import config from '../../config';
import Toast from '../Toast';
import { DEFAULT_TOAST_DURATION } from '../toastConfig';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

export default function AverbacoesLista() {
  const navigate = useNavigate();
  const location = useLocation();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [ressarcivel, setRessarcivel] = useState('todos'); // 'todos' | 'sim' | 'nao'
  const [tipoFiltro, setTipoFiltro] = useState('');
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
    const fetchLista = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const qs = [];
        if (dataInicial) qs.push(`dataInicial=${encodeURIComponent(dataInicial)}`);
        if (dataFinal) qs.push(`dataFinal=${encodeURIComponent(dataFinal)}`);
        if (ressarcivel === 'sim') qs.push('ressarcivel=true');
        if (ressarcivel === 'nao') qs.push('ressarcivel=false');
        if (tipoFiltro) qs.push(`tipo=${encodeURIComponent(tipoFiltro)}`);
        const query = qs.length ? `?${qs.join('&')}` : '';
        const res = await fetch(`${config.apiURL}/averbacoes-gratuitas${query}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setItens(Array.isArray(data?.averbacoes) ? data.averbacoes : (Array.isArray(data) ? data : []));
      } catch (e) {
        setItens([]);
        showToast('error', 'Erro ao carregar lista.');
      }
      setLoading(false);
    };
    fetchLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInicial, dataFinal, ressarcivel, tipoFiltro]);

  // Mostrar toast vindo de navegacao (ex: salvou na tela de manutencao)
  useEffect(() => {
    if (location.state?.message) {
      showToast(location.state?.type || 'success', location.state.message);
      // limpar state para não reaparecer em refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tiposDisponiveis = useMemo(() => {
    const setTipos = new Set((itens || []).map(i => i.tipo).filter(Boolean));
    return Array.from(setTipos).sort();
  }, [itens]);

  const handleExcluir = async (id) => {
    if (!id) return;
    if (!window.confirm('Deseja realmente excluir esta averbação gratuita?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(id)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setItens(prev => prev.filter(i => i.id !== id));
        showToast('success', 'Averbação excluída com sucesso!');
      } else {
        const t = await res.text();
        showToast('error', t || 'Erro ao excluir.');
      }
    } catch (e) {
      showToast('error', 'Erro ao excluir.');
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        padding: '8px 12px',
        background: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(44,62,80,0.12)'
      }}>
        <button
          onClick={() => navigate('/averbacoes-gratuitas/nova')}
          style={{
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(44,62,80,0.12)'
          }}
        >
          + NOVA AVERBAÇÃO GRATUITA
        </button>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Data Inicial</label>
            <input type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)}
              style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '6px 10px', fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Data Final</label>
            <input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)}
              style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '6px 10px', fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Ressarcível?</label>
            <select value={ressarcivel} onChange={e => setRessarcivel(e.target.value)}
              style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '6px 10px', fontSize: 14, minWidth: 140 }}>
              <option value="todos">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Tipo de Averbação</label>
            <input list="tipos-averbacao" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}
              placeholder="Digite ou escolha..."
              style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '6px 10px', fontSize: 14, minWidth: 220 }} />
            <datalist id="tipos-averbacao">
              {tiposDisponiveis.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </datalist>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, borderRadius: 12, background: '#f4f6f8', padding: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#e9ecef' }}>
              <th style={{ padding: 8 }}>Data</th>
              <th style={{ padding: 8 }}>Tipo</th>
              <th style={{ padding: 8 }}>Descrição</th>
              <th style={{ padding: 8 }}>Ressarcível</th>
              <th style={{ padding: 8 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#888' }}>Carregando...</td></tr>
            ) : itens.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#888' }}>Nenhuma averbação encontrada.</td></tr>
            ) : (
              itens.map(item => (
                <tr key={item.id} style={{ background: '#fff' }}>
                  <td style={{ padding: 8 }}>{formatDate(item.data || item.criado_em)}</td>
                  <td style={{ padding: 8 }}>{item.tipo || '-'}</td>
                  <td style={{ padding: 8 }}>{item.descricao || '-'}</td>
                  <td style={{ padding: 8 }}>{item.ressarcivel ? 'Sim' : 'Não'}</td>
                  <td style={{ padding: 8, display: 'flex', gap: 8 }}>
                    <button
                      style={{ background: '#3498db', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                      onClick={() => navigate(`/averbacoes-gratuitas/${encodeURIComponent(item.id)}/editar`)}
                    >
                      EDITAR
                    </button>
                    <button
                      style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                      onClick={() => handleExcluir(item.id)}
                    >
                      EXCLUIR
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
        {/* Toast de feedback */}
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
    </div>
  );
}
