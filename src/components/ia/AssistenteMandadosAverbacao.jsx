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
  
  // Estado do console de IA
  const [consoleLog, setConsoleLog] = useState([]);
  const consoleRef = React.useRef(null);

  // Função para adicionar mensagem ao console com animação
  const addConsoleMessage = async (label, content, isLabel = false) => {
    const newEntry = { label, content, isLabel };
    setConsoleLog(prev => [...prev, newEntry]);
    
    // Auto-scroll suave para o final
    setTimeout(() => {
      if (consoleRef.current) {
        consoleRef.current.scrollTo({
          top: consoleRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  // Função para renderizar texto com formatação
  const renderFormattedText = (text) => {
    if (!text) return null;
    
    // Tags suportadas: [success]texto[/success], [error]texto[/error], [warning]texto[/warning], [info]texto[/info], [highlight]texto[/highlight]
    const parts = [];
    let lastIndex = 0;
    
    const tagRegex = /\[(success|error|warning|info|highlight|title)\](.*?)\[\/\1\]/gs;
    let match;
    
    while ((match = tagRegex.exec(text)) !== null) {
      // Adiciona texto antes da tag
      if (match.index > lastIndex) {
        parts.push({ type: 'normal', text: text.substring(lastIndex, match.index) });
      }
      
      // Adiciona texto formatado
      parts.push({ type: match[1], text: match[2] });
      lastIndex = match.index + match[0].length;
    }
    
    // Adiciona texto restante
    if (lastIndex < text.length) {
      parts.push({ type: 'normal', text: text.substring(lastIndex) });
    }
    
    // Se não houver tags, retorna texto simples
    if (parts.length === 0) {
      return text;
    }
    
    // Mapeia cores para cada tipo
    const colorMap = {
      success: '#2ecc71',
      error: '#e74c3c',
      warning: '#f39c12',
      info: '#3498db',
      highlight: '#9b59b6',
      title: '#1abc9c'
    };
    
    return (
      <>
        {parts.map((part, idx) => {
          if (part.type === 'normal') {
            return <span key={idx}>{part.text}</span>;
          }
          return (
            <span key={idx} style={{ 
              color: colorMap[part.type], 
              fontWeight: part.type === 'title' ? 'bold' : 'normal',
              textDecoration: part.type === 'highlight' ? 'underline' : 'none'
            }}>
              {part.text}
            </span>
          );
        })}
      </>
    );
  };

  // Limpar console
  const clearConsole = () => {
    setConsoleLog([]);
  };

  // Efeito para rolar a página até o console quando aparecer
  React.useEffect(() => {
    if (consoleLog.length > 0 && consoleRef.current) {
      // Rola a página para que o console fique visível
      consoleRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [consoleLog.length]);

  const onFileChange = async (e) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setError('');
    setExtracted('');
    setTipo('');
    setTipoConfidence(null);
    setLegislacao([]);
    setResultado(null);
    setTextoAverbacao('');
    setManual(false);
    clearConsole();
    
    // Inicia o fluxo completo automaticamente
    if (selectedFile) {
      await executarFluxoCompleto(selectedFile);
    }
  };

  // Fluxo completo automatizado
  const executarFluxoCompleto = async (pdfFile) => {
    try {
      setLoading(true);
      
      // Passo 1: Extrair texto
      await addConsoleMessage('[title]Extraindo o texto do PDF:[/title]', '', true);
      const { text, warning } = await extrairTexto(pdfFile);
      
      if (!text) {
        const errMsg = (warning || 'Não foi possível extrair texto do PDF.') + ' Dica: envie um PDF pesquisável (não escaneado/sem senha) ou use a edição manual.';
        setError(errMsg);
        await addConsoleMessage('', `[error]❌ ${errMsg}[/error]`, false);
        setLoading(false);
        return;
      }
      
      setExtracted(text);
      const preview = text.length > 500 ? text.slice(0, 500) + '...' : text;
      await addConsoleMessage('', `[success]✓ Texto extraído com sucesso[/success] ([info]${text.length} caracteres[/info])\n\n${preview}`, false);
      
      // Passo 2: Identificar tipo
      await addConsoleMessage('[title]Identificando o tipo de mandado:[/title]', '', true);
      const { tipo: tipoIdentificado, confidence } = await identificarTipo(text);
      setTipo(tipoIdentificado || '');
      setTipoConfidence(confidence ?? null);
      
      const confidencePercent = confidence !== null ? Math.round(confidence * 100) : 0;
      await addConsoleMessage('', `[success]✓ Tipo identificado:[/success] [highlight]${tipoIdentificado || 'n/d'}[/highlight] [info](confiança: ${confidencePercent}%)[/info]`, false);
      
      // Buscar legislação correlata
      try {
        await addConsoleMessage('', '\n[info]Buscando legislação correlata...[/info]', false);
        const lista = await listarLegislacao({ indexador: tipoIdentificado, ativo: true });
        setLegislacao(Array.isArray(lista) ? lista : []);
        
        if (Array.isArray(lista) && lista.length > 0) {
          await addConsoleMessage('', `[success]✓ ${lista.length} dispositivo(s) legal(is) encontrado(s)[/success]`, false);
        } else {
          await addConsoleMessage('', '[warning]⚠ Nenhuma legislação específica encontrada para este tipo[/warning]', false);
        }
        
        // Passo 3: Analisar exigência
        await addConsoleMessage('[title]Analisando o mandado com base na legislação:[/title]', '', true);
        const resp = await analisarExigencia({ text, legislacao: Array.isArray(lista) ? lista : [], tipo: tipoIdentificado });
        setResultado(resp);
        
        if (resp.aprovado) {
          await addConsoleMessage('', '[success]✓ Mandado APROVADO - todos os requisitos atendidos[/success]', false);
        } else {
          await addConsoleMessage('', '[error]❌ Mandado NÃO APROVADO - pendências encontradas[/error]', false);
        }
        
        if (resp.checklist && resp.checklist.length > 0) {
          await addConsoleMessage('', '\n[title]Checklist de requisitos:[/title]', false);
          for (const item of resp.checklist) {
            const status = item.ok ? '[success]✓[/success]' : '[error]✗[/error]';
            await addConsoleMessage('', `  ${status} ${item.requisito}`, false);
          }
        }
        
        if (resp.orientacao) {
          await addConsoleMessage('', '\n[info]Orientação:[/info]\n' + resp.orientacao, false);
        }
        
        // Passo 4: Gerar texto da averbação
        await addConsoleMessage('[title]Gerando o texto da averbação:[/title]', '', true);
        const { textoAverbacao: textoGerado } = await gerarTextoAverbacao({ text, legislacao: Array.isArray(lista) ? lista : [], tipo: tipoIdentificado });
        setTextoAverbacao(textoGerado || '');
        
        if (textoGerado) {
          await addConsoleMessage('', `[success]✓ Texto gerado com sucesso:[/success]\n\n${textoGerado}`, false);
          await addConsoleMessage('', '\n[highlight]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/highlight]', false);
          await addConsoleMessage('', '[success]✓ Fluxo completo finalizado com sucesso![/success]', false);
        } else {
          await addConsoleMessage('', '[warning]⚠ Não foi possível gerar o texto da averbação[/warning]', false);
        }
        
      } catch (legislacaoError) {
        await addConsoleMessage('', `[warning]⚠ Erro ao buscar legislação: ${legislacaoError.message}[/warning]`, false);
      }
      
    } catch (e) {
      const errMsg = e?.message || 'Erro no fluxo automatizado.';
      setError(errMsg);
      await addConsoleMessage('', `[error]❌ ${errMsg}[/error]`, false);
    } finally {
      setLoading(false);
    }
  };

  const handleExtrairTexto = async () => {
    setError('');
    setResultado(null);
    setTipo('');
    setTipoConfidence(null);
    setLegislacao([]);
    setTextoAverbacao('');
    clearConsole();
    
    if (!file) {
      setError('Selecione um PDF do mandado judicial.');
      return;
    }
    
    try {
      setLoading(true);
      await addConsoleMessage('Extraindo o texto do PDF:', '', true);
      
      const { text, warning } = await extrairTexto(file);
      setExtracted(text || '');
      
      if (!text) {
        const errMsg = (warning || 'Não foi possível extrair texto do PDF.') + ' Dica: envie um PDF pesquisável (não escaneado/sem senha) ou use a edição manual.';
        setError(errMsg);
        await addConsoleMessage('', `❌ ${errMsg}`, false);
      } else {
        const preview = text.length > 500 ? text.slice(0, 500) + '...' : text;
        await addConsoleMessage('', `✓ Texto extraído com sucesso (${text.length} caracteres)\n\n${preview}`, false);
      }
    } catch (e) {
      const errMsg = e?.message || 'Falha ao extrair texto do PDF.';
      setError(errMsg);
      await addConsoleMessage('', `❌ ${errMsg}`, false);
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
      await addConsoleMessage('Identificando o tipo de mandado:', '', true);
      
      const { tipo, confidence } = await identificarTipo(extracted);
      setTipo(tipo || '');
      setTipoConfidence(confidence ?? null);
      
      const confidencePercent = confidence !== null ? Math.round(confidence * 100) : 0;
      await addConsoleMessage('', `✓ Tipo identificado: ${tipo || 'n/d'} (confiança: ${confidencePercent}%)`, false);
      
      try {
        await addConsoleMessage('', '\nBuscando legislação correlata...', false);
        const lista = await listarLegislacao({ indexador: tipo, ativo: true });
        setLegislacao(Array.isArray(lista) ? lista : []);
        
        if (Array.isArray(lista) && lista.length > 0) {
          await addConsoleMessage('', `✓ ${lista.length} dispositivo(s) legal(is) encontrado(s)`, false);
        } else {
          await addConsoleMessage('', '⚠ Nenhuma legislação específica encontrada para este tipo', false);
        }
      } catch (_) {
        await addConsoleMessage('', '⚠ Não foi possível buscar legislação correlata', false);
      }
    } catch (e) {
      const errMsg = e?.message || 'Falha ao identificar tipo do mandado.';
      setError(errMsg);
      await addConsoleMessage('', `❌ ${errMsg}`, false);
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
      await addConsoleMessage('Analisando o mandado com base na legislação:', '', true);
      
      const resp = await analisarExigencia({ text: extracted, legislacao, tipo });
      setResultado(resp);
      
      if (resp.aprovado) {
        await addConsoleMessage('', '✓ Mandado APROVADO - todos os requisitos atendidos', false);
      } else {
        await addConsoleMessage('', '❌ Mandado NÃO APROVADO - pendências encontradas', false);
      }
      
      if (resp.checklist && resp.checklist.length > 0) {
        await addConsoleMessage('', '\nChecklist de requisitos:', false);
        for (const item of resp.checklist) {
          await addConsoleMessage('', `  ${item.ok ? '✓' : '✗'} ${item.requisito}`, false);
        }
      }
      
      if (resp.orientacao) {
        await addConsoleMessage('', `\nOrientação:\n${resp.orientacao}`, false);
      }
    } catch (e) {
      const errMsg = e?.message || 'Falha ao analisar exigência.';
      setError(errMsg);
      await addConsoleMessage('', `❌ ${errMsg}`, false);
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
      await addConsoleMessage('Gerando o texto da averbação:', '', true);
      
      const { textoAverbacao } = await gerarTextoAverbacao({ text: extracted, legislacao, tipo });
      setTextoAverbacao(textoAverbacao || '');
      
      if (textoAverbacao) {
        await addConsoleMessage('', `✓ Texto gerado com sucesso:\n\n${textoAverbacao}`, false);
      } else {
        await addConsoleMessage('', '⚠ Não foi possível gerar o texto da averbação', false);
      }
    } catch (e) {
      const errMsg = e?.message || 'Falha ao gerar texto da averbação.';
      setError(errMsg);
      await addConsoleMessage('', `❌ ${errMsg}`, false);
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

      <main style={{ padding: '16px 24px' }}>
        <section style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Envie o mandado judicial (PDF)</h2>
          <p style={{ color: '#7f8c8d', marginTop: 0 }}>
            O fluxo completo será executado automaticamente: extração de texto → identificação do tipo → análise legal → geração do texto da averbação.
          </p>

          <div style={{ 
            border: '2px dashed #3498db', 
            borderRadius: '12px', 
            padding: '32px', 
            textAlign: 'center',
            background: loading ? '#f0f8ff' : '#fff',
            transition: 'all 0.3s ease'
          }}>
            <label htmlFor="fileInput" style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: '16px',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(52, 152, 219, 0.3)',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(52, 152, 219, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.3)';
            }}>
              📄 Escolher arquivo PDF
            </label>
            <input 
              id="fileInput"
              type="file" 
              accept="application/pdf" 
              onChange={onFileChange} 
              disabled={loading}
              style={{ display: 'none' }}
            />
            {file && !loading && (
              <div style={{ marginTop: '16px', color: '#2c3e50', fontSize: '14px' }}>
                <strong>Arquivo selecionado:</strong> {file.name}
              </div>
            )}
            {loading && (
              <div style={{ marginTop: '16px', color: '#3498db', fontWeight: 'bold', fontSize: '16px' }}>
                ⏳ Processando automaticamente...
              </div>
            )}
          </div>

          {/* Console do Agente IA */}
          {consoleLog.length > 0 && (
            <div ref={consoleRef} style={{
              marginTop: 24,
              background: '#000',
              color: '#aaa',
              padding: '16px',
              borderRadius: '8px',
              minHeight: '300px',
              maxHeight: '500px',
              overflowY: 'auto',
              fontFamily: 'Courier New, monospace',
              fontSize: '14px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}>
              {consoleLog.map((entry, idx) => (
                <div key={idx} style={{ marginBottom: '8px' }}>
                  {entry.isLabel ? (
                    <div style={{ color: '#ff4444', fontWeight: 'bold' }}>{renderFormattedText(entry.label)}</div>
                  ) : (
                    <div style={{ color: '#aaa', paddingLeft: '8px' }}>{renderFormattedText(entry.content)}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <div style={{ marginTop: 16, color: '#c0392b' }}>{error}</div>}

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
