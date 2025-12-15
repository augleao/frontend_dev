import { useEffect, useMemo, useState } from 'react';
import { FiDatabase, FiEye, FiPlay, FiRefreshCcw, FiSave, FiTrash2, FiUpload } from 'react-icons/fi';
import { LuLayers, LuSparkles } from 'react-icons/lu';
import AtosTabelaService from '../../services/AtosTabelaService';
import './AtosTabelaManager.css';

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
  const [tableBusy, setTableBusy] = useState(false);
  const [preview, setPreview] = useState({ origem: null, registros: [] });
  const [previewBusy, setPreviewBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(null);

  const showBanner = (type, message) => {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), 6500);
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
          <button type="button" onClick={() => handlePreview(item.origem)} disabled={previewBusy && preview?.origem === item.origem}>
            <FiEye size={16} /> Prévia
          </button>
          <button type="button" onClick={() => handleActivate(item.origem)} disabled={tableBusy}>
            <FiPlay size={16} /> Ativar
          </button>
          <button type="button" className="atm-danger" onClick={() => handleDelete(item.origem)} disabled={tableBusy}>
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
          <button type="button" onClick={loadVersions} disabled={loading}>
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
              <span>Substituir se já existir</span>
            </label>
            <button type="submit" disabled={snapshotBusy}>
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
              Origem de destino
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
            <button type="submit" disabled={importBusy}>
              <FiUpload size={18} /> {importBusy ? 'Importando...' : 'Importar registros'}
            </button>
          </form>
        </article>
      </section>

      <section className="atm-versions">
        <div className="atm-versions-head">
          <h2>Histórico de origens
            <small>{loading ? 'Carregando...' : `${versions.length} origens cadastradas`}</small>
          </h2>
          <button type="button" onClick={loadVersions} disabled={loading}>
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
            <button type="button" onClick={() => setPreview({ origem: null, registros: [] })}>
              Fechar
            </button>
          </header>
          <div className="atm-preview-table">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Valor final</th>
                  <th>Emol. bruto</th>
                  <th>Recompe</th>
                  <th>Emol. líquido</th>
                  <th>ISSQN</th>
                  <th>Taxa fiscal</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {preview.registros.map((row) => (
                  <tr key={`${preview.origem}-${row.codigo}`}>
                    <td>{row.codigo}</td>
                    <td>
                      <input
                        type="text"
                        value={row.descricao ?? ''}
                        onChange={(e) => handlePreviewFieldChange(row.codigo, 'descricao', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.valor_final ?? ''}
                        onChange={(e) => handlePreviewFieldChange(row.codigo, 'valor_final', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.emol_bruto ?? ''}
                        onChange={(e) => handlePreviewFieldChange(row.codigo, 'emol_bruto', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.recompe ?? ''}
                        onChange={(e) => handlePreviewFieldChange(row.codigo, 'recompe', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.emol_liquido ?? ''}
                        onChange={(e) => handlePreviewFieldChange(row.codigo, 'emol_liquido', e.target.value)}
                      />
                    </td>
                    <td>
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
                    <td className="atm-inline-actions">
                      <button type="button" onClick={() => handlePreviewSave(row)} disabled={updateBusy === row.codigo}>
                        <FiSave size={16} /> {updateBusy === row.codigo ? 'Salvando...' : 'Salvar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
