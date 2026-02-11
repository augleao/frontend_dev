import React, { useRef, useState } from 'react';
import config from '../../config';
import '../../buttonGradients.css';

export default function ClipboardImageUpload({ protocolo, onUpload, codigoTributario, disabled = false }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const buttonRef = useRef();

  // Handler para importar dados de selo da área de transferência
  const handleImportFromClipboard = async () => {
    setError('');

    if (disabled) {
      setError('Salve a certidão antes de importar selos.');
      return;
    }

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

  // Envia conteúdo textual do selo para o backend reutilizando a mesma rota do upload de imagem
  const handleSeloUpload = async (conteudoSelo) => {
    setUploading(true);
    setError('');

    try {
      if (!protocolo || typeof protocolo !== 'string') {
        setError('Protocolo inválido para upload.');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      // Mantém o nome do campo para reaproveitar a rota do backend
      const blob = new Blob([conteudoSelo], { type: 'text/plain' });
      formData.append('imagem', blob, 'selo.txt');
      formData.append('conteudo_selo', conteudoSelo);
      formData.append('execucao_servico_id', protocolo);
      if (codigoTributario) formData.append('codigo_tributario', codigoTributario);

      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/execucaoservico/${protocolo}/selo`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const text = await res.text();
      if (!res.ok) throw new Error('Erro ao enviar dados do selo.');

      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}

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
        disabled={uploading || disabled}
        className="btn-gradient btn-gradient-blue btn-compact"
        style={{ width: 220, marginLeft: 0 }}
        title="Importar imagem da área de transferência"
      >
        {uploading ? 'Importando selo...' : '� Importar selo da área de transferência'}
      </button>
      {error && <span style={{ color: 'red', marginLeft: 6 }}>{error}</span>}
    </span>
  );
}
