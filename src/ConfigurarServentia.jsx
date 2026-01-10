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
      const resp = await fetch(`${config.apiURL}/ia/agents`, {
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
    <div style={{ padding: 20, width: '100%', maxWidth: 820, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Configurar Serventia</h2>
        <button onClick={onClose} aria-label="Fechar modal" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: '#374151' }}>✕</button>
      </div>
      {loading ? (
        <div>Carregando...</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontWeight: 700, fontSize: 14 }}>Caixa Unificado?</label>
              <small style={{ color: '#6b7280' }}>Se marcado, todos os lançamentos irão para um único caixa.</small>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={caixaUnificado}
                onChange={e => setCaixaUnificado(e.target.checked)}
                style={{ width: 20, height: 20 }}
                disabled={saving}
              />
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <label style={{ fontWeight: 700, display: 'block' }}>IA Agent (primário)</label>
              <button
                type="button"
                onClick={handleFetchAgents}
                disabled={loadingAgents || saving}
                style={{
                  marginLeft: 'auto',
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: '#0ea5a3',
                  color: 'white',
                  border: 'none',
                  cursor: loadingAgents || saving ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  boxShadow: '0 6px 18px rgba(14,165,163,0.12)'
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
              style={{ width: '100%', padding: 10, borderRadius: 12, border: '1px solid #e6eef6', background: '#fbfdff', resize: 'vertical', fontSize: 14 }}
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
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
              <div style={{ width: '820px', maxWidth: '100%', maxHeight: '85%', overflow: 'auto', background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 20px 60px rgba(2,6,23,0.2)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0 }}>Agentes IA disponíveis</h3>
                  <button type="button" onClick={() => setAgentsModalOpen(false)} aria-label="Fechar agentes" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, color: '#6b7280' }}>{agentsList.length === 0 ? 'Nenhum agente encontrado.' : `${agentsList.length} agentes encontrados`}</div>
                </div>
                <div style={{ width: '100%', overflow: 'auto' }}>
                  {agentsList.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                      {agentsList.map((a, idx) => {
                        const agentKey = a.id ?? a.name ?? a.agentId ?? a;
                        const isPrimary = String(agentKey) === String(iaAgent);
                        const isFb1 = String(agentKey) === String(iaAgentFallback1);
                        const isFb2 = String(agentKey) === String(iaAgentFallback2);
                        return (
                          <div key={idx} style={{ borderRadius: 10, padding: 12, background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{agentKey}</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {isPrimary && <span style={{ background: '#065f46', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>Primário</span>}
                                {isFb1 && <span style={{ background: '#3f3f46', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>Fallback 1</span>}
                                {isFb2 && <span style={{ background: '#1f2937', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>Fallback 2</span>}
                              </div>
                            </div>
                            <div style={{ color: '#475569', fontSize: 13, minHeight: 36 }}>{a.description ?? a.desc ?? ''}</div>
                            <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => { handleUseAgent(agentKey, 'primary'); }}
                                aria-pressed={isPrimary}
                                style={{
                                  flex: 1,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  background: isPrimary ? '#065f46' : '#0ea5a3',
                                  color: '#fff',
                                  border: isPrimary ? '2px solid rgba(0,0,0,0.06)' : 'none',
                                  boxShadow: isPrimary ? 'inset 0 2px 4px rgba(0,0,0,0.12)' : 'none'
                                }}
                              >
                                Primário
                              </button>
                              <button
                                type="button"
                                onClick={() => { handleUseAgent(agentKey, 'fb1'); }}
                                aria-pressed={isFb1}
                                style={{
                                  flex: 1,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  background: isFb1 ? '#3f3f46' : '#94a3b8',
                                  color: '#fff',
                                  border: isFb1 ? '2px solid rgba(0,0,0,0.06)' : 'none',
                                  boxShadow: isFb1 ? 'inset 0 2px 4px rgba(0,0,0,0.12)' : 'none'
                                }}
                              >
                                Fallback 1
                              </button>
                              <button
                                type="button"
                                onClick={() => { handleUseAgent(agentKey, 'fb2'); }}
                                aria-pressed={isFb2}
                                style={{
                                  flex: 1,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  background: isFb2 ? '#1f2937' : '#64748b',
                                  color: '#fff',
                                  border: isFb2 ? '2px solid rgba(0,0,0,0.06)' : 'none',
                                  boxShadow: isFb2 ? 'inset 0 2px 4px rgba(0,0,0,0.12)' : 'none'
                                }}
                              >
                                Fallback 2
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setAgentsModalOpen(false); setSuccess(false); }} style={{ padding: '8px 12px', borderRadius: 8, background: '#e5e7eb', border: 'none' }}>Fechar</button>
                  <button type="button" onClick={() => { setAgentsModalOpen(false); setSuccess(false); handleSalvar(); }} style={{ padding: '8px 12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: 8 }}>Salvar alterações</button>
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
