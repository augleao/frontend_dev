import React from 'react';

export default function AverbacaoPdfManager({
  pdfList,
  pdfInfo,
  uploading,
  deletingUploadId,
  selectAndUploadFiles,
  handleViewUpload,
  handleDeleteUpload,
  getMesReferencia
}) {
  return (
    <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px dashed #e1e5ea' }}>
      <h4 className="servico-title" style={{ fontSize: 16, margin: '0 0 8px 0' }}>1) Anexar PDF da Averbação</h4>

      <div className="servico-row" style={{ alignItems: 'center', gap: 12, display: 'flex', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={selectAndUploadFiles}
          disabled={uploading}
          style={{ minWidth: 140 }}
        >
          {uploading ? 'Enviando…' : 'Selecionar PDF'}
        </button>
        {uploading && <span style={{ color: '#888' }}>Enviando...</span>}
      </div>

      <div style={{ marginTop: 12 }}>
        <style>{`
          .adm-table {
            background: white;
            border-radius: 12px;
            box-shadow: 0 6px 20px rgba(2,6,23,0.08);
            overflow: hidden;
            border: 1px solid #e6eef6;
          }
          .adm-table table { width: 100%; border-collapse: collapse; min-width: 640px; }
          .adm-table thead tr { background: linear-gradient(180deg,#f8fbff,#f5f9ff); }
          .adm-table th { text-align: left; padding: 12px 16px; font-size: 13px; font-weight: 700; color:#203442; }
          .adm-table td { padding: 12px 16px; font-size: 13px; color:#334155; vertical-align: middle; }
          .adm-table tbody tr { border-top: 1px solid #f1f5f9; }
          .adm-actions { display:flex; gap:8px; justify-content:center; }
          .adm-btn { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; border:1px solid transparent; background:transparent; cursor:pointer; font-size:13px; }
          .adm-btn.view { color:#0f4c81; border-color: #cfe6ff; background: #f3f9ff; }
          .adm-btn.del { color:#842029; border-color:#ffd6d9; background:#fff5f6; }
          .adm-btn:disabled { opacity:0.6; cursor:not-allowed; }

          /* Responsive: stack rows on narrow screens */
          @media (max-width: 720px) {
            .adm-table table { display:block; }
            .adm-table thead { display:none; }
            .adm-table tbody tr { display:block; padding:12px; margin:8px; border-radius:10px; background:#fff; box-shadow:0 4px 14px rgba(2,6,23,0.04); }
            .adm-table td { display:flex; justify-content:space-between; padding:6px 0; }
            .adm-table td .label { color:#6b7280; margin-right:8px; font-weight:600; }
            .adm-actions { justify-content:flex-end; margin-top:6px; }
          }
        `}</style>

        {pdfList && pdfList.length > 0 ? (
          <div className="adm-table" style={{ marginTop: 8 }}>
            <div style={{ overflowX: 'auto' }}>
              <table role="table" aria-label="Arquivos PDF anexados">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Nome salvo</th>
                    <th style={{ textAlign: 'right' }}>Tamanho</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pdfList.map(p => {
                    const displayName = p.originalName || p.storedName || (p.url ? decodeURIComponent(p.url.split('/').pop()) : '');
                    return (
                      <tr key={p.id || p.url}>
                        <td title={displayName} style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace:'nowrap' }}>
                          <span>{displayName}</span>
                        </td>
                        <td style={{ color: '#475569' }}>{p.storedName || ''}</td>
                        <td style={{ textAlign: 'right', color:'#64748b' }}>{p.size ? `${Math.round(p.size/1024)} KB` : '-'}</td>
                        <td style={{ color:'#64748b' }}>{p.contentType || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="adm-actions">
                            <button
                              type="button"
                              onClick={() => handleViewUpload(p)}
                              className="adm-btn view"
                              aria-label={`Exibir ${displayName}`}
                              title="Exibir"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7z" stroke="#0f4c81" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="#0f4c81" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              <span style={{ display: 'none' }}>Exibir</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUpload(p.id)}
                              disabled={deletingUploadId === p.id}
                              className="adm-btn del"
                              aria-label={`Excluir ${displayName}`}
                              title="Excluir"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18" stroke="#842029" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="#842029" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="#842029" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              <span style={{ display: 'none' }}>{deletingUploadId === p.id ? 'Excluindo…' : 'Excluir'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          pdfInfo?.storedName && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 13, color: '#2c3e50' }}>
                Arquivo salvo como: <strong>{pdfInfo.originalName || pdfInfo.storedName || (pdfInfo.url ? pdfInfo.url.split('/').pop() : '')}</strong>
                {pdfInfo.url && (
                  <a href={pdfInfo.url} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>abrir</a>
                )}
              </span>
            </div>
          )
        )}
      </div>

      <small style={{ color: '#777', display: 'block', marginTop: 10 }}>O arquivo será renomeado como <strong>AVERBACAO-XXX-{getMesReferencia()}.PDF</strong> automaticamente.</small>
    </div>
  );
}
