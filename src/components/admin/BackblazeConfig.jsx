import React, { useEffect, useState } from 'react';
import BackblazeConfigService from '../../services/BackblazeConfigService';
import Toast from '../Toast';
import { DEFAULT_TOAST_DURATION } from '../toastConfig';

export default function BackblazeConfig() {
  const [config, setConfig] = useState({ endpoint: '', region: '', key: '', secret: '', bucket: '', prefix: '' });
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await BackblazeConfigService.getConfig();
        // service may return an object or an array; handle both
        const cfg = Array.isArray(data) ? (data[0] || {}) : (data || {});
        setConfig({
          endpoint: cfg.endpoint || '',
          region: cfg.region || '',
          key: cfg.key || '',
          secret: cfg.secret || '',
          bucket: cfg.bucket || '',
          prefix: cfg.prefix || ''
        });
      } catch (e) {
        // ignore 404/no-config
      }
      setLoading(false);
    };
    load();
  }, []);

  const showToast = (type, message) => {
    setToastType(type);
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), DEFAULT_TOAST_DURATION);
  };

  const handleChange = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setLoading(true);
    try {
      await BackblazeConfigService.saveConfig(config);
      showToast('success', 'Configuração salva com sucesso.');
    } catch (e) {
      console.error('save backblaze', e);
      showToast('error', e?.message || 'Erro ao salvar configuração.');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Remover configuração Backblaze?')) return;
    setLoading(true);
    try {
      // Try to fetch current id (service may return id or not)
      const current = await BackblazeConfigService.getConfig().catch(() => null);
      const id = current && (current.id || (Array.isArray(current) && current[0] && current[0].id));
      if (!id) {
        showToast('error', 'Não foi possível identificar a configuração para remover.');
        return;
      }
      await BackblazeConfigService.deleteConfig(id);
      setConfig({ endpoint: '', region: '', key: '', secret: '', bucket: '', prefix: '' });
      showToast('success', 'Configuração removida.');
    } catch (e) {
      console.error('delete backblaze', e);
      showToast('error', e?.message || 'Erro ao remover configuração.');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 12 }}>
      <h3>Backblaze B2 - Configuração</h3>
      <p style={{ color: '#666' }}>Insira as credenciais e o bucket para que uploads presigned funcionem.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>Endpoint (ex: https://s3.us-east-005.backblazeb2.com)</label>
          <input className="servico-input" value={config.endpoint} onChange={e => handleChange('endpoint', e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>Região</label>
          <input className="servico-input" value={config.region} onChange={e => handleChange('region', e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>Bucket</label>
          <input className="servico-input" value={config.bucket} onChange={e => handleChange('bucket', e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>Prefixo (opcional)</label>
          <input className="servico-input" value={config.prefix} onChange={e => handleChange('prefix', e.target.value)} placeholder="ex: averbacoes/" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>Access Key ID</label>
          <input className="servico-input" value={config.key} onChange={e => handleChange('key', e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label>Application Key (secret)</label>
          <input className="servico-input" value={config.secret} onChange={e => handleChange('secret', e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button className="btn btn-success" onClick={handleSave} disabled={loading}>{loading ? 'Salvando…' : 'Salvar'}</button>
        <button className="btn btn-danger" onClick={handleDelete} disabled={loading}>Remover</button>
      </div>

      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />
    </div>
  );
}
