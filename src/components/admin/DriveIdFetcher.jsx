import React, { useState } from 'react';

const statusBoxStyle = {
  marginTop: 8,
  padding: '8px 10px',
  borderRadius: 8,
  background: '#f1f5f9',
  color: '#1f2937',
  fontSize: 13,
  lineHeight: 1.4
};

export default function DriveIdFetcher({ config, onResolved, disabled }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const fetchDriveId = async () => {
    if (loading) return;
    setError('');
    setStatus('Gerando access token a partir do refresh token…');
    const tenant = (config?.tenant || 'common').trim();
    const clientId = (config?.clientId || '').trim();
    const clientSecret = (config?.clientSecret || '').trim();
    const refreshToken = (config?.refreshToken || '').trim();

    if (!clientId || !clientSecret || !refreshToken) {
      setStatus('');
      setError('Informe Client ID, Client Secret e Refresh Token antes de detectar o Drive ID.');
      return;
    }

    setLoading(true);
    try {
      const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'https://graph.microsoft.com/.default offline_access Files.ReadWrite.All'
      });

      const tokenResp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString()
      });

      const tokenData = await tokenResp.json().catch(() => ({}));
      if (!tokenResp.ok) {
        const detail = tokenData?.error_description || tokenData?.error || tokenResp.statusText;
        throw new Error(detail || 'Falha ao obter access token');
      }

      const accessToken = tokenData?.access_token;
      if (!accessToken) {
        throw new Error('Resposta sem access token. Verifique o refresh token informado.');
      }

      setStatus('Access token obtido. Consultando /me/drive no Microsoft Graph…');
      const driveResp = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const driveData = await driveResp.json().catch(() => ({}));
      if (!driveResp.ok) {
        const detail = driveData?.error?.message || driveResp.statusText;
        throw new Error(detail || 'Falha ao consultar o Microsoft Graph');
      }

      if (!driveData?.id) {
        throw new Error('Resposta sem id. Confira as permissões Files.ReadWrite no aplicativo.');
      }

      onResolved?.(driveData.id);
      setStatus(`Drive ID detectado: ${driveData.id}`);
    } catch (err) {
      console.error('[DriveIdFetcher] Erro ao detectar driveId', err);
      setError(err?.message || 'Não foi possível detectar o Drive ID.');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={fetchDriveId}
        disabled={disabled || loading}
        style={{
          background: loading ? '#94a3b8' : '#0ea5e9',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 14px',
          fontWeight: 700,
          cursor: disabled || loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Detectando…' : 'Detectar Drive ID automaticamente'}
      </button>
      {(status || error) && (
        <div style={{ ...statusBoxStyle, background: error ? '#fee2e2' : '#ecfeff', color: error ? '#b91c1c' : '#0f172a' }}>
          {error || status}
        </div>
      )}
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
        Para contas pessoais o endpoint /me/drive retorna o identificador da unidade raiz. O processo usa o refresh token informado acima.
      </div>
    </div>
  );
}
