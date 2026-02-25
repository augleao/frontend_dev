import { useEffect, useMemo, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { FiAlertTriangle, FiDatabase, FiEye, FiPlay, FiRefreshCcw, FiSave, FiTrash2, FiUpload } from 'react-icons/fi';
import { LuLayers, LuSparkles } from 'react-icons/lu';
import AtosTabelaService from '../../services/AtosTabelaService';
import './AtosTabelaManager.css';

// Configuração do worker do PDF.js para processamento no frontend
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const defaultSnapshotLabel = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${month}-${now.getFullYear()}`;
};

function formatDate(dateString) {
  if (!dateString) return 'n/d';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'n/d';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AtosTabelaManager() {
  const [versions, setVersions] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);
  const [snapshotOrigem, setSnapshotOrigem] = useState(defaultSnapshotLabel());
  const [overwriteSnapshot, setOverwriteSnapshot] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [importOrigem, setImportOrigem] = useState('');
  const [importPayload, setImportPayload] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [pdfOrigem, setPdfOrigem] = useState('');
  const [pdfOverwrite, setPdfOverwrite] = useState(true);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [tableBusy, setTableBusy] = useState(false);
  const [preview, setPreview] = useState({ origem: null, registros: [] });
  const [previewBusy, setPreviewBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(null);
  const [validationResults, setValidationResults] = useState({});

  const showBanner = (type, message) => {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), 6500);
  };

  const round2 = (value) => {
    if (!Number.isFinite(value)) return NaN;
    return Number(value.toFixed(2));
  };

  const almostEqual = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(round2(a) - round2(b)) < 0.01;

  const validateRow = (row) => {
    const codigo = String(row.codigo ?? '').trim();
    const emolBruto = parseFloat(row.emol_bruto);
    const recompe = parseFloat(row.recompe);
    const emolLiquido = parseFloat(row.emol_liquido);
    const issqn = parseFloat(row.issqn);
    const taxaFiscal = parseFloat(row.taxa_fiscal) || 0;
    const valorFinal = parseFloat(row.valor_final);

    if (!Number.isFinite(emolBruto)) return { ok: false, motivo: 'Emol. bruto ausente' };

    const isJuizDePaz = ['11', '12', '13'].includes(codigo);
    const recompeCalc = isJuizDePaz ? 0 : round2(emolBruto * 0.07);
    const emolLiquidoCalc = isJuizDePaz ? round2(emolBruto) : round2(emolBruto - recompeCalc);
    const issqnCalc = isJuizDePaz ? 0 : round2(emolLiquidoCalc * 0.03);
    const valorFinalCalc = isJuizDePaz
      ? round2(emolBruto)
      : round2(recompeCalc + emolLiquidoCalc + issqnCalc + (Number.isFinite(taxaFiscal) ? taxaFiscal : 0));

    const fieldMismatch = {
      recompe: !almostEqual(recompe, recompeCalc),
      emolLiquido: !almostEqual(emolLiquido, emolLiquidoCalc),
      issqn: !almostEqual(issqn, issqnCalc),
      valorFinal: !almostEqual(valorFinal, valorFinalCalc)
    };

    const ok = !fieldMismatch.recompe && !fieldMismatch.emolLiquido && !fieldMismatch.issqn && !fieldMismatch.valorFinal;

    return { ok, esperado: { recompeCalc, emolLiquidoCalc, issqnCalc, valorFinalCalc }, fields: fieldMismatch };
  };

  const handleValidatePreview = () => {
    if (!preview?.registros?.length) return;
    const result = {};
    preview.registros.forEach((row) => {
      result[row.codigo] = validateRow(row);
    });

    const total = preview.registros.length;
    const invalid = Object.values(result).filter((item) => !item.ok).length;
    setValidationResults(result);
    showBanner(
      invalid ? 'error' : 'success',
      `Validação concluída: ${total - invalid} linha(s) consistente(s) e ${invalid} com divergência.`
    );
  };

  const loadVersions = async () => {
    setLoading(true);
    try {
      const data = await AtosTabelaService.listVersions();
      setVersions(data?.origens || []);
      setActive(data?.ativa || null);
    } catch (err) {
      showBanner('error', err.message || 'Não foi possível listar as versões salvas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, []);

  const handleSnapshot = async (event) => {
    event.preventDefault();
    if (!snapshotOrigem) {
      showBanner('error', 'Informe o identificador da nova versão (ex.: 01-2026).');
      return;
    }
    setSnapshotBusy(true);
    try {
      await AtosTabelaService.snapshotCurrent({ origem: snapshotOrigem, overwrite: overwriteSnapshot });
      showBanner('success', `Versão ${snapshotOrigem} salva a partir da tabela atual.`);
      await loadVersions();
    } catch (err) {
      showBanner('error', err.message || 'Falha ao salvar a versão atual.');
    } finally {
      setSnapshotBusy(false);
    }
  };

  const handleImport = async (event) => {
    event.preventDefault();
    if (!importOrigem.trim()) {
      showBanner('error', 'Defina a origem antes de importar registros.');
      return;
    }
    if (!importPayload.trim()) {
      showBanner('error', 'Cole o JSON contendo os atos que deseja importar.');
      return;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(importPayload);
    } catch (_) {
      showBanner('error', 'JSON inválido. Verifique a estrutura antes de reenviar.');
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      showBanner('error', 'A importação precisa de um array com pelo menos um registro.');
      return;
    }
    setImportBusy(true);
    try {
      await AtosTabelaService.importVersion({ origem: importOrigem.trim(), registros: parsed });
      showBanner('success', `Versão ${importOrigem.trim()} importada (${parsed.length} registros).`);
      setImportPayload('');
      await loadVersions();
    } catch (err) {
      showBanner('error', err.message || 'Não foi possível importar os registros.');
    } finally {
      setImportBusy(false);
    }
  };

  const handleImportPdf = async (event) => {
    event.preventDefault();
    if (!pdfOrigem.trim()) {
      showBanner('error', 'Defina a origem antes de importar o PDF.');
      return;
    }
    if (!pdfFile) {
      showBanner('error', 'Selecione o PDF da Consulta 7.');
      return;
    }

    setPdfBusy(true);
    try {
      // 1. Converter PDF para imagens no frontend (melhor para OCR no cloud/backend)
      // pois o ambiente de node muitas vezes não possui as bibliotecas de renderização nativas.
      showBanner('info', 'Processando PDF localmente para otimizar OCR...');
      const imageBlobs = await renderPdfToImages(pdfFile);
      
      showBanner('info', `Enviando ${imageBlobs.length} páginas para análise...`);
      await AtosTabelaService.importVersionPdf({
        origem: pdfOrigem.trim(),
        arquivo: pdfFile, // mantém o original por precaução
        images: imageBlobs, // envia imagens renderizadas
        overwrite: pdfOverwrite
      });
      
      showBanner('success', `Importação de ${pdfOrigem.trim()} concluída com sucesso.`);
      setPdfFile(null);
      await loadVersions();
    } catch (err) {
      console.error('Erro na importação PDF:', err);
      showBanner('error', err.message || 'Falha ao importar o PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  /**
   * Renderiza cada página do PDF em um Canvas e retorna um array de Blobs (PNG)
   * Isso contorna a falta de bibliotecas de renderização nativa (poppler/libvips) no servidor.
   */
  const renderPdfToImages = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const blobs = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.5 }); // escala alta para OCR preciso
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport }).promise;
        
        const blob = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/png', 0.9);
        });
        blobs.push(blob);
      }
      return blobs;
    } catch (err) {
      throw new Error('Falha ao processar as páginas do PDF: ' + err.message);
    }
  };

  const handleActivate = async (origem) => {
    setTableBusy(true);
    try {
      await AtosTabelaService.activateVersion(origem);
      showBanner('success', `Versão ${origem} ativada com sucesso.`);
      await loadVersions();
    } catch (err) {
      showBanner('error', err.message || 'Não foi possível ativar esta versão.');
    } finally {
      setTableBusy(false);
    }
  };

  const handleDelete = async (origem) => {
    if (!window.confirm(`Remover definitivamente a origem ${origem}?`)) return;
    setTableBusy(true);
    try {
      await AtosTabelaService.deleteVersion(origem);
      showBanner('success', `Versão ${origem} removida.`);
      await loadVersions();
    } catch (err) {
      showBanner('error', err.message || 'Erro ao remover a origem.');
    } finally {
      setTableBusy(false);
    }
  };

  const handlePreview = async (origem) => {
    setPreviewBusy(true);
    try {
      const data = await AtosTabelaService.previewVersion(origem);
      setPreview({ origem: data?.origem, registros: data?.registros || [] });
      setValidationResults({});
    } catch (err) {
      showBanner('error', err.message || 'Falha ao carregar a prévia desta origem.');
    } finally {
      setPreviewBusy(false);
    }
  };

  const handlePreviewFieldChange = (codigo, field, value) => {
    setPreview((prev) => {
      if (!prev?.origem) return prev;
      const registrosAtualizados = prev.registros.map((row) => (row.codigo === codigo ? { ...row, [field]: value } : row));
      return { ...prev, registros: registrosAtualizados };
    });
  };

  const handlePreviewSave = async (row) => {
    if (!preview?.origem) return;
    setUpdateBusy(row.codigo);
    try {
      const payload = {
        descricao: row.descricao,
        emol_bruto: row.emol_bruto,
        recompe: row.recompe,
        emol_liquido: row.emol_liquido,
        issqn: row.issqn,
        taxa_fiscal: row.taxa_fiscal,
        valor_final: row.valor_final
      };
      const result = await AtosTabelaService.updateRecord(preview.origem, row.codigo, payload);
      setPreview((prev) => {
        if (!prev?.origem) return prev;
        const registrosAtualizados = prev.registros.map((entry) => (entry.codigo === row.codigo ? { ...entry, ...(result?.registro || {}) } : entry));
        return { ...prev, registros: registrosAtualizados };
      });
      showBanner('success', `Registro ${row.codigo} atualizado em ${preview.origem}.`);
      await loadVersions();
    } catch (err) {
      showBanner('error', err.message || 'Não foi possível atualizar o registro.');
    } finally {
      setUpdateBusy(null);
    }
  };

  const versionCards = useMemo(() => {
    if (!versions.length) {
      return (
        <div className="atm-empty-state">
          <LuLayers size={48} />
          <p>Nenhuma versão salva ainda. Capture a tabela atual para começar.</p>
        </div>
      );
    }
    return versions.map((item) => (
      <div className={`atm-version-card${item.ativa ? ' atm-version-card--active' : ''}`} key={item.origem}>
        <div className="atm-version-head">
          <span className="atm-version-label">Origem {item.origem}</span>
          {item.ativa && <span className="atm-chip">Em uso</span>}
        </div>
        <div className="atm-version-metrics">
          <div>
            <strong>{item.total_registros}</strong>
            <span>Atos cadastrados</span>
          </div>
          <div>
            <strong>{formatDate(item.ultima_atualizacao)}</strong>
            <span>Última atualização</span>
          </div>
        </div>
        <div className="atm-version-actions">
          <button
            type="button"
            className="btn-gradient btn-gradient-blue btn-compact"
            onClick={() => handlePreview(item.origem)}
            disabled={previewBusy && preview?.origem === item.origem}
          >
            <FiEye size={16} /> Prévia
          </button>
          <button
            type="button"
            className="btn-gradient btn-gradient-green btn-compact"
            onClick={() => handleActivate(item.origem)}
            disabled={tableBusy}
          >
            <FiPlay size={16} /> Ativar
          </button>
          <button
            type="button"
            className="btn-gradient btn-gradient-red btn-compact"
            onClick={() => handleDelete(item.origem)}
            disabled={tableBusy}
          >
            <FiTrash2 size={16} /> Excluir
          </button>
        </div>
      </div>
    ));
  }, [versions, tableBusy, previewBusy, preview]);

  return (
    <div className="atos-table-manager">
      <header className="atm-hero">
        <div>
          <p className="atm-eyebrow">TJMG • Tabelas 07/08</p>
          <h1>Controle de Versões dos Atos</h1>
          <p className="atm-subtitle">
            Salve cada tabela oficial com um identificador (por exemplo, 01-2025), mantenha um histórico completo e alterne qual versão abastece o sistema com um clique.
          </p>
          <div className="atm-hero-tags">
            <span><LuSparkles size={16} /> Transparência histórica</span>
            <span><FiDatabase size={16} /> Migração em lote</span>
          </div>
        </div>
        <div className="atm-hero-card">
          <span>Versão em uso</span>
          <strong>{active?.origem || 'não definida'}</strong>
          <small>{active?.total ? `${active.total} atos carregados` : 'Capture ou ative uma origem para definir a versão atual.'}</small>
          <button
            type="button"
            className="btn-gradient btn-gradient-blue btn-compact atm-hero-btn"
            onClick={loadVersions}
            disabled={loading}
          >
            <FiRefreshCcw size={16} /> Atualizar estado
          </button>
        </div>
      </header>

      {banner && (
        <div className={`atm-banner atm-banner--${banner.type}`}>
          {banner.message}
        </div>
      )}

      <section className="atm-grid">
        <article className="atm-card">
          <div className="atm-card-head">
            <h2>Salvar tabela atual</h2>
            <p>Cria um snapshot completo da tabela `atos` no banco `atos_tabelas`.</p>
          </div>
          <form className="atm-form" onSubmit={handleSnapshot}>
            <label>
              Identificador da origem
              <input
                type="text"
                value={snapshotOrigem}
                onChange={(e) => setSnapshotOrigem(e.target.value.toUpperCase())}
                placeholder="MM-AAAA"
              />
            </label>
            <label className="atm-switch">
              <input
                type="checkbox"
                checked={overwriteSnapshot}
                onChange={(e) => setOverwriteSnapshot(e.target.checked)}
              />
              <span>Limpar versão antes de capturar (overwrite)</span>
            </label>
            <button
              type="submit"
              className="btn-gradient btn-gradient-green"
              disabled={snapshotBusy}
            >
              <LuLayers size={18} /> {snapshotBusy ? 'Salvando...' : 'Capturar versão atual'}
            </button>
          </form>
        </article>

        <article className="atm-card">
          <div className="atm-card-head">
            <h2>Importar via JSON</h2>
            <p>Opcional: cole um array de atos para preencher `atos_tabelas` diretamente.</p>
          </div>
          <form className="atm-form" onSubmit={handleImport}>
            <label>
              Nome de destino
              <input
                type="text"
                value={importOrigem}
                onChange={(e) => setImportOrigem(e.target.value.toUpperCase())}
                placeholder="EX.: 01-2026"
              />
            </label>
            <label>
              Conteúdo JSON
              <textarea
                value={importPayload}
                onChange={(e) => setImportPayload(e.target.value)}
                placeholder='[ { "codigo": "7801", "descricao": "Registro...", "valor_final": 123.45 }, ... ]'
              />
            </label>
            <button
              type="submit"
              className="btn-gradient btn-gradient-orange"
              disabled={importBusy}
            >
              <FiUpload size={18} /> {importBusy ? 'Importando...' : 'Importar registros'}
            </button>
          </form>
        </article>

        <article className="atm-card">
          <div className="atm-card-head">
            <h2>Importar PDF (Tabelas do Recivil)</h2>
            <p>Envia o PDF oficial do Recivil para extrair e preencher uma nova origem.</p>
          </div>
          <form className="atm-form" onSubmit={handleImportPdf}>
            <label>
              Nome de destino
              <input
                type="text"
                value={pdfOrigem}
                onChange={(e) => setPdfOrigem(e.target.value.toUpperCase())}
                placeholder="EX.: 01-2026"
              />
            </label>
            <label>
              PDF da Tabela
              <div className="atm-file-picker">
                <input
                  id="pdf-file-input"
                  className="atm-file-input"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                />
                <label htmlFor="pdf-file-input" className="btn-gradient btn-gradient-blue btn-compact atm-file-button">
                  Escolher arquivo
                </label>
                <span className="atm-file-name">{pdfFile ? pdfFile.name : 'Nenhum arquivo escolhido'}</span>
              </div>
            </label>
            <label className="atm-switch">
              <input
                type="checkbox"
                checked={pdfOverwrite}
                onChange={(e) => setPdfOverwrite(e.target.checked)}
              />
              <span>Limpar versão antes de importar (se desmarcado, irá mesclar)</span>
            </label>
            <button
              type="submit"
              className="btn-gradient btn-gradient-blue"
              disabled={pdfBusy}
            >
              <FiUpload size={18} /> {pdfBusy ? 'Processando...' : 'Importar PDF'}
            </button>
          </form>
        </article>
      </section>

      <section className="atm-versions">
        <div className="atm-versions-head">
          <h2>Histórico de Tabelas
            <small>{loading ? 'Carregando...' : `${versions.length} origens cadastradas`}</small>
          </h2>
          <button
            type="button"
            className="btn-gradient btn-gradient-blue btn-compact"
            onClick={loadVersions}
            disabled={loading}
          >
            <FiRefreshCcw size={16} /> Atualizar lista
          </button>
        </div>
        <div className="atm-version-list">
          {versionCards}
        </div>
      </section>

      {preview?.origem && (
        <section className="atm-preview">
          <header>
            <div>
              <p className="atm-eyebrow">Prévia rápida</p>
              <h3>Origem {preview.origem}</h3>
              <small>{preview.registros.length} registros exibidos (máx. 200)</small>
            </div>
            <div className="atm-preview-actions">
              <button
                type="button"
                className="btn-gradient btn-gradient-orange btn-compact"
                onClick={handleValidatePreview}
                disabled={previewBusy}
              >
                <FiAlertTriangle size={16} /> Verificar inconsistências
              </button>
              <button
                type="button"
                className="btn-gradient btn-gradient-red btn-compact"
                onClick={() => {
                  setPreview({ origem: null, registros: [] });
                  setValidationResults({});
                }}
              >
                Fechar
              </button>
            </div>
          </header>
          <div className="atm-preview-table">
            <table>
              <thead>
                <tr>
                  <th>Emolumentos brutos</th>
                  <th>Recompe</th>
                  <th>Emolumentos líquidos</th>
                  <th>ISSQN</th>
                  <th>Taxa de Fiscalização Judiciária (TFJ)</th>
                  <th>Valor final ao usuário</th>
                  <th>Código da Corregedoria</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {preview.registros.map((row) => {
                  const validation = validationResults[row.codigo];
                  const invalidFields = validation?.fields || {};
                  return (
                  <tr
                    key={`${preview.origem}-${row.codigo}`}
                    className={
                      validation?.ok === true
                        ? 'atm-row-valid'
                        : validation?.ok === false
                        ? 'atm-row-invalid'
                        : ''
                    }
                  >
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.emol_bruto ?? ''}
                        onChange={(e) => handlePreviewFieldChange(row.codigo, 'emol_bruto', e.target.value)}
                      />
                    </td>
                    <td className={invalidFields.recompe ? 'atm-cell-invalid' : ''}>
                      <input
                        type="number"
                        step="0.01"
                        value={row.recompe ?? ''}
                        onChange={(e) => handlePreviewFieldChange(row.codigo, 'recompe', e.target.value)}
                      />
                    </td>
                    <td className={invalidFields.emolLiquido ? 'atm-cell-invalid' : ''}>
                      <input
                        type="number"
                        step="0.01"
                        value={row.emol_liquido ?? ''}
                        onChange={(e) => handlePreviewFieldChange(row.codigo, 'emol_liquido', e.target.value)}
                      />
                    </td>
                    <td className={invalidFields.issqn ? 'atm-cell-invalid' : ''}>
                      <input
                        type="number"
                        step="0.01"
                        value={row.issqn ?? ''}
                        onChange={(e) => handlePreviewFieldChange(row.codigo, 'issqn', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.taxa_fiscal ?? ''}
                        onChange={(e) => handlePreviewFieldChange(row.codigo, 'taxa_fiscal', e.target.value)}
                      />
                    </td>
                    <td className={invalidFields.valorFinal ? 'atm-cell-invalid' : ''}>
                      <input
                        type="number"
                        step="0.01"
                        value={row.valor_final ?? ''}
                        onChange={(e) => handlePreviewFieldChange(row.codigo, 'valor_final', e.target.value)}
                      />
                    </td>
                    <td>{row.codigo}</td>
                    <td className="atm-inline-actions">
                      <button
                        type="button"
                        className="btn-gradient btn-gradient-green btn-compact"
                        onClick={() => handlePreviewSave(row)}
                        disabled={updateBusy === row.codigo}
                      >
                        <FiSave size={16} /> {updateBusy === row.codigo ? 'Salvando...' : 'Salvar'}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
