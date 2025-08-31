import React, { useRef, useState } from 'react';
import config from '../../config';

export default function ClipboardImageUpload({ protocolo, onUpload }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const buttonRef = useRef();

  // Handler para importar imagem da área de transferência
  const handleImportFromClipboard = async () => {
    setError('');
    try {
      const clipboardItems = await navigator.clipboard.read();
      let foundImage = false;
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            foundImage = true;
            const blob = await item.getType(type);
            await handleImageUpload(blob);
            break;
          }
        }
        if (foundImage) break;
      }
      if (!foundImage) {
        setError('A área de transferência não contém uma imagem.');
      }
    } catch (err) {
      setError('Erro ao acessar a área de transferência.');
    }
  };

  // Envia imagem para o backend (igual SeloEletronicoManager)
  const handleImageUpload = async (file) => {
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('imagem', file);
      if (!protocolo || typeof protocolo !== 'string') {
        setError('Protocolo inválido para upload.');
        setUploading(false);
        return;
      }
      formData.append('execucao_servico_id', protocolo);
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/execucaoservico/${protocolo}/selo`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const text = await res.text();
      if (!res.ok) throw new Error('Erro ao enviar imagem.');
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}
      if (onUpload) onUpload(data);
    } catch (err) {
      setError('Falha ao enviar imagem: ' + (err.message || err));
    }
    setUploading(false);
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 8 }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleImportFromClipboard}
        disabled={uploading}
        style={{
          padding: '4px 10px',
          background: '#f6c23e',
          color: '#222',
          border: '1.5px solid #f6c23e',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          cursor: uploading ? 'not-allowed' : 'pointer',
          marginLeft: 4
        }}
        title="Importar imagem da área de transferência"
      >
        {uploading ? 'Importando imagem...' : '🖼️ Importar Imagem'}
      </button>
      {error && <span style={{ color: 'red', marginLeft: 6 }}>{error}</span>}
    </span>
  );
}
