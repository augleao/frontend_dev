import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { iniciarAnalise, obterStatus } from '../servicos/IAAsyncService';

function AssistenteMandadosAverbacao() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null); // { aprovado, motivos[], checklist[], textoAverbacao }
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null); // { state, step, message, progress, textPreview }
  const [pollTimer, setPollTimer] = useState(null);

  const onFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setResultado(null);
    setError('');
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearTimeout(pollTimer);
      setPollTimer(null);
    }
  };

  const pollStatus = async (id) => {
    try {
      const s = await obterStatus(id);
      setStatus(s);
      if (s.state === 'done') {
        setResultado(s.result || null);
        setLoading(false);
        setPollTimer(null);
        return;
      }
      if (s.state === 'error') {
        setError(s.message || 'Falha no processamento');
        setLoading(false);
        setPollTimer(null);
        return;
      }
      const t = setTimeout(() => pollStatus(id), 1200);
      setPollTimer(t);
    } catch (e) {
      setError(e?.message || 'Falha ao consultar status');
      setLoading(false);
      setPollTimer(null);
    }
  };

  // Cleanup polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [pollTimer]);

  const handleAnalyze = async () => {
    setError('');
    setResultado(null);
    setStatus(null);
    stopPolling();
    if (!file) {
      setError('Selecione um PDF do mandado judicial.');
      return;
    }
    try {
      setLoading(true);
      const start = await iniciarAnalise(file, { tipoAto: 'averbacao' });
      if (start && start.result) {
        // Fallback síncrono: backend não possui rota assíncrona
        setResultado(start.result);
        setStatus({ state: 'done', step: 'completed', message: 'Análise concluída', progress: 100 });
        setLoading(false);
        return;
      }
      setJobId(start.jobId);
      await pollStatus(start.jobId);
    } catch (e) {
      setError(e?.message || 'Falha ao analisar o mandado.');
      setLoading(false);
    } finally {
      // loading será finalizado no término do polling
    }
  };

  const copyAverbacao = async () => {
    if (!resultado?.textoAverbacao) return;
    try {
      await navigator.clipboard.writeText(resultado.textoAverbacao);
      alert('Texto da averbação copiado para a área de transferência.');
    } catch (_) {
      alert('Não foi possível copiar o texto.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fff3bf 0%, #ffe066 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(44, 62, 80, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/ferramentas-ia')}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            ← Voltar
          </button>
          <h1 style={{
            color: 'white',
            margin: 0,
            fontSize: '24px',
            fontWeight: '600',
            letterSpacing: '0.5px'
          }}>
            Assistente de Mandados de Averbação
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px' }}>
        <section style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Envie o mandado judicial (PDF)</h2>
          <p style={{ color: '#7f8c8d', marginTop: 0 }}>O arquivo será analisado à luz da legislação cadastrada no sistema.</p>

          <input type="file" accept="application/pdf" onChange={onFileChange} />

          <div style={{ marginTop: '16px' }}>
            <button
              onClick={handleAnalyze}
              disabled={loading}
              style={{
                background: '#f1c40f',
                color: '#2c3e50',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 700
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.filter = 'brightness(0.95)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
            >
              {loading ? 'Analisando…' : 'Analisar'}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: '16px', color: '#c0392b' }}>
              {error}
            </div>
          )}

          {(status || resultado) && (
            <div style={{ marginTop: '24px' }}>
              {status && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#eef5ff', color: '#1f4ba0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{status.step ? status.step.replace(/_/g, ' ') : 'Processando…'}</strong>
                    <span>{typeof status.progress === 'number' ? `${status.progress}%` : ''}</span>
                  </div>
                  <div style={{ marginTop: 6 }}>{status.message}</div>
                </div>
              )}

              {status?.textPreview && (
                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>Prévia do texto extraído</h3>
                  <textarea readOnly value={status.textPreview} style={{ width: '100%', minHeight: 120, padding: 12, borderRadius: 8, border: '1px solid #ecf0f1' }} />
                </div>
              )}

              {resultado && (
                <div>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: resultado.aprovado ? '#d4edda' : '#fdecea',
                    color: resultado.aprovado ? '#155724' : '#611a15',
                    marginTop: 12
                  }}>
                    {resultado.aprovado ? 'Aprovado para averbação' : 'Reprovado / Inconclusivo'}
                  </div>

              {resultado.motivos?.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>Motivos</h3>
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    {resultado.motivos.map((m, idx) => (
                      <li key={idx} style={{ color: '#2c3e50' }}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {resultado.checklist?.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>Checklist</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ecf0f1', padding: '8px' }}>Requisito</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ecf0f1', padding: '8px' }}>OK</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.checklist.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ borderBottom: '1px solid #ecf0f1', padding: '8px' }}>{item.requisito}</td>
                            <td style={{ borderBottom: '1px solid #ecf0f1', padding: '8px' }}>{item.ok ? '✔️' : '❌'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {resultado.textoAverbacao && (
                <div style={{ marginTop: '16px' }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>Texto da Averbação</h3>
                  <textarea
                    readOnly
                    value={resultado.textoAverbacao}
                    style={{ width: '100%', minHeight: '160px', padding: '12px', borderRadius: '8px', border: '1px solid #ecf0f1' }}
                  />
                  <div style={{ marginTop: '8px' }}>
                    <button
                      onClick={copyAverbacao}
                      style={{
                        background: '#27ae60',
                        color: 'white',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.05)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                    >
                      Copiar texto
                    </button>
                  </div>
                </div>
              )}
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
