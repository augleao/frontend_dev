import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listDaps, getDapById, deleteDap, uploadDap } from './services/dapService';
import DapTable from './components/dap/DapTable';
import DapDetailsDrawer from './components/dap/DapDetailsDrawer';

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
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [feedback, setFeedback] = useState({ tipo: '', mensagem: '' });

  useEffect(() => {
    carregarDaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.ano, filtros.mes, filtros.tipo, filtros.status]);

  const carregarDaps = async () => {
    setLoading(true);
    try {
      // Pega codigoServentia do usuario logado (localStorage)
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      const codigoServentia = usuario.codigo_serventia || usuario.codigoServentia || usuario.serventia_id || usuario.serventiaId || usuario.serventia;
      const filtrosComServentia = { ...filtros };
      if (codigoServentia) {
        filtrosComServentia.codigoServentia = codigoServentia;
      }
      const resposta = await listDaps(filtrosComServentia);
      // eslint-disable-next-line no-console
      console.debug('DAPs normalizadas', resposta);
      setDaps(resposta.items);
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
          <h1 style={titleStyle}>Análise da DAP</h1>
          <p style={subtitleStyle}>Gerencie as declarações mensais de atos praticados, incluindo retificadoras.</p>
        </div>
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={() => {
            // open native file picker
            if (fileInputRef.current) fileInputRef.current.click();
          }}
          disabled={uploadingFile}
        >
          {uploadingFile ? 'Enviando...' : '+ Nova DAP'}
        </button>
        {/* hidden file input triggered by the button above */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={async (event) => {
            const f = event.target.files?.[0] ?? null;
            // clear the input so same file can be selected again later
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

      {/* feedback messages removed from UI per request */}

      <DapTable
        items={daps}
        loading={loading}
        onSelect={handleSelecionarDap}
        onDelete={handleExcluir}
      />

      {/* Modal removed from the primary flow (direct upload). If you need the modal elsewhere,
          re-add it and control `isOpen` accordingly. */}

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={filterLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

const pageWrapperStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
  padding: '48px 32px',
  fontFamily: 'Arial, sans-serif',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '32px',
  gap: '24px',
};

const backButtonStyle = {
  background: 'rgba(15, 23, 42, 0.45)',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  color: 'white',
  borderRadius: '999px',
  padding: '10px 20px',
  cursor: 'pointer',
  fontWeight: 600,
};

const titleStyle = {
  color: 'white',
  fontSize: '32px',
  margin: 0,
  letterSpacing: '0.4px',
};

const subtitleStyle = {
  color: 'rgba(255, 255, 255, 0.85)',
  margin: '8px 0 0 0',
};

const primaryButtonStyle = {
  background: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
  color: '#0f172a',
  border: 'none',
  borderRadius: '999px',
  padding: '14px 28px',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
  boxShadow: '0 18px 40px rgba(59, 130, 246, 0.45)',
};

const filtersSectionStyle = {
  display: 'flex',
  gap: '16px',
  background: 'rgba(15, 23, 42, 0.25)',
  borderRadius: '20px',
  padding: '20px',
  alignItems: 'flex-end',
  flexWrap: 'wrap',
  marginBottom: '24px',
};

const filterLabelStyle = {
  fontSize: '11px',
  color: 'rgba(226, 232, 240, 0.85)',
  letterSpacing: '0.4px',
  textTransform: 'uppercase',
  fontWeight: 600,
};

const selectStyle = {
  minWidth: '140px',
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  fontSize: '14px',
  background: 'rgba(15, 23, 42, 0.9)',
  color: 'white',
};

const refreshButtonStyle = {
  background: 'rgba(148, 163, 184, 0.2)',
  border: '1px solid rgba(203, 213, 225, 0.4)',
  color: 'white',
  borderRadius: '12px',
  padding: '12px 20px',
  cursor: 'pointer',
  fontWeight: 600,
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
