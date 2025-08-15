import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import config from '../../config';


export default function ConfigurarServentia({ onClose }) {
  const { user } = useContext(AuthContext);
  const [caixaUnificado, setCaixaUnificado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Fetch config on mount
  useEffect(() => {
    if (!user || !user.serventia) {
      setError('Usuário sem serventia vinculada.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const url = `${config.apiURL}/configuracoes-serventia?serventia=${encodeURIComponent(user.serventia)}`;
    console.log('[ConfigurarServentia] Usuário logado:', user);
    console.log('[ConfigurarServentia] Buscando config da serventia:', user.serventia, 'URL:', url);
    fetch(url)
      .then(async res => {
        console.log('[ConfigurarServentia] Resposta GET status:', res.status);
        if (!res.ok) throw new Error('Erro ao carregar configuração');
        const text = await res.text();
        if (!text) return {};
        try {
          return JSON.parse(text);
        } catch {
          return {};
        }
      })
      .then(data => {
        console.log('[ConfigurarServentia] Dados recebidos GET:', data);
        if (data && typeof data.caixa_unificado !== 'undefined') {
          setCaixaUnificado(!!data.caixa_unificado);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('[ConfigurarServentia] Erro GET:', err);
        setError(err.message || 'Erro ao carregar configuração');
        setLoading(false);
      });
  }, [user]);

  // Save config
  const handleSalvar = () => {
    if (!user || !user.serventia) {
      setError('Usuário sem serventia vinculada.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    const body = {
      caixa_unificado: caixaUnificado,
      serventia: user.serventia
    };
    console.log('[ConfigurarServentia] Salvando config:', body);
    fetch(`${config.apiURL}/configuracoes-serventia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(async res => {
        console.log('[ConfigurarServentia] Resposta POST status:', res.status);
        if (!res.ok) throw new Error('Erro ao salvar configuração');
        const text = await res.text();
        if (!text) return {};
        try {
          return JSON.parse(text);
        } catch {
          return {};
        }
      })
      .then(data => {
        console.log('[ConfigurarServentia] Dados recebidos POST:', data);
        setSuccess(true);
        setSaving(false);
      })
      .catch(err => {
        console.error('[ConfigurarServentia] Erro POST:', err);
        setError(err.message || 'Erro ao salvar configuração');
        setSaving(false);
      });
  };

  return (
    <div style={{ padding: 32, maxWidth: 500 }}>
      <h2 style={{ marginBottom: 24 }}>Configurar Serventia</h2>
      {loading ? (
        <div>Carregando...</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <label style={{ fontWeight: 600, fontSize: 16 }}>
              Caixa Unificado?
            </label>
            <span
              style={{
                background: '#eee',
                borderRadius: '50%',
                width: 22,
                height: 22,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                cursor: 'pointer',
                marginLeft: 4
              }}
              title="Caso esta opção esteja marcada, todos os lançamentos feitos pelos escreventes serão lançados em um único caixa. Caso esteja desmarcado, cada escrevente terá seu próprio caixa."
            >
              ?
            </span>
            <input
              type="checkbox"
              checked={caixaUnificado}
              onChange={e => setCaixaUnificado(e.target.checked)}
              style={{ marginLeft: 12, width: 20, height: 20 }}
              disabled={saving}
            />
          </div>
          {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
          {success && <div style={{ color: 'green', marginBottom: 12 }}>Configuração salva com sucesso!</div>}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleSalvar}
              style={{
                padding: '8px 24px',
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 15,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1
              }}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '8px 24px',
                background: '#888',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
