import React, { useRef, useState } from 'react';
import config from '../../config';

export default function SeloFileUploadAverbacao({ averbacaoId, execucaoId, onUpload, codigoTributario }) {
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
        setError('Salve o ato antes de enviar o selo.');
        setUploading(false);
        return;
      }
      const effectiveExecucaoId = execucaoId || (averbacaoId ? `AV${String(averbacaoId)}` : null);
      console.log('[SeloFileUploadAverbacao] handleImageUpload: effectiveExecucaoId=', effectiveExecucaoId, 'file=', { name: file.name, size: file.size, type: file.type });
      if (!effectiveExecucaoId) {
        setError('Salve o ato antes de enviar o selo.');
        setUploading(false);
        return;
      }
      try {
        const checkRes = await fetch(`${config.apiURL}/execucao-servico/${encodeURIComponent(effectiveExecucaoId)}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!checkRes.ok) {
          // Tenta criar execução automaticamente quando não existir
          console.warn('[SeloFileUploadAverbacao] execução não encontrada, tentando criar automaticamente', effectiveExecucaoId);
          try {
            const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
            const usuarioNome = usuario.nome || usuario.email || 'Sistema';
            const body = { protocolo: effectiveExecucaoId, usuario: usuarioNome };
            console.log('[SeloFileUploadAverbacao] criando execucao via POST /execucao-servico', body);
            const createRes = await fetch(`${config.apiURL}/execucao-servico`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify(body)
            });
            const createText = await createRes.text();
            if (!createRes.ok) {
              console.error('[SeloFileUploadAverbacao] falha ao criar execução automaticamente', { status: createRes.status, body: createText });
              setError('Execução não encontrada para este ID; salve/registre a execução antes de importar selos via API de execução.');
              setUploading(false);
              return;
            }
            console.log('[SeloFileUploadAverbacao] execução criada automaticamente', createText);
          } catch (e2) {
            console.error('[SeloFileUploadAverbacao] erro ao criar execução automaticamente:', e2);
            setError('Erro ao verificar/registrar execução.');
            setUploading(false);
            return;
          }
        }
      } catch (e) {
        console.error('[SeloFileUploadAverbacao] erro ao verificar execução:', e);
        setError('Erro ao verificar existência da execução.');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('imagem', file);
      // compatibilidade com API de execução de serviço: enviar execucaoId com prefixo 'AV'
      formData.append('execucao_servico_id', effectiveExecucaoId);
      if (codigoTributario) formData.append('codigo_tributario', codigoTributario);
      // log FormData entries for debugging (blob/file objects will be shown as File/Blob)
      for (const pair of formData.entries()) {
        try { console.log('[SeloFileUploadAverbacao] formData entry', pair[0], pair[1]); } catch (e) { console.log('[SeloFileUploadAverbacao] formData entry', pair[0]); }
      }
      const token = localStorage.getItem('token');
      // Reaproveitar API de execução de serviço para salvar selos (mesma rota usada em ServicoExecucao)
      const res = await fetch(`${config.apiURL}/execucaoservico/${encodeURIComponent(effectiveExecucaoId)}/selo`, {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const text = await res.text();
      if (!res.ok) {
        console.error('[SeloFileUploadAverbacao] upload response error:', res.status, text);
        throw new Error(text || 'Erro ao enviar imagem.');
      }
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (e) { console.warn('[SeloFileUploadAverbacao] parse response failed', e); }
      console.log('[SeloFileUploadAverbacao] upload successful, response:', data);
      if (onUpload) onUpload(data);
    } catch (err) {
      console.error('[SeloFileUploadAverbacao] upload error', err);
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
