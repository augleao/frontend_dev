/* eslint-disable no-console */
import React, { useEffect, useRef, useState } from 'react';
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
        pushConsole(`[title]Prompt carregado: ${indexador}[/title]`);
        if (p && p.prompt) pushConsole(p.prompt);
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
    setConsoleLines((prev) => [...prev, typeof line === 'string' ? line : JSON.stringify(line)]);
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

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Terminal IA — {indexador}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={simpleButtonStyle}>Fechar</button>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
          <div ref={consoleRef} style={consoleStyle}>
            {consoleLines.map((l, i) => (
              <div key={i} style={{ marginBottom: 8, fontFamily: 'Courier New, monospace', fontSize: 13 }}>{l}</div>
            ))}
          </div>
          <div style={{ flex: '0 0 320px', maxWidth: 320 }}>
            <div style={{ fontSize: 13, color: '#333' }}>
              <strong>Prompt preview</strong>
              <div style={{ marginTop: 8, background: '#fafafa', padding: 10, borderRadius: 8, minHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                {promptRow?.prompt || 'Prompt não encontrado.'}
              </div>
            </div>
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
