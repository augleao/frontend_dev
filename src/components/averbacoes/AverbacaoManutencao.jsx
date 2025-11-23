import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import config from '../../config';
import Toast from '../Toast';
import { DEFAULT_TOAST_DURATION } from '../toastConfig';
import { listarSelosAverbacao, criarSeloAverbacao, atualizarSeloAverbacao } from './SeloAverbacaoService';
import ClipboardImageUploadAverbacao from './ClipboardImageUploadAverbacao';
import SeloFileUploadAverbacao from './SeloFileUploadAverbacao';
import AnexarPdfModal from './AnexarPdfModal';
import '../servicos/servicos.css';

export default function AverbacaoManutencao() {
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
    codigoTributario: '',
    selo_consulta: '',
    codigo_seguranca: ''
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
    console.log('[AverbacaoManutencao] Solicitando abertura do modal de anexo');
    setModalAberto(true);
  };

  const fecharModalAnexo = () => {
    if (uploading) return;
    console.log('[AverbacaoManutencao] Fechando modal de anexo');
    setModalAberto(false);
  };

  useEffect(() => {
    if (!isEdicao) return;
    const fetchItem = async () => {
      setLoading(true);
      console.log('[AverbacaoManutencao] fetchItem: iniciando fetch da averbação', { id });
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('[AverbacaoManutencao] fetchItem: resposta inicial', { status: res.status });
        if (res.ok) {
          const data = await res.json();
          const item = data?.averbacao || data;
          console.log('[AverbacaoManutencao] fetchItem: dados recebidos', { item });
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
            codigoTributario: item.codigoTributario || '',
            selo_consulta: item.selo_consulta || '',
            codigo_seguranca: item.codigo_seguranca || ''
          });
            if (item.pdf) {
            console.log('[AverbacaoManutencao] fetchItem: item possui pdf', { pdf: item.pdf });
            // pdf JSON may contain different shapes. Common shapes observed:
            // { key, url, metadata: { originalName } }
            // { originalName, storedName, url }
            const pdf = item.pdf || {};
            const meta = pdf.metadata || {};
            const originalName = pdf.originalName || pdf.original_name || meta.originalName || meta.original_name || '';
            const storedName = pdf.storedName || pdf.nome || pdf.filename || (pdf.key ? String(pdf.key).split('/').pop() : '') || '';
            const url = pdf.url || '';
            setPdfInfo({ originalName, storedName, url, id: pdf.id || null });
            // if the server returned uploads embedded, use them
            if (item.uploads && Array.isArray(item.uploads)) {
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
            // legacy fields: some DB schemas use pdf_filename / pdf_url
            console.log('[AverbacaoManutencao] fetchItem: item possui campos legados de PDF', { pdf_filename: item.pdf_filename, pdf_url: item.pdf_url, anexo_url: item.anexo_url });
            setPdfInfo({
              originalName: item.pdf_filename || (item.anexo_metadata && (item.anexo_metadata.originalName || item.anexo_metadata.filename)) || '',
              storedName: item.pdf_filename || '',
              url: item.pdf_url || item.anexo_url || '' ,
              id: null
            });
          } else if (item.anexo_url) {
            // another legacy option
            setPdfInfo({ originalName: '', storedName: '', url: item.anexo_url || '', id: null });
          }
        }
      } catch (e) {}
      setLoading(false);
    };
    fetchItem();
    // refresh uploads list for this averbacao
    if (isEdicao && id) fetchUploadsList(id);
  }, [id, isEdicao]);

  useEffect(() => {
    console.log('[AverbacaoManutencao] Estado do modal atualizado', {
      modalAberto,
      uploading
    });
  }, [modalAberto, uploading]);


    const fetchUploadsList = async (averbacaoId) => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${config.apiURL}/uploads?averbacaoId=${encodeURIComponent(averbacaoId)}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return setPdfList([]);
        const j = await res.json();
        if (j && Array.isArray(j.uploads)) {
          setPdfList(j.uploads.map(u => ({
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
        console.warn('[AverbacaoManutencao] fetchUploadsList failed', e && e.message ? e.message : e);
        setPdfList([]);
      }
    };
  const salvar = async () => {
    try {
      // Validações mínimas (agora apenas os campos solicitados)
      if (!form.tipo || (form.tipo === 'Outras' && !form.tipoOutro)) {
        showToast('error', 'Informe o tipo de averbação.');
        return;
      }
      if (!form.livro || !form.folha || !form.termo) {
        showToast('error', 'Preencha Livro, Folha e Termo do registro.');
        return;
      }
      const token = localStorage.getItem('token');
      // Envia apenas os campos mínimos solicitados para evitar incompatibilidades no backend
      const payload = {
        data: form.data,
        tipo: form.tipo === 'Outras' ? (form.tipoOutro || 'Outras') : form.tipo,
        ressarcivel: !!form.ressarcivel,
        livro: form.livro,
        folha: form.folha,
        termo: form.termo,
      };
      const url = isEdicao
        ? `${config.apiURL}/averbacoes-gratuitas/${encodeURIComponent(id)}`
        : `${config.apiURL}/averbacoes-gratuitas`;
      const method = isEdicao ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      console.log('[AverbacaoManutencao] salvar: resposta do save', { status: res.status });
      if (!res.ok) {
        const t = await res.text();
        showToast('error', t || 'Erro ao salvar.');
        return;
      }
      // Tenta obter o id da averbação salva
      const text = await res.text();
      let dataResp = {};
      try { dataResp = text ? JSON.parse(text) : {}; } catch {}
      const averbacaoId = dataResp?.id || dataResp?.averbacao?.id || id; // no PUT pode usar o id da URL
      showToast('success', 'Averbação salva com sucesso!');
      // Após salvar, abre a tela de edição para liberar a seção de Selo Eletrônico
      if (!isEdicao && averbacaoId) {
        setTimeout(() => navigate(`/averbacoes-gratuitas/${encodeURIComponent(averbacaoId)}/editar`, {
          state: { message: 'Averbação salva. Agora adicione o selo eletrônico.', type: 'success' }
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
      console.log('[AverbacaoManutencao] handleUploadPDF: iniciando upload via multipart', { name: file.name, size: file.size });
      const token = localStorage.getItem('token');
      const formData = new FormData();
      // Backend espera o campo "file" e opcionalmente "data" (YYYY-MM-DD)
      formData.append('file', file);
      if (form && form.data) {
        formData.append('data', form.data);
      }
      const res = await fetch(`${config.apiURL}/averbacoes-gratuitas/upload-pdf`, {
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
        console.log('[AverbacaoManutencao] handleUploadPDF: backend retornou', { data });
        const info = data.arquivo || data;
        setPdfInfo({
          originalName: info.originalName || file.name,
          // O backend retorna "filename"; manter compat com outras chaves
          storedName: info.storedName || info.nome || info.filename || '',
          url: info.url || '',
          id: info.id || null
        });
        showToast('success', 'PDF enviado e renomeado com sucesso.');
        sucesso = true;
      }
    } catch (e) {
      showToast('error', 'Falha no upload do PDF.');
    }
    setUploading(false);
    return sucesso;
  };

  // New: select file(s) and upload directly to Backblaze using presigned URL flow
  const selectAndUploadFiles = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,application/pdf';
      input.multiple = false;
      input.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        console.log('[AverbacaoManutencao] selectAndUploadFiles: arquivo selecionado', { name: file.name, size: file.size });
        setUploading(true);
        try {
          await uploadFileToBackblaze(file);
        } catch (err) {
          console.error('[AverbacaoManutencao] upload error', err);
          showToast('error', err?.message || 'Falha no upload do PDF.');
        } finally {
          setUploading(false);
        }
      };
      input.click();
    } catch (e) {
      console.error('[AverbacaoManutencao] select file error', e);
      showToast('error', 'Não foi possível abrir o seletor de arquivos.');
    }
  };

  const uploadFileToBackblaze = async (file) => {
    const token = localStorage.getItem('token');
    // 1) request presigned URL from backend
    const prepareBody = { filename: file.name, contentType: file.type || 'application/pdf', folder: 'averbacoes' };
    console.log('[AverbacaoManutencao] uploadFileToBackblaze: preparando upload', { prepareBody });
    const prepareRes = await fetch(`${config.apiURL}/uploads/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(prepareBody)
    });
    let prepareJson = {};
    try { prepareJson = await prepareRes.json(); } catch (_) { prepareJson = {}; }
    console.log('[AverbacaoManutencao] uploadFileToBackblaze: prepare response', { status: prepareRes.status, body: prepareJson });
    if (!prepareRes.ok) {
      throw new Error(prepareJson.error || prepareJson.message || 'Falha ao preparar upload.');
    }

    const { url, key } = prepareJson;
    if (!url || !key) throw new Error('Resposta inválida do servidor ao preparar upload.');

    // 2) upload file directly to Backblaze
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/pdf' },
      body: file
    });
    console.log('[AverbacaoManutencao] uploadFileToBackblaze: put result', { status: putRes.status });
    if (!putRes.ok && putRes.status !== 200 && putRes.status !== 201) {
      const text = await putRes.text().catch(() => '');
      throw new Error(text || 'Falha ao enviar arquivo para o Backblaze.');
    }

    // 3) inform backend that upload completed (and let it persist metadata)
    // Include averbacao id when present so backend can link the upload to the averbacao
    const completeBody = { key, metadata: { originalName: file.name }, averbacaoId: isEdicao ? id : null };
    console.log('[AverbacaoManutencao] uploadFileToBackblaze: confirmando upload (complete)', { completeBody });
    const completeRes = await fetch(`${config.apiURL}/uploads/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(completeBody)
    });
    let completeJson = {};
    try { completeJson = await completeRes.json(); } catch (_) { completeJson = {}; }
    console.log('[AverbacaoManutencao] uploadFileToBackblaze: complete response', { status: completeRes.status, body: completeJson });
    if (!completeRes.ok) {
      throw new Error(completeJson.error || completeJson.message || 'Falha ao confirmar upload no servidor.');
    }

    // Update local state with returned info when available
    // If backend returned the updated averbacao, merge it into local state
    if (completeJson && completeJson.averbacao) {
      const a = completeJson.averbacao;
      // merge form fields (keep existing when not provided)
      setForm(prev => ({
        ...prev,
        data: a.data ? String(a.data).slice(0,10) : prev.data,
        tipo: a.tipo || prev.tipo,
        tipoOutro: a.tipoOutro || a.tipo_outro || prev.tipoOutro,
        descricao: a.descricao || prev.descricao,
        ressarcivel: typeof a.ressarcivel !== 'undefined' ? Boolean(a.ressarcivel) : prev.ressarcivel,
        observacoes: a.observacoes || prev.observacoes,
        livro: a.livro || prev.livro,
        folha: a.folha || prev.folha,
        termo: a.termo || prev.termo,
        nomePessoa1: a.nomePessoa1 || a.nome || prev.nomePessoa1,
        nomePessoa2: a.nomePessoa2 || prev.nomePessoa2,
        codigoTributario: a.codigoTributario || prev.codigoTributario
      }));

      // normalize pdf info from returned averbacao
      const pdfObj = a.pdf || (a.anexo_metadata ? { url: a.anexo_url, metadata: a.anexo_metadata } : null);
      if (pdfObj) {
        const meta = pdfObj.metadata || {};
        const originalName = pdfObj.originalName || pdfObj.original_name || meta.originalName || meta.original_name || '';
        const storedName = pdfObj.storedName || pdfObj.nome || pdfObj.filename || (pdfObj.key ? String(pdfObj.key).split('/').pop() : '') || '';
        const url = pdfObj.url || a.anexo_url || '';
        setPdfInfo({ originalName, storedName, url, id: pdfObj.id || null });
        // refresh list from server if available. Determine the averbacao id
        // from the response, falling back to the current route id when in edit mode.
        const attachedAverbacaoId = completeJson?.attachedAverbacaoId || a.id || (isEdicao ? id : null);
        if (attachedAverbacaoId) fetchUploadsList(attachedAverbacaoId);
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
        // Use backend details to inform the user
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
        // refresh list
        const aId = isEdicao ? id : null;
        if (aId) fetchUploadsList(aId);
        // clear pdfInfo if it matches
        setPdfInfo(prev => (prev && prev.id === uploadId ? { originalName: '', storedName: '', url: '', id: null } : prev));
      }
    } catch (e) {
      showToast('error', 'Erro ao excluir arquivo.');
    }
    setDeletingUploadId(null);
  };

  const enviarAnexoModal = async (file) => {
    console.log('[AverbacaoManutencao] Enviando PDF via modal');
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
        <div className="servico-header">
          <h3 className="servico-title">{isEdicao ? 'Editar Averbação Gratuita' : 'Nova Averbação Gratuita'}</h3>
          <div className="servico-actions" style={{ margin: 0 }}>
            <button onClick={() => navigate('/averbacoes-gratuitas')} className="btn btn-secondary">Cancelar</button>
            <button onClick={salvar} className="btn btn-success">Salvar</button>
          </div>
        </div>
      </div>

      <div className="servico-section">
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <form onSubmit={e => { e.preventDefault(); salvar(); }}>
            {/* Passo 1: Upload PDF */}
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px dashed #e1e5ea' }}>
              <h4 className="servico-title" style={{ fontSize: 16, margin: '0 0 8px 0' }}>1) Anexar PDF da Averbação</h4>
              <div className="servico-row" style={{ alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={selectAndUploadFiles}
                  disabled={uploading}
                  style={{ minWidth: 140 }}
                >
                  {uploading ? 'Enviando…' : 'Selecionar PDF'}
                </button>
                {uploading && <span style={{ color: '#888' }}>Enviando...</span>}
                {pdfList && pdfList.length > 0 ? (
                  <div style={{ marginTop: 8, background: 'white', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                        <thead>
                          <tr style={{ background: '#f7fafc' }}>
                            <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#2c3e50' }}>Nome</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#2c3e50' }}>Nome salvo</th>
                            <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#2c3e50' }}>Tamanho</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#2c3e50' }}>Tipo</th>
                            <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#2c3e50' }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pdfList.map(p => (
                            <tr key={p.id || p.url} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '12px 16px', fontSize: 13, color: '#334155', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.originalName || p.storedName || (p.url ? decodeURIComponent(p.url.split('/').pop()) : '')}>{p.originalName || p.storedName || (p.url ? decodeURIComponent(p.url.split('/').pop()) : '')}</td>
                              <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{p.storedName || ''}</td>
                              <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b', textAlign: 'right' }}>{p.size ? `${Math.round(p.size/1024)} KB` : '-'}</td>
                              <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{p.contentType || '-'}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                                  <button type="button" onClick={() => handleViewUpload(p)} className="btn btn-sm btn-outline" style={{ padding: '6px 8px' }}>Exibir</button>
                                  <button type="button" onClick={() => handleDeleteUpload(p.id)} disabled={deletingUploadId === p.id} className="btn btn-sm btn-danger" style={{ padding: '6px 8px' }}>{deletingUploadId === p.id ? 'Excluindo…' : 'Excluir'}</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  pdfInfo?.storedName && (
                    <span style={{ fontSize: 13, color: '#2c3e50' }}>
                      Arquivo salvo como: <strong>{pdfInfo.originalName || pdfInfo.storedName || (pdfInfo.url ? pdfInfo.url.split('/').pop() : '')}</strong>
                      {pdfInfo.url && (
                        <a href={pdfInfo.url} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>abrir</a>
                      )}
                    </span>
                  )
                )}
              </div>
              <small style={{ color: '#777' }}>O arquivo será renomeado como AVERBACAO-XXX-{getMesReferencia()}.PDF automaticamente.</small>
            </div>

            {/* Passo 2: Dados principais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="servico-label">Data</label>
                <input className="servico-input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="servico-label">Tipo de Averbação</label>
                <select className="servico-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="">Selecione...</option>
                  <option value="Divórcio">Divórcio</option>
                  <option value="Reconhecimento de Paternidade">Reconhecimento de Paternidade</option>
                  <option value="Adoção Unilateral">Adoção Unilateral</option>
                  <option value="Outras">Outras</option>
                </select>
              </div>
              {form.tipo === 'Outras' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="servico-label">Informar Tipo</label>
                  <input className="servico-input" type="text" value={form.tipoOutro} onChange={e => setForm(f => ({ ...f, tipoOutro: e.target.value }))} placeholder="Descreva o tipo de averbação" />
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

            {/* Selo de Fiscalização - disponível após salvar (modo edição) */}
            {isEdicao ? (
              <div style={{ marginTop: 16 }}>
                <h3 className="servico-title" style={{ margin: '0 0 8px 0', fontSize: 16 }}>Selo de Fiscalização</h3>
                {/* Campos manuais (opcional) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="servico-label">Selo (consulta)</label>
                    <input className="servico-input" type="text" value={form.selo_consulta} onChange={e => setForm(f => ({ ...f, selo_consulta: e.target.value }))} placeholder="Selo de consulta" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="servico-label">Código de Segurança</label>
                    <input className="servico-input" type="text" value={form.codigo_seguranca} onChange={e => setForm(f => ({ ...f, codigo_seguranca: e.target.value }))} placeholder="Código de segurança" />
                  </div>
                </div>
                {/* Mesma UX de importação usada no componente de execução */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, margin: '8px 0' }}>
                  <ClipboardImageUploadAverbacao
                    averbacaoId={id}
                    onUpload={async () => {
                      try {
                        const existentes = await listarSelosAverbacao(id).catch(() => []);
                        if (Array.isArray(existentes) && existentes.length > 0) {
                          const s = existentes[0];
                          setForm(f => ({
                            ...f,
                            selo_consulta: s.selo_consulta || s.seloConsulta || f.selo_consulta,
                            codigo_seguranca: s.codigo_seguranca || s.codigoSeguranca || f.codigo_seguranca,
                          }));
                        }
                      } catch {}
                    }}
                  />
                  <SeloFileUploadAverbacao
                    averbacaoId={id}
                    onUpload={async () => {
                      try {
                        const existentes = await listarSelosAverbacao(id).catch(() => []);
                        if (Array.isArray(existentes) && existentes.length > 0) {
                          const s = existentes[0];
                          setForm(f => ({
                            ...f,
                            selo_consulta: s.selo_consulta || s.seloConsulta || f.selo_consulta,
                            codigo_seguranca: s.codigo_seguranca || s.codigoSeguranca || f.codigo_seguranca,
                          }));
                        }
                      } catch {}
                    }}
                  />
                </div>
              </div>
            ) : (
              <small style={{ color: '#777', display: 'block', marginTop: 12 }}>
                Para adicionar o selo eletrônico, salve a averbação primeiro.
              </small>
            )}

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
      />

      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />
    </div>
  );
}

