import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extrairTexto, identificarTipo, analisarExigencia, gerarTextoAverbacao } from '../servicos/IAWorkflowService';
import { listarLegislacao } from '../servicos/LegislacaoService';

function AssistenteMandadosAverbacao() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extracted, setExtracted] = useState('');
  const [tipo, setTipo] = useState('');
  const [tipoConfidence, setTipoConfidence] = useState(null);
  const [legislacao, setLegislacao] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [textoAverbacao, setTextoAverbacao] = useState('');
  const [manual, setManual] = useState(false);

  const onFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setError('');
    setExtracted('');
    setTipo('');
    setTipoConfidence(null);
    setLegislacao([]);
    setResultado(null);
    setTextoAverbacao('');
    setManual(false);
  };

  const handleExtrairTexto = async () => {
    setError('');
    setResultado(null);
    setTipo('');
    setTipoConfidence(null);
    setLegislacao([]);
  setTextoAverbacao('');
    if (!file) {
      setError('Selecione um PDF do mandado judicial.');
      return;
    }
    try {
      setLoading(true);
      const { text, warning } = await extrairTexto(file);
      setExtracted(text || '');
      if (!text) {
        setError((warning || 'Não foi possível extrair texto do PDF.') + ' Dica: envie um PDF pesquisável (não escaneado/sem senha) ou use a edição manual.');
      }
    } catch (e) {
      setError(e?.message || 'Falha ao extrair texto do PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleIdentificarTipo = async () => {
    setError('');
    setResultado(null);
  setTextoAverbacao('');
    if (!extracted || extracted.trim().length < 5) {
      setError('Extraia o texto primeiro.');
      return;
    }
    try {
      setLoading(true);
      const { tipo, confidence } = await identificarTipo(extracted);
      setTipo(tipo || '');
      setTipoConfidence(confidence ?? null);
      try {
        const lista = await listarLegislacao({ indexador: tipo, ativo: true });
        setLegislacao(Array.isArray(lista) ? lista : []);
      } catch (_) {
        // Optional: silently ignore; user can still run analysis without legislação
      }
    } catch (e) {
      setError(e?.message || 'Falha ao identificar tipo do mandado.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalisarExigencia = async () => {
    setError('');
    if (!extracted || extracted.trim().length < 5) {
      setError('Extraia o texto primeiro.');
      return;
    }
    try {
      setLoading(true);
      const resp = await analisarExigencia({ text: extracted, legislacao, tipo });
      setResultado(resp);
    } catch (e) {
      setError(e?.message || 'Falha ao analisar exigência.');
    } finally {
      setLoading(false);
    }
  };

  const handleGerarTextoAverbacao = async () => {
    setError('');
    if (!extracted || extracted.trim().length < 5) {
      setError('Extraia o texto primeiro.');
      return;
    }
    try {
      setLoading(true);
      const { textoAverbacao } = await gerarTextoAverbacao({ text: extracted, legislacao, tipo });
      setTextoAverbacao(textoAverbacao || '');
    } catch (e) {
      setError(e?.message || 'Falha ao gerar texto da averbação.');
    } finally {
      setLoading(false);
    }
  };

  const copyAverbacao = async () => {
    if (!textoAverbacao) return;
    try {
      await navigator.clipboard.writeText(textoAverbacao);
      alert('Texto da averbação copiado.');
    } catch (_) {
      alert('Não foi possível copiar o texto.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff3bf 0%, #ffe066 100%)', fontFamily: 'Arial, sans-serif' }}>
      <header style={{
        background: 'rgba(44, 62, 80, 0.95)', backdropFilter: 'blur(10px)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/ferramentas-ia')} style={{
            background: 'rgba(255, 255, 255, 0.1)', border: '2px solid rgba(255, 255, 255, 0.3)', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.3s ease'
          }}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(255, 255, 255, 0.2)'; }}
            onMouseLeave={(e) => { e.target.style.background = 'rgba(255, 255, 255, 0.1)'; }}>
            ← Voltar
          </button>
          <h1 style={{ color: 'white', margin: 0, fontSize: '24px', fontWeight: 600, letterSpacing: '0.5px' }}>
            Assistente de Mandados de Averbação
          </h1>
        </div>
      </header>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px' }}>
        <section style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Envie o mandado judicial (PDF)</h2>
          <p style={{ color: '#7f8c8d', marginTop: 0 }}>Fluxo em 3 passos: extrair texto, identificar tipo e analisar exigência legal.</p>

          <input type="file" accept="application/pdf" onChange={onFileChange} />

          <div style={{ marginTop: 16 }}>
            <button onClick={handleExtrairTexto} disabled={loading} style={{
              background: '#f1c40f', color: '#2c3e50', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700
            }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.filter = 'brightness(0.95)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}>
              {loading ? 'Processando…' : 'Extrair texto'}
            </button>
            <button onClick={handleIdentificarTipo} disabled={loading || !extracted} style={{
              background: '#74b9ff', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: (!extracted || loading) ? 'not-allowed' : 'pointer', fontWeight: 700, marginLeft: 12
            }}>
              Identificar tipo do mandado
            </button>
            <button onClick={handleAnalisarExigencia} disabled={loading || !extracted} style={{
              background: '#00b894', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: (!extracted || loading) ? 'not-allowed' : 'pointer', fontWeight: 700, marginLeft: 12
            }}>
              Analisar exigência legal
            </button>
            <button onClick={handleGerarTextoAverbacao} disabled={loading || !extracted} style={{
              background: '#27ae60', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: (!extracted || loading) ? 'not-allowed' : 'pointer', fontWeight: 700, marginLeft: 12
            }}>
              Gerar texto da averbação
            </button>
          </div>

          {error && <div style={{ marginTop: 16, color: '#c0392b' }}>{error}</div>}

          {(error || extracted === '') && (
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => setManual(true)} style={{ background: 'transparent', border: 'none', color: '#1f4ba0', textDecoration: 'underline', cursor: 'pointer' }}>
                Colar/editar texto manualmente
              </button>
              {manual && <span style={{ marginLeft: 8, color: '#555' }}>(modo manual ativo)</span>}
            </div>
          )}

          {(extracted || tipo || (legislacao && legislacao.length) || resultado) && (
            <div style={{ marginTop: 24 }}>
              {(extracted !== '' || manual) && (
                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>Texto extraído do PDF</h3>
                  <textarea
                    readOnly={!manual}
                    value={extracted}
                    onChange={(e) => manual && setExtracted(e.target.value)}
                    placeholder={manual ? 'Cole aqui o texto do mandado…' : ''}
                    style={{ width: '100%', minHeight: 200, padding: 12, borderRadius: 8, border: '1px solid #ecf0f1' }}
                  />
                  {manual && (
                    <div style={{ marginTop: 8, color: '#7f8c8d' }}>
                      Dica: cole o texto do mandado acima e prossiga para os próximos passos.
                    </div>
                  )}
                </div>
              )}

              {(tipo || tipoConfidence !== null) && (
                <div>
                  <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#eef5ff', color: '#1f4ba0', marginTop: 12 }}>
                    <strong>Tipo de mandado:</strong> {tipo || 'n/d'} {tipoConfidence !== null ? `(confiança: ${Math.round(tipoConfidence * 100)}%)` : ''}
                  </div>
                </div>
              )}

              {Array.isArray(legislacao) && legislacao.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>Legislação correlata (indexador = {tipo || 'n/d'})</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {legislacao.map((l) => (
                      <li key={l.id} style={{ color: '#2c3e50' }}>
                        <strong>{l.base_legal}</strong>{l.artigo ? ` - ${l.artigo}` : ''}: {l.texto}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {resultado?.checklist?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>Checklist</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ecf0f1', padding: 8 }}>Requisito</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ecf0f1', padding: 8 }}>OK</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.checklist.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ borderBottom: '1px solid #ecf0f1', padding: 8 }}>{item.requisito}</td>
                            <td style={{ borderBottom: '1px solid #ecf0f1', padding: 8 }}>{item.ok ? '✔️' : '❌'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {resultado?.orientacao && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>Orientação</h3>
                  <textarea readOnly value={resultado.orientacao} style={{ width: '100%', minHeight: 140, padding: 12, borderRadius: 8, border: '1px solid #ecf0f1' }} />
                </div>
              )}

              {typeof resultado?.aprovado === 'boolean' && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', background: resultado.aprovado ? '#d4edda' : '#fdecea', color: resultado.aprovado ? '#155724' : '#611a15', marginTop: 12 }}>
                  {resultado.aprovado ? 'Aprovado' : 'Não aprovado'}
                </div>
              )}

              {textoAverbacao && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>Texto da Averbação</h3>
                  <textarea readOnly value={textoAverbacao} style={{ width: '100%', minHeight: 160, padding: 12, borderRadius: 8, border: '1px solid #ecf0f1' }} />
                  <div style={{ marginTop: 8 }}>
                    <button onClick={copyAverbacao} style={{ background: '#2ecc71', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                      Copiar texto
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AssistenteMandadosAverbacao;
