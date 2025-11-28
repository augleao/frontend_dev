/* eslint-disable no-console */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiURL } from '../../config';
import { useNavigate } from 'react-router-dom';
import { listDaps, getDapById, deleteDap, uploadDap } from '../../services/dapService';
import DapTable from '../dap/DapTable';
import DapDetailsDrawer from '../dap/DapDetailsDrawer';
import { identificarTipo, analisarExigencia, gerarTextoAverbacao } from '../servicos/IAWorkflowService';
import ModalTerminalIA from './ModalTerminalIA';

const currentYear = new Date().getFullYear();

function AnaliseDAP() {
  const navigate = useNavigate();
  const [filtros, setFiltros] = useState({
    ano: currentYear,
    mes: 'todos',
    tipo: 'todos',
    status: 'todos',
  });
  const [daps, setDaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);
  const [selectedDap, setSelectedDap] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [, setFeedback] = useState({ tipo: '', mensagem: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndexador] = useState('DAP_impacto_financeiro');
  const selectedDaps = useMemo(() => (Array.isArray(daps) && Array.isArray(selectedIds) ? daps.filter((x) => selectedIds.includes(x.id)) : []), [daps, selectedIds]);

  useEffect(() => {
    carregarDaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.ano, filtros.mes, filtros.tipo, filtros.status]);

  const carregarDaps = async () => {
    setLoading(true);
    try {
      const apiFilters = { ...filtros };
      if (apiFilters.tipo === 'RETIFICADORA') {
        apiFilters.retificadora = true;
        delete apiFilters.tipo;
      } else if (apiFilters.tipo === 'ORIGINAL') {
        apiFilters.retificadora = false;
        delete apiFilters.tipo;
      }

      const resposta = await listDaps(apiFilters);
      // eslint-disable-next-line no-console
      console.debug('DAPs normalizadas', resposta);

      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      const token = localStorage.getItem('token');
      let userServentiaAbreviada = '';
      try {
        let serv = null;
        const serventiaId = usuario?.serventiaId || usuario?.serventia_id || usuario?.serventiaId || usuario?.serventia_id_serventia || null;
        if (serventiaId) {
          const res = await fetch(`${apiURL}/serventias/${encodeURIComponent(serventiaId)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const text = await res.text();
            const parsed = text ? JSON.parse(text) : {};
            serv = parsed?.serventia || parsed || null;
          }
        }
        if ((!serv || Object.keys(serv || {}).length === 0) && usuario?.serventia) {
          const res2 = await fetch(`${apiURL}/configuracoes-serventia?serventia=${encodeURIComponent(usuario.serventia)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res2.ok) {
            const text = await res2.text();
            const parsed = text ? JSON.parse(text) : {};
            serv = parsed?.serventia || parsed || serv;
          }
        }
        if (serv) {
          userServentiaAbreviada = serv.nome_abreviado || serv.nomeAbreviado || serv.nome_abrev || serv.nome || usuario?.serventia || '';
        } else {
          userServentiaAbreviada = usuario?.serventia || usuario?.nome_abreviado || usuario?.nomeAbreviado || '';
        }
      } catch (e) {
        userServentiaAbreviada = usuario?.serventia || usuario?.nome_abreviado || usuario?.nome || '';
      }

      const getServentiaDisplay = (dap) => (
        dap?.serventia_nome
        ?? dap?.serventiaNome
        ?? dap?.serventia
        ?? dap?.nome_serventia
        ?? dap?.nomeServentia
        ?? ''
      );

      const getFinalToken = (s) => {
        if (!s || typeof s !== 'string') return '';
        const parts = s.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return '';
        return parts[parts.length - 1].replace(/[^\p{L}\p{N}_-]+/gu, '');
      };

      let items = resposta.items || [];
      if (userServentiaAbreviada) {
        const userLower = String(userServentiaAbreviada).toLowerCase();
        const filtered = items.filter((dap) => {
          const servDisplay = String(getServentiaDisplay(dap) || '').trim();
          const finalToken = String(getFinalToken(servDisplay) || '').toLowerCase();
          const match = finalToken && userLower.includes(finalToken);
          // eslint-disable-next-line no-console
          console.debug('[Filtro DAP] usuário serventia_abreviada:', userServentiaAbreviada, '| serventia DAP:', servDisplay, '| token:', finalToken, '| match:', match);
          return match;
        });
        // eslint-disable-next-line no-console
        console.debug('[Filtro DAP] DAPs finais exibidas:', filtered);
        items = filtered;
      } else {
        // eslint-disable-next-line no-console
        console.warn('[Filtro DAP] usuário sem serventia abreviada definida; exibindo todas as DAPs temporariamente');
      }

      const parseYearMonth = (dap) => {
        const anoCandidates = [dap?.ano_referencia, dap?.ano, dap?.ano_ref, dap?.anoReferencia, dap?.ano_referente];
        const mesCandidates = [dap?.mes_referencia, dap?.mes, dap?.mes_ref, dap?.mesReferencia, dap?.mes_referente];
        const anoVal = Number(anoCandidates.find((v) => v !== undefined && v !== null && v !== '') ?? 0) || 0;
        const mesVal = Number(mesCandidates.find((v) => v !== undefined && v !== null && v !== '') ?? 0) || 0;
        return { ano: anoVal, mes: mesVal };
      };

      items.sort((a, b) => {
        const A = parseYearMonth(a);
        const B = parseYearMonth(b);
        if (A.ano !== B.ano) return B.ano - A.ano;
        return B.mes - A.mes;
      });

      setDaps(items);
    } catch (error) {
      const mensagem = error?.response?.data?.mensagem || 'Não foi possível carregar as DAPs.';
      // eslint-disable-next-line no-console
      console.error('Erro ao carregar DAPs', error);
      setFeedback({ tipo: 'erro', mensagem });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadConcluido = () => {
    setFeedback({ tipo: 'sucesso', mensagem: 'DAP processada com sucesso.' });
    carregarDaps();
  };

  const handleSelecionarDap = async (dap) => {
    if (!dap?.id) return;
    setSelectedDap(null);
    setLoadingDetalhe(true);
    try {
      const detalhe = await getDapById(dap.id);
      setSelectedDap(detalhe);
      // eslint-disable-next-line no-console
      console.debug('Detalhe DAP', detalhe);
    } catch (error) {
      const mensagem = error?.response?.data?.mensagem || 'Não foi possível carregar os detalhes da DAP.';
      // eslint-disable-next-line no-console
      console.error('Erro detalhe DAP', error);
      setFeedback({ tipo: 'erro', mensagem });
    } finally {
      setLoadingDetalhe(false);
    }
  };

  const handleToggleSelect = (dap) => {
    if (!dap || !dap.id) return;
    setSelectedIds((prev) => {
      const has = prev.includes(dap.id);
      if (has) return prev.filter((id) => id !== dap.id);
      return [...prev, dap.id];
    });
  };

  const runAnalyses = async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    setFeedback({ tipo: '', mensagem: '' });
    try {
      setLoading(true);
      for (const id of ids) {
        try {
          const detail = await getDapById(id);
          const periodos = detail.periodos ?? detail.dap_periodos ?? [];
          let combinedText = '';
          periodos.forEach((p, idx) => {
            const atos = p.atos ?? p.dap_atos ?? [];
            combinedText += `----- PERIODO ${idx + 1} -----\n`;
            atos.forEach((a) => {
              combinedText += `ATO ${a.codigo ?? a.codigo_ato ?? a.ato_codigo} | Qtd: ${(a.quantidade ?? a.qtde ?? a.qtd) || 0} | Emol: ${(a.emolumentos ?? a.emol) || 0}\n`;
            });
          });

          let tipoIdent = null;
          try {
            const tipoResp = await identificarTipo(combinedText);
            tipoIdent = tipoResp.tipo || null;
          } catch (e) {
            // non-fatal
          }

          let analiseResp = null;
          try {
            analiseResp = await analisarExigencia({ text: combinedText, legislacao: [], tipo: tipoIdent });
          } catch (e) {
            analiseResp = { error: e.message || 'Erro na análise' };
          }

          let textoGerado = null;
          try {
            const gen = await gerarTextoAverbacao({ text: combinedText, legislacao: [], tipo: tipoIdent });
            textoGerado = gen.textoAverbacao || gen.texto || null;
          } catch (e) {
            // ignore
          }

          setFeedback({ tipo: 'sucesso', mensagem: `Análise concluída para DAP ${id}.` });
          // eslint-disable-next-line no-console
          console.debug('[AnaliseDAP] resultado', { id, tipoIdent, analiseResp, textoGerado });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Falha ao analisar DAP', id, err);
          setFeedback({ tipo: 'erro', mensagem: `Falha ao analisar DAP ${id}: ${err?.message || err}` });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRunWithPrompt = async ({ indexador, prompt, items, pushConsole }) => {
    // Minimal starter: display prompt and run existing analyses for items (ids)
    try {
      if (pushConsole) pushConsole(`[title]Usando prompt: ${indexador}[/title]`);
      if (pushConsole && prompt) pushConsole(prompt);
      const idsToRun = Array.isArray(items) && items.length > 0 ? items.map((d) => d.id).filter(Boolean) : selectedIds;
      if (!Array.isArray(idsToRun) || idsToRun.length === 0) {
        if (pushConsole) pushConsole('[warning]Nenhuma DAP selecionada para análise.[/warning]');
        return;
      }
      if (pushConsole) pushConsole(`[info]Iniciando análises para ${idsToRun.length} DAP(s)...[/info]`);
      await runAnalyses(idsToRun);
      if (pushConsole) pushConsole('[success]Análises finalizadas (fluxo padrão).[/success]');
    } catch (e) {
      if (pushConsole) pushConsole(`[error]Erro ao executar análises: ${e?.message || e}[/error]`);
      throw e;
    }
  };

  const handleExcluir = async (dap) => {
    if (!dap?.id) return;
    const confirmado = window.confirm('Confirma a exclusão (soft delete) desta DAP?');
    if (!confirmado) return;

    try {
      await deleteDap(dap.id);
      setFeedback({ tipo: 'sucesso', mensagem: 'DAP marcada como excluída.' });
      if (selectedDap?.id === dap.id) {
        setSelectedDap(null);
      }
      carregarDaps();
    } catch (error) {
      const mensagem = error?.response?.data?.mensagem || 'Falha ao excluir a DAP.';
      setFeedback({ tipo: 'erro', mensagem });
    }
  };

  const anosDisponiveis = useMemo(() => {
    const anos = new Set([currentYear]);
    daps.forEach((dap) => {
      if (dap.ano) anos.add(dap.ano);
    });
    return Array.from(anos).sort((a, b) => b - a);
  }, [daps]);

  return (
    <div style={pageWrapperStyle}>
      <header style={headerStyle}>
        <button type="button" onClick={() => navigate(-1)} style={backButtonStyle}>
          ← Voltar
        </button>
        <div>
            <h1 style={titleStyle}>Análise das DAPs</h1>
            <p style={subtitleStyle}>Utilize ferramentas de IA para analisar o desempenho da serventia.</p>
          </div>
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={() => {
            if (fileInputRef.current) fileInputRef.current.click();
          }}
          disabled={uploadingFile}
        >
          {uploadingFile ? 'Enviando...' : '+ Nova DAP'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={async (event) => {
            const f = event.target.files?.[0] ?? null;
            event.target.value = '';
            if (!f) return;

            setUploadingFile(true);
            setFeedback({ tipo: '', mensagem: '' });
            try {
              await uploadDap({ file: f, metadata: {} });
              setFeedback({ tipo: 'sucesso', mensagem: 'DAP enviada com sucesso.' });
              carregarDaps();
            } catch (err) {
              const mensagem = err?.response?.data?.mensagem || err?.message || 'Erro ao enviar a DAP.';
              setFeedback({ tipo: 'erro', mensagem });
            } finally {
              setUploadingFile(false);
            }
          }}
        />
      </header>

      <section style={filtersSectionStyle}>
        <FilterItem label="Ano">
          <select
            value={filtros.ano}
            onChange={(event) => setFiltros((prev) => ({ ...prev, ano: Number(event.target.value) }))}
            style={selectStyle}
          >
            {anosDisponiveis.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
        </FilterItem>
        <FilterItem label="Mês">
          <select
            value={filtros.mes}
            onChange={(event) => setFiltros((prev) => ({ ...prev, mes: event.target.value }))}
            style={selectStyle}
          >
            <option value="todos">Todos</option>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((mes) => (
              <option key={mes} value={mes}>
                {String(mes).padStart(2, '0')}
              </option>
            ))}
          </select>
        </FilterItem>
        <FilterItem label="Tipo">
          <select
            value={filtros.tipo}
            onChange={(event) => setFiltros((prev) => ({ ...prev, tipo: event.target.value }))}
            style={selectStyle}
          >
            <option value="todos">Todos</option>
            <option value="ORIGINAL">Original</option>
            <option value="RETIFICADORA">Retificadora</option>
          </select>
        </FilterItem>
        <FilterItem label="Status">
          <select
            value={filtros.status}
            onChange={(event) => setFiltros((prev) => ({ ...prev, status: event.target.value }))}
            style={selectStyle}
          >
            <option value="todos">Todos</option>
            <option value="ATIVA">Ativa</option>
            <option value="RETIFICADA">Retificada</option>
            <option value="EXCLUIDA">Excluída</option>
          </select>
        </FilterItem>
        <button type="button" onClick={carregarDaps} style={refreshButtonStyle}>
          Atualizar
        </button>
      </section>

      {/* IA buttons container */}
      <div style={iaButtonsContainerStyle}>
        <button
          type="button"
          onClick={() => {
            if (!selectedIds || selectedIds.length === 0) {
              alert('Selecione ao menos uma DAP antes de executar esta ação.');
              return;
            }
            setModalOpen(true);
          }}
          style={iaButtonStyle}
        >
          Impactos Financeiros
        </button>
      </div>

      <DapTable
        items={daps}
        loading={loading}
        onSelect={handleSelecionarDap}
        showSelection={true}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onDelete={handleExcluir}
      />

      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={() => runAnalyses(selectedIds)}
          disabled={selectedIds.length === 0 || loading}
          style={{ padding: '10px 16px', borderRadius: 8, background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Analisar selecionadas ({selectedIds.length})
        </button>
        <button
          type="button"
          onClick={() => selectedDap?.id && runAnalyses([selectedDap.id])}
          disabled={!selectedDap?.id || loading}
          style={{ padding: '10px 16px', borderRadius: 8, background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Analisar DAP aberta
        </button>
      </div>

      <ModalTerminalIA
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        indexador={modalIndexador}
        items={selectedDaps}
        onRun={handleRunWithPrompt}
      />

      <DapDetailsDrawer
        dap={selectedDap}
        onClose={() => setSelectedDap(null)}
        loading={loadingDetalhe}
      />
    </div>
  );
}

function FilterItem({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={filterLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

const pageWrapperStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
  padding: '32px 24px',
  fontFamily: 'Arial, sans-serif',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
  gap: '16px',
};

const backButtonStyle = {
  background: 'rgba(15, 23, 42, 0.45)',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  color: 'white',
  borderRadius: '999px',
  padding: '8px 14px',
  cursor: 'pointer',
  fontWeight: 600,
};

const titleStyle = {
  color: 'white',
  fontSize: '24px',
  margin: 0,
  letterSpacing: '0.4px',
};

const subtitleStyle = {
  color: 'rgba(255, 255, 255, 0.85)',
  margin: '4px 0 0 0',
  fontSize: '13px',
};

const primaryButtonStyle = {
  background: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
  color: '#0f172a',
  border: 'none',
  borderRadius: '999px',
  padding: '10px 20px',
  fontWeight: 700,
  fontSize: '13px',
  cursor: 'pointer',
  boxShadow: '0 12px 30px rgba(59, 130, 246, 0.35)',
};

const filtersSectionStyle = {
  display: 'flex',
  gap: '12px',
  background: 'rgba(15, 23, 42, 0.25)',
  borderRadius: '16px',
  padding: '12px',
  alignItems: 'flex-end',
  flexWrap: 'wrap',
  marginBottom: '16px',
};

const filterLabelStyle = {
  fontSize: '10px',
  color: 'rgba(226, 232, 240, 0.85)',
  letterSpacing: '0.4px',
  textTransform: 'uppercase',
  fontWeight: 700,
};

const selectStyle = {
  minWidth: '120px',
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  fontSize: '13px',
  background: 'rgba(15, 23, 42, 0.9)',
  color: 'white',
};

const refreshButtonStyle = {
  background: 'rgba(148, 163, 184, 0.2)',
  border: '1px solid rgba(203, 213, 225, 0.4)',
  color: 'white',
  borderRadius: '10px',
  padding: '8px 12px',
  cursor: 'pointer',
  fontWeight: 600,
};

const iaButtonsContainerStyle = {
  display: 'flex',
  gap: 10,
  marginTop: 8,
  marginBottom: 12,
  alignItems: 'center'
};

const iaButtonStyle = {
  padding: '8px 12px',
  borderRadius: 8,
  background: 'linear-gradient(135deg,#f97316,#fb923c)',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 700
};

const feedbackStyle = (tipo) => ({
  marginBottom: '20px',
  padding: '14px 18px',
  borderRadius: '12px',
  background: tipo === 'erro' ? 'rgba(254, 226, 226, 0.9)' : 'rgba(187, 247, 208, 0.85)',
  color: tipo === 'erro' ? '#b91c1c' : '#166534',
  fontWeight: 600,
});

export default AnaliseDAP;
