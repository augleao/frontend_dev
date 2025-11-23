import React, { useEffect, useState, useMemo } from 'react';
import config from '../../config';

export default function GerenciadorArquivosPDF() {
  const [path, setPath] = useState('');
  const [items, setItems] = useState([]); // { name, key, type: 'file'|'folder', size, url }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const fetchList = async (p = '') => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/storage/list?path=${encodeURIComponent(p)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Erro ao listar arquivos.');
      }
      const j = await res.json();
      setItems(Array.isArray(j.items) ? j.items : []);
      setPath(p || '');
    } catch (e) {
      setError(e.message || 'Erro inesperado');
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchList('');
  }, []);

  const enterFolder = (folderKey) => { fetchList(folderKey); };

  const downloadItem = (it) => {
    if (!it || !it.key) return;
    const token = localStorage.getItem('token');
    const url = `${config.apiURL}/storage/download?key=${encodeURIComponent(it.key)}`;
    window.open(url + (token ? `&token=${encodeURIComponent(token)}` : ''), '_blank', 'noopener');
  };

  const openItem = (it) => {
    if (!it || !it.key) return;
    const token = localStorage.getItem('token');
    // prefer direct url if provided, otherwise hit download endpoint (may force download)
    const base = it.url ? it.url : `${config.apiURL}/storage/download?key=${encodeURIComponent(it.key)}`;
    const url = base + (token && !base.includes('?') ? `?token=${encodeURIComponent(token)}` : (token ? `&token=${encodeURIComponent(token)}` : ''));
    window.open(url, '_blank', 'noopener');
  };

  const downloadFolder = async (it) => {
    if (!it || !it.key) return;
    try {
      const token = localStorage.getItem('token');
      const url = `${config.apiURL}/storage/download?key=${encodeURIComponent(it.key)}&archive=true`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Erro ao baixar pasta.');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      let filename = `${it.name}.zip`;
      const m = /filename\*=UTF-8''(.+)$/.exec(disposition) || /filename="?([^";]+)"?/.exec(disposition);
      if (m && m[1]) {
        try { filename = decodeURIComponent(m[1]); } catch (_) { filename = m[1]; }
      }
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setError(e.message || 'Erro ao baixar pasta');
    }
  };

  const downloadAllFolder = async (it) => {
    // alias for downloadFolder (keeps semantic name)
    return downloadFolder(it);
  };

  const deleteItem = async (it) => {
    if (!it || !it.key) return;
    if (!window.confirm(`Deseja realmente excluir ${it.name}?`)) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/storage?key=${encodeURIComponent(it.key)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Erro ao excluir');
      }
      fetchList(path);
    } catch (e) {
      setError(e.message || 'Erro ao excluir');
    }
  };

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => String(it.name || '').toLowerCase().includes(q));
  }, [items, query]);

  const crumbs = useMemo(() => {
    if (!path) return [];
    const parts = path.split('/').filter(Boolean);
    const out = [];
    let acc = '';
    parts.forEach(p => {
      acc = acc ? `${acc}${p}/` : `${p}/`;
      out.push({ label: p, path: acc });
    });
    return out;
  }, [path]);

  return (
    <div style={{ minHeight: '100vh', padding: 16, fontFamily: 'Inter, system-ui, -apple-system, sans-serif', background: '#f6f8fb' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: '#243341' }}>📁 Gerenciador de Arquivos PDF</h1>
            <div style={{ color: '#6b7280', fontSize: 13 }}>Navegue, visualize, baixe e gerencie arquivos armazenados.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              aria-label="Buscar arquivos"
              placeholder="Pesquisar por nome..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e6edf3', width: 320, boxShadow: '0 2px 8px rgba(16,24,40,0.04)' }}
            />
            <button onClick={() => fetchList('')} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#0ea5a4', color: 'white', cursor: 'pointer' }}>Raiz</button>
            <button onClick={() => {
              if (!path) return; let p = path.endsWith('/') ? path.slice(0, -1) : path; const idx = p.lastIndexOf('/'); if (idx === -1) { fetchList(''); } else { const parent = p.slice(0, idx + 1); fetchList(parent); }
            }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e6edf3', background: 'white', cursor: 'pointer' }}>Voltar</button>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#9aa4af' }}>Local:</span>
          <button onClick={() => fetchList('')} style={{ background: 'transparent', border: 'none', color: '#0ea5a4', cursor: 'pointer' }}>/</button>
          {crumbs.map((c, idx) => (
            <React.Fragment key={c.path}>
              <span style={{ color: '#9aa4af' }}>{'>'}</span>
              <button onClick={() => fetchList(c.path)} style={{ background: 'transparent', border: 'none', color: '#243341', cursor: 'pointer', fontWeight: 600 }}>{c.label}</button>
            </React.Fragment>
          ))}
        </div>

        {/* Bulk actions for current folder (only when inside a folder and more than 1 file present) */}
        {path && (() => {
          const fileCount = Array.isArray(items) ? items.filter(i => i.type === 'file').length : 0;
          if (fileCount > 1) {
            const folderName = path.endsWith('/') ? path.slice(0, -1).split('/').pop() : path.split('/').pop();
            return (
              <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => downloadFolder({ key: path, name: folderName })}
                  style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#0b74ff', color: 'white', cursor: 'pointer' }}
                >
                  Baixar tudo ({fileCount})
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Deseja realmente excluir TODOS os arquivos dentro de "${folderName}"? Esta ação é irreversível.`)) return;
                    try {
                      const token = localStorage.getItem('token');
                      const res = await fetch(`${config.apiURL}/storage?key=${encodeURIComponent(path)}&recursive=true`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                      if (!res.ok) {
                        const t = await res.text().catch(() => '');
                        throw new Error(t || 'Erro ao excluir todos');
                      }
                      // after deletion, navigate to parent
                      let p = path.endsWith('/') ? path.slice(0, -1) : path;
                      const idx = p.lastIndexOf('/');
                      const parent = idx === -1 ? '' : p.slice(0, idx + 1);
                      fetchList(parent);
                    } catch (e) {
                      setError(e.message || 'Erro ao excluir todos');
                    }
                  }}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #fdecea', background: '#fff5f5', color: '#c53030', cursor: 'pointer' }}
                >
                  Excluir tudo
                </button>
              </div>
            );
          }
          return null;
        })()}

        {/* Error */}
        {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}

        {/* Grid of items */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: 'white', padding: 12, borderRadius: 10, boxShadow: '0 6px 20px rgba(16,24,40,0.06)' }}>
                <div style={{ height: 14, background: '#eef2f7', borderRadius: 6, width: '70%', marginBottom: 8 }} />
                <div style={{ height: 10, background: '#f3f6fb', borderRadius: 6, width: '40%', marginBottom: 10 }} />
                <div style={{ height: 10, background: '#f3f6fb', borderRadius: 6, width: '50%' }} />
              </div>
            ))
          ) : (
            filtered.length === 0 ? (
              <div style={{ gridColumn: '1/-1', padding: 24, background: 'white', borderRadius: 10, textAlign: 'center', boxShadow: '0 6px 20px rgba(16,24,40,0.04)' }}>Nenhum item encontrado.</div>
            ) : (
              filtered.map(it => (
                <div key={it.key} style={{ background: 'white', padding: 14, borderRadius: 10, boxShadow: '0 6px 20px rgba(16,24,40,0.04)', display: 'flex', flexDirection: 'column', gap: 8, transition: 'transform 0.12s ease', cursor: 'default' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: it.type === 'folder' ? '#e6f4f1' : '#eef2fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                        {it.type === 'folder' ? '📁' : '📄'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#233240', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                        <div style={{ fontSize: 12, color: '#7b8794' }}>{it.type} • {it.size ? `${(it.size/1024).toFixed(1)} KB` : '-'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {it.type === 'folder' ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button onClick={() => enterFolder(it.key)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#0ea5a4', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}>Abrir</button>
                          <button onClick={async () => {
                            if (!window.confirm(`Deseja realmente excluir TODOS os arquivos dentro de "${it.name}"? Esta ação é irreversível.`)) return;
                            try {
                              const token = localStorage.getItem('token');
                              const res = await fetch(`${config.apiURL}/storage?key=${encodeURIComponent(it.key)}&recursive=true`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                              if (!res.ok) {
                                const t = await res.text().catch(() => '');
                                throw new Error(t || 'Erro ao excluir todos');
                              }
                              // refresh list (stay in same parent)
                              let p = path.endsWith('/') ? path.slice(0, -1) : path;
                              const idx = p.lastIndexOf('/');
                              const parent = idx === -1 ? '' : p.slice(0, idx + 1);
                              fetchList(parent);
                            } catch (e) {
                              setError(e.message || 'Erro ao excluir todos');
                            }
                          }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fdecea', background: '#fff5f5', color: '#c53030', cursor: 'pointer', whiteSpace: 'nowrap' }}>Excluir tudo</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button onClick={() => openItem(it)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e6edf3', background: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}>Abrir</button>
                          <button onClick={() => downloadItem(it)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}>Baixar</button>
                          <button onClick={() => deleteItem(it)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fdecea', background: '#fff5f5', color: '#c53030', cursor: 'pointer', whiteSpace: 'nowrap' }}>Excluir</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}
