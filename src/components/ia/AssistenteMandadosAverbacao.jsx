import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extrairTexto, identificarTipo, analisarExigencia, gerarTextoAverbacao } from '../servicos/IAWorkflowService';
import { listarLegislacao } from '../servicos/LegislacaoService';

function AssistenteMandadosAverbacao() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
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

  // Extrai texto de um ou mais arquivos PDF e retorna texto combinado e metadados
  const extrairTextoDeArquivos = async (arquivos) => {
    const partes = [];
    let totalChars = 0;
    let warnings = [];

    for (let i = 0; i < arquivos.length; i++) {
      const f = arquivos[i];
      await addConsoleMessage('', `[info]Processando arquivo ${i + 1}/${arquivos.length}:[/info] [highlight]${f.name}[/highlight]`, false);
      const { text, warning, pages, length } = await extrairTexto(f);
      if (warning) warnings.push(`(${f.name}) ${warning}`);
      const textoParte = text || '';
      totalChars += (length ?? textoParte.length);
      partes.push({
        name: f.name,
        text: textoParte,
        pages: pages ?? null,
        length: length ?? textoParte.length,
      });
    }

    // Combina com separadores claros por arquivo
    const combinado = partes
      .map((p, idx) => `===== INÍCIO DO ARQUIVO ${idx + 1}: ${p.name} =====\n${p.text}\n===== FIM DO ARQUIVO ${idx + 1}: ${p.name} =====`)
      .join('\n\n');

    return { combinado, partes, totalChars, warnings };
  };

  const onFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);

    // Validações básicas: apenas PDF, limite de quantidade
    const MAX_FILES = 5;
    if (selectedFiles.length > MAX_FILES) {
      setError(`Selecione no máximo ${MAX_FILES} arquivos PDF.`);
      return;
    }
    const invalid = selectedFiles.find(f => f.type !== 'application/pdf');
    if (invalid) {
      setError(`O arquivo "${invalid.name}" não é um PDF válido.`);
      return;
    }

    setFiles(selectedFiles);
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
    if (selectedFiles.length > 0) {
      await executarFluxoCompleto(selectedFiles);
    }
  };

  // Fluxo completo automatizado
  const executarFluxoCompleto = async (pdfFiles) => {
    try {
      setLoading(true);
      
      // Passo 1: Extrair texto (suporta múltiplos PDFs)
      await addConsoleMessage('[title]Extraindo o texto do(s) PDF(s):[/title]', '', true);
      const { combinado, partes, totalChars, warnings } = await extrairTextoDeArquivos(Array.isArray(pdfFiles) ? pdfFiles : [pdfFiles]);

      if (!combinado || combinado.trim().length === 0) {
        const warnJoin = warnings?.length ? `\n${warnings.join('\n')}` : '';
        const errMsg = ('Não foi possível extrair texto do(s) PDF(s).') + ' Dica: envie PDF pesquisável (não escaneado/sem senha) ou use a edição manual.' + warnJoin;
        setError(errMsg);
        await addConsoleMessage('', `[error]❌ ${errMsg}[/error]`, false);
        setLoading(false);
        return;
      }
      // Feedback por arquivo
      for (const p of partes) {
        const previewParte = p.text.length > 300 ? p.text.slice(0, 300) + '...' : p.text;
        await addConsoleMessage('', `[success]✓ Texto extraído:[/success] [info]${p.length} caracteres[/info] ${p.pages ? `[info]| ${p.pages} pág(s)[/info]` : ''} — ${p.name}\n${previewParte}\n`, false);
      }

      setExtracted(combinado);
      const preview = combinado.length > 500 ? combinado.slice(0, 500) + '...' : combinado;
      await addConsoleMessage('', `[success]✓ Texto combinado pronto[/success] ([info]${totalChars} caracteres[/info])\n\n${preview}`, false);
      
      // Passo 2: Identificar tipo
      await addConsoleMessage('[title]Identificando o tipo de mandado:[/title]', '', true);
      const { tipo: tipoIdentificado, confidence } = await identificarTipo(combinado);
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
  const resp = await analisarExigencia({ text: combinado, legislacao: Array.isArray(lista) ? lista : [], tipo: tipoIdentificado });
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
  const { textoAverbacao: textoGerado } = await gerarTextoAverbacao({ text: combinado, legislacao: Array.isArray(lista) ? lista : [], tipo: tipoIdentificado });
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
    
    if (!files || files.length === 0) {
      setError('Selecione um ou mais PDFs do mandado judicial.');
      return;
    }
    
    try {
      setLoading(true);
      await addConsoleMessage('Extraindo o texto do(s) PDF(s):', '', true);

      const { combinado, warnings } = await extrairTextoDeArquivos(files);
      setExtracted(combinado || '');

      if (!combinado) {
        const errMsg = ((warnings && warnings[0]) || 'Não foi possível extrair texto do(s) PDF(s).') + ' Dica: envie PDF pesquisável (não escaneado/sem senha) ou use a edição manual.';
        setError(errMsg);
        await addConsoleMessage('', `❌ ${errMsg}`, false);
      } else {
        const preview = combinado.length > 500 ? combinado.slice(0, 500) + '...' : combinado;
        await addConsoleMessage('', `✓ Texto extraído com sucesso\n\n${preview}`, false);
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
          <h1 style={{ color: 'white', margin: 0, fontSize: '24px', fontWeight: 600, letterSpacing: '0.5px' }}>
            Assistente de Mandados de Averbação
          </h1>
        </div>
      </header>

      <main style={{ padding: '16px 24px' }}>
        <section style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>

          <div style={{ 
            border: '2px dashed #3498db', 
            borderRadius: '12px', 
            padding: '16px', 
            textAlign: 'left',
            background: loading ? '#f0f8ff' : '#fff',
            transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              <label htmlFor="fileInput" style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '15px',
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
                📄 Selecione os arquivos PDF do mandado
              </label>
              <input 
                id="fileInput"
                type="file" 
                accept="application/pdf" 
                multiple
                onChange={onFileChange} 
                disabled={loading}
                style={{ display: 'none' }}
              />
              <div style={{ color: loading ? '#3498db' : '#2c3e50', fontSize: '14px', fontWeight: loading ? 700 : 400 }}>
                {loading ? (
                  '⏳ Processando automaticamente...'
                ) : (
                  files && files.length > 0 ? (
                    <>
                      <strong>{files.length > 1 ? 'Arquivos selecionados:' : 'Arquivo selecionado:'}</strong> {files.map(f => f.name).join(', ')}
                    </>
                  ) : (
                    <span style={{ color: '#95a5a6' }}>Nenhum arquivo selecionado</span>
                  )
                )}
              </div>
            </div>
          </div>

          {error && <div style={{ marginTop: 16, color: '#c0392b' }}>{error}</div>}

          {(consoleLog.length > 0 || tipo || resultado || textoAverbacao) && (
            <div style={{ marginTop: 24 }}>
              

              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: 16, flexWrap: 'nowrap', width: '100%' }}>
                {/* Coluna esquerda: Console */}
                <div style={{ flex: '0 0 calc(50% - 8px)', maxWidth: 'calc(50% - 8px)', boxSizing: 'border-box' }}>
                  {consoleLog.length > 0 && (
                    <div ref={consoleRef} style={{
                      background: '#000',
                      color: '#aaa',
                      padding: '16px',
                      borderRadius: '8px',
                      minHeight: '220px',
                      maxHeight: '45vh',
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
                </div>

                {/* Coluna direita: Orientação e Texto da Averbação */}
                <div style={{ flex: '0 0 calc(50% - 8px)', maxWidth: 'calc(50% - 8px)', boxSizing: 'border-box' }}>
                  {resultado?.orientacao && (
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ margin: '0 0 8px 0' }}>Orientação</h3>
                      <textarea readOnly value={resultado.orientacao} style={{ width: '100%', minHeight: 140, padding: 12, borderRadius: 8, border: '1px solid #ecf0f1' }} />
                    </div>
                  )}

                  {textoAverbacao && (
                    <div>
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
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AssistenteMandadosAverbacao;
