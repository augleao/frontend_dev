import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import config from '../../config';
import Toast from '../Toast';
import { DEFAULT_TOAST_DURATION } from '../toastConfig';
import AnexarPdfModal from '../averbacoes/AnexarPdfModal';
import ProcedimentoPdfManager from './ProcedimentoPdfManager';
import '../servicos/servicos.css';

export default function ProcedimentoManutencao() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdicao = Boolean(id);

  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    tipo: '',
    tipoOutro: '',
    descricao: '',
    ressarcivel: false,
    observacoes: '',
    livro: '',
    folha: '',
    termo: '',
    nomePessoa1: '',
    nomePessoa2: '',
    codigoTributario: ''
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfInfo, setPdfInfo] = useState({ originalName: '', storedName: '', url: '', id: null });
  const [pdfList, setPdfList] = useState([]);
  const [deletingUploadId, setDeletingUploadId] = useState(null);
  const [codigoSugestoes, setCodigoSugestoes] = useState([]);
  const [codigoLoading, setCodigoLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [modalAberto, setModalAberto] = useState(false);
  const toastTimerRef = useRef(null);

  const showToast = (type, message) => {
    setToastType(type);
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
      toastTimerRef.current = null;
    }, DEFAULT_TOAST_DURATION);
  };

  const abrirModalAnexo = () => {
    console.log('[ProcedimentoManutencao] Solicitando abertura do modal de anexo');
    setModalAberto(true);
  };

  const fecharModalAnexo = () => {
    if (uploading) return;
    console.log('[ProcedimentoManutencao] Fechando modal de anexo');
    setModalAberto(false);
  };

  useEffect(() => {
    if (!isEdicao) return;
    const fetchItem = async () => {
      setLoading(true);
      console.log('[ProcedimentoManutencao] fetchItem: iniciando fetch do procedimento', { id });
      let hadEmbeddedUploads = false;
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${config.apiURL}/procedimentos-gratuitos/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('[ProcedimentoManutencao] fetchItem: resposta inicial', { status: res.status });
        if (res.ok) {
          const data = await res.json();
          const item = data?.procedimento || data;
          console.log('[ProcedimentoManutencao] fetchItem: dados recebidos', { item });
          setForm({
            data: (item.data || new Date().toISOString().slice(0, 10)).slice(0,10),
            tipo: item.tipo || '',
            tipoOutro: item.tipoOutro || '',
            descricao: item.descricao || '',
            ressarcivel: Boolean(item.ressarcivel),
            observacoes: item.observacoes || '',
            livro: item.livro || '',
            folha: item.folha || '',
            termo: item.termo || '',
            nomePessoa1: item.nomePessoa1 || item.nome || '',
            nomePessoa2: item.nomePessoa2 || '',
            codigoTributario: item.codigoTributario || ''
          });
          if (item.pdf) {
            console.log('[ProcedimentoManutencao] fetchItem: item possui pdf', { pdf: item.pdf });
            const pdf = item.pdf || {};
            const meta = pdf.metadata || {};
            const originalName = pdf.originalName || pdf.original_name || meta.originalName || meta.original_name || '';
            const storedName = pdf.storedName || pdf.nome || pdf.filename || (pdf.key ? String(pdf.key).split('/').pop() : '') || '';
            const url = pdf.url || '';
            setPdfInfo({ originalName, storedName, url, id: pdf.id || null });
            if (item.uploads && Array.isArray(item.uploads) && item.uploads.length > 0) {
              hadEmbeddedUploads = true;
              setPdfList(item.uploads.map(u => ({
                id: u.id,
                storedName: u.stored_name || u.storedName,
                originalName: u.original_name || (u.metadata && (u.metadata.originalName || u.metadata.filename)) || '',
                url: u.url || '',
                size: u.size || null,
                contentType: u.content_type || u.contentType || '',
                createdAt: u.created_at || u.createdAt || null
              })));
            }
          } else if (item.pdf_filename || item.pdf_url || item.pdf_filename === null) {
            console.log('[ProcedimentoManutencao] fetchItem: item possui campos legados de PDF', { pdf_filename: item.pdf_filename, pdf_url: item.pdf_url, anexo_url: item.anexo_url });
            setPdfInfo({
              originalName: item.pdf_filename || (item.anexo_metadata && (item.anexo_metadata.originalName || item.anexo_metadata.filename)) || '',
              storedName: item.pdf_filename || '',
              url: item.pdf_url || item.anexo_url || '' ,
              id: null
            });
          } else if (item.anexo_url) {
            setPdfInfo({ originalName: '', storedName: '', url: item.anexo_url || '', id: null });
          }
        }
      } catch (e) {}
      setLoading(false);
      return hadEmbeddedUploads;
    };
    (async () => {
      const had = await fetchItem();
      if (!had && isEdicao && id) fetchUploadsList(id);
    })();
  }, [id, isEdicao]);

  useEffect(() => {
    console.log('[ProcedimentoManutencao] Estado do modal atualizado', {
      modalAberto,
      uploading
    });
  }, [modalAberto, uploading]);

  const fetchUploadsList = async (procedimentoId) => {
    try {
      const token = localStorage.getItem('token');
      // Try new API first (atoId + tipo). If it returns no uploads, fall back to legacy param for compatibility.
      try {
        const qs = `atoId=${encodeURIComponent(procedimentoId)}&tipo=procedimento`;
        const res = await fetch(`${config.apiURL}/uploads?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
        let j = {};
        if (res.ok) {
          try { j = await res.json(); } catch (_) { j = {}; }
          if (j && Array.isArray(j.uploads) && j.uploads.length > 0) {
            return setPdfList(j.uploads.map(u => ({
              id: u.id,
              storedName: u.stored_name || u.storedName,
              originalName: u.original_name || (u.metadata && (u.metadata.originalName || u.metadata.filename)) || '',
              url: u.url || '',
              size: u.size || null,
              contentType: u.content_type || u.contentType || '',
              createdAt: u.created_at || u.createdAt || null
            })));
          }
        }
      } catch (e) {
        console.warn('[ProcedimentoManutencao] fetchUploadsList new query failed, falling back', e && e.message ? e.message : e);
      }

      // Fallback to legacy API
      try {
        const res2 = await fetch(`${config.apiURL}/uploads?procedimentoId=${encodeURIComponent(procedimentoId)}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res2.ok) return setPdfList([]);
        const j2 = await res2.json();
        if (j2 && Array.isArray(j2.uploads)) {
          setPdfList(j2.uploads.map(u => ({
            id: u.id,
            storedName: u.stored_name || u.storedName,
            originalName: u.original_name || (u.metadata && (u.metadata.originalName || u.metadata.filename)) || '',
            url: u.url || '',
            size: u.size || null,
            contentType: u.content_type || u.contentType || '',
            createdAt: u.created_at || u.createdAt || null
          })));
        }
      } catch (e) {
        console.warn('[ProcedimentoManutencao] fetchUploadsList fallback failed', e && e.message ? e.message : e);
        setPdfList([]);
      }
    } catch (e) {
      console.warn('[ProcedimentoManutencao] fetchUploadsList failed', e && e.message ? e.message : e);
      setPdfList([]);
    }
  };

  const salvar = async () => {
    try {
      if (!form.tipo || (form.tipo === 'Outras' && !form.tipoOutro)) {
        showToast('error', 'Informe o tipo de procedimento.');
        return;
      }
      if (!form.livro || !form.folha || !form.termo) {
        showToast('error', 'Preencha Livro, Folha e Termo do registro.');
        return;
      }
      const token = localStorage.getItem('token');
      const payload = {
        data: form.data,
        tipo: form.tipo === 'Outras' ? (form.tipoOutro || 'Outras') : form.tipo,
        ressarcivel: !!form.ressarcivel,
        livro: form.livro,
        folha: form.folha,
        termo: form.termo,
      };
      const url = isEdicao
        ? `${config.apiURL}/procedimentos-gratuitos/${encodeURIComponent(id)}`
        : `${config.apiURL}/procedimentos-gratuitos`;
      const method = isEdicao ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      console.log('[ProcedimentoManutencao] salvar: resposta do save', { status: res.status });
      if (!res.ok) {
        const t = await res.text();
        showToast('error', t || 'Erro ao salvar.');
        return;
      }
      const text = await res.text();
      let dataResp = {};
      try { dataResp = text ? JSON.parse(text) : {}; } catch {}
      const procedimentoId = dataResp?.id || dataResp?.procedimento?.id || id;
      showToast('success', 'Procedimento salvo com sucesso!');
      if (!isEdicao && procedimentoId) {
        setTimeout(() => navigate(`/procedimentos-gratuitos/${encodeURIComponent(procedimentoId)}/editar`, {
          state: { message: 'Procedimento salvo com sucesso.', type: 'success' }
        }), 400);
      }
    } catch (e) {
      showToast('error', 'Erro ao salvar.');
    }
  };

  const MESES_PT_BR = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const getMesReferencia = () => {
    const d = new Date(form.data || new Date());
    const idx = d.getMonth();
    return MESES_PT_BR[idx] || '';
  };

  const handleUploadPDF = async (file) => {
    if (!file) return false;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('error', 'Selecione um arquivo PDF válido.');
      return false;
    }
    setUploading(true);
    let sucesso = false;
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      if (form && form.data) {
        formData.append('data', form.data);
        // include explicit ato identifiers for backend convenience
        if (isEdicao && id) {
          formData.append('atoId', id);
          formData.append('atoTipo', 'procedimento');
        }
      }
          // Informar ao backend o tipo do anexo para regras específicas (ex: renomeação)
          formData.append('metadata', JSON.stringify({ tipo: form.tipoAto || 'procedimento' }));
      const res = await fetch(`${config.apiURL}/procedimentos-gratuitos/upload-pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch {}
      if (!res.ok) {
        showToast('error', data.error || 'Erro ao enviar PDF.');
      } else {
        const info = data.arquivo || data;
        setPdfInfo({
          originalName: info.originalName || file.name,
          storedName: info.storedName || info.nome || info.filename || '',
          url: info.url || '',
          id: info.id || null
        });
        // refresh uploads list: use attached id from backend when present, otherwise current route id
        try {
          const attachedId = data?.attachedProcedimentoId || (data.arquivo && data.arquivo.attachedProcedimentoId) || (isEdicao ? id : null);
          if (attachedId) fetchUploadsList(attachedId);
        } catch (e) { /* ignore */ }
        showToast('success', 'PDF enviado e renomeado com sucesso.');
        sucesso = true;
      }
    } catch (e) {
      showToast('error', 'Falha no upload do PDF.');
    }
    setUploading(false);
    return sucesso;
  };

  const selectAndUploadFiles = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,application/pdf';
      input.multiple = false;
      input.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
          await uploadFileToBackblaze(file);
        } catch (err) {
          console.error('[ProcedimentoManutencao] upload error', err);
          showToast('error', err?.message || 'Falha no upload do PDF.');
        } finally {
          setUploading(false);
        }
      };
      input.click();
    } catch (e) {
      console.error('[ProcedimentoManutencao] select file error', e);
      showToast('error', 'Não foi possível abrir o seletor de arquivos.');
    }
  };

  const uploadFileToBackblaze = async (file) => {
    const token = localStorage.getItem('token');
    const prepareBody = { filename: file.name, contentType: file.type || 'application/pdf', folder: 'procedimentos', metadata: { tipo: form.tipoAto || 'procedimento' } };
    const prepareRes = await fetch(`${config.apiURL}/uploads/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(prepareBody)
    });
    let prepareJson = {};
    try { prepareJson = await prepareRes.json(); } catch (_) { prepareJson = {}; }
    if (!prepareRes.ok) {
      throw new Error(prepareJson.error || prepareJson.message || 'Falha ao preparar upload.');
    }
    const { url, key } = prepareJson;
    if (!url || !key) throw new Error('Resposta inválida do servidor ao preparar upload.');

    const putRes = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/pdf' }, body: file });
    if (!putRes.ok && putRes.status !== 200 && putRes.status !== 201) {
      const text = await putRes.text().catch(() => '');
      throw new Error(text || 'Falha ao enviar arquivo para o Backblaze.');
    }

    const completeBody = { key, metadata: { originalName: file.name, tipo: form.tipoAto || 'procedimento' }, procedimentoId: isEdicao ? id : null, averbacaoId: null, atoId: isEdicao ? id : null, atoTipo: form.tipoAto || 'procedimento' };
    const completeRes = await fetch(`${config.apiURL}/uploads/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(completeBody)
    });
    let completeJson = {};
    try { completeJson = await completeRes.json(); } catch (_) { completeJson = {}; }
    if (!completeRes.ok) {
      throw new Error(completeJson.error || completeJson.message || 'Falha ao confirmar upload no servidor.');
    }

    if (completeJson && completeJson.procedimento) {
      const p = completeJson.procedimento;
      setForm(prev => ({
        ...prev,
        data: p.data ? String(p.data).slice(0,10) : prev.data,
        tipo: p.tipo || prev.tipo,
        tipoOutro: p.tipoOutro || p.tipo_outro || prev.tipoOutro,
        descricao: p.descricao || prev.descricao,
        ressarcivel: typeof p.ressarcivel !== 'undefined' ? Boolean(p.ressarcivel) : prev.ressarcivel,
        observacoes: p.observacoes || prev.observacoes,
        livro: p.livro || prev.livro,
        folha: p.folha || prev.folha,
        termo: p.termo || prev.termo,
        nomePessoa1: p.nomePessoa1 || p.nome || prev.nomePessoa1,
        nomePessoa2: p.nomePessoa2 || prev.nomePessoa2,
        codigoTributario: p.codigoTributario || prev.codigoTributario
      }));

      const pdfObj = p.pdf || (p.anexo_metadata ? { url: p.anexo_url, metadata: p.anexo_metadata } : null);
      if (pdfObj) {
        const meta = pdfObj.metadata || {};
        const originalName = pdfObj.originalName || pdfObj.original_name || meta.originalName || meta.original_name || '';
        const storedName = pdfObj.storedName || pdfObj.nome || pdfObj.filename || (pdfObj.key ? String(pdfObj.key).split('/').pop() : '') || '';
        const url = pdfObj.url || p.anexo_url || '';
        setPdfInfo({ originalName, storedName, url, id: pdfObj.id || null });
        const attachedId = completeJson?.attachedProcedimentoId || p.id || (isEdicao ? id : null);
        if (attachedId) fetchUploadsList(attachedId);
      }
    } else {
      setPdfInfo(prev => ({
        originalName: file.name,
        storedName: completeJson.storedName || completeJson.nome || key,
        url: completeJson.url || prev.url || '',
        id: completeJson.id || prev.id || null
      }));
    }
    showToast('success', 'PDF enviado com sucesso.');
    return true;
  };

  const handleViewUpload = (u) => {
    if (!u || !u.url) {
      showToast('error', 'URL do arquivo não disponível');
      return;
    }
    window.open(u.url, '_blank', 'noopener');
  };

  const handleDeleteUpload = async (uploadId) => {
    if (!uploadId) return;
    if (!window.confirm('Deseja realmente excluir este arquivo? Esta ação não pode ser desfeita.')) return;
    try {
      setDeletingUploadId(uploadId);
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/uploads/${encodeURIComponent(uploadId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      let j = {};
      try { j = await res.json(); } catch (_) { j = {}; }
      if (!res.ok) {
        const message = j && j.error ? j.error : (await res.text().catch(() => 'Erro ao excluir arquivo.'));
        showToast('error', message || 'Erro ao excluir arquivo.');
      } else {
        if (j && typeof j.storageDeleted !== 'undefined') {
          if (j.storageDeleted) {
            showToast('success', 'Arquivo excluído do storage e marcado no sistema.');
          } else if (j.storageDeleteError) {
            showToast('warning', 'Registro removido, mas falha ao excluir do storage: ' + j.storageDeleteError);
          } else {
            showToast('warning', 'Registro removido, mas objeto aparentemente ainda existe no storage.');
          }
        } else {
          showToast('success', 'Arquivo excluído.');
        }
        const pId = isEdicao ? id : null;
        if (pId) fetchUploadsList(pId);
        setPdfInfo(prev => (prev && prev.id === uploadId ? { originalName: '', storedName: '', url: '', id: null } : prev));
      }
    } catch (e) {
      showToast('error', 'Erro ao excluir arquivo.');
    }
    setDeletingUploadId(null);
  };

  const enviarAnexoModal = async (file) => {
    console.log('[ProcedimentoManutencao] Enviando PDF via modal');
    const sucesso = await handleUploadPDF(file);
    if (sucesso) {
      setModalAberto(false);
    }
  };

  const buscarCodigosTributarios = async (term) => {
    if (!term || term.length < 1) { setCodigoSugestoes([]); return; }
    setCodigoLoading(true);
    try {
      const res = await fetch(`${config.apiUrl || config.apiURL}/codigos-tributarios?s=${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        setCodigoSugestoes(data.sugestoes || []);
      } else {
        setCodigoSugestoes([]);
      }
    } catch (e) {
      setCodigoSugestoes([]);
    }
    setCodigoLoading(false);
  };

  return (
    <div style={{ padding: 12 }}>

      <div className="servico-section">
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <form onSubmit={e => { e.preventDefault(); salvar(); }}>
            {/* Passo 1: Upload PDF (moved to ProcedimentoPdfManager) */}
            <ProcedimentoPdfManager
              pdfList={pdfList}
              pdfInfo={pdfInfo}
              uploading={uploading}
              deletingUploadId={deletingUploadId}
              selectAndUploadFiles={selectAndUploadFiles}
              handleViewUpload={handleViewUpload}
              handleDeleteUpload={handleDeleteUpload}
              onSave={salvar}
              getMesReferencia={getMesReferencia}
            />

            {/* Passo 2: Dados principais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="servico-label">Data</label>
                <input className="servico-input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="servico-label">Tipo de Procedimento</label>
                <select className="servico-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="">Selecione...</option>
                  <option value="Tipo A">Tipo A</option>
                  <option value="Tipo B">Tipo B</option>
                  <option value="Outras">Outras</option>
                </select>
              </div>
              {form.tipo === 'Outras' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="servico-label">Informar Tipo</label>
                  <input className="servico-input" type="text" value={form.tipoOutro} onChange={e => setForm(f => ({ ...f, tipoOutro: e.target.value }))} placeholder="Descreva o tipo de procedimento" />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="servico-label">Ressarcível?</label>
                <select className="servico-select" value={form.ressarcivel ? 'sim' : 'nao'} onChange={e => setForm(f => ({ ...f, ressarcivel: e.target.value === 'sim' }))}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
            </div>

            {/* Registro */}
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="servico-label">Livro</label>
                <input className="servico-input" type="text" value={form.livro} onChange={e => setForm(f => ({ ...f, livro: e.target.value }))} placeholder="Ex.: A25" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="servico-label">Folha</label>
                <input className="servico-input" type="text" value={form.folha} onChange={e => setForm(f => ({ ...f, folha: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="servico-label">Termo</label>
                <input className="servico-input" type="text" value={form.termo} onChange={e => setForm(f => ({ ...f, termo: e.target.value }))} />
              </div>
            </div>

            {/* Nomes */}
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="servico-label">Nome do Registrado</label>
                <input className="servico-input" type="text" value={form.nomePessoa1} onChange={e => setForm(f => ({ ...f, nomePessoa1: e.target.value }))} placeholder="Nome completo" />
              </div>
              {form.tipo === 'Divórcio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="servico-label">Segundo Nome (casamento)</label>
                  <input className="servico-input" type="text" value={form.nomePessoa2} onChange={e => setForm(f => ({ ...f, nomePessoa2: e.target.value }))} placeholder="Nome completo" />
                </div>
              )}
            </div>

            {/* Código Tributário */}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
              <label className="servico-label">Código Tributário da Gratuidade</label>
              <input
                className="servico-input"
                type="text"
                value={form.codigoTributario}
                onChange={async e => { const v = e.target.value; setForm(f => ({ ...f, codigoTributario: v })); await buscarCodigosTributarios(v); }}
                placeholder="Digite para buscar..."
                autoComplete="off"
              />
              {codigoLoading && <span style={{ fontSize: 12, color: '#888' }}>Buscando...</span>}
              {codigoSugestoes.length > 0 && (
                <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ccc', borderRadius: 6, margin: 0, padding: '4px 0', listStyle: 'none', zIndex: 9999, maxHeight: 220, overflowY: 'auto' }}>
                  {codigoSugestoes.map(sug => (
                    <li key={sug.codigo} style={{ padding: '6px 10px', cursor: 'pointer' }} onClick={() => { setForm(f => ({ ...f, codigoTributario: sug.codigo })); setCodigoSugestoes([]); }} onMouseEnter={e => e.currentTarget.style.background = '#f7f7f7'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {sug.codigo} - {sug.descricao}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Descrição e Observações */}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="servico-label">Descrição</label>
              <textarea className="servico-textarea" rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="servico-label">Observações</label>
              <textarea className="servico-textarea" rows={3} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </form>
        )}
      </div>

      <AnexarPdfModal
        open={modalAberto}
        onClose={fecharModalAnexo}
        onSubmit={enviarAnexoModal}
        loading={uploading}
        pdfList={pdfList}
        pdfInfo={pdfInfo}
        deletingUploadId={deletingUploadId}
        handleViewUpload={handleViewUpload}
        handleDeleteUpload={handleDeleteUpload}
        getMesReferencia={getMesReferencia}
        selectAndUploadFiles={selectAndUploadFiles}
      />

      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />
    </div>
  );
}
