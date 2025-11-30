import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import config from './config';


export default function ConfigurarServentia({ onClose }) {
  const { user } = useContext(AuthContext);
  const [caixaUnificado, setCaixaUnificado] = useState(false);
  const [iaAgent, setIaAgent] = useState('');
  const [iaAgentFallback1, setIaAgentFallback1] = useState('');
  const [iaAgentFallback2, setIaAgentFallback2] = useState('');
  const [agentsModalOpen, setAgentsModalOpen] = useState(false);
  const [agentsList, setAgentsList] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
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
        if (data && typeof data.ia_agent !== 'undefined') {
          setIaAgent(data.ia_agent || '');
        }
        if (data && typeof data.ia_agent_fallback1 !== 'undefined') {
          setIaAgentFallback1(data.ia_agent_fallback1 || '');
        }
        if (data && typeof data.ia_agent_fallback2 !== 'undefined') {
          setIaAgentFallback2(data.ia_agent_fallback2 || '');
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
    // include IA agent config
    if (typeof iaAgent !== 'undefined') body.ia_agent = iaAgent;
    if (typeof iaAgentFallback1 !== 'undefined') body.ia_agent_fallback1 = iaAgentFallback1;
    if (typeof iaAgentFallback2 !== 'undefined') body.ia_agent_fallback2 = iaAgentFallback2;
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

  const handleFetchAgents = async () => {
    setAgentsList([]);
    setLoadingAgents(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${config.apiURL}/ia/diagnostics`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      // Expecting data.agents or data (flexible)
      const agents = data?.agents || data || [];
      setAgentsList(Array.isArray(agents) ? agents : []);
      setAgentsModalOpen(true);
    } catch (err) {
      console.error('[ConfigurarServentia] Erro ao buscar agentes IA', err);
      setError('Falha ao buscar agentes IA: ' + (err?.message || err));
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleUseAgent = (agentId, target) => {
    if (target === 'primary') setIaAgent(agentId || '');
    else if (target === 'fb1') setIaAgentFallback1(agentId || '');
    else if (target === 'fb2') setIaAgentFallback2(agentId || '');
    // keep modal open for quick multi-selects; close only on explicit close
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
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <label style={{ fontWeight: 700, display: 'block' }}>IA Agent (primário)</label>
              <button
                type="button"
                onClick={handleFetchAgents}
                disabled={loadingAgents || saving}
                style={{
                  marginLeft: 'auto',
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  cursor: loadingAgents || saving ? 'not-allowed' : 'pointer',
                  fontWeight: 700
                }}
                title="Buscar agentes IA disponíveis"
              >
                {loadingAgents ? 'Buscando...' : 'Buscar agentes IA'}
              </button>
            </div>
            <textarea
              value={iaAgent}
              onChange={e => setIaAgent(e.target.value)}
              placeholder="ID ou configuração do agente IA (ex.: 'google-gemini')"
              rows={3}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc', resize: 'vertical' }}
              disabled={saving}
            />
            <small style={{ color: '#666' }}>Valor salvo em `ia_agent` na tabela `serventia`. Use "Buscar agentes IA" para selecionar.</small>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>IA Agent Fallback 1</label>
            <textarea
              value={iaAgentFallback1}
              onChange={e => setIaAgentFallback1(e.target.value)}
              placeholder="Fallback 1 para IA (ex.: 'openai-gpt')"
              rows={2}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc', resize: 'vertical' }}
              disabled={saving}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>IA Agent Fallback 2</label>
            <textarea
              value={iaAgentFallback2}
              onChange={e => setIaAgentFallback2(e.target.value)}
              placeholder="Fallback 2 para IA"
              rows={2}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc', resize: 'vertical' }}
              disabled={saving}
            />
          </div>
          {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
          {success && <div style={{ color: 'green', marginBottom: 12 }}>Configuração salva com sucesso!</div>}
          {/* Agents modal */}
          {agentsModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
              <div style={{ width: '720px', maxWidth: '95%', maxHeight: '80%', overflow: 'auto', background: 'white', borderRadius: 8, padding: 18 }}>
                <h3 style={{ marginTop: 0 }}>Agentes IA disponíveis</h3>
                <div style={{ marginBottom: 12 }}>
                  <button type="button" onClick={() => setAgentsModalOpen(false)} style={{ marginRight: 8 }}>Fechar</button>
                </div>
                {agentsList.length === 0 ? (
                  <div>Nenhum agente encontrado.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 8 }}>ID / Nome</th>
                        <th style={{ textAlign: 'left', padding: 8 }}>Descrição</th>
                        <th style={{ padding: 8 }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentsList.map((a, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid #eee' }}>
                          <td style={{ padding: 8, verticalAlign: 'top' }}>{a.id ?? a.name ?? a.agentId ?? a}</td>
                          <td style={{ padding: 8, verticalAlign: 'top', color: '#444' }}>{a.description ?? a.desc ?? ''}</td>
                          <td style={{ padding: 8, verticalAlign: 'top' }}>
                            <button type="button" onClick={() => { handleUseAgent(a.id ?? a.name ?? a.agentId ?? a, 'primary'); }} style={{ marginRight: 6 }}>Usar como primário</button>
                            <button type="button" onClick={() => { handleUseAgent(a.id ?? a.name ?? a.agentId ?? a, 'fb1'); }} style={{ marginRight: 6 }}>Usar como fallback 1</button>
                            <button type="button" onClick={() => { handleUseAgent(a.id ?? a.name ?? a.agentId ?? a, 'fb2'); }}>Usar como fallback 2</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => { setAgentsModalOpen(false); setSuccess(false); }} style={{ padding: '8px 12px' }}>Fechar</button>
                  <button type="button" onClick={() => { setAgentsModalOpen(false); setSuccess(false); handleSalvar(); }} style={{ padding: '8px 12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: 6 }}>Salvar alterações</button>
                </div>
              </div>
            </div>
          )}
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
