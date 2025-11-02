import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listarLegislacao, criarLegislacao, atualizarLegislacao, excluirLegislacao } from '../servicos/LegislacaoService';
import { DEFAULT_TOAST_DURATION } from '../toastConfig';

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: 'min(92vw, 900px)', boxShadow: '0 6px 30px rgba(0,0,0,0.2)' }}>
        {children}
      </div>
    </div>
  );
}

export default function LegislacaoAdmin() {
  const navigate = useNavigate();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [indexador, setIndexador] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ indexador: '', base_legal: '', titulo: '', artigo: '', jurisdicao: '', texto: '', ativo: true, tags: '' });

  const carregar = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listarLegislacao({ search, indexador, ativo: mostrarInativos ? undefined : true });
      setItens(res || []);
    } catch (e) {
      setError(e?.message || 'Erro ao carregar legislação');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onOpenNovo = () => {
    setEditItem(null);
    setForm({ indexador: '', base_legal: '', titulo: '', artigo: '', jurisdicao: '', texto: '', ativo: true, tags: '' });
    setModalOpen(true);
  };

  const onOpenEditar = (item) => {
    setEditItem(item);
    setForm({
      indexador: item.indexador || '',
      base_legal: item.base_legal || '',
      titulo: item.titulo || '',
      artigo: item.artigo || '',
      jurisdicao: item.jurisdicao || '',
      texto: item.texto || '',
      ativo: item.ativo !== false,
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || '')
    });
    setModalOpen(true);
  };

  const onSalvar = async () => {
    if (!form.indexador?.trim() || !form.base_legal?.trim() || !form.texto?.trim()) {
      alert('Preencha Indexador, Base Legal e Texto.');
      return;
    }
    const payload = {
      indexador: form.indexador.trim(),
      base_legal: form.base_legal.trim(),
      titulo: form.titulo?.trim() || null,
      artigo: form.artigo?.trim() || null,
      jurisdicao: form.jurisdicao?.trim() || null,
      texto: form.texto,
      ativo: !!form.ativo,
      // converter tags "a, b, c" -> ['a','b','c'] ignorando vazios
      tags: form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : []
    };
    try {
      setLoading(true);
      if (editItem?.id) await atualizarLegislacao(editItem.id, payload);
      else await criarLegislacao(payload);
      setModalOpen(false);
      await carregar();
      setTimeout(() => {}, DEFAULT_TOAST_DURATION); // placeholder para manter padrão de UX
    } catch (e) {
      alert(e?.message || 'Falha ao salvar legislação');
    } finally {
      setLoading(false);
    }
  };

  const onExcluir = async (item) => {
    if (!window.confirm('Confirma excluir este item?')) return;
    try {
      setLoading(true);
      await excluirLegislacao(item.id);
      await carregar();
    } catch (e) {
      alert(e?.message || 'Falha ao excluir legislação');
    } finally {
      setLoading(false);
    }
  };

  const itensFiltrados = useMemo(() => itens, [itens]);

  return (
    <div style={{ maxWidth: 1200, margin: '40px auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => navigate('/admin')}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#f8f9fa', cursor: 'pointer' }}
          >
            ← Voltar
          </button>
          <h2 style={{ margin: 0 }}>Legislação (Admin)</h2>
        </div>
        <div>
          <button
            onClick={onOpenNovo}
            style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#1976d2', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            + Novo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          placeholder="Buscar (termos do texto/base/artigo)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 260, padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd' }}
        />
        <input
          placeholder="Indexador (ex.: averbacao_divorcio)"
          value={indexador}
          onChange={(e) => setIndexador(e.target.value)}
          style={{ width: 260, padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd' }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
          Mostrar inativos
        </label>
        <button onClick={carregar} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#16a085', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Buscar
        </button>
      </div>

      {/* Tabela */}
      <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #eee' }}>ID</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #eee' }}>Indexador</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #eee' }}>Base Legal</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #eee' }}>Artigo</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #eee' }}>Jurisd.</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #eee' }}>Ativo</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #eee' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 16 }}>Carregando…</td></tr>
            ) : itensFiltrados.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 16 }}>Nenhum registro</td></tr>
            ) : (
              itensFiltrados.map((it) => (
                <tr key={it.id}>
                  <td style={{ borderBottom: '1px solid #f2f2f2', padding: 10 }}>{it.id}</td>
                  <td style={{ borderBottom: '1px solid #f2f2f2', padding: 10 }}>{it.indexador}</td>
                  <td style={{ borderBottom: '1px solid #f2f2f2', padding: 10 }}>{it.base_legal}</td>
                  <td style={{ borderBottom: '1px solid #f2f2f2', padding: 10 }}>{it.artigo || '-'}</td>
                  <td style={{ borderBottom: '1px solid #f2f2f2', padding: 10 }}>{it.jurisdicao || '-'}</td>
                  <td style={{ borderBottom: '1px solid #f2f2f2', padding: 10 }}>{it.ativo ? 'Sim' : 'Não'}</td>
                  <td style={{ borderBottom: '1px solid #f2f2f2', padding: 10 }}>
                    <button onClick={() => onOpenEditar(it)} style={{ padding: '6px 10px', marginRight: 8, borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => onExcluir(it)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e57373', background: '#ffcdd2', color: '#b71c1c', cursor: 'pointer' }}>Excluir</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <h3 style={{ marginTop: 0 }}>{editItem ? 'Editar Legislação' : 'Nova Legislação'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Indexador*</label>
            <input
              placeholder="Ex.: averbacao_divorcio"
              value={form.indexador}
              onChange={(e) => setForm({ ...form, indexador: e.target.value })}
              style={{ border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Base Legal*</label>
            <input
              placeholder="Ex.: Lei X, Art. Y..."
              value={form.base_legal}
              onChange={(e) => setForm({ ...form, base_legal: e.target.value })}
              style={{ border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Título</label>
            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              style={{ border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Artigo</label>
            <input
              value={form.artigo}
              onChange={(e) => setForm({ ...form, artigo: e.target.value })}
              style={{ border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Jurisdição</label>
            <input
              value={form.jurisdicao}
              onChange={(e) => setForm({ ...form, jurisdicao: e.target.value })}
              style={{ border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Tags (separadas por vírgula)</label>
            <input
              placeholder="ex.: registros, civil, casamento"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              style={{ border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={!!form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Ativo
          </label>
          <div></div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Texto do dispositivo*</label>
            <textarea
              placeholder="Cole aqui o dispositivo legal (texto completo)"
              value={form.texto}
              onChange={(e) => setForm({ ...form, texto: e.target.value })}
              style={{ width: '100%', minHeight: 180, border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px' }}
            />
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={() => setModalOpen(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>Cancelar</button>
          <button onClick={onSalvar} disabled={loading} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#27ae60', color: '#fff', fontWeight: 700 }}>
            {loading ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
