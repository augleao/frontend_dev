import React, { useEffect, useState } from 'react';
import config from '../../config';

export default function GerenciadorArquivosPDF() {
  const [path, setPath] = useState('');
  const [items, setItems] = useState([]); // { name, key, type: 'file'|'folder', size, url }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchList = async (p = '') => {
    setLoading(true);
    setError('');
    try {
      // Backend endpoint expected: GET /storage/list?path={path}
      // Adjust the endpoint to match your server implementation.
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/storage/list?path=${encodeURIComponent(p)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Erro ao listar arquivos.');
      }
      const j = await res.json();
      // Expecting { items: [ { name, key, type, size, url } ] }
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

  const enterFolder = (folderKey) => {
    // folderKey should be path-like (e.g., 'averbacoes/2025/11/')
    fetchList(folderKey);
  };

  const downloadItem = (it) => {
    // Backend expected: GET /storage/download?key={key}
    if (!it || !it.key) return;
    const token = localStorage.getItem('token');
    const url = `${config.apiURL}/storage/download?key=${encodeURIComponent(it.key)}`;
    // open in new tab (server should set Content-Disposition)
    window.open(url + (token ? `&token=${encodeURIComponent(token)}` : ''), '_blank', 'noopener');
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
      // refresh
      fetchList(path);
    } catch (e) {
      setError(e.message || 'Erro ao excluir');
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Gerenciador de Arquivos PDF</h2>
      <p style={{ color: '#666' }}>Navegue pelas pastas, baixe e exclua arquivos PDF armazenados.</p>
      <div style={{ margin: '12px 0' }}>
        <button onClick={() => fetchList('')}>Raiz</button>
        <span style={{ marginLeft: 12, color: '#333' }}>Caminho atual: {path || '/'}</span>
      </div>
      {error && <div style={{ color: 'crimson', marginBottom: 8 }}>{error}</div>}
      {loading ? (
        <div>Carregando...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: 8 }}>Nome</th>
              <th style={{ padding: 8, width: 160 }}>Tipo</th>
              <th style={{ padding: 8, width: 160 }}>Tamanho</th>
              <th style={{ padding: 8, width: 220 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 12 }}>Nenhum item encontrado.</td></tr>
            )}
            {items.map(it => (
              <tr key={it.key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: 8 }}>{it.name}</td>
                <td style={{ padding: 8 }}>{it.type}</td>
                <td style={{ padding: 8 }}>{it.size ? `${(it.size/1024).toFixed(1)} KB` : '-'}</td>
                <td style={{ padding: 8 }}>
                  {it.type === 'folder' ? (
                    <button onClick={() => enterFolder(it.key)} style={{ marginRight: 8 }}>Abrir</button>
                  ) : (
                    <>
                      <button onClick={() => downloadItem(it)} style={{ marginRight: 8 }}>Baixar</button>
                      <button onClick={() => deleteItem(it)} style={{ color: 'crimson' }}>Excluir</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ marginTop: 12 }}>
        <small style={{ color: '#666' }}>Observação: os endpoints backend esperados são <code>/storage/list</code>, <code>/storage/download</code> e <code>/storage?key=...</code> (DELETE). Ajuste se necessário.</small>
      </div>
    </div>
  );
}
