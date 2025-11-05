import React, { useEffect, useRef, useState } from 'react';
import OnedriveConfigService from '../../services/OnedriveConfigService';
import Toast from '../Toast';
import { DEFAULT_TOAST_DURATION } from '../toastConfig';
import DriveIdFetcher from './DriveIdFetcher';

const fieldLabelStyle = { fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' };
const inputStyle = {
  border: '1.5px solid #d0d7de',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  width: '100%',
  background: '#fff'
};
const AUTH_BASE_URL = 'https://login.microsoftonline.com';
const AUTH_SCOPES = 'offline_access Files.ReadWrite.All User.Read';

function OnedriveConfig() {
  const [form, setForm] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    tenant: 'consumers',
    folderPath: 'Averbacoes',
    driveId: '',
    refreshToken: ''
  });
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const toastTimerRef = useRef(null);

  const triggerToast = (type, message) => {
    setToastType(type);
    setToastMessage(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
      toastTimerRef.current = null;
    }, DEFAULT_TOAST_DURATION);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await OnedriveConfigService.getConfig();
        if (mounted && data) {
          setRecordId(data.id || data._id || null);
          setForm({
            clientId: data.clientId || data.client_id || '',
            clientSecret: data.clientSecret || data.client_secret || '',
            redirectUri: data.redirectUri || data.redirect_uri || '',
            tenant: data.tenant || data.tenantId || 'consumers',
            folderPath: data.folderPath || data.folder_path || 'Averbacoes',
            driveId: data.driveId || data.drive_id || data.sharepointDriveId || data.sharepoint_drive_id || '',
            refreshToken: data.refreshToken || data.refresh_token || ''
          });
        }
      } catch (err) {
        triggerToast('error', err.message || 'Falha ao carregar configuração.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleDriveIdResolved = (driveId) => {
    if (!driveId) return;
    handleChange('driveId', driveId);
    triggerToast('success', 'Drive ID detectado automaticamente.');
  };

  const handleOpenAuthUrl = async () => {
    const clientId = form.clientId.trim();
    const redirectUri = form.redirectUri.trim();
    const tenant = (form.tenant || 'consumers').trim();

    if (!clientId || !redirectUri) {
      triggerToast('warning', 'Informe Client ID e Redirect URI antes de gerar a URL.');
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: AUTH_SCOPES,
      response_mode: 'query'
    });

    const authUrl = `${AUTH_BASE_URL}/${tenant || 'common'}/oauth2/v2.0/authorize?${params.toString()}`;

    try {
      await navigator.clipboard.writeText(authUrl);
      triggerToast('success', 'URL de autorização copiada. Abrindo em nova aba…');
    } catch (err) {
      triggerToast('info', 'Abrindo URL de autorização em nova aba. Copie manualmente se precisar.');
    }

    window.open(authUrl, '_blank', 'noopener');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        clientId: form.clientId.trim(),
        clientSecret: form.clientSecret.trim(),
        redirectUri: form.redirectUri.trim(),
        tenant: form.tenant.trim() || 'consumers',
        folderPath: form.folderPath.trim() || 'Averbacoes',
        driveId: form.driveId.trim(),
        refreshToken: form.refreshToken.trim()
      };
      if (!payload.clientId || !payload.clientSecret || !payload.redirectUri || !payload.folderPath || !payload.driveId || !payload.refreshToken) {
        throw new Error('Preencha Client ID, Client Secret, Redirect URI, Folder Path, Drive ID e Refresh Token.');
      }
      const saved = await OnedriveConfigService.saveConfig(payload, recordId);
      setRecordId(saved.id || saved._id || recordId);
      triggerToast('success', 'Configuração salva com sucesso.');
    } catch (err) {
      triggerToast('error', err.message || 'Falha ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!recordId) {
      triggerToast('warning', 'Nenhum registro para remover.');
      return;
    }
    if (!window.confirm('Remover configuração do OneDrive?')) return;
    setDeleting(true);
    try {
      await OnedriveConfigService.deleteConfig(recordId);
      setRecordId(null);
      setForm({
        clientId: '',
        clientSecret: '',
        redirectUri: '',
        tenant: 'consumers',
        folderPath: 'Averbacoes',
        driveId: '',
        refreshToken: ''
      });
      triggerToast('success', 'Configuração removida.');
    } catch (err) {
      triggerToast('error', err.message || 'Falha ao remover configuração.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '40px auto' }}>
      <div style={{
        background: '#fff',
        padding: 24,
        borderRadius: 16,
        boxShadow: '0 12px 30px rgba(15,23,42,0.12)'
      }}>
        <h2 style={{ marginTop: 0, color: '#111827' }}>Configuração OneDrive</h2>
        <p style={{ color: '#64748b', marginTop: -6, marginBottom: 20 }}>
          Ajuste as credenciais delegadas usadas para armazenar PDFs no OneDrive. Dados são guardados no banco e aplicados sem deploy do backend.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleOpenAuthUrl}
            style={{
              background: 'linear-gradient(135deg,#16a34a,#15803d)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Gerar URL de autorização
          </button>
          <small style={{ color: '#64748b', alignSelf: 'center' }}>
            Use esta URL para obter o código OAuth e, na sequência, gerar um novo refresh token.
          </small>
        </div>

        {loading ? (
          <div style={{ color: '#64748b' }}>Carregando…</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={fieldLabelStyle}>ONEDRIVE_CLIENT_ID</label>
              <input
                type="text"
                style={inputStyle}
                value={form.clientId}
                onChange={e => handleChange('clientId', e.target.value)}
                autoComplete="off"
                placeholder="GUID gerado no portal do Azure"
              />
            </div>
            <div>
              <label style={fieldLabelStyle}>ONEDRIVE_CLIENT_SECRET</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={showSecret ? 'text' : 'password'}
                  style={{ ...inputStyle, flex: 1 }}
                  value={form.clientSecret}
                  onChange={e => handleChange('clientSecret', e.target.value)}
                  autoComplete="new-password"
                  placeholder="Segredo do aplicativo"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(prev => !prev)}
                  style={{
                    minWidth: 96,
                    border: '1px solid #d0d7de',
                    borderRadius: 10,
                    background: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  {showSecret ? 'Ocultar' : 'Exibir'}
                </button>
              </div>
            </div>
            <div>
              <label style={fieldLabelStyle}>ONEDRIVE_REDIRECT_URI</label>
              <input
                type="text"
                style={inputStyle}
                value={form.redirectUri}
                onChange={e => handleChange('redirectUri', e.target.value)}
                autoComplete="off"
                placeholder="http://localhost:3000/auth/onedrive/callback"
              />
            </div>
            <div>
              <label style={fieldLabelStyle}>ONEDRIVE_TENANT</label>
              <input
                type="text"
                style={inputStyle}
                value={form.tenant}
                onChange={e => handleChange('tenant', e.target.value)}
                autoComplete="off"
                placeholder="consumers"
              />
            </div>
            <div>
              <label style={fieldLabelStyle}>PASTA DE UPLOAD (folderPath)</label>
              <input
                type="text"
                style={inputStyle}
                value={form.folderPath}
                onChange={e => handleChange('folderPath', e.target.value)}
                autoComplete="off"
                placeholder="Averbacoes"
              />
              <small style={{ color: '#64748b' }}>
                Ex: Averbacoes (gera uploads em /Averbacoes/&lt;ano&gt;...). Use caminhos relativos ao raiz do OneDrive.
              </small>
            </div>
            <div>
              <label style={fieldLabelStyle}>ONEDRIVE_DRIVE_ID</label>
              <input
                type="text"
                style={inputStyle}
                value={form.driveId}
                onChange={e => handleChange('driveId', e.target.value)}
                autoComplete="off"
                placeholder="drive-id (contas pessoais use /me/drive => ID está em /me/drive)"
              />
              <small style={{ color: '#64748b' }}>
                Informe o identificador do drive (ex.: valor retornado por GET https://graph.microsoft.com/v1.0/me/drive ou sites/.../drives).
              </small>
              <DriveIdFetcher
                config={form}
                onResolved={handleDriveIdResolved}
                disabled={loading || saving}
              />
            </div>
            <div>
              <label style={fieldLabelStyle}>ONEDRIVE_REFRESH_TOKEN</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea
                  style={{ ...inputStyle, flex: 1, minHeight: 120, fontFamily: 'monospace' }}
                  value={form.refreshToken}
                  onChange={e => handleChange('refreshToken', e.target.value)}
                  autoComplete="off"
                  placeholder="Cole aqui o refresh token obtido no fluxo OAuth"
                  rows={4}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(form.refreshToken || '');
                      triggerToast('success', 'Refresh token copiado para a área de transferência.');
                    } catch (err) {
                      triggerToast('error', 'Não foi possível copiar. Copie manualmente.');
                    }
                  }}
                  style={{
                    minWidth: 96,
                    border: '1px solid #d0d7de',
                    borderRadius: 10,
                    background: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  Copiar
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              background: saving ? '#94a3b8' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 800,
              cursor: saving || loading ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || !recordId || loading}
            style={{
              background: deleting ? '#f87171' : '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 800,
              cursor: deleting || !recordId || loading ? 'not-allowed' : 'pointer'
            }}
          >
            {deleting ? 'Removendo…' : 'Excluir'}
          </button>
        </div>
      </div>

      <div style={{
        marginTop: 32,
        padding: 20,
        borderRadius: 12,
        background: '#f8fafc',
        boxShadow: '0 1px 2px rgba(148,163,184,0.16)'
      }}>
        <h3 style={{ marginTop: 0, color: '#0f172a', fontSize: 18 }}>Guia rápido de configuração</h3>
        <ol style={{ margin: '12px 0 0 20px', padding: 0, color: '#1f2937', fontSize: 14, lineHeight: 1.6 }}>
          <li style={{ marginBottom: 10 }}>
            <strong>Client ID &amp; Client Secret:</strong> no <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noreferrer">Azure Portal &rarr; Azure Active Directory &rarr; App registrations</a>, selecione o aplicativo e copie o <em>Application (client) ID</em>. Em <em>Certificates &amp; secrets</em>, gere (ou copie) o segredo e cole aqui.
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>Redirect URI:</strong> precisa constar na aba <em>Authentication</em> do aplicativo. Para uso local, utilize algo como <code>http://localhost:3000/auth/onedrive/callback</code>; em produção, informe o domínio hospedado. Mais detalhes na documentação <a href="https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-auth-code-flow" target="_blank" rel="noreferrer">OAuth 2.0 auth code flow</a>.
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>Tenant:</strong> use <code>consumers</code> para contas pessoais (Microsoft/Outlook) ou o domínio/tenant ID se estiver em um diretório corporativo. Pode ser consultado em <em>Azure Active Directory &rarr; Overview &rarr; Tenant ID</em>.
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>Refresh Token:</strong> gere-o após completar o fluxo OAuth com o botão “Gerar URL de autorização”. Depois troque o <em>authorization code</em> por tokens conforme o guia <a href="https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-auth-code-flow#request-an-access-token" target="_blank" rel="noreferrer">Request an access token</a>. Cole aqui o valor retornado em <code>refresh_token</code>.
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>Folder Path:</strong> caminho relativo dentro do OneDrive onde os PDFs serão gravados (ex.: <code>Averbacoes</code>). O backend cria subpastas por ano/mês automaticamente.
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>Drive ID:</strong> para contas pessoais, clique em “Detectar Drive ID automaticamente” ou rode <code>GET https://graph.microsoft.com/v1.0/me/drive</code> com um token que inclua <code>Files.ReadWrite.All</code>. Em ambientes corporativos, consulte <a href="https://learn.microsoft.com/graph/api/drive-get?view=graph-rest-1.0&amp;tabs=http" target="_blank" rel="noreferrer">Drive &mdash; Get</a> para localizar o ID desejado.
          </li>
        </ol>
        <p style={{ color: '#475569', fontSize: 13, marginTop: 16 }}>
          Após preencher tudo, salve a configuração e teste um upload de PDF em “Averbações gratuitas”. Se o backend apontar falta de variáveis, confirme que todos os campos acima estão preenchidos e que o aplicativo possui as permissões <code>offline_access</code>, <code>Files.ReadWrite.All</code> e <code>User.Read</code>.
        </p>
      </div>

      <Toast
        message={toastMessage}
        type={toastType}
        onClose={() => setToastMessage('')}
      />
    </div>
  );
}

export default OnedriveConfig;
