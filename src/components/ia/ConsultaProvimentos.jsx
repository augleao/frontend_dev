import React, { useEffect, useState } from 'react';
import IAAgentService from '../../services/IAAgentService';
import PromptsService from '../../services/PromptsService';
import '../../buttonGradients.css';
import '../../home2.css';
import './ConsultaProvimentos.css';

function renderLogs(logs = []) {
  return (
    <div className="ia-card ia-card--logs">
      <div className="ia-card-title">Andamento</div>
      <div className="ia-logs">
        {Array.isArray(logs) && logs.length > 0 ? (
          logs.map((line, idx) => (
            <div key={`log-${idx}`} className="ia-log-line">
              {String(line)}
            </div>
          ))
        ) : (
          <div className="ia-log-line ia-log-line--empty">Aguardando execução do agente.</div>
        )}
      </div>
    </div>
  );
}

const URL_CNJ = 'https://atos.cnj.jus.br/atos/detalhar/5243';
const URL_TJMG = 'http://www8.tjmg.jus.br/institucional/at/pdf/vc00932020.pdf';

const extractArtigoId = (artigo = '') => {
  const m = String(artigo || '').match(/(\d+[A-Za-z]?)/);
  return m ? m[1] : '';
};

function renderArtigos(artigos = [], resolveFonteUrl) {
  if (!Array.isArray(artigos) || artigos.length === 0) {
    return <div className="ia-empty">Nenhum artigo identificado na resposta.</div>;
  }
  return (
    <div className="ia-artigos">
      {artigos.map((a, idx) => {
        const href = resolveFonteUrl ? resolveFonteUrl(a.provimento, a.artigo) : '';
        const Container = href ? 'a' : 'div';
        const extraProps = href ? { href, target: '_blank', rel: 'noreferrer' } : {};
        return (
          <Container key={`art-${idx}`} className={`ia-artigo-card${href ? ' ia-artigo-card--link' : ''}`} {...extraProps}>
            <div className="ia-artigo-head">
              <span className="ia-pill">{a.provimento || 'Provimento'}</span>
              <span className="ia-artigo-label">{a.artigo || 'Artigo não informado'}</span>
            </div>
            {a.trecho ? <div className="ia-artigo-texto">{a.trecho}</div> : null}
            {href ? <div className="ia-artigo-open">Abrir fonte</div> : null}
          </Container>
        );
      })}
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
    pushLog('Enviando consulta ao Servidor...');
    try {
      const resp = await IAAgentService.consultarProvimentos({ pergunta: pergunta.trim() });
      if (Array.isArray(resp.logs) && resp.logs.length) {
        setLogs((prev) => [...prev, ...resp.logs]);
      }
      setResposta(resp.resposta || resp.answer || '');
      setArtigos(Array.isArray(resp.artigos) ? resp.artigos : []);
      setModel(resp.model || '');
      pushLog('Resposta recebida do Servidor.');
      pushLog('Consulta finalizada.');
    } catch (err) {
      const msg = err?.message || 'Erro ao consultar os provimentos.';
      setError(msg);
      if (Array.isArray(err?.logs) && err.logs.length) {
        setLogs((prev) => [...prev, ...err.logs]);
      }
      pushLog('Falha ao concluir consulta.');
      pushLog(`Erro: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const resolveFonteUrl = (provimento = '', artigo = '') => {
    const p = String(provimento || '').toLowerCase();
    const artigoId = extractArtigoId(artigo);

    if (p.includes('149') || p.includes('cnj')) {
      const anchor = artigoId ? `#artigo-${artigoId}` : '';
      return `${URL_CNJ}${anchor}`;
    }

    if (p.includes('93') || p.includes('tjmg') || p.includes('cgj')) {
      const searchTerm = artigo ? `#search=${encodeURIComponent(artigo)}` : '';
      return `${URL_TJMG}${searchTerm}`;
    }

    return '';
  };

  return (
    <div className="home2-shell ia-shell">
      <div className="home2-watermark" />
      <main className="home2-main ia-main">
        <div className="hero-panel ia-hero-panel">
          <div className="hero-copy">
            <div className="hero-title">Consulta de Provimentos</div>
            <div className="hero-sub">
              Pergunte ao agente de IA usando o Provimento CNJ 149/2023 e o Provimento TJMG 93/2020 (busca online em tempo real).
            </div>
            <div className="ia-meta">
              Indexador: <strong>balisador_consulta_provimentos</strong>
              {promptInfo?.updated_at ? ` • atualizado em ${new Date(promptInfo.updated_at).toLocaleString()}` : ''}
            </div>
          </div>
          <div className="ia-badge">IA • Normas</div>
        </div>

        <div className="ia-grid">
          <div className="hub-card ia-card ia-card--form">
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
          <div className="hub-card ia-card ia-card--response">
            <div className="ia-card-title">Resposta</div>
            {resposta ? (
              <div className="ia-resposta">{resposta}</div>
            ) : (
              <div className="ia-empty">Nenhuma resposta ainda.</div>
            )}
          </div>

          <div className="hub-card ia-card">
            <div className="ia-card-title">Artigos utilizados</div>
            {renderArtigos(artigos, resolveFonteUrl)}
          </div>
        </div>
      </main>
    </div>
  );
}
