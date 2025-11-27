import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import config from '../../config';
import Toast from '../Toast';
import AnexarPdfModal from './AnexarPdfModal';
import AverbacoesService from '../../services/AverbacoesService';
import { DEFAULT_TOAST_DURATION } from '../toastConfig';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

export default function AverbacoesLista() {
  console.log('[AverbacoesLista] Render iniciado');
  const navigate = useNavigate();
  const location = useLocation();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [ressarcivel, setRessarcivel] = useState('todos'); // 'todos' | 'sim' | 'nao'
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const toastTimerRef = useRef(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [idSelecionado, setIdSelecionado] = useState(null);
  const [uploading, setUploading] = useState(false);

  const showToast = useCallback((type, message) => {
    setToastType(type);
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
      toastTimerRef.current = null;
    }, DEFAULT_TOAST_DURATION);
  }, []);

  const fetchLista = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const qs = [];
      if (dataInicial) qs.push(`dataInicial=${encodeURIComponent(dataInicial)}`);
      if (dataFinal) qs.push(`dataFinal=${encodeURIComponent(dataFinal)}`);
      if (ressarcivel === 'sim') qs.push('ressarcivel=true');
      if (ressarcivel === 'nao') qs.push('ressarcivel=false');
      if (tipoFiltro) qs.push(`tipo=${encodeURIComponent(tipoFiltro)}`);
      const query = qs.length ? `?${qs.join('&')}` : '';
      const res = await fetch(`${config.apiURL}/averbacoes-gratuitas${query}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      let parsed = null;
      try {
        parsed = await res.json();
      } catch (_) {
        parsed = null;
      }
      if (!res.ok) {
        console.error('[AverbacoesLista] Falha ao carregar lista', { status: res.status, payload: parsed });
      } else {
        const totalItens = Array.isArray(parsed?.averbacoes)
          ? parsed.averbacoes.length
          : Array.isArray(parsed)
            ? parsed.length
            : 0;
        console.log('[AverbacoesLista] Lista carregada', { total: totalItens });
      }
      if (!res.ok) {
        const msg = (parsed && (parsed.message || parsed.error || parsed.detail)) || 'Erro ao carregar lista.';
        throw new Error(msg);
      }
      const lista = Array.isArray(parsed?.averbacoes) ? parsed.averbacoes : (Array.isArray(parsed) ? parsed : []);
      setItens(lista);
      return lista;
    } catch (e) {
      setItens([]);
      showToast('error', e?.message || 'Erro ao carregar lista.');
      throw e;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dataFinal, dataInicial, ressarcivel, tipoFiltro, showToast]);

  useEffect(() => {
    console.log('[AverbacoesLista] Montagem / efeito inicial iniciado');
    fetchLista().catch(() => {});
    return () => {
      console.log('[AverbacoesLista] Componente desmontado');
    };
  }, [fetchLista]);

  // Mostrar toast vindo de navegacao (ex: salvou na tela de manutencao)
  useEffect(() => {
    if (location.state?.message) {
      showToast(location.state?.type || 'success', location.state.message);
      // limpar state para não reaparecer em refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tiposDisponiveis = useMemo(() => {
    const setTipos = new Set((itens || []).map(i => i.tipo).filter(Boolean));
    return Array.from(setTipos).sort();
  }, [itens]);

  const contagem = useMemo(() => {
    const total = (itens || []).length;
    const sim = (itens || []).filter(i => !!i.ressarcivel).length;
    const nao = Math.max(0, total - sim);
    return { total, sim, nao };
  }, [itens]);

  const limparFiltros = () => {
    setDataInicial('');
    setDataFinal('');
    setRessarcivel('todos');
    setTipoFiltro('');
  };

  const handleExcluir = async (id) => {
    if (!id) return;
    if (!window.confirm('Deseja realmente excluir esta averbação gratuita?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(id)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setItens(prev => prev.filter(i => i.id !== id));
        showToast('success', 'Averbação excluída com sucesso!');
      } else {
        const t = await res.text();
        showToast('error', t || 'Erro ao excluir.');
      }
    } catch (e) {
      showToast('error', 'Erro ao excluir.');
    }
  };

  const abrirModalAnexo = (id) => {
    console.log('[AverbacoesLista] Solicitando abertura do modal de anexo', { id });
    setIdSelecionado(id);
    setModalAberto(true);
  };

  const fecharModalAnexo = () => {
    if (uploading) return;
    console.log('[AverbacoesLista] Fechando modal de anexo');
    setModalAberto(false);
    setIdSelecionado(null);
  };

  useEffect(() => {
    console.log('[AverbacoesLista] Estado do modal atualizado', {
      modalAberto,
      idSelecionado,
      uploading
    });
  }, [modalAberto, idSelecionado, uploading]);

  const enviarAnexo = async (file) => {
    if (!idSelecionado || !file) return;
    try {
      setUploading(true);
      console.log('[AverbacoesLista] Iniciando upload PDF', {
        idSelecionado,
        nomeArquivo: file.name,
        tamanhoKB: Math.round(file.size / 1024)
      });
  const uploadResult = await AverbacoesService.uploadAnexoPdf(idSelecionado, file);
  const { url, shareLink, webUrl } = uploadResult || {};
  console.log('[AverbacoesLista] Upload finalizado', uploadResult);
      await fetchLista({ silent: true });
      const linkInfo = shareLink || webUrl || url;
      showToast('success', linkInfo ? 'Anexo enviado e link gerado com sucesso!' : 'Anexo enviado com sucesso!');
      setModalAberto(false);
      setIdSelecionado(null);
    } catch (e) {
      console.error('[AverbacoesLista] Erro ao enviar anexo', e);
      showToast('error', e?.message || 'Falha ao enviar anexo.');
    } finally {
      setUploading(false);
    }
  };

  console.log('[AverbacoesLista] Render concluído', {
    totalItens: itens?.length || 0,
    loading,
    modalAberto,
    idSelecionado
  });

  return (
    <div style={{ padding: 16 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        padding: '8px 12px',
        background: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(44,62,80,0.12)'
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => navigate('/averbacoes-gratuitas/nova')}
            style={{
              background: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(44,62,80,0.12)'
            }}
          >
            + NOVO ATO GRATUITO
          </button>
          {/* Exportar CSV removido */}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Data Inicial</label>
            <input type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)}
              style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '6px 10px', fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Data Final</label>
            <input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)}
              style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '6px 10px', fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Ressarcível?</label>
            <select value={ressarcivel} onChange={e => setRessarcivel(e.target.value)}
              style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '6px 10px', fontSize: 14, minWidth: 140 }}>
              <option value="todos">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2c3e50' }}>Tipo de Averbação</label>
            <input list="tipos-averbacao" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}
              placeholder="Digite ou escolha..."
              style={{ border: '1.5px solid #bdc3c7', borderRadius: 6, padding: '6px 10px', fontSize: 14, minWidth: 220 }} />
            <datalist id="tipos-averbacao">
              {tiposDisponiveis.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </datalist>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
            <button
              onClick={limparFiltros}
              title="Limpar filtros"
              style={{
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, borderRadius: 12, background: '#f4f6f8', padding: 16 }}>
        <div style={{ marginBottom: 10, color: '#2c3e50', fontSize: 13 }}>
          <strong>{contagem.total}</strong> item(s)
          {contagem.total > 0 && (
            <span> — Ressarcíveis: <strong>{contagem.sim}</strong>; Não: <strong>{contagem.nao}</strong></span>
          )}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#e9ecef' }}>
              <th style={{ padding: 8 }}>Data</th>
              <th style={{ padding: 8 }}>Ato</th>
              <th style={{ padding: 8 }}>Tipo</th>
              {/* <th style={{ padding: 8 }}>Descrição</th> */}
              <th style={{ padding: 8 }}>Ressarcível</th>
              <th style={{ padding: 8 }}>Caminho</th>
              <th style={{ padding: 8 }}>PDF</th>
              <th style={{ padding: 8 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: '#888' }}>Carregando...</td></tr>
            ) : itens.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: '#888' }}>Nenhuma averbação encontrada.</td></tr>
            ) : (
              itens.map(item => (
                <tr key={item.id} style={{ background: '#fff' }}>
                  <td style={{ padding: 8 }}>{formatDate(item.data || item.criado_em)}</td>
                  <td style={{ padding: 8 }}>{item.tipo_outro || item.tipoOutro || item.tipoAto || '-'}</td>
                  <td style={{ padding: 8 }}>{item.tipo || '-'}</td>
                  {/* <td style={{ padding: 8 }}>{item.descricao || '-'} </td> */}
                  <td style={{ padding: 8 }}>{item.ressarcivel ? 'Sim' : 'Não'}</td>
                  <td style={{ padding: 8 }}>{item.pdf_url || '—'}</td>
                  <td style={{ padding: 8 }}>
                    {(() => {
                      // DEBUG: logar o objeto item para inspecionar uploads/anexos
                      // eslint-disable-next-line no-console
                      console.log('[AverbacoesLista] item para coluna Anexo:', item);
                      // 1. uploads array (novo padrão)
                      if (Array.isArray(item.uploads) && item.uploads.length > 0) {
                        const u = item.uploads[0];
                        const nome = u.original_name || u.originalName || u.stored_name || u.storedName || (u.url ? decodeURIComponent(u.url.split('/').pop()) : '');
                        return u.url ? (
                          <a href={u.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }} title={nome}>{nome}</a>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>{nome || '—'}</span>
                        );
                      }
                      // 2. pdf (objeto)
                      if (item.pdf && (item.pdf.url || item.pdf.storedName || item.pdf.originalName || item.pdf.filename)) {
                        const nome = item.pdf.originalName || item.pdf.storedName || item.pdf.filename || (item.pdf.url ? decodeURIComponent(item.pdf.url.split('/').pop()) : '');
                        return item.pdf.url ? (
                          <a href={item.pdf.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }} title={nome}>{nome}</a>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>{nome || '—'}</span>
                        );
                      }
                      // 3. pdf_filename + pdf_url (legado)
                      if (item.pdf_filename && item.pdf_url) {
                        return (
                          <a href={item.pdf_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }} title={item.pdf_filename}>{item.pdf_filename}</a>
                        );
                      }
                      // 4. anexo_url + anexo_metadata (legado)
                      if (item.anexo_url) {
                        const nome = (item.anexo_metadata && (item.anexo_metadata.originalName || item.anexo_metadata.filename)) || (item.anexo_url.split('/').pop()) || 'Abrir PDF';
                        return (
                          <a href={item.anexo_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }} title={nome}>{nome}</a>
                        );
                      }
                      // 5. anexoUrl camelCase (legado)
                      if (item.anexoUrl) {
                        const nome = (item.anexo_metadata && (item.anexo_metadata.originalName || item.anexo_metadata.filename)) || (item.anexoUrl.split('/').pop()) || 'Abrir PDF';
                        return (
                          <a href={item.anexoUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }} title={nome}>{nome}</a>
                        );
                      }
                      // Nada encontrado
                      return <span style={{ color: '#94a3b8' }}>—</span>;
                    })()}
                  </td>
                  <td style={{ padding: 8, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                    <button
                      style={{ background: '#3498db', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                      onClick={() => navigate(`/averbacoes-gratuitas/${encodeURIComponent(item.id)}/editar`)}
                    >
                      EDITAR
                    </button>
                    <button
                      style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                      onClick={() => handleExcluir(item.id)}
                    >
                      EXCLUIR
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
        <AnexarPdfModal
          open={modalAberto}
          onClose={fecharModalAnexo}
          onSubmit={enviarAnexo}
          loading={uploading}
        />
        {/* Toast de feedback */}
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
    </div>
  );
}
