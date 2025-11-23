import React, { useState } from 'react';

export default function AnexarPdfModal({ open, onClose, onSubmit, loading, pdfList = [], pdfInfo = {}, deletingUploadId = null, handleViewUpload = () => {}, handleDeleteUpload = () => {}, getMesReferencia = () => '', selectAndUploadFiles = () => {} }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  if (!open) return null;

  console.log('[AnexarPdfModal] Modal renderizado');

  const handleFileChange = (e) => {
    setError('');
    const f = e.target.files?.[0];
    if (!f) {
      console.log('[AnexarPdfModal] Nenhum arquivo selecionado');
      setFile(null);
      return;
    }
    if (f.type !== 'application/pdf') {
      setError('Selecione um arquivo PDF.');
      setFile(null);
      return;
    }
    console.log('[AnexarPdfModal] Arquivo selecionado', {
      nomeArquivo: f.name,
      tamanhoKB: Math.round(f.size / 1024)
    });
    setFile(f);
  };

  const handleSubmit = async () => {
    setError('');
    if (!file) {
      setError('Selecione um PDF para enviar.');
      return;
    }
    console.log('[AnexarPdfModal] Enviando arquivo selecionado');
    onSubmit?.(file);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(520px, 92vw)', padding: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#1f2937' }}>Anexar PDF da Averbação</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, color: '#64748b' }}>×</button>
        </div>

        <div style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: 16, background: '#f8fafc' }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#334155' }}>Selecione um arquivo PDF</div>
          <input type="file" accept="application/pdf" onChange={handleFileChange} />
          {file && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#334155' }}>
              Arquivo: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
            </div>
          )}
          {error && (
            <div style={{ marginTop: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>
          )}
        </div>

        {/* Table view of existing uploads (same visual as main manager) */}
        {(Array.isArray(pdfList) && pdfList.length > 0) && (
          <div style={{ marginTop: 12, background: 'white', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr style={{ background: '#f7fafc' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#2c3e50' }}>Nome</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#2c3e50' }}>Nome salvo</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#2c3e50' }}>Tamanho</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#2c3e50' }}>Tipo</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#2c3e50' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pdfList.map(p => (
                    <tr key={p.id || p.url} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#334155', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.originalName || p.storedName || (p.url ? decodeURIComponent(p.url.split('/').pop()) : '')}>{p.originalName || p.storedName || (p.url ? decodeURIComponent(p.url.split('/').pop()) : '')}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{p.storedName || ''}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b', textAlign: 'right' }}>{p.size ? `${Math.round(p.size/1024)} KB` : '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{p.contentType || '-'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                          <button type="button" onClick={() => handleViewUpload(p)} className="btn btn-sm btn-outline" style={{ padding: '6px 8px' }}>Exibir</button>
                          <button type="button" onClick={() => handleDeleteUpload(p.id)} disabled={deletingUploadId === p.id} className="btn btn-sm btn-danger" style={{ padding: '6px 8px' }}>{deletingUploadId === p.id ? 'Excluindo…' : 'Excluir'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} disabled={loading} style={{
            background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 8,
            padding: '8px 14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer'
          }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={loading} style={{
            background: loading ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 14px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer'
          }}>{loading ? 'Enviando…' : 'Enviar PDF'}</button>
        </div>
      </div>
    </div>
  );
}
