import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ServicoEntrada from './ServicoEntrada';
import ServicoCliente from './ServicoCliente';
import ServicoPagamento from './ServicoPagamento';
import ServicoConferencia from './ServicoConferencia';
import ServicoExecucao from './ServicoExecucao';
import ServicoEntrega from './ServicoEntrega';
import ServicoAlertas from './ServicoAlertas';
import ServicoLista from './ServicoLista';
import config from '../../config';
import { fetchComAuth } from '../../utils';

const clientesMock = [
  { id: 1, nome: 'João Silva', cpf: '123.456.789-00', endereco: 'Rua A, 123', telefone: '99999-9999', email: 'joao@email.com' },
  { id: 2, nome: 'Maria Souza', cpf: '987.654.321-00', endereco: 'Rua B, 456', telefone: '88888-8888', email: 'maria@email.com' }
];
const tiposServico = [
  'Certidão de Nascimento',
  'Certidão de Casamento',
  'Reconhecimento de Firma',
  'Autenticação de Documento'
];
const statusExecucao = [
  { value: 'em_andamento', label: 'Em andamento', color: '#3498db' },
  { value: 'aguardando', label: 'Aguardando documentos', color: '#f39c12' },
  { value: 'concluido', label: 'Concluído', color: '#27ae60' },
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
  // Fallback: garante que o form sempre tenha serventiaId se o usuário logado possuir
  useEffect(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (usuario && usuario.serventiaId) {
      setForm(f => {
        // Só seta se não houver nenhum id de serventia já presente
        if (!f.serventiaId && !f.serventia_id && !f.serventia) {
          return { ...f, serventiaId: usuario.serventiaId };
        }
        return f;
      });
    }
  }, []);
  const [clientes, setClientes] = useState(clientesMock);
  const [alertas, setAlertas] = useState([]);
  const [combosDisponiveis, setCombosDisponiveis] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [atosPedido, setAtosPedido] = useState([]);
  const [historicoStatus, setHistoricoStatus] = useState([]);
  // Inicializa o form já tentando pegar o serventiaId do usuário logado
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

  // Função para extrair o protocolo da query string
  function getProtocoloFromQuery() {
    const params = new URLSearchParams(location.search);
    return params.get('protocolo');
  }

  function deepEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  // Função para buscar histórico de status
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
        // Se não houver endpoint específico, simula histórico básico
        setHistoricoStatus([
          {
            status: form.status || 'Em Análise',
            data_alteracao: new Date().toISOString(),
            responsavel: 'Sistema',
            observacoes: 'Status atual do pedido'
          }
        ]);
      }
    } catch (error) {
      // Fallback com dados básicos
      setHistoricoStatus([
        {
          status: form.status || 'Em Análise',
          data_alteracao: new Date().toISOString(),
          responsavel: 'Sistema',
          observacoes: 'Status atual do pedido'
        }
      ]);
    }
  };


  useEffect(() => {
    const protocolo = getProtocoloFromQuery();
    
    // Se não há protocolo, limpa o estado e sai
    if (!protocolo) {
      if (pedidoCarregado) {
        setPedidoCarregado(false);
        setForm(prev => ({ ...prev, protocolo: '' }));
        setAtosPedido([]);
      }
      return;
    }
    
    // Se já carregou este protocolo específico, não recarrega
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
          // Compatibiliza o nome do campo vindo do backend
          const valorAdiantadoDetalhes =
            data.pedido.valorAdiantadoDetalhes ||
            data.pedido.valor_adiantado_detalhes ||
            [{ valor: '', forma: '' }];
          // LOGS DE DEPURAÇÃO PARA SERVANTIA
          setForm(f => ({
            ...f,
            ...data.pedido,
            prazo: prazoFormatado,
            valorAdiantado: data.pedido.valor_adiantado || 0,
            valorAdiantadoDetalhes,
            observacao: data.pedido.observacao ?? '',
            clienteId: data.pedido.cliente?.id || null, // Use null ao invés de string vazia
            novoCliente: false, // Define como cliente existente
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
            // Garante que o id da serventia esteja presente para o ServicoEntrada
            serventiaId: (
              data.pedido.serventiaId ||
              data.pedido.serventia_id ||
              (typeof data.pedido.serventia === 'object' && data.pedido.serventia?.id) ||
              data.pedido.serventia ||
              null
            )
          }));

          // Após carregar o pedido, buscar conferências salvas (se existirem) e atualizar o form
          if (data.pedido && data.pedido.protocolo) {
            // Buscar conferências
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

            // Buscar pagamento salvo
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
          }
          // Mapeia os combos do backend para o formato esperado pelo frontend
          const combosFormatados = Array.isArray(data.pedido.combos) 
            ? data.pedido.combos.map(combo => ({
                comboId: combo.combo_id,
                comboNome: combo.combo_nome,
                atoId: combo.ato_id,
                atoCodigo: combo.ato_codigo,
                atoDescricao: combo.ato_descricao,
                quantidade: combo.quantidade || 1,
                codigoTributario: combo.codigo_tributario || '',
                valor_final: combo.valor_final // Garante que o valor_final venha para o frontend
              }))
            : [];
          setAtosPedido(combosFormatados);
          setPedidoCarregado(true);
          
          // Busca o histórico de status após carregar o pedido
          buscarHistoricoStatus(protocolo);
        }
      })
      .catch(err => {
        setPedidoCarregado(true);
      });
  }, [location.search, form.protocolo]); // Adiciona form.protocolo às dependências

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
    // Se o field for 'execucao' (vindo do backend), substitui o objeto inteiro
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

    // Função para tratar mudanças na conferência
    function handleConferenciaChange(field, value) {
      setForm(f => ({
        ...f,
        conferencia: { ...f.conferencia, [field]: value }
      }));
    }

  // Função para excluir pedido
  const excluirPedido = async () => {
    if (!form.protocolo) {
      return;
    }

    const confirmacao = window.confirm(`Tem certeza que deseja excluir o pedido ${form.protocolo}? Esta ação não pode ser desfeita.`);
    if (!confirmacao) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(form.protocolo)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        // Limpa o formulário e redireciona
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
        // Redireciona para a lista de pedidos
        navigate('/servicos');
      } else {
        const errorText = await res.text();
      }
    } catch (error) {
    }
  };

  // Função para calcular o total dos atos pagos (código tributário "01")
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
      clienteId: null, // Use null ao invés de string vazia
      novoCliente: false,
      cliente: { nome: '', cpf: '', endereco: '', telefone: '', email: '' },
      pagamento: { status: 'pendente', valorTotal: '', valorPago: '', data: '', forma: '' },
      execucao: { status: 'em_andamento', observacoes: '', responsavel: '' },
      entrega: { data: '', hora: '', retiradoPor: '', documentoRetirada: '', assinaturaDigital: false }
    });
  }

  useEffect(() => {
    const hoje = new Date();
    const atrasados = servicos.filter(s => s.prazo && new Date(s.prazo) < hoje && s.execucao.status !== 'concluido');
    setAlertas(atrasados.map(s => `Serviço ${s.protocolo} está atrasado!`));
  }, [servicos]);

  // Efeito para atualizar histórico quando o status mudar
  useEffect(() => {
    if (form.protocolo && form.status) {
      buscarHistoricoStatus(form.protocolo);
    }
  }, [form.status, form.protocolo]);



  // Estado para abas
  const [aba, setAba] = useState('cliente');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '0 0 60px 0',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: "98%",
        margin: '0 auto',
        padding: '12px 24px 0 24px' // <-- alterado de '48px 24px 0 24px' para diminuir o espaçamento superior
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, justifyContent: 'space-between' }}>
          <h2 style={{
            color: '#2c3e50',
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: 1,
            margin: 0,
            textShadow: '0 2px 8px #fff, 0 1px 0 #fff, 0 0px 2px #fff',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{ textShadow: '0 2px 8px #fff, 0 1px 0 #fff, 0 0px 2px #fff' }}>Pedido - Protocolo:</span>
            <span style={{
              marginLeft: 12,
              color: '#6c3483',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: 28,
              textShadow: '0 2px 8px #fff, 0 1px 0 #fff, 0 0px 2px #fff'
            }}>
              {form.protocolo || 'Novo Pedido'}
            </span>
          </h2>
          {form.status && (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: 24
            }}>
              <span style={{
                color: '#2c3e50',
                fontWeight: 700,
                fontSize: 28,
                fontFamily: 'monospace',
                textShadow: '0 2px 8px #fff, 0 1px 0 #fff, 0 0px 2px #fff',
                marginRight: 8
              }}>
                Status:
              </span>
              <span style={{
                color: '#6c3483',
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: 28,
                textShadow: '0 2px 8px #fff, 0 1px 0 #fff, 0 0px 2px #fff',
                marginLeft: 0
              }}>
                {form.status}
              </span>
            </span>
          )}
        </div>
        <ServicoAlertas alertas={alertas} />
        <form
          onSubmit={registrarServico}
          style={{
            background: 'white',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(44,62,80,0.08)',
            padding: 32,
            marginBottom: 32
          }}
        >
          {/* Abas de navegação dos serviços */}
          <div style={{ display: 'flex', borderBottom: '2px solid #e3eaf5', marginBottom: 24 }}>
            {[
              { key: 'cliente', label: 'Cliente' },
              { key: 'entrada', label: 'Entrada' },
              { key: 'conferencia', label: 'Conferência' },
              { key: 'pagamento', label: 'Pagamento' },
              { key: 'execucao', label: 'Execução' },
              { key: 'entrega', label: 'Entrega' },
              { key: 'historico', label: 'Histórico' }
            ].map(tab => {
              // Lógica para definir se cada aba está "preenchida"
              let isFilled = false;
              if (tab.key === 'cliente') {
                isFilled = !!(form.cliente && form.cliente.nome && form.cliente.cpf);
              } else if (tab.key === 'entrada') {
                isFilled = Array.isArray(atosPedido) && atosPedido.length > 0;
              } else if (tab.key === 'conferencia') {
                // Só fica verde se houver dados salvos em form.conferencia
                isFilled = !!(form.conferencia && (
                  (typeof form.conferencia === 'object' && Object.values(form.conferencia).some(v => v && v !== ''))
                ));
              } else if (tab.key === 'pagamento') {
                let pagamentoDebug = form.pagamento;
                let pagamentoFilled = false;
                if (pagamentoDebug) {
                  pagamentoFilled = (
                    (pagamentoDebug.status && pagamentoDebug.status !== 'pendente') ||
                    (pagamentoDebug.valorPago && parseFloat(pagamentoDebug.valorPago) > 0) ||
                    (pagamentoDebug.valorTotal && parseFloat(pagamentoDebug.valorTotal) > 0) ||
                    (pagamentoDebug.data && pagamentoDebug.data !== '') ||
                    (pagamentoDebug.forma && pagamentoDebug.forma !== '')
                  );
                }
                // LOG DE DEPURAÇÃO
                if (window && window.console) {
                  console.log('[DEBUG][Aba Pagamento] form.pagamento:', pagamentoDebug);
                  console.log('[DEBUG][Aba Pagamento] pagamentoFilled:', pagamentoFilled);
                }
                isFilled = !!pagamentoFilled;
              } else if (tab.key === 'execucao') {
                let execucaoDebug = form.execucao;
                let execucaoFilled = false;
                if (execucaoDebug) {
                  execucaoFilled = (
                    execucaoDebug.id ||
                    execucaoDebug.status === 'concluido' ||
                    execucaoDebug.status === 'concluído'
                  );
                }
                if (window && window.console) {
                  console.log('[DEBUG][Aba Execucao] form.execucao:', execucaoDebug);
                  if (execucaoDebug && typeof execucaoDebug === 'object') {
                    Object.entries(execucaoDebug).forEach(([k, v]) => {
                      console.log(`[DEBUG][Aba Execucao] campo ${k}:`, v);
                    });
                  }
                  console.log('[DEBUG][Aba Execucao] execucaoFilled:', execucaoFilled);
                }
                isFilled = !!execucaoFilled;
              } else if (tab.key === 'entrega') {
                isFilled = !!(form.entrega && (form.entrega.data || form.entrega.retiradoPor || form.entrega.retirado_por));
              } else if (tab.key === 'historico') {
                isFilled = historicoStatus && historicoStatus.length > 0;
              }
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setAba(tab.key)}
                  style={{
                    background: aba === tab.key ? '#fff' : 'transparent',
                    border: 'none',
                    borderBottom: aba === tab.key ? '3px solid #3498db' : '3px solid transparent',
                    color: aba === tab.key ? '#3498db' : (isFilled ? '#27ae60' : '#e74c3c'),
                    fontWeight: 700,
                    fontSize: 16,
                    padding: '10px 28px',
                    cursor: aba === tab.key ? 'default' : 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {/* Conteúdo das abas */}
          {aba === 'cliente' && (
            <ServicoCliente form={form} clientes={clientes} onChange={handleFormChange} onClienteChange={handleClienteChange} />
          )}
          {aba === 'entrada' && (
            <ServicoEntrada
              form={form}
              tiposServico={tiposServico}
              onChange={handleFormChange}
              combosDisponiveis={combosDisponiveis}
              atosPedido={atosPedido}
              setAtosPedido={setAtosPedido}
            />
          )}
          {aba === 'conferencia' && (
            <ServicoConferencia protocolo={form.protocolo} atosPedido={atosPedido} disabled={false} />
          )}
          {aba === 'pagamento' && (
            <ServicoPagamento
              form={form}
              onChange={handlePagamentoChange}
              valorTotal={calcularTotalAtosPagos()}
              valorAdiantadoDetalhes={form.valorAdiantadoDetalhes || []}
              disabled={false}
            />
          )}
          {aba === 'execucao' && (
            <ServicoExecucao
              form={form}
              onChange={handleExecucaoChange}
              pedidoId={form.protocolo}
              disabled={false}
            />
          )}
          {aba === 'entrega' && (
            <ServicoEntrega
              form={form}
              onChange={handleEntregaChange}
              pedidoId={form.protocolo}
              disabled={false}
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
                📊 Histórico de Status - Protocolo: {form.protocolo}
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
                        📅 Data/Hora
                      </th>
                      <th style={{
                        padding: '16px 20px',
                        textAlign: 'left',
                        fontWeight: '700',
                        fontSize: '16px',
                        borderRight: '1px solid rgba(255,255,255,0.2)'
                      }}>
                        📋 Status
                      </th>
                      <th style={{
                        padding: '16px 20px',
                        textAlign: 'left',
                        fontWeight: '700',
                        fontSize: '16px',
                        borderRight: '1px solid rgba(255,255,255,0.2)'
                      }}>
                        👤 Responsável
                      </th>
                      <th style={{
                        padding: '16px 20px',
                        textAlign: 'left',
                        fontWeight: '700',
                        fontSize: '16px'
                      }}>
                        📝 Observações
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
                          case 'em análise': return '#f39c12';
                          case 'cancelado': return '#e74c3c';
                          case 'concluído': return '#2ecc71';
                          default: return '#7f8c8d';
                        }
                      };
                      return (
                        <tr key={index} style={{ 
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
                            color: '#7f8c8d',
                            fontStyle: item.observacoes ? 'normal' : 'italic'
                          }}>
                            {item.observacoes || 'Nenhuma observação'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Resumo estatístico */}
              <div style={{
                marginTop: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                borderRadius: 8,
                border: '1px solid #dee2e6'
              }}>
                <div style={{
                  fontSize: '14px',
                  color: '#6c757d',
                  fontWeight: '600'
                }}>
                  📈 Total de alterações de status: <strong style={{ color: '#2c3e50' }}>{historicoStatus.length}</strong>
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#6c757d',
                  fontWeight: '600'
                }}>
                  🕒 Última atualização: <strong style={{ color: '#2c3e50' }}>
                    {historicoStatus.length > 0 ? new Date(historicoStatus[historicoStatus.length - 1].data_alteracao).toLocaleString('pt-BR') : 'N/A'}
                  </strong>
                </div>
              </div>
            </div>
          )}
          {/* Só mostra o botão de excluir se há um pedido carregado */}
          {form.protocolo && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
              <button
                type="button"
                onClick={excluirPedido}
                style={{
                  padding: '12px 32px',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(231,76,60,0.3)'
                }}
              >
                🗑️ Excluir Pedido
              </button>
            </div>
          )}
        </form>
 
      </div>
    </div>
  );
}