import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ServicoEntrada from './ServicoEntrada';
import ServicoCliente from './ServicoCliente';
import ServicoPagamento from './ServicoPagamento';
import ServicoConferencia from './ServicoConferencia';
import ServicoExecucao from './ServicoExecucao';
import ServicoEntrega from './ServicoEntrega';
import ServicoLista from './ServicoLista';
import config from '../../config';
import { fetchComAuth } from '../../utils';

const clientesMock = [
  { id: 1, nome: 'Joao Silva', cpf: '123.456.789-00', endereco: 'Rua A, 123', telefone: '99999-9999', email: 'joao@email.com' },
  { id: 2, nome: 'Maria Souza', cpf: '987.654.321-00', endereco: 'Rua B, 456', telefone: '88888-8888', email: 'maria@email.com' }
];
const tiposServico = [
  'Certidao de Nascimento',
  'Certidao de Casamento',
  'Reconhecimento de Firma',
  'Autenticacao de Documento'
];
const statusExecucao = [
  { value: 'em_andamento', label: 'Em andamento', color: '#3498db' },
  { value: 'aguardando', label: 'Aguardando documentos', color: '#f39c12' },
  { value: 'concluido', label: 'Concluido', color: '#27ae60' },
  { value: 'cancelado', label: 'Cancelado', color: '#e74c3c' }
];
const statusPagamento = [
  { value: 'pendente', label: 'Pendente', color: '#f39c12' },
  { value: 'parcial', label: 'Parcial', color: '#3498db' },
  { value: 'pago', label: 'Pago', color: '#27ae60' }
];
function gerarProtocolo() {
  return 'PRT-' + Date.now().toString().slice(-6);
}

export default function ServicoManutencao() {
  const [servicos, setServicos] = useState([]);
  useEffect(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (usuario && usuario.serventiaId) {
      setForm(f => {
        if (!f.serventiaId && !f.serventia_id && !f.serventia) {
          return { ...f, serventiaId: usuario.serventiaId };
        }
        return f;
      });
    }
  }, []);
  const [clientes, setClientes] = useState(clientesMock);
  const [combosDisponiveis, setCombosDisponiveis] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [atosPedido, setAtosPedido] = useState([]);
  const [historicoStatus, setHistoricoStatus] = useState([]);
  const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || '{}');
  const [form, setForm] = useState({
    protocolo: '',
    tipo: '',
    descricao: '',
    prazo: '',
    clienteId: null,
    novoCliente: false,
    cliente: { nome: '', cpf: '', endereco: '', telefone: '', email: '' },
    pagamento: { status: 'pendente', valorTotal: '', valorPago: '', data: '', forma: '' },
    execucao: { status: 'em_andamento', observacoes: '', responsavel: '' },
    entrega: { data: '', hora: '', retiradoPor: '', documentoRetirada: '', assinaturaDigital: false },
    ...(usuarioLocal && usuarioLocal.serventiaId ? { serventiaId: usuarioLocal.serventiaId } : {})
  });
  const [pedidoCarregado, setPedidoCarregado] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  function getProtocoloFromQuery() {
    const params = new URLSearchParams(location.search);
    return params.get('protocolo');
  }

  function deepEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  const buscarHistoricoStatus = async (protocolo) => {
    if (!protocolo) return;
    try {
      const response = await fetchComAuth(`${config.apiURL}/pedidoshistoricostatus/${encodeURIComponent(protocolo)}/historico-status`);
      if (response && response.ok) {
        const data = await response.json();
        if (Array.isArray(data.historico)) {
        }
        setHistoricoStatus(data.historico || []);
      } else {
        setHistoricoStatus([
          {
            status: form.status || 'Em Analise',
            data_alteracao: new Date().toISOString(),
            responsavel: 'Sistema',
            observacoes: 'Status atual do pedido'
          }
        ]);
      }
    } catch (error) {
      setHistoricoStatus([
        {
          status: form.status || 'Em Analise',
          data_alteracao: new Date().toISOString(),
          responsavel: 'Sistema',
          observacoes: 'Status atual do pedido'
        }
      ]);
    }
  };

  useEffect(() => {
    const protocolo = getProtocoloFromQuery();
    if (!protocolo) {
      if (pedidoCarregado) {
        setPedidoCarregado(false);
        setForm(prev => ({ ...prev, protocolo: '' }));
        setAtosPedido([]);
      }
      return;
    }
    if (form.protocolo === protocolo && pedidoCarregado) {
      return;
    }

    const token = localStorage.getItem('token');
    fetchComAuth(`${config.apiURL}/pedidos/${encodeURIComponent(protocolo)}`)
      .then(res => res && res.json())
      .then(data => {
        if (data.pedido) {
          let prazoFormatado = '';
          if (data.pedido.prazo) {
            const d = new Date(data.pedido.prazo);
            prazoFormatado = d.toISOString().slice(0, 10);
          }
          const valorAdiantadoDetalhes =
            data.pedido.valorAdiantadoDetalhes ||
            data.pedido.valor_adiantado_detalhes ||
            [{ valor: '', forma: '' }];
          setForm(f => ({
            ...f,
            ...data.pedido,
            prazo: prazoFormatado,
            valorAdiantado: data.pedido.valor_adiantado || 0,
            valorAdiantadoDetalhes,
            observacao: data.pedido.observacao ?? '',
            clienteId: data.pedido.cliente?.id || null,
            novoCliente: false,
            cliente: { ...f.cliente, ...data.pedido.cliente },
            pagamento: { ...f.pagamento, ...data.pedido.pagamento },
            execucao: {
              ...(data.pedido.execucao || {}),
              ...f.execucao,
              status: (data.pedido.execucao && data.pedido.execucao.status) || (f.execucao && f.execucao.status) || 'em_andamento',
              observacoes: (data.pedido.execucao && data.pedido.execucao.observacoes) || (f.execucao && f.execucao.observacoes) || '',
              responsavel: (data.pedido.execucao && data.pedido.execucao.responsavel) || (f.execucao && f.execucao.responsavel) || ''
            },
            entrega: {
              ...f.entrega,
              ...data.pedido.entrega,
              ...(data.pedido.entrega?.retirado_por ? { retiradoPor: data.pedido.entrega.retirado_por } : {})
            },
            serventiaId: (
              data.pedido.serventiaId ||
              data.pedido.serventia_id ||
              (typeof data.pedido.serventia === 'object' && data.pedido.serventia?.id) ||
              data.pedido.serventia ||
              null
            )
          }));

          if (data.pedido && data.pedido.protocolo) {
            fetchComAuth(`${config.apiURL}/conferencias?protocolo=${encodeURIComponent(data.pedido.protocolo)}`)
              .then(confRes => {
                if (!confRes || !confRes.ok) return null;
                return confRes.json();
              })
              .then(confData => {
                if (confData && Array.isArray(confData.conferencias) && confData.conferencias.length > 0) {
                  setForm(f => ({
                    ...f,
                    conferencia: confData.conferencias[confData.conferencias.length - 1]
                  }));
                } else {
                  setForm(f => ({ ...f, conferencia: undefined }));
                }
              });

            fetchComAuth(`${config.apiURL}/pedido_pagamento/${encodeURIComponent(data.pedido.protocolo)}`)
              .then(pagRes => {
                if (!pagRes || !pagRes.ok) return null;
                return pagRes.json();
              })
              .then(pagData => {
                if (pagData && (pagData.id || pagData.status || pagData.valorPago || pagData.valorTotal)) {
                  setForm(f => ({
                    ...f,
                    pagamento: {
                      ...f.pagamento,
                      ...pagData
                    }
                  }));
                }
              });

            fetchComAuth(`${config.apiURL}/execucao-servico/${encodeURIComponent(data.pedido.protocolo)}`)
              .then(execRes => {
                if (!execRes || !execRes.ok) return null;
                return execRes.json();
              })
              .then(execData => {
                if (execData && (execData.id || execData.status)) {
                  setForm(f => ({
                    ...f,
                    execucao: {
                      ...execData,
                      status: execData.status || (f.execucao && f.execucao.status) || 'em_andamento',
                      observacoes: execData.observacoes || (f.execucao && f.execucao.observacoes) || '',
                      responsavel: execData.responsavel || execData.usuario || (f.execucao && f.execucao.responsavel) || ''
                    }
                  }));
                }
              });

            fetchComAuth(`${config.apiURL}/entrega-servico/${encodeURIComponent(data.pedido.protocolo)}`)
              .then(entregaRes => {
                if (!entregaRes || !entregaRes.ok) return null;
                return entregaRes.json();
              })
              .then(entregaData => {
                if (entregaData && (entregaData.id || entregaData.data || entregaData.hora)) {
                  setForm(f => ({
                    ...f,
                    entrega: {
                      ...f.entrega,
                      ...entregaData,
                      retiradoPor: entregaData.retiradoPor || entregaData.retirado_por || f.entrega.retiradoPor || ''
                    }
                  }));
                }
              });
          }
          const combosFormatados = Array.isArray(data.pedido.combos)
            ? data.pedido.combos.map(combo => ({
                comboId: combo.combo_id,
                comboNome: combo.combo_nome,
                atoId: combo.ato_id,
                atoCodigo: combo.ato_codigo,
                atoDescricao: combo.ato_descricao,
                quantidade: combo.quantidade || 1,
                codigoTributario: combo.codigo_tributario || '',
                valor_final: combo.valor_final
              }))
            : [];
          setAtosPedido(combosFormatados);
          setPedidoCarregado(true);
          buscarHistoricoStatus(protocolo);
        }
      })
      .catch(err => {
        setPedidoCarregado(true);
      });
  }, [location.search, form.protocolo]);

  useEffect(() => {
    async function fetchCombos() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetchComAuth(`${config.apiURL}/combos`);
        const data = await res.json();
        if (res.ok) {
          setCombosDisponiveis(data.combos || []);
        } else {
          setCombosDisponiveis([]);
        }
      } catch (error) {
        setCombosDisponiveis([]);
      }
    }
    fetchCombos();
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);
  function handleClienteChange(field, value) {
    setForm(f => ({
      ...f,
      cliente: { ...f.cliente, [field]: value }
    }));
  }
  function handlePagamentoChange(field, value) {
    setForm(f => ({
      ...f,
      pagamento: { ...f.pagamento, [field]: value }
    }));
  }
  function handleExecucaoChange(field, value) {
    if (field === 'execucao' && value && typeof value === 'object') {
      setForm(f => ({
        ...f,
        execucao: { ...value }
      }));
    } else {
      setForm(f => ({
        ...f,
        execucao: { ...f.execucao, [field]: value }
      }));
    }
  }
  function handleEntregaChange(field, value) {
    if (field === 'entrega' && value && typeof value === 'object') {
      setForm(f => ({
        ...f,
        entrega: { ...value }
      }));
    } else {
      setForm(f => ({
        ...f,
        entrega: { ...f.entrega, [field]: value }
      }));
    }
  }
  function handleConferenciaChange(field, value) {
    setForm(f => ({
      ...f,
      conferencia: { ...f.conferencia, [field]: value }
    }));
  }

  const excluirPedido = async () => {
    if (!form.protocolo) {
      return;
    }
    const confirmacao = window.confirm(`Tem certeza que deseja excluir o pedido ${form.protocolo}? Esta acao nao pode ser desfeita.`);
    if (!confirmacao) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(form.protocolo)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setForm({
          protocolo: '',
          tipo: '',
          descricao: '',
          prazo: '',
          clienteId: null,
          novoCliente: false,
          cliente: { nome: '', cpf: '', endereco: '', telefone: '', email: '' },
          pagamento: { status: 'pendente', valorTotal: '', valorPago: '', data: '', forma: '' },
          execucao: { status: 'em_andamento', observacoes: '', responsavel: '' },
          entrega: { data: '', hora: '', retiradoPor: '', documentoRetirada: '', assinaturaDigital: false }
        });
        setAtosPedido([]);
        setPedidoCarregado(false);
        navigate('/lista-servicos');
      } else {
        const errorText = await res.text();
      }
    } catch (error) {
    }
  };

  const calcularTotalAtosPagos = () => {
    const atosFiltrados = atosPedido.filter(ato => ato.codigoTributario === '01');
    const total = atosFiltrados.reduce((total, ato) => {
      const valor = parseFloat(ato.valor_final || 0);
      return total + (valor * (ato.quantidade || 1));
    }, 0);
    return total;
  };

  function registrarServico(e) {
    e.preventDefault();
    let clienteFinal;
    if (form.novoCliente) {
      clienteFinal = { ...form.cliente, id: clientes.length + 1 };
      setClientes([...clientes, clienteFinal]);
    } else {
      clienteFinal = clientes.find(c => c.id === Number(form.clienteId));
    }
    const novoServico = {
      ...form,
      cliente: clienteFinal
    };
    setServicos([...servicos, novoServico]);
    setForm({
      protocolo: gerarProtocolo(),
      tipo: '',
      descricao: '',
      prazo: '',
      clienteId: null,
      novoCliente: false,
      cliente: { nome: '', cpf: '', endereco: '', telefone: '', email: '' },
      pagamento: { status: 'pendente', valorTotal: '', valorPago: '', data: '', forma: '' },
      execucao: { status: 'em_andamento', observacoes: '', responsavel: '' },
      entrega: { data: '', hora: '', retiradoPor: '', documentoRetirada: '', assinaturaDigital: false }
    });
  }

  useEffect(() => {
    if (form.protocolo && form.status) {
      buscarHistoricoStatus(form.protocolo);
    }
  }, [form.status, form.protocolo]);

  const [aba, setAba] = useState('cliente');
  const stepDefs = [
    { key: 'cliente', label: 'Cliente', color: '#2563eb' },
    { key: 'entrada', label: 'Entrada', color: '#7c3aed' },
    { key: 'conferencia', label: 'Conferencia', color: '#f59e0b' },
    { key: 'pagamento', label: 'Pagamento', color: '#d97706' },
    { key: 'execucao', label: 'Execucao', color: '#0ea5e9' },
    { key: 'entrega', label: 'Entrega', color: '#16a34a' },
    { key: 'historico', label: 'Historico', color: '#6b7280' }
  ];
  const isStepFilled = (key) => {
    if (key === 'cliente') return !!(form.cliente && form.cliente.nome && form.cliente.cpf);
    if (key === 'entrada') return Array.isArray(atosPedido) && atosPedido.length > 0;
    if (key === 'conferencia') return !!(form.conferencia && typeof form.conferencia === 'object' && Object.values(form.conferencia).some(v => v && v !== ''));
    if (key === 'pagamento') {
      const p = form.pagamento;
      if (!p) return false;
      return (
        (p.status && p.status !== 'pendente') ||
        (p.valorPago && parseFloat(p.valorPago) > 0) ||
        (p.valorTotal && parseFloat(p.valorTotal) > 0) ||
        (p.data && p.data !== '') ||
        (p.forma && p.forma !== '')
      );
    }
    if (key === 'execucao') {
      const e = form.execucao;
      if (!e) return false;
      return !!(e.id || e.status === 'concluido' || e.status === 'concluido');
    }
    if (key === 'entrega') return !!(form.entrega && (form.entrega.data || form.entrega.retiradoPor || form.entrega.retirado_por));
    if (key === 'historico') return Array.isArray(historicoStatus) && historicoStatus.length > 0;
    return false;
  };
  const stepStates = [];
  let prevFilled = true;
  stepDefs.forEach((step, idx) => {
    const filled = isStepFilled(step.key);
    const locked = idx === 0 ? false : !prevFilled;
    stepStates.push({ ...step, filled, locked });
    prevFilled = filled;
  });
  const currentIdx = stepDefs.findIndex(s => s.key === aba);
  const goPrev = () => {
    if (currentIdx > 0) setAba(stepDefs[currentIdx - 1].key);
  };
  const goNext = () => {
    if (currentIdx < stepDefs.length - 1 && !stepStates[currentIdx + 1].locked) {
      setAba(stepDefs[currentIdx + 1].key);
    }
  };
  const renderResumo = () => {
    const cardBase = {
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      boxShadow: '0 2px 10px rgba(15,23,42,0.05)'
    };
    if (aba === 'cliente') {
      return (
        <div style={cardBase}>
          <strong style={{ color: '#2563eb' }}>Cliente</strong>
          <div>Nome: {form.cliente?.nome || ''}</div>
          <div>CPF/CNPJ: {form.cliente?.cpf || ''}</div>
          <div>Contato: {form.cliente?.telefone || ''}</div>
        </div>
      );
    }
    if (aba === 'entrada') {
      return (
        <div style={cardBase}>
          <strong style={{ color: '#7c3aed' }}>Entrada</strong>
          <div>Atos selecionados: {Array.isArray(atosPedido) ? atosPedido.length : 0}</div>
          <div>Total atos pagos: R$ {calcularTotalAtosPagos().toFixed(2)}</div>
        </div>
      );
    }
    if (aba === 'conferencia') {
      return (
        <div style={cardBase}>
          <strong style={{ color: '#f59e0b' }}>Conferencia</strong>
          <div>Status: {form.conferencia?.status || ''}</div>
          <div>Observacao: {form.conferencia?.observacao || ''}</div>
        </div>
      );
    }
    if (aba === 'pagamento') {
      const p = form.pagamento || {};
      return (
        <div style={cardBase}>
          <strong style={{ color: '#d97706' }}>Pagamento</strong>
          <div>Status: {p.status || 'pendente'}</div>
          <div>Valor total: R$ {(p.valorTotal || 0).toString()}</div>
          <div>Valor pago: R$ {(p.valorPago || 0).toString()}</div>
        </div>
      );
    }
    if (aba === 'execucao') {
      const e = form.execucao || {};
      return (
        <div style={cardBase}>
          <strong style={{ color: '#0ea5e9' }}>Execucao</strong>
          <div>Status: {e.status || ''}</div>
          <div>Responsavel: {e.responsavel || e.usuario || ''}</div>
        </div>
      );
    }
    if (aba === 'entrega') {
      const ent = form.entrega || {};
      return (
        <div style={cardBase}>
          <strong style={{ color: '#16a34a' }}>Entrega</strong>
          <div>Data: {ent.data || ''}</div>
          <div>Hora: {ent.hora || ''}</div>
          <div>Retirado por: {ent.retiradoPor || ent.retirado_por || ''}</div>
        </div>
      );
    }
    if (aba === 'historico') {
      return (
        <div style={cardBase}>
          <strong style={{ color: '#6b7280' }}>Historico</strong>
          <div>Eventos: {Array.isArray(historicoStatus) ? historicoStatus.length : 0}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '0 0 60px 0',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '98%',
        margin: '0 auto',
        padding: '12px 24px 0 24px'
      }}>
        <form
          onSubmit={registrarServico}
          style={{
            background: 'white',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(44,62,80,0.08)',
            padding: 24,
            marginBottom: 32
          }}
        >
          <div style={{ display: 'flex', gap: 24, alignItems: 'stretch' }}>
            <aside style={{
              width: 260,
              borderRight: '1px solid #e5e7eb',
              paddingRight: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{
                padding: '8px 10px',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                background: '#f9fafb'
              }}>
                <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>Protocolo</div>
                <div style={{ fontFamily: 'monospace', color: '#6b21a8' }}>{form.protocolo || 'Novo Pedido'}</div>
                {form.status && (
                  <div style={{ marginTop: 8, display: 'inline-block', padding: '4px 10px', borderRadius: 8, background: '#eef2ff', color: '#4338ca', fontWeight: 700 }}>
                    Status: {form.status}
                  </div>
                )}
              </div>
              {stepStates.map(step => {
                const isActive = aba === step.key;
                const canClick = !step.locked || isActive;
                return (
                  <button
                    key={step.key}
                    type="button"
                    disabled={!canClick}
                    onClick={() => canClick && setAba(step.key)}
                    style={{
                      textAlign: 'left',
                      border: '1px solid ' + (isActive ? step.color : '#e5e7eb'),
                      background: isActive ? step.color + '15' : '#fff',
                      color: step.locked ? '#9ca3af' : step.color,
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: canClick ? 'pointer' : 'not-allowed',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: step.filled ? step.color : '#e5e7eb',
                      border: '2px solid ' + (isActive ? step.color : '#e5e7eb')
                    }} />
                    {step.label}
                  </button>
                );
              })}
            </aside>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" onClick={goPrev} disabled={currentIdx === 0} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: currentIdx === 0 ? 'not-allowed' : 'pointer' }}>Voltar</button>
                  <button type="button" onClick={goNext} disabled={currentIdx === stepDefs.length - 1 || stepStates[currentIdx + 1]?.locked} style={{ border: '1px solid #e5e7eb', background: '#2563eb', color: 'white', borderRadius: 8, padding: '8px 14px', cursor: currentIdx === stepDefs.length - 1 || stepStates[currentIdx + 1]?.locked ? 'not-allowed' : 'pointer' }}>Salvar e continuar</button>
                  <button type="button" onClick={() => setAba('historico')} style={{ border: '1px solid #e5e7eb', background: '#f3f4f6', color: '#111827', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Ver historico</button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => navigate('/lista-servicos')} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Voltar para lista</button>
                  <button type="button" onClick={excluirPedido} style={{ border: '1px solid #fee2e2', background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Excluir pedido</button>
                </div>
              </div>

              {renderResumo()}

              {aba === 'cliente' && (
                <ServicoCliente
                  form={form}
                  clientes={clientes}
                  onChange={handleFormChange}
                  onClienteChange={handleClienteChange}
                  onAvancarEtapa={() => setAba('entrada')}
                />
              )}
              {aba === 'entrada' && (
                <ServicoEntrada
                  form={form}
                  tiposServico={tiposServico}
                  onChange={handleFormChange}
                  combosDisponiveis={combosDisponiveis}
                  atosPedido={atosPedido}
                  setAtosPedido={setAtosPedido}
                  onAvancarEtapa={() => setAba('conferencia')}
                />
              )}
              {aba === 'conferencia' && (
                <ServicoConferencia
                  protocolo={form.protocolo}
                  atosPedido={atosPedido}
                  disabled={false}
                  onAvancarEtapa={() => setAba('pagamento')}
                  onVoltarEtapa={() => setAba('entrada')}
                  onStatusChange={status => handleFormChange('status', status)}
                />
              )}
              {aba === 'pagamento' && (
                <ServicoPagamento
                  form={form}
                  onChange={handlePagamentoChange}
                  valorTotal={calcularTotalAtosPagos()}
                  valorAdiantadoDetalhes={form.valorAdiantadoDetalhes || []}
                  disabled={false}
                  onAvancarEtapa={() => setAba('entrega')}
                  onVoltarEtapa={() => setAba('conferencia')}
                />
              )}
              {aba === 'execucao' && (
                <ServicoExecucao
                  form={form}
                  onChange={handleExecucaoChange}
                  pedidoId={form.protocolo}
                  disabled={false}
                  onStatusChange={status => handleFormChange('status', status)}
                />
              )}
              {aba === 'entrega' && (
                <ServicoEntrega
                  form={form}
                  onChange={handleEntregaChange}
                  pedidoId={form.protocolo}
                  disabled={false}
                  onVoltarLista={() => navigate('/lista-servicos')}
                  onStatusChange={status => handleFormChange('status', status)}
                />
              )}
              {aba === 'historico' && form.protocolo && historicoStatus.length > 0 && (
                <div style={{
                  background: 'white',
                  borderRadius: 16,
                  boxShadow: '0 4px 24px rgba(44,62,80,0.08)',
                  padding: 32,
                  marginBottom: 32
                }}>
                  <h3 style={{
                    color: '#2c3e50',
                    fontSize: 24,
                    fontWeight: 700,
                    marginBottom: 24,
                    borderBottom: '3px solid #9b59b6',
                    paddingBottom: 12,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                     Historico de Status - Protocolo: {form.protocolo}
                  </h3>
                  <div style={{
                    border: '2px solid #9b59b6',
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: '0 2px 12px rgba(155,89,182,0.15)'
                  }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '14px'
                    }}>
                      <thead>
                        <tr style={{
                          background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
                          color: 'white'
                        }}>
                          <th style={{
                            padding: '16px 20px',
                            textAlign: 'left',
                            fontWeight: '700',
                            fontSize: '16px',
                            borderRight: '1px solid rgba(255,255,255,0.2)'
                          }}>
                             Data/Hora
                          </th>
                          <th style={{
                            padding: '16px 20px',
                            textAlign: 'left',
                            fontWeight: '700',
                            fontSize: '16px',
                            borderRight: '1px solid rgba(255,255,255,0.2)'
                          }}>
                             Status
                          </th>
                          <th style={{
                            padding: '16px 20px',
                            textAlign: 'left',
                            fontWeight: '700',
                            fontSize: '16px',
                            borderRight: '1px solid rgba(255,255,255,0.2)'
                          }}>
                             Responsavel
                          </th>
                          <th style={{
                            padding: '16px 20px',
                            textAlign: 'left',
                            fontWeight: '700',
                            fontSize: '16px'
                          }}>
                             Observacoes
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicoStatus.map((item, index) => {
                          const dataFormatada = new Date(item.data_alteracao).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          });
                          const getStatusColor = (status) => {
                            switch (status?.toLowerCase()) {
                              case 'pago': return '#27ae60';
                              case 'conferido': return '#3498db';
                              case 'em analise': return '#f39c12';
                              case 'cancelado': return '#e74c3c';
                              case 'concluido': return '#2ecc71';
                              default: return '#7f8c8d';
                            }
                          };
                          return (
                            <tr
                              key={index}
                              style={{
                                background: index % 2 === 0 ? '#fafafa' : '#ffffff',
                                borderBottom: index < historicoStatus.length - 1 ? '1px solid #ecf0f1' : 'none',
                                transition: 'background-color 0.2s ease'
                              }}
                              onMouseEnter={(e) => e.target.parentElement.style.backgroundColor = '#f8f9fa'}
                              onMouseLeave={(e) => e.target.parentElement.style.backgroundColor = index % 2 === 0 ? '#fafafa' : '#ffffff'}
                            >
                              <td style={{
                                padding: '16px 20px',
                                borderRight: '1px solid #ecf0f1',
                                fontFamily: 'monospace',
                                fontWeight: '600',
                                color: '#2c3e50'
                              }}>
                                {dataFormatada}
                              </td>
                              <td style={{
                                padding: '16px 20px',
                                borderRight: '1px solid #ecf0f1',
                                fontWeight: '700',
                                color: getStatusColor(item.status)
                              }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '4px 12px',
                                  borderRadius: '20px',
                                  backgroundColor: `${getStatusColor(item.status)}20`,
                                  border: `2px solid ${getStatusColor(item.status)}`,
                                  fontSize: '13px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}>
                                  {item.status}
                                </span>
                              </td>
                              <td style={{
                                padding: '16px 20px',
                                borderRight: '1px solid #ecf0f1',
                                color: '#2c3e50',
                                fontWeight: '600'
                              }}>
                                {item.responsavel || 'Sistema'}
                              </td>
                              <td style={{
                                padding: '16px 20px',
                                color: '#2c3e50'
                              }}>
                                {item.observacoes || ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
