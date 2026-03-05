import React, { useEffect, useState } from 'react';
import IAAgentService from '../../services/IAAgentService';
import PromptsService from '../../services/PromptsService';
import '../../buttonGradients.css';
import './ConsultaProvimentos.css';

function renderLogs(logs = []) {
  if (!Array.isArray(logs) || logs.length === 0) return null;
  return (
    <div className="ia-card ia-card--logs">
      <div className="ia-card-title">Andamento</div>
      <div className="ia-logs">
        {logs.map((line, idx) => (
          <div key={`log-${idx}`} className="ia-log-line">
            {String(line)}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderArtigos(artigos = []) {
  if (!Array.isArray(artigos) || artigos.length === 0) {
    return <div className="ia-empty">Nenhum artigo identificado na resposta.</div>;
  }
  return (
    <div className="ia-artigos">
      {artigos.map((a, idx) => (
        <div key={`art-${idx}`} className="ia-artigo-card">
          <div className="ia-artigo-head">
            <span className="ia-pill">{a.provimento || 'Provimento'}</span>
            <span className="ia-artigo-label">{a.artigo || 'Artigo não informado'}</span>
          </div>
          {a.trecho ? <div className="ia-artigo-texto">{a.trecho}</div> : null}
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
        return (
          <div className="ia-shell">
            <div className="ia-hero">
              <div>
                <div className="ia-title">Consulta de Provimentos</div>
                <div className="ia-subtitle">
                  Pergunte ao agente de IA usando o Provimento CNJ 149/2023 e o Provimento TJMG 93/2020 (busca online em tempo real).
                </div>
                <div className="ia-meta">
                  Indexador do prompt: <strong>balisador_consulta_provimentos</strong>
                  {promptInfo?.updated_at ? ` • atualizado em ${new Date(promptInfo.updated_at).toLocaleString()}` : ''}
                </div>
              </div>
              <div className="ia-badge">IA • Normas</div>
            </div>

            <div className="ia-grid">
              <div className="ia-card ia-card--form">
                <form onSubmit={handleSubmit} className="ia-form">
                  <label className="ia-label">Pergunta</label>
                  <textarea
                    value={pergunta}
                    onChange={(e) => setPergunta(e.target.value)}
                    placeholder="Ex.: Quais prazos estão previstos para registro e averbação segundo os provimentos?"
                    rows={5}
                    className="ia-textarea"
                  />
                  <div className="ia-actions">
                    <button
                      type="submit"
                      className="btn-gradient btn-gradient-blue"
                      disabled={loading}
                      style={{ minWidth: 180, opacity: loading ? 0.75 : 1 }}
                    >
                      {loading ? 'Consultando...' : 'Consultar provimentos'}
                    </button>
                    {model ? <span className="ia-agent">Agente: {model}</span> : null}
                  </div>
                  {error ? <div className="ia-error">{error}</div> : null}
                </form>
              </div>

              {renderLogs(logs)}
            </div>

            <div className="ia-grid">
              <div className="ia-card ia-card--response">
                <div className="ia-card-title">Resposta</div>
                {resposta ? (
                  <div className="ia-resposta">{resposta}</div>
                ) : (
                  <div className="ia-empty">Nenhuma resposta ainda.</div>
                )}
              </div>

              <div className="ia-card">
                <div className="ia-card-title">Artigos utilizados</div>
                {renderArtigos(artigos)}
              </div>
            </div>
          </div>
        );
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
