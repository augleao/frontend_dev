/* eslint-disable no-console */
import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import PromptsService from '../../services/PromptsService';

export default function ModalTerminalIA({ open, onClose, indexador, items = [], onRun }) {
  const [promptRow, setPromptRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [consoleLines, setConsoleLines] = useState([]);
  const consoleRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    console.log(`[ModalTerminalIA] opened indexador=${indexador} items=${(items || []).length}`);
    setConsoleLines([]);
    setPromptRow(null);
    (async () => {
      setLoading(true);
      try {
        const p = await PromptsService.getByIndexador(indexador);
        console.log('[ModalTerminalIA] prompt fetched', p);
        setPromptRow(p);
        if (!p) {
          pushConsole(`[warning]Prompt não encontrado no DB para indexador '${indexador}'. Crie um prompt com PUT /api/ia/prompts/${indexador} ou verifique o indexador existente.[/warning]`);
        } else {
          pushConsole(`[title]Prompt carregado: ${indexador}[/title]`);
        }
        // Execute automatically when prompt is loaded
        console.log('[ModalTerminalIA] onRun present?', !!onRun, 'items.length=', (items || []).length);
        if (p && p.prompt && onRun) {
          console.log('[ModalTerminalIA] starting automatic run');
          pushConsole('[info]Iniciando execução automática do prompt...[/info]');
          try {
            await onRun({ indexador, prompt: p.prompt, items, pushConsole });
            console.log('[ModalTerminalIA] automatic run completed');
            pushConsole('[success]Execução automática concluída.[/success]');
          } catch (autoErr) {
            console.error('[ModalTerminalIA] automatic run failed', autoErr);
            pushConsole(`[error]Falha na execução automática: ${autoErr?.message || autoErr}[/error]`);
          }
        }
      } catch (e) {
        console.error('[ModalTerminalIA] error loading prompt', e);
        pushConsole(`[error]Erro ao carregar prompt: ${e.message || e}[/error]`);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, indexador]);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [consoleLines]);

  function pushConsole(line) {
    setConsoleLines((prev) => [...prev, line]);
  }

  // Render formatted text with simple tag markup like [success]text[/success]
  function renderFormattedText(text) {
    if (!text) return null;
    const parts = [];
    let lastIndex = 0;
    const tagRegex = /\[(success|error|warning|info|highlight|title)\](.*?)\[\/\1\]/gs;
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'normal', text: text.substring(lastIndex, match.index) });
      }
      parts.push({ type: match[1], text: match[2] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push({ type: 'normal', text: text.substring(lastIndex) });

    if (parts.length === 0) return text;

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
          if (part.type === 'normal') return <span key={idx}>{part.text}</span>;
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
  }

  const handleRun = async () => {
    if (!onRun) return;
    console.log('[ModalTerminalIA] manual run triggered');
    pushConsole('[info]Executando agente de IA com o prompt selecionado...[/info]');
    try {
      await onRun({ indexador, prompt: promptRow?.prompt || '', items, pushConsole });
      pushConsole('[success]Execução concluída.[/success]');
    } catch (e) {
      pushConsole(`[error]Falha na execução: ${e?.message || e}[/error]`);
    }
  };

  if (!open) return null;

  const hasIaResults = Array.isArray(consoleLines) && consoleLines.some((l) => l && l.type === 'ia_result');

  async function gerarRelatorioPdf() {
    const results = (consoleLines || []).filter((l) => l && l.type === 'ia_result');
    if (!results || results.length === 0) {
      pushConsole('[warning]Nenhum resultado de IA disponível para gerar relatório.[/warning]');
      return;
    }

    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    // Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(`Analise da DAP`, margin, y);
    y += 24;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, margin, y);
    y += 18;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;

    const maxWidth = pageWidth - margin * 2;
    const lineHeight = 14;

    for (const r of results) {
      if (y > pageHeight - margin - 100) {
        doc.addPage();
        y = margin;
      }

      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.text(`DAP ${r.dapId}`, margin, y);
      y += 16;

      if (r.indexador) {
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 120, 140);
        doc.text(`indexador: ${r.indexador}`, margin, y);
        y += 14;
      }

      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(20, 30, 40);

      let content = r.output || '';
      // If JSON string, pretty print
      try {
        if (typeof content === 'string') {
          const parsed = JSON.parse(content);
          content = JSON.stringify(parsed, null, 2);
        }
      } catch (_) { /* not JSON */ }

      const lines = doc.splitTextToSize(String(content || '[sem conteúdo]'), maxWidth);
      // Add lines, with page breaks if needed
      for (let i = 0; i < lines.length; i++) {
        if (y > pageHeight - margin - lineHeight) {
          doc.addPage();
          y = margin;
        }
        doc.text(lines[i], margin, y);
        y += lineHeight;
      }

      y += 12;
      // separator
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 12;
    }

    const filename = `relatorio_ia_${String(indexador || 'relatorio')}_${Date.now()}.pdf`;
    try {
      doc.save(filename);
      pushConsole(`[success]Relatório gerado: ${filename}[/success]`);
    } catch (e) {
      pushConsole(`[error]Falha ao gerar PDF: ${e?.message || e}[/error]`);
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Terminal IA — {indexador}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {hasIaResults ? (
              <button onClick={gerarRelatorioPdf} style={{ ...simpleButtonStyle, background: '#0f172a', color: 'white' }}>Gerar Relatorio</button>
            ) : null}
            <button onClick={onClose} style={simpleButtonStyle}>Fechar</button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div ref={consoleRef} style={consoleStyle}>
              {consoleLines.map((l, i) => {
                const key = `line-${i}`;
                // Plain string -> formatted tag renderer
                if (typeof l === 'string') {
                  return (
                    <div key={key} style={{ marginBottom: 8, fontFamily: 'Courier New, monospace', fontSize: 13 }}>
                      {renderFormattedText(String(l))}
                    </div>
                  );
                }

                // Structured IA result
                if (l && l.type === 'ia_result') {
                  // Try to pretty-print JSON output if possible
                  let content = l.output || '';
                  let pretty = null;
                  try {
                    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
                    pretty = JSON.stringify(parsed, null, 2);
                  } catch (_) {
                    pretty = null;
                  }
                  return (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: '700', marginBottom: 6, color: '#9ae6b4' }}>Resultado DAP {String(l.dapId)}</div>
                      {l.indexador ? <div style={{ fontSize: 12, color: '#93c5fd', marginBottom: 6 }}>indexador: {l.indexador}</div> : null}
                      <div style={{ background: '#071226', padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap', fontFamily: 'Courier New, monospace', fontSize: 13, color: '#e6eef8' }}>
                        {pretty ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{pretty}</pre> : (content || '[sem conteúdo]')}
                      </div>
                    </div>
                  );
                }

                // Structured IA error
                if (l && l.type === 'ia_error') {
                  return (
                    <div key={key} style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: '700', color: '#ff9b9b' }}>Erro DAP {String(l.dapId)}</div>
                      <div style={{ background: '#2b0b0b', padding: 10, borderRadius: 8, color: '#ffd6d6', fontFamily: 'Courier New, monospace', fontSize: 13 }}>
                        {String(l.message || 'Erro desconhecido')}
                        {l.detail ? (<pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{JSON.stringify(l.detail, null, 2)}</pre>) : null}
                      </div>
                    </div>
                  );
                }

                // Fallback: show JSON for unknown objects
                return (
                  <div key={key} style={{ marginBottom: 8, fontFamily: 'Courier New, monospace', fontSize: 13 }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(l, null, 2)}</pre>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
};

const modalStyle = {
  width: '90%', maxWidth: 1100, background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 20px 60px rgba(2,6,23,0.6)'
};

const consoleStyle = {
  flex: 1, background: '#0b1220', color: '#cbd5e1', padding: 12, borderRadius: 8, minHeight: 220, maxHeight: '60vh', overflow: 'auto', fontFamily: 'Courier New, monospace'
};

const simpleButtonStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' };
const primaryButtonStyle = { padding: '8px 12px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer' };
