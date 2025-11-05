import React, { useEffect, useState } from 'react';
import { uploadDap } from '../../services/dapService';

function DapUploadModal({ isOpen, onClose, onUploaded, existingDaps = [] }) {
  const [file, setFile] = useState(null);
  const [retificaId, setRetificaId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setRetificaId('');
      setObservacoes('');
      setUploading(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Selecione um arquivo PDF da DAP.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const metadata = {};
      if (retificaId) {
        metadata.retificaDapId = retificaId;
      }
      if (observacoes.trim()) {
        metadata.observacoes = observacoes.trim();
      }

      const response = await uploadDap({ file, metadata });
      if (onUploaded) {
        onUploaded(response);
      }
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.mensagem || err?.message || 'Erro ao enviar a DAP.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, color: '#0f172a' }}>Enviar DAP mensal</h2>
          <button type="button" onClick={onClose} style={closeButtonStyle} disabled={uploading}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Selecione o PDF da DAP</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              style={inputStyle}
              disabled={uploading}
            />
            {file && (
              <div style={fileInfoStyle}>
                <span role="img" aria-label="pdf" style={{ marginRight: 8 }}>
                  📄
                </span>
                {file.name}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Esta DAP retifica outra?</label>
            <select
              value={retificaId}
              onChange={(event) => setRetificaId(event.target.value)}
              style={inputStyle}
              disabled={uploading || existingDaps.length === 0}
            >
              <option value="">Não, é a DAP original</option>
              {existingDaps.map((dap) => (
                <option key={dap.id} value={dap.id}>
                  {`${dap.ano}/${String(dap.mes).padStart(2, '0')} • ${dap.tipo ?? 'ORIGINAL'} • ${dap.status ?? 'ATIVA'}`}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Observações (opcional)</label>
            <textarea
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              style={{ ...inputStyle, height: 80, resize: 'vertical' }}
              placeholder="Use este campo para registrar qualquer nota sobre o envio."
              disabled={uploading}
            />
          </div>

          {error && (
            <div style={errorStyle}>{error}</div>
          )}

          <div style={footerStyle}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle} disabled={uploading}>
              Cancelar
            </button>
            <button type="submit" style={primaryButtonStyle} disabled={uploading}>
              {uploading ? 'Enviando...' : 'Enviar DAP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '16px',
};

const modalStyle = {
  width: '100%',
  maxWidth: '560px',
  background: 'white',
  borderRadius: '16px',
  boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)',
  padding: '24px',
  position: 'relative',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
};

const closeButtonStyle = {
  background: 'transparent',
  border: 'none',
  fontSize: '24px',
  cursor: 'pointer',
  color: '#1f2937',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#1f2937',
  marginBottom: 6,
  letterSpacing: '0.4px',
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid #d1d5db',
  fontSize: '14px',
  outline: 'none',
  background: '#f9fafb',
};

const fileInfoStyle = {
  marginTop: 8,
  padding: '10px 12px',
  background: '#f1f5f9',
  borderRadius: '10px',
  fontSize: '13px',
  color: '#0f172a',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
};

const footerStyle = {
  marginTop: 24,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
};

const primaryButtonStyle = {
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: 'white',
  border: 'none',
  borderRadius: '999px',
  padding: '12px 24px',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  letterSpacing: '0.5px',
  boxShadow: '0 10px 30px rgba(37, 99, 235, 0.3)',
};

const secondaryButtonStyle = {
  background: 'transparent',
  color: '#1d4ed8',
  border: '1px solid #bfdbfe',
  borderRadius: '999px',
  padding: '12px 24px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
};

const errorStyle = {
  background: '#fee2e2',
  color: '#b91c1c',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '13px',
  marginBottom: 16,
};

export default DapUploadModal;
