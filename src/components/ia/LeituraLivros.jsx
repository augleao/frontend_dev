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
    <div style={{ minHeight: '100vh', padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={() => navigate('/ferramentas-ia')} style={{ padding: '8px 12px', borderRadius: 8 }}>← Voltar</button>
        <h2 style={{ margin: 0 }}>Leitura de Livros de Registro</h2>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Left: console */}
        <div style={{ flex: '1 1 60%', minHeight: 300 }}>
          {/* Parâmetros da Carga CRC */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, minmax(110px, 1fr))',
            gap: 8,
            background: '#fff',
            padding: 12,
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            marginBottom: 12
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>VERSAO</label>
              <input value={versao} onChange={e => setVersao(e.target.value)} style={{ padding: '6px 8px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>ACAO</label>
              <select value={acao} onChange={e => setAcao(e.target.value)} style={{ padding: '6px 8px' }}>
                <option value="CARGA">CARGA</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>CNS</label>
              <input value={cns} onChange={e => setCns(e.target.value)} placeholder="CNS do cartório" style={{ padding: '6px 8px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>TIPO</label>
              <select value={tipoRegistro} onChange={e => setTipoRegistro(e.target.value)} style={{ padding: '6px 8px' }}>
                <option value="NASCIMENTO">NASCIMENTO</option>
                <option value="CASAMENTO">CASAMENTO</option>
                <option value="OBITO">ÓBITO</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>MAX/ARQUIVO</label>
              <input type="number" min={1} value={maxPorArquivo} onChange={e => setMaxPorArquivo(Number(e.target.value || 2500))} style={{ padding: '6px 8px' }} />
            </div>
          </div>

          <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontWeight: 700 }}>Modo:</label>
            <button onClick={() => setMode('folder')} disabled={mode === 'folder'} style={{ padding: '6px 12px' }}>Pasta no servidor</button>
            <button onClick={() => setMode('upload')} disabled={mode === 'upload'} style={{ padding: '6px 12px' }}>Upload de arquivos</button>
          </div>

          <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            {mode === 'folder' ? (
              <>
                <input type="text" placeholder="Caminho da pasta no servidor (ex: /data/livros)" value={folderPath} onChange={e => setFolderPath(e.target.value)} style={{ flex: 1, padding: '8px 10px' }} />
                <button onClick={startProcessing} disabled={running} style={{ padding: '8px 14px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8 }}>{running ? 'Processando...' : 'Iniciar'}</button>
              </>
            ) : (
              <>
                <input type="file" multiple accept="image/*" onChange={e => setFiles(Array.from(e.target.files || []))} />
                <button onClick={startProcessing} disabled={running || files.length === 0} style={{ padding: '8px 14px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8 }}>{running ? 'Processando...' : 'Enviar e Processar'}</button>
              </>
            )}
          </div>

          <div style={{ background: '#000', color: '#ccc', borderRadius: 8, padding: 12, minHeight: 260, maxHeight: '60vh', overflow: 'auto' }} ref={consoleRef}>
            {consoleLines.map((line, idx) => (
              <div key={idx} style={{ fontFamily: 'monospace', marginBottom: 6 }}>{renderFormattedText(line)}</div>
            ))}
          </div>
        </div>

        {/* Right: resumo */}
        <div style={{ width: 420, flexShrink: 0 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h3 style={{ marginTop: 0 }}>Resumo</h3>
            <div style={{ marginBottom: 8 }}><strong>Job:</strong> {jobId || '-'}</div>
            <div style={{ marginBottom: 8 }}><strong>Progresso:</strong> {progress}%</div>
            <div style={{ marginBottom: 8 }}><strong>Status:</strong> {running ? 'Em andamento' : (jobId ? 'Concluído / Pronto' : 'Inativo')}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={handleDownloadXml} disabled={!jobId} style={{ padding: '8px 12px', borderRadius: 8, background: jobId ? '#2ecc71' : '#bdc3c7', color: '#fff', border: 'none' }}>Baixar XML</button>
            </div>
          </div>

          <div style={{ marginTop: 12, background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxHeight: '60vh', overflow: 'auto' }}>
            <h4 style={{ marginTop: 0 }}>Registros extraídos</h4>
            {results.length === 0 ? (
              <div style={{ color: '#888' }}>Nenhum registro extraído ainda.</div>
            ) : (
              results.map((r, i) => (
                <div key={i} style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ fontWeight: 700 }}>{r.nome || r.titulo || `Registro ${i + 1}`}</div>
                  <div style={{ color: '#666' }}>{r.data || r.pagina || ''}</div>
                  <pre style={{ margin: '6px 0 0 0', whiteSpace: 'pre-wrap', fontSize: 12 }}>{r.summary || JSON.stringify(r, null, 2)}</pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
