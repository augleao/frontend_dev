import React, { useRef, useState } from 'react';
import config from '../../config';

export default function ClipboardImageUploadAverbacao({ averbacaoId, onUpload }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const buttonRef = useRef();

  const handleImportFromClipboard = async () => {
    setError('');

    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      setError('Navegador não suporta leitura de texto da área de transferência.');
      return;
    }

    try {
      const rawText = await navigator.clipboard.readText();
      const conteudo = (rawText || '').trim();

      if (!conteudo) {
        setError('A área de transferência não contém dados de selo.');
        return;
      }

      await handleSeloUpload(conteudo);
    } catch (err) {
      setError('Erro ao acessar a área de transferência.');
    }
  };

  const handleSeloUpload = async (conteudoSelo) => {
    setUploading(true);
    setError('');

    try {
      if (!averbacaoId) {
        setError('Salve a averbação antes de importar o selo.');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      const blob = new Blob([conteudoSelo], { type: 'text/plain' });
      formData.append('imagem', blob, 'selo.txt');
      formData.append('conteudo_selo', conteudoSelo);

      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(averbacaoId)}/selo`, {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Erro ao enviar dados do selo.');

      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch {}
      if (onUpload) onUpload(data);
    } catch (err) {
      setError('Falha ao enviar dados do selo: ' + (err.message || err));
    }

    setUploading(false);
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 0, width: '100%' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleImportFromClipboard}
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
        title="Importar imagem da área de transferência"
      >
        {uploading ? 'Importando selo...' : '� Importar selo da área de transferência'}
      </button>
      {error && <span style={{ color: 'red', marginLeft: 6 }}>{error}</span>}
    </span>
  );
}
