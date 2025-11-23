import React from 'react';

export default function ProcedimentoPdfManager({
  pdfList,
  pdfInfo,
  uploading,
  deletingUploadId,
  selectAndUploadFiles,
  handleViewUpload,
  handleDeleteUpload,
  onSave,
  getMesReferencia
}) {
  return (
    <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px dashed #cfdbe6', background: '#fbfdff' }}>
      
      <div className="servico-row" style={{ alignItems: 'center', gap: 12, display: 'flex', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={selectAndUploadFiles}
            disabled={uploading}
            style={{ minWidth: 140 }}
          >
            Selecionar PDF
          </button>

          <button type="button" className="btn btn-success" onClick={onSave} disabled={uploading} style={{ minWidth: 160 }}>
            Salvar Procedimento
          </button>

          {uploading && <span style={{ color: '#888' }}>Enviando...</span>}
        </div>

        {pdfList && pdfList.length > 0 ? (
          <div style={{ marginTop: 8, background: '#f6f9fc', borderRadius: 12, boxShadow: '0 6px 24px rgba(2,6,23,0.08)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(180deg,#eef6ff,#e8f1ff)' }}>
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
        ) : (
          pdfInfo?.storedName && (
            <span style={{ fontSize: 13, color: '#2c3e50' }}>
              Arquivo salvo como: <strong>{pdfInfo.originalName || pdfInfo.storedName || (pdfInfo.url ? pdfInfo.url.split('/').pop() : '')}</strong>
              {pdfInfo.url && (
                <a href={pdfInfo.url} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>abrir</a>
              )}
            </span>
          )
        )}
      </div>
      
    </div>
  );
}
