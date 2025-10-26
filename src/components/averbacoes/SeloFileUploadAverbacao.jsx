import React, { useRef, useState } from 'react';
import config from '../../config';

export default function SeloFileUploadAverbacao({ averbacaoId, onUpload }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef();

  const handleFileChange = async (e) => {
    setError('');
    const file = e.target.files[0];
    if (file) {
      await handleImageUpload(file);
      e.target.value = '';
    }
  };

  const handleImageUpload = async (file) => {
    setUploading(true);
    setError('');
    try {
      if (!averbacaoId) {
        setError('Salve a averbação antes de enviar o selo.');
        setUploading(false);
        return;
      }
      const formData = new FormData();
      formData.append('imagem', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(averbacaoId)}/selo`, {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Erro ao enviar imagem.');
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch {}
      if (onUpload) onUpload(data);
    } catch (err) {
      setError('Falha ao enviar imagem: ' + (err.message || err));
    }
    setUploading(false);
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 0, width: '100%' }}>
      <button
        type="button"
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        disabled={uploading}
        style={{
          width: 220,
          padding: '4px 10px',
          background: '#36c2f6',
          color: '#fff',
          border: '1.5px solid #36c2f6',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          cursor: uploading ? 'not-allowed' : 'pointer',
          marginLeft: 0
        }}
        title="Selecionar arquivo de imagem do selo"
      >
        {uploading ? 'Importando selo...' : '📁 Selecionar arquivo de selo'}
      </button>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {error && <span style={{ color: 'red', marginLeft: 6 }}>{error}</span>}
    </span>
  );
}
