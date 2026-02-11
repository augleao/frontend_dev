import React, { useCallback, useMemo, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import '../../buttonGradients.css';

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildXML(entries) {
  const items = entries.map((e) => {
    const campos = e.campos || {};
    return (
      '  <registro>\n' +
      `    <arquivo>${escapeXml(e.nomeArquivo)}</arquivo>\n` +
      `    <livro>${escapeXml(campos.livro || '')}</livro>\n` +
      `    <folha>${escapeXml(campos.folha || '')}</folha>\n` +
      `    <termo>${escapeXml(campos.termo || '')}</termo>\n` +
      `    <nome>${escapeXml(campos.nome || '')}</nome>\n` +
      `    <data>${escapeXml(campos.data || '')}</data>\n` +
      `    <textoCompleto>${escapeXml(e.texto || '')}</textoCompleto>\n` +
      '  </registro>'
    );
  });
  return `<registros>\n${items.join('\n')}\n</registros>\n`;
}

function parseCampos(texto) {
  if (!texto) return {};
  const t = texto.replace(/\r/g, '').replace(/\t/g, ' ');
  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const joined = ' ' + lines.join(' ') + ' ';

  // Heurísticas simples e tolerantes a variações/acentos
  const get = (patterns) => {
    for (const p of patterns) {
      const m = joined.match(p);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  };

  const livro = get([
    /\bLIVRO\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
    /\bLIV\.?\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
  ]);
  const folha = get([
    /\bFOLHA\s*[:\-]?\s*([0-9A-Z\-\/]+)/i,
    /\bFL\.?\s*[:\-]?\s*([0-9A-Z\-\/]+)/i,
  ]);
  const termo = get([
    /\bTERMO\s*[:\-]?\s*([0-9A-Z\-\/]+)/i,
    /\bTRM\.?\s*[:\-]?\s*([0-9A-Z\-\/]+)/i,
  ]);
  const nome = get([
    /\bNOME\s*[:\-]?\s*([A-ZÀ-ÿ'`´~\- ]{4,})/i,
    /\bREQUERENTE\s*[:\-]?\s*([A-ZÀ-ÿ'`´~\- ]{4,})/i,
  ]);
  const data = get([
    /\bDATA\s*[:\-]?\s*([0-3]?\d\/[0-1]?\d\/(?:\d{2}|\d{4}))/i,
    /\bEM\s+(\d{1,2}\s+de\s+[A-Za-zçãé]+\s+de\s+\d{4})/i,
  ]);

  return { livro, folha, termo, nome, data };
}

export default function LeituraLivrosRegistro() {
  const [arquivos, setArquivos] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [lang, setLang] = useState('por');
  const consoleRef = useRef(null);
  const inputRef = useRef(null);

  const appendLog = useCallback((msg, level = 'info') => {
    const color = level === 'error' ? '#ff6b6b' : level === 'success' ? '#2ecc71' : level === 'warning' ? '#f39c12' : '#bdc3c7';
    const el = document.createElement('div');
    el.style.color = color;
    el.style.fontFamily = 'monospace';
    el.style.fontSize = '12px';
    el.textContent = msg;
    if (consoleRef.current) {
      consoleRef.current.appendChild(el);
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, []);

  const onSelectFolder = useCallback((e) => {
    const files = Array.from(e.target.files || []).filter((f) => /\.(png|jpg|jpeg|tif|tiff|bmp)$/i.test(f.name));
    setArquivos(files);
    setResultados([]);
    setProgresso({ atual: 0, total: files.length });
    if (consoleRef.current) consoleRef.current.innerHTML = '';
    appendLog(`[title] Selecionados ${files.length} arquivo(s) de imagem.`, 'info');
  }, [appendLog]);

  const iniciarProcessamento = useCallback(async () => {
    if (!arquivos.length) {
      appendLog('Nenhum arquivo selecionado.', 'warning');
      return;
    }
    setProcessando(true);
    setResultados([]);
    setProgresso({ atual: 0, total: arquivos.length });
    if (consoleRef.current) consoleRef.current.innerHTML = '';
    appendLog(`[title] Iniciando OCR (${lang}) em ${arquivos.length} arquivo(s)...`, 'info');

    for (let i = 0; i < arquivos.length; i++) {
      const arq = arquivos[i];
      appendLog(`OCR ${i + 1}/${arquivos.length}: ${arq.name}`, 'info');
      try {
        const { data } = await Tesseract.recognize(arq, lang, {
          // logger: m => console.log(m), // opcional
        });
        const texto = data?.text || '';
        const campos = parseCampos(texto);
        setResultados((prev) => [...prev, { nomeArquivo: arq.name, texto, campos }]);
        appendLog(`✔ Extraído: Livro=${campos.livro || '-'} Folha=${campos.folha || '-'} Termo=${campos.termo || '-'} Nome=${campos.nome || '-'}`, 'success');
      } catch (err) {
        appendLog(`✖ Erro no arquivo ${arq.name}: ${err?.message || err}`, 'error');
        setResultados((prev) => [...prev, { nomeArquivo: arq.name, texto: '', campos: {} }]);
      }
      setProgresso({ atual: i + 1, total: arquivos.length });
    }

    appendLog('[title] Processamento concluído.', 'success');
    setProcessando(false);
  }, [arquivos, appendLog, lang]);

  const baixarXML = useCallback(() => {
    if (!resultados.length) return;
    const xml = buildXML(resultados);
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'registros_extracao.xml';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [resultados]);

  const colStyle = useMemo(() => ({
    width: 'calc(50% - 8px)'
  }), []);

  return (
    <div style={{ padding: 16 }}>
      {/* Seletor de pasta */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        background: '#fff', padding: '12px 16px', borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => inputRef.current && inputRef.current.click()}
            disabled={processando}
            className={processando ? 'btn-muted btn-compact' : 'btn-gradient btn-gradient-blue btn-compact'}
          >
            📁 Selecionar pasta de imagens
          </button>
          <input
            type="file"
            ref={inputRef}
            style={{ display: 'none' }}
            webkitdirectory="true"
            directory="true"
            multiple
            onChange={onSelectFolder}
            accept="image/*"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Idioma OCR:</label>
          <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd' }}>
            <option value="por">Português (por)</option>
            <option value="eng">Inglês (eng)</option>
            <option value="spa">Espanhol (spa)</option>
          </select>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={iniciarProcessamento}
            disabled={processando || !arquivos.length}
            className={(processando || !arquivos.length) ? 'btn-muted btn-compact' : 'btn-gradient btn-gradient-blue btn-compact'}
          >
            ▶ Iniciar
          </button>
          <button
            onClick={baixarXML}
            disabled={!resultados.length}
            className={!resultados.length ? 'btn-muted btn-compact' : 'btn-gradient btn-gradient-orange btn-compact'}
          >
            ⬇ Baixar XML
          </button>
        </div>
      </div>

      {/* Área de resultados: duas colunas */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'nowrap' }}>
        {/* Resumo à esquerda */}
        <div style={{ ...colStyle, background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minHeight: 280 }}>
          <h3 style={{ marginTop: 0, borderBottom: '2px solid #eee', paddingBottom: 8 }}>Resumo dos dados extraídos</h3>
          {!resultados.length ? (
            <div style={{ color: '#7f8c8d' }}>Nenhum resultado ainda. Selecione uma pasta e clique em Iniciar.</div>
          ) : (
            <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
              {resultados.map((r, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px dashed #eee' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#7f8c8d' }}>{r.nomeArquivo}</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                    <div><strong>Livro:</strong> {r.campos?.livro || '-'}</div>
                    <div><strong>Folha:</strong> {r.campos?.folha || '-'}</div>
                    <div><strong>Termo:</strong> {r.campos?.termo || '-'}</div>
                    <div><strong>Nome:</strong> {r.campos?.nome || '-'}</div>
                    <div><strong>Data:</strong> {r.campos?.data || '-'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Console à direita */}
        <div style={{ ...colStyle, background: '#111', color: '#eee', borderRadius: 8, padding: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#f39c12' }}>Andamento</div>
          <div style={{ fontSize: 12, color: '#bdc3c7', marginBottom: 8 }}>
            Progresso: {progresso.atual}/{progresso.total}
          </div>
          <div ref={consoleRef} style={{ maxHeight: '50vh', overflow: 'auto' }} />
        </div>
      </div>
    </div>
  );
}
