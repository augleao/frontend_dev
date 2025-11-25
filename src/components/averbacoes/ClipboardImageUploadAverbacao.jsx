import React, { useRef, useState } from 'react';
import config from '../../config';

export default function ClipboardImageUploadAverbacao({ averbacaoId, execucaoId, onUpload }) {
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
      const effectiveExecucaoId = execucaoId || (averbacaoId ? `AV${String(averbacaoId)}` : null);
      console.log('[ClipboardImageUploadAverbacao] handleSeloUpload: effectiveExecucaoId=', effectiveExecucaoId);
      if (!effectiveExecucaoId) {
        setError('Salve a averbação antes de importar o selo.');
        setUploading(false);
        return;
      }
      try {
        const checkRes = await fetch(`${config.apiURL}/execucao-servico/${encodeURIComponent(effectiveExecucaoId)}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!checkRes.ok) {
          // Tenta criar uma execução automaticamente (mínimo necessário)
          console.warn('[ClipboardImageUploadAverbacao] execução não encontrada, tentando criar automaticamente', effectiveExecucaoId);
          try {
            const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
            const usuarioNome = usuario.nome || usuario.email || 'Sistema';
            const body = { protocolo: effectiveExecucaoId, usuario: usuarioNome };
            console.log('[ClipboardImageUploadAverbacao] criando execucao via POST /execucao-servico', body);
            const createRes = await fetch(`${config.apiURL}/execucao-servico`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify(body)
            });
            const createText = await createRes.text();
            if (!createRes.ok) {
              console.error('[ClipboardImageUploadAverbacao] falha ao criar execução automaticamente', { status: createRes.status, body: createText });
              setError('Execução não encontrada para este ID; salve/registre a execução antes de importar selos via API de execução.');
              setUploading(false);
              return;
            }
            console.log('[ClipboardImageUploadAverbacao] execução criada automaticamente', createText);
          } catch (e2) {
            console.error('[ClipboardImageUploadAverbacao] erro ao criar execução automaticamente:', e2);
            setError('Erro ao verificar/registrar execução.');
            setUploading(false);
            return;
          }
        }
      } catch (e) {
        console.error('[ClipboardImageUploadAverbacao] erro ao verificar execução:', e);
        setError('Erro ao verificar existência da execução.');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      const blob = new Blob([conteudoSelo], { type: 'text/plain' });
      formData.append('imagem', blob, 'selo.txt');
      formData.append('conteudo_selo', conteudoSelo);
      // compatibilidade com API de execução de serviço: enviar execucaoServiço id (prefira o valor vindo do backend)
      formData.append('execucao_servico_id', effectiveExecucaoId);
      // log FormData entries for debugging (note: blob contents won't be fully printed)
      for (const pair of formData.entries()) {
        try { console.log('[ClipboardImageUploadAverbacao] formData entry', pair[0], pair[1]); } catch (e) { console.log('[ClipboardImageUploadAverbacao] formData entry', pair[0]); }
      }

      const token = localStorage.getItem('token');
      // Envia para API de execução de serviço usando execucaoId (pode ser string com prefixo)
      const res = await fetch(`${config.apiURL}/execucaoservico/${encodeURIComponent(effectiveExecucaoId)}/selo`, {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const text = await res.text();
      if (!res.ok) {
        console.error('[ClipboardImageUploadAverbacao] upload response error:', res.status, text);
        throw new Error(text || 'Erro ao enviar dados do selo.');
      }

      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (e) { console.warn('[ClipboardImageUploadAverbacao] parse response failed', e); }
      console.log('[ClipboardImageUploadAverbacao] upload successful, response:', data);
      if (onUpload) onUpload(data);
    } catch (err) {
      console.error('[ClipboardImageUploadAverbacao] upload error', err);
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
