import React, { useRef, useState } from 'react';
import config from '../../config';

export default function SeloFileUpload({ protocolo, onUpload }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef();

  // Handler para selecionar arquivo manualmente
  const handleFileChange = async (e) => {
    setError('');
    const file = e.target.files[0];
    if (file) {
      await handleImageUpload(file);
      e.target.value = '';
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
    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 8, marginTop: 8 }}>
      <button
        type="button"
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        disabled={uploading}
        style={{
          padding: '4px 10px',
          background: '#36c2f6',
          color: '#fff',
          border: '1.5px solid #36c2f6',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          cursor: uploading ? 'not-allowed' : 'pointer',
          marginLeft: 4
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
