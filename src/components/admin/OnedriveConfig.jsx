import React, { useEffect, useRef, useState } from 'react';
import OnedriveConfigService from '../../services/OnedriveConfigService';
import Toast from '../Toast';
import { DEFAULT_TOAST_DURATION } from '../toastConfig';

const fieldLabelStyle = { fontSize: 12, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' };
const inputStyle = {
  border: '1.5px solid #d0d7de',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  width: '100%',
  background: '#fff'
};

function OnedriveConfig() {
  const [form, setForm] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    tenant: 'consumers',
    folderPath: 'Averbacoes',
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        clientId: form.clientId.trim(),
        clientSecret: form.clientSecret.trim(),
        redirectUri: form.redirectUri.trim(),
        tenant: form.tenant.trim() || 'consumers',
        folderPath: form.folderPath.trim() || 'Averbacoes',
        refreshToken: form.refreshToken.trim()
      };
      if (!payload.clientId || !payload.clientSecret || !payload.redirectUri || !payload.folderPath || !payload.refreshToken) {
        throw new Error('Preencha Client ID, Client Secret, Redirect URI, Folder Path e Refresh Token.');
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
  setForm({ clientId: '', clientSecret: '', redirectUri: '', tenant: 'consumers', folderPath: 'Averbacoes', refreshToken: '' });
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
                placeholder="Averbacoes"
              />
              <small style={{ color: '#64748b' }}>
                Ex: Averbacoes (gera uploads em /Averbacoes/&lt;ano&gt;...). Use caminhos relativos ao raiz do OneDrive.
              </small>
            </div>
            <div>
              <label style={fieldLabelStyle}>ONEDRIVE_REFRESH_TOKEN</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea
                  style={{ ...inputStyle, flex: 1, minHeight: 120, fontFamily: 'monospace' }}
                  value={form.refreshToken}
                  onChange={e => handleChange('refreshToken', e.target.value)}
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

      <Toast
        message={toastMessage}
        type={toastType}
        onClose={() => setToastMessage('')}
      />
    </div>
  );
}

export default OnedriveConfig;
