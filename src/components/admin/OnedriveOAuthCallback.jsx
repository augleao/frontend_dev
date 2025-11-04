import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const containerStyle = {
  maxWidth: 640,
  margin: '60px auto',
  padding: '24px 28px',
  background: '#ffffff',
  borderRadius: 16,
  boxShadow: '0 18px 48px rgba(15,23,42,0.12)',
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  color: '#0f172a'
};

const codeBoxStyle = {
  background: '#0f172a',
  color: '#f8fafc',
  borderRadius: 12,
  padding: '18px 20px',
  fontSize: '0.95rem',
  wordBreak: 'break-all',
  fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
  marginTop: 16,
  marginBottom: 24
};

const buttonStyle = {
  background: 'linear-gradient(135deg,#2563eb,#1e40af)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '10px 18px',
  fontWeight: 700,
  cursor: 'pointer'
};

function OnedriveOAuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [authCode, setAuthCode] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code') || '';
    const error = params.get('error');

    if (error) {
      setCopyStatus(`Erro retornado pelo Azure: ${error}`);
      return;
    }

    setAuthCode(code);

    if (!code) {
      setCopyStatus('Nenhum código de autorização encontrado na URL. Refazer o fluxo de consentimento.');
    }
  }, [location.search]);

  const handleCopyCode = async () => {
    if (!authCode) return;
    try {
      await navigator.clipboard.writeText(authCode);
      setCopyStatus('Código copiado para a área de transferência.');
    } catch (err) {
      setCopyStatus('Não foi possível copiar automaticamente. Copie manualmente.');
    }
  };

  const handleReturn = () => {
    navigate('/admin/onedrive');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 12px' }}>
      <div style={containerStyle}>
        <h2 style={{ marginTop: 0 }}>Código de Autorização OneDrive</h2>
        <p style={{ color: '#475569', lineHeight: 1.5 }}>
          Copie o <strong>authorization code</strong> abaixo e troque por tokens no passo seguinte. O código expira em alguns minutos,
          então faça a requisição de troca imediatamente.
        </p>

        <div style={codeBoxStyle}>
          {authCode ? authCode : 'Código não encontrado na URL.'}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" style={buttonStyle} onClick={handleCopyCode} disabled={!authCode}>
            Copiar código
          </button>
          <button
            type="button"
            onClick={handleReturn}
            style={{ ...buttonStyle, background: 'linear-gradient(135deg,#334155,#1e293b)' }}
          >
            Voltar ao painel
          </button>
        </div>

        <div style={{ color: '#475569', marginTop: 28, lineHeight: 1.55 }}>
          <strong>Próximo passo:</strong> envie este código para o endpoint de troca de tokens (ou use o script/insomnia) com <code>grant_type=authorization_code</code>,
          usando o mesmo <em>clientId</em>, <em>clientSecret</em> e <em>redirectUri</em> configurados. O resultado incluirá o <em>refresh_token</em>. Cole o refresh no painel administrativo.
        </div>

        {copyStatus && (
          <div style={{ marginTop: 18, color: '#0f172a', fontWeight: 600 }}>{copyStatus}</div>
        )}
      </div>
    </div>
  );
}

export default OnedriveOAuthCallback;