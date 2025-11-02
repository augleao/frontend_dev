import React, { useEffect, useRef, useState } from 'react';
import LeituraLivrosService from '../../services/LeituraLivrosService';
import { useNavigate } from 'react-router-dom';

function renderFormattedText(text) {
  if (!text) return null;
  // suporta tags tipo [title], [success], [error], [info], [warning]
  const parts = text.split(/(\[[a-z]+\])/i);
  return parts.map((p, i) => {
    const m = p.match(/^\[([a-z]+)\]$/i);
    if (m) {
      const tag = m[1].toLowerCase();
      const style = {
        title: { color: '#ff4d4f', fontWeight: 800 },
        success: { color: '#27ae60' },
        error: { color: '#e74c3c' },
        info: { color: '#3498db' },
        warning: { color: '#f39c12' }
      }[tag] || { color: '#999' };
      return <span key={i} style={style}>{`[${tag}]`}</span>;
    }
    return <span key={i} style={{ color: '#ccc' }}>{p}</span>;
  });
}

export default function LeituraLivros() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('folder'); // 'folder' or 'upload'
  const [folderPath, setFolderPath] = useState('');
  const [files, setFiles] = useState([]);
  const [consoleLines, setConsoleLines] = useState([]);
  const consoleRef = useRef(null);
  const [jobId, setJobId] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const pollRef = useRef(null);
  // Parâmetros CRC Nacional
  const [versao, setVersao] = useState('2.6');
  const [acao, setAcao] = useState('CARGA'); // por ora apenas CARGA
  const [cns, setCns] = useState('');
  const [tipoRegistro, setTipoRegistro] = useState('NASCIMENTO'); // NASCIMENTO | CASAMENTO | OBITO
  const [maxPorArquivo, setMaxPorArquivo] = useState(2500);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleLines]);

  function pushConsole(line) {
    setConsoleLines(prev => [...prev, typeof line === 'string' ? line : JSON.stringify(line)]);
  }

  function clearConsole() {
    setConsoleLines([]);
  }

  async function startProcessing() {
    setResults([]);
    setConsoleLines([]);
    setRunning(true);
    setProgress(0);
    try {
      if (!cns.trim()) { pushConsole('[error] Informe o CNS do cartório.'); setRunning(false); return; }
      if (!versao.trim()) { pushConsole('[error] Informe a VERSAO do XML.'); setRunning(false); return; }
      if (!acao.trim()) { pushConsole('[error] Informe a ACAO (ex.: CARGA).'); setRunning(false); return; }
      pushConsole('[title] Preparando processamento para CRC Nacional');
      pushConsole(`[info] Parâmetros: VERSAO=${versao}, ACAO=${acao}, CNS=${cns}, TIPO=${tipoRegistro}, MAX_POR_ARQUIVO=${maxPorArquivo}`);
      pushConsole('[info] O XML será gerado com tags em MAIÚSCULAS, Inclusões antes de Alterações, e grupos FILIACAONASCIMENTO e DOCUMENTOS agrupados.');
      let resp;
      if (mode === 'folder') {
        if (!folderPath.trim()) { pushConsole('[error] Informe o caminho da pasta no servidor.'); setRunning(false); return; }
        pushConsole(`[info] Solicitando processamento da pasta: ${folderPath}`);
        resp = await LeituraLivrosService.startFolderProcessing(folderPath.trim(), {
          versao, acao, cns, tipoRegistro, maxPorArquivo, inclusaoPrimeiro: true
        });
      } else {
        if (!files || files.length === 0) { pushConsole('[error] Selecione arquivos para upload.'); setRunning(false); return; }
        pushConsole(`[info] Enviando ${files.length} arquivos para processamento...`);
        resp = await LeituraLivrosService.uploadFiles(files, {
          versao, acao, cns, tipoRegistro, maxPorArquivo, inclusaoPrimeiro: true
        });
      }
      if (!resp || !resp.jobId) {
        pushConsole('[error] Falha ao iniciar o processamento (resposta inválida).');
        setRunning(false);
        return;
      }
      setJobId(resp.jobId);
      pushConsole(`[title] Job iniciado: ${resp.jobId}`);
      // comece a pollar
      pollRef.current = setInterval(async () => {
        try {
          const status = await LeituraLivrosService.getStatus(resp.jobId);
          if (status) {
            if (status.messages && status.messages.length) {
              status.messages.forEach(m => pushConsole(m));
            }
            setProgress(status.progress || 0);
            if (status.status === 'done') {
              clearInterval(pollRef.current);
              setRunning(false);
              pushConsole('[success] Processamento concluído. Buscando resultados...');
              const res = await LeituraLivrosService.getResult(resp.jobId);
              setResults(res.records || res || []);
              pushConsole('[title] Resultados carregados.');
            } else if (status.status === 'failed') {
              clearInterval(pollRef.current);
              setRunning(false);
              pushConsole('[error] Processamento falhou.');
            }
          }
        } catch (e) {
          pushConsole('[warning] Erro ao consultar status do job.');
        }
      }, 2000);
    } catch (e) {
      pushConsole('[error] Erro ao iniciar processamento: ' + (e.message || e));
      setRunning(false);
    }
  }

  async function handleDownloadXml() {
    if (!jobId) return;
    try {
      const blob = await LeituraLivrosService.getResultXml(jobId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const tipo = (tipoRegistro || 'REGISTRO').toLowerCase();
      a.download = `crc_${tipo}_${acao.toLowerCase()}_${jobId}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      pushConsole('[error] Falha ao baixar XML: ' + (e.message || e));
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: 24, fontFamily: 'Inter, Arial, sans-serif', background: 'linear-gradient(180deg,#f5f7fb 0%, #eef1f6 100%)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff', borderRadius: 16, padding: '14px 18px',
        boxShadow: '0 8px 24px rgba(32,50,73,0.08)', marginBottom: 18
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/ferramentas-ia')}
            style={{
              background: 'linear-gradient(135deg,#e9ecef,#dee2e6)',
              color: '#2c3e50', border: '1px solid #d0d7de',
              padding: '8px 14px', borderRadius: 10, fontWeight: 700, cursor: 'pointer'
            }}
          >
            ← Voltar
          </button>
          <h2 style={{ margin: 0, fontSize: 20, color: '#2c3e50' }}>Leitura de Livros de Registro</h2>
        </div>
        <div style={{ color: '#6c757d', fontWeight: 600, fontSize: 13 }}>Console + Resumo com visual moderno</div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Left column */}
        <div style={{ flex: '1 1 60%', minHeight: 300, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Parâmetros da Carga CRC */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(6, minmax(120px, 1fr))', gap: 12,
            background: '#ffffff', padding: 16, borderRadius: 16,
            boxShadow: '0 10px 26px rgba(32,50,73,0.08)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>VERSAO</label>
              <input value={versao} onChange={e => setVersao(e.target.value)}
                style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>ACAO</label>
              <select value={acao} onChange={e => setAcao(e.target.value)}
                style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14 }}>
                <option value="CARGA">CARGA</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>CNS</label>
              <input value={cns} onChange={e => setCns(e.target.value)} placeholder="CNS do cartório"
                style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>TIPO</label>
              <select value={tipoRegistro} onChange={e => setTipoRegistro(e.target.value)}
                style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14 }}>
                <option value="NASCIMENTO">NASCIMENTO</option>
                <option value="CASAMENTO">CASAMENTO</option>
                <option value="OBITO">ÓBITO</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>MAX/ARQUIVO</label>
              <input type="number" min={1} value={maxPorArquivo}
                onChange={e => setMaxPorArquivo(Number(e.target.value || 2500))}
                style={{ border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14 }} />
            </div>
          </div>

          {/* Mode selector & actions */}
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 16, boxShadow: '0 10px 26px rgba(32,50,73,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 800, color: '#1f2937', fontSize: 13 }}>Modo</span>
                <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
                  <button onClick={() => setMode('folder')} disabled={mode === 'folder'}
                    style={{
                      padding: '8px 14px', borderRadius: 10, border: 'none', cursor: mode === 'folder' ? 'default' : 'pointer',
                      background: mode === 'folder' ? '#ffffff' : 'transparent', color: mode === 'folder' ? '#111827' : '#64748b', fontWeight: 700
                    }}>Pasta no servidor</button>
                  <button onClick={() => setMode('upload')} disabled={mode === 'upload'}
                    style={{
                      padding: '8px 14px', borderRadius: 10, border: 'none', cursor: mode === 'upload' ? 'default' : 'pointer',
                      background: mode === 'upload' ? '#ffffff' : 'transparent', color: mode === 'upload' ? '#111827' : '#64748b', fontWeight: 700
                    }}>Upload de arquivos</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={clearConsole}
                  style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#374151', padding: '8px 12px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Limpar console</button>
                <button onClick={startProcessing} disabled={running || (mode === 'upload' && files.length === 0)}
                  style={{ background: running ? '#94a3b8' : 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff',
                    border: 'none', padding: '10px 16px', borderRadius: 10, fontWeight: 800, cursor: running ? 'not-allowed' : 'pointer' }}>
                  {running ? 'Processando…' : (mode === 'folder' ? 'Iniciar' : 'Enviar e Processar')}
                </button>
              </div>
            </div>

            {mode === 'folder' ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" placeholder="Caminho da pasta no servidor (ex: /data/livros)" value={folderPath}
                  onChange={e => setFolderPath(e.target.value)}
                  style={{ flex: 1, border: '1.5px solid #d0d7de', borderRadius: 10, padding: '10px 12px', fontSize: 14 }} />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  flex: 1, border: '2px dashed #cbd5e1', borderRadius: 12, padding: 16, textAlign: 'center', color: '#475569',
                  background: '#f8fafc'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Selecione arquivos</div>
                  <div style={{ fontSize: 12, marginBottom: 12 }}>Imagens (jpg, png, tif), PDFs e .p7s assinados</div>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.p7s,application/pdf"
                    title="Aceita imagens (jpg, png, tif...), PDFs e arquivos .p7s"
                    onChange={e => setFiles(Array.from(e.target.files || []))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Console */}
          <div style={{ background: '#0b1220', borderRadius: 16, boxShadow: '0 16px 36px rgba(2,6,23,0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', color: '#cbd5e1', borderBottom: '1px solid #111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>Console</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{consoleLines.length} linhas</div>
            </div>
            <div style={{ color: '#94a3b8', padding: 14, minHeight: 260, maxHeight: '60vh', overflow: 'auto' }} ref={consoleRef}>
              {consoleLines.map((line, idx) => (
                <div key={idx} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', marginBottom: 6 }}>{renderFormattedText(line)}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column (Resumo + Resultados) */}
        <div style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 16, boxShadow: '0 10px 26px rgba(32,50,73,0.08)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 10, color: '#1f2937' }}>Resumo</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, fontSize: 14, color: '#334155' }}>
              <div><strong>Job:</strong> {jobId || '-'}</div>
              <div><strong>Status:</strong>{' '}
                <span style={{
                  padding: '4px 10px', borderRadius: 999,
                  background: running ? '#dbeafe' : (jobId ? '#dcfce7' : '#e2e8f0'),
                  color: running ? '#1d4ed8' : (jobId ? '#166534' : '#334155'), fontWeight: 800,
                }}>
                  {running ? 'Em andamento' : (jobId ? 'Concluído / Pronto' : 'Inativo')}
                </span>
              </div>
              <div>
                <strong>Progresso:</strong> {progress}%
                <div style={{ marginTop: 6, height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, progress))}%`, height: '100%', background: 'linear-gradient(90deg,#22c55e,#16a34a)' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={handleDownloadXml} disabled={!jobId} style={{
                padding: '10px 14px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: jobId ? 'pointer' : 'not-allowed',
                background: jobId ? 'linear-gradient(135deg,#10b981,#059669)' : '#cbd5e1', color: '#fff'
              }}>Baixar XML</button>
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: 16, padding: 16, boxShadow: '0 10px 26px rgba(32,50,73,0.08)', maxHeight: '60vh', overflow: 'auto' }}>
            <h4 style={{ marginTop: 0, color: '#1f2937' }}>Registros extraídos</h4>
            {results.length === 0 ? (
              <div style={{ color: '#64748b' }}>Nenhum registro extraído ainda.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ padding: 12, border: '1px solid #eef2f7', borderRadius: 12, background: '#fff', boxShadow: '0 2px 8px rgba(32,50,73,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{r.nome || r.titulo || `Registro ${i + 1}`}</div>
                      {r.tipo && (
                        <span style={{ padding: '2px 10px', borderRadius: 999, background: r.tipo === 'INCLUSAO' ? '#dbeafe' : '#fde68a', color: r.tipo === 'INCLUSAO' ? '#1d4ed8' : '#92400e', fontWeight: 800 }}>
                          {r.tipo}
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#475569', fontSize: 13 }}>{r.data || r.pagina || ''}</div>
                    <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap', fontSize: 12, color: '#334155' }}>{r.summary || JSON.stringify(r, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
