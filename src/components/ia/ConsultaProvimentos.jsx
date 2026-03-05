import React, { useEffect, useState } from 'react';
import IAAgentService from '../../services/IAAgentService';
import PromptsService from '../../services/PromptsService';
import '../../buttonGradients.css';

function renderLogs(logs = []) {
  if (!Array.isArray(logs) || logs.length === 0) return null;
  return (
    <div style={{ background: '#0b1d3a', color: '#dbeafe', padding: 12, borderRadius: 10, minHeight: 120 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Andamento</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {logs.map((line, idx) => (
          <div key={`log-${idx}`} style={{ fontFamily: 'Courier New, monospace', fontSize: 13 }}>
            {String(line)}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderArtigos(artigos = []) {
  if (!Array.isArray(artigos) || artigos.length === 0) {
    return <div style={{ color: '#6b7280' }}>Nenhum artigo identificado na resposta.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {artigos.map((a, idx) => (
        <div key={`art-${idx}`} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb' }}>
          <div style={{ fontWeight: 800, color: '#111827' }}>{a.provimento || 'Provimento'}</div>
          <div style={{ fontSize: 14, color: '#1f2937', marginTop: 4 }}>{a.artigo || 'Artigo não informado'}</div>
          {a.trecho ? (
            <div style={{ marginTop: 6, color: '#374151', lineHeight: 1.5 }}>{a.trecho}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function ConsultaProvimentos() {
  const [pergunta, setPergunta] = useState('');
  const [loading, setLoading] = useState(false);
  const [resposta, setResposta] = useState('');
  const [artigos, setArtigos] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [model, setModel] = useState('');
  const [promptInfo, setPromptInfo] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await PromptsService.getByIndexador('balisador_consulta_provimentos');
        setPromptInfo(p || null);
      } catch (_) {
        setPromptInfo(null);
      }
    })();
  }, []);

  const pushLog = (line) => setLogs((prev) => [...prev, line]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pergunta.trim()) {
      setError('Digite uma pergunta para consultar os provimentos.');
      return;
    }
    setError('');
    setResposta('');
    setArtigos([]);
    setLogs([]);
    setModel('');
    setLoading(true);
    pushLog('Iniciando consulta...');
    try {
      const resp = await IAAgentService.consultarProvimentos({ pergunta: pergunta.trim() });
      if (Array.isArray(resp.logs) && resp.logs.length) {
        setLogs((prev) => [...prev, ...resp.logs]);
      }
      setResposta(resp.resposta || resp.answer || '');
      setArtigos(Array.isArray(resp.artigos) ? resp.artigos : []);
      setModel(resp.model || '');
      pushLog('Consulta finalizada.');
    } catch (err) {
      const msg = err?.message || 'Erro ao consultar os provimentos.';
      setError(msg);
      if (Array.isArray(err?.logs) && err.logs.length) {
        setLogs((prev) => [...prev, ...err.logs]);
      }
      pushLog(`Erro: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '28px 22px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Consulta de Provimentos</div>
        <div style={{ color: '#4b5563', marginTop: 6, lineHeight: 1.5 }}>
          Pergunte ao agente de IA usando o Provimento CNJ 149/2023 e o Provimento TJMG 93/2020 (busca online em tempo real).
        </div>
        <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>
          Indexador do prompt: <strong>balisador_consulta_provimentos</strong>
          {promptInfo?.updated_at ? ` • atualizado em ${new Date(promptInfo.updated_at).toLocaleString()}` : ''}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 18, alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontWeight: 700, color: '#111827' }}>Pergunta</label>
            <textarea
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Ex.: Quais prazos estão previstos para registro e averbação segundo os provimentos?"
              rows={5}
              style={{ width: '100%', borderRadius: 10, border: '1px solid #d1d5db', padding: 12, resize: 'vertical', fontSize: 14, lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="submit"
                className="btn-gradient btn-gradient-blue"
                disabled={loading}
                style={{ minWidth: 180, opacity: loading ? 0.75 : 1 }}
              >
                {loading ? 'Consultando...' : 'Consultar provimentos'}
              </button>
              {model ? <span style={{ color: '#6b7280', fontSize: 13 }}>Agente: {model}</span> : null}
            </div>
            {error ? <div style={{ color: '#dc2626', fontWeight: 600 }}>{error}</div> : null}
          </form>
        </div>

        {renderLogs(logs)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 18, alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.05)', minHeight: 200 }}>
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Resposta</div>
          {resposta ? (
            <div style={{ color: '#1f2937', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{resposta}</div>
          ) : (
            <div style={{ color: '#6b7280' }}>Nenhuma resposta ainda.</div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Artigos utilizados</div>
          {renderArtigos(artigos)}
        </div>
      </div>
    </div>
  );
}
