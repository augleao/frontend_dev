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
  const [clientes, setClientes] = useState(clientesMock);
  const [alertas, setAlertas] = useState([]);
  const [combosDisponiveis, setCombosDisponiveis] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [atosPedido, setAtosPedido] = useState([]);
  const [historicoStatus, setHistoricoStatus] = useState([]);
  const [form, setForm] = useState({
    protocolo: '', // começa vazio
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
        console.log('[HISTORICO DEBUG] Resposta da API /historico-status:', data);
        if (Array.isArray(data.historico)) {
          console.log(`[HISTORICO DEBUG] Quantidade de status recebidos: ${data.historico.length}`);
          data.historico.forEach((item, idx) => console.log(`[HISTORICO DEBUG] #${idx+1}:`, item));
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
      console.error('Erro ao buscar histórico de status:', error);
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
    console.log('useEffect [location.search] disparado');
    const protocolo = getProtocoloFromQuery();
    console.log('Protocolo extraído:', protocolo);
    
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
      console.log('Protocolo já carregado, pulando...');
      return;
    }

    console.log('Carregando protocolo:', protocolo);
    const token = localStorage.getItem('token');
    fetchComAuth(`${config.apiURL}/pedidos/${encodeURIComponent(protocolo)}`)
      .then(res => res && res.json())
      .then(data => {
        console.log('Dados recebidos do backend:', data);
        if (data.pedido) {
          console.log('[DEBUG] Status recebido do backend:', data.pedido.status);
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
          console.log('[DEBUG] data.pedido.serventia:', data.pedido.serventia);
          console.log('[DEBUG] data.pedido.serventiaId:', data.pedido.serventiaId);
          console.log('[DEBUG] data.pedido.serventia_id:', data.pedido.serventia_id);
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
              status: 'em_andamento',
              observacoes: '',
              responsavel: '',
              ...f.execucao,
              ...(data.pedido.execucao || {})
            },
            entrega: { ...f.entrega, ...data.pedido.entrega },
            // Garante que o id da serventia esteja presente para o ServicoEntrada
            serventiaId: (
              data.pedido.serventiaId ||
              data.pedido.serventia_id ||
              (typeof data.pedido.serventia === 'object' && data.pedido.serventia?.id) ||
              data.pedido.serventia ||
              null
            )
          }));

          // Após carregar o pedido, buscar execução salva (se existir) e atualizar o form
          if (data.pedido && data.pedido.protocolo) {
            console.log('[EXECUCAO DEBUG] Buscando execução do serviço para protocolo:', data.pedido.protocolo);
            fetchComAuth(`${config.apiURL}/execucao-servico/${encodeURIComponent(data.pedido.protocolo)}`)
              .then(execRes => {
                if (!execRes) {
                  console.warn('[EXECUCAO DEBUG] Resposta fetchComAuth nula para execução');
                  return null;
                }
                if (!execRes.ok) {
                  console.warn('[EXECUCAO DEBUG] Execução não encontrada ou erro HTTP:', execRes.status);
                  return null;
                }
                return execRes.json();
              })
              .then(execData => {
                console.log('[EXECUCAO DEBUG] Dados recebidos da execução:', execData);
                if (execData) {
                  setForm(f => ({
                    ...f,
                    execucao: {
                      ...f.execucao, // mantém campos já existentes
                      ...execData    // sobrescreve pelos do backend
                    }
                  }));
                  console.log('[EXECUCAO DEBUG] Execução do serviço carregada no form:', execData);
                } else {
                  console.log('[EXECUCAO DEBUG] Nenhuma execução encontrada para o protocolo:', data.pedido.protocolo);
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
        console.error('Erro ao buscar pedido por protocolo:', err);
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
    setForm(f => ({
      ...f,
      entrega: { ...f.entrega, [field]: value }
    }));
  }

  // Função para excluir pedido
  const excluirPedido = async () => {
    if (!form.protocolo) {
      alert('Nenhum pedido carregado para excluir.');
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
        alert(`Pedido ${form.protocolo} excluído com sucesso!`);
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
        console.error('Erro ao excluir pedido:', res.status, errorText);
        alert(`Erro ao excluir pedido: ${res.status}`);
      }
    } catch (error) {
      console.error('Erro ao excluir pedido:', error);
      alert('Erro ao excluir pedido. Tente novamente.');
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
          {console.log('[DEBUG] form.status:', form.status, '| form:', form)}
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
          {/* Moldura lilás envolvendo ServicoCliente e ServicoEntrada */}
          <div style={{
            border: '3px solid #9b59b6',
            borderRadius: 24,
            background: '#fdf8feff',
            padding: 20,
            marginBottom: 12,
            boxShadow: '0 6px 32px rgba(155,89,182,0.10)'
          }}>
            {/* ServicoCliente - largura total, em cima */}
            <div style={{ 
              width: '100%', 
              marginBottom: 20,
              boxSizing: 'border-box'
            }}>
              <ServicoCliente form={form} clientes={clientes} onChange={handleFormChange} onClienteChange={handleClienteChange} />
            </div>
            
            {/* ServicoEntrada - largura total, embaixo */}
            <div style={{ 
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <ServicoEntrada
                form={form}
                tiposServico={tiposServico}
                onChange={handleFormChange}
                combosDisponiveis={combosDisponiveis}
                atosPedido={atosPedido}
                setAtosPedido={setAtosPedido}
              />
            </div>
          </div>

          {/* Novo componente de conferência - só habilita se protocolo existir */}
          <div style={!form.protocolo ? {
            pointerEvents: 'none',
            opacity: 0.6,
            filter: 'grayscale(0.7) contrast(0.7)',
            background: 'repeating-linear-gradient(135deg, #eee 0 8px, #fff 8px 16px)',
            borderRadius: 12,
            marginBottom: 12
          } : {}}>
            <ServicoConferencia protocolo={form.protocolo} atosPedido={atosPedido} disabled={!form.protocolo} />
          </div>

          {/* Pagamento só é exibido se houver ato tributário '01' */}
          {(() => {
            const protocoloExiste = !!form.protocolo;
            const temAtoTributario01 = atosPedido.some(ato => ato.codigoTributario === '01');
            if (!temAtoTributario01) return null;
            const temConferenciaConferido = historicoStatus.some(h => h.status && h.status.toLowerCase() === 'conferido');
            const habilitaPagamento = protocoloExiste && temAtoTributario01 && temConferenciaConferido;
            console.log('[DEBUG PAGAMENTO] protocoloExiste:', protocoloExiste, '| temAtoTributario01:', temAtoTributario01, '| temConferenciaConferido:', temConferenciaConferido, '| habilitaPagamento:', habilitaPagamento);
            console.log('[DEBUG PAGAMENTO] form.protocolo:', form.protocolo);
            console.log('[DEBUG PAGAMENTO] atosPedido:', atosPedido);
            console.log('[DEBUG PAGAMENTO] historicoStatus:', historicoStatus);
            return (
              <div style={!habilitaPagamento ? {
                pointerEvents: 'none',
                opacity: 0.6,
                filter: 'grayscale(0.7) contrast(0.7)',
                background: 'repeating-linear-gradient(135deg, #eee 0 8px, #fff 8px 16px)',
                borderRadius: 12,
                marginBottom: 12
              } : {}}>
                <ServicoPagamento 
                  form={form} 
                  onChange={handlePagamentoChange} 
                  valorTotal={calcularTotalAtosPagos()}
                  valorAdiantadoDetalhes={form.valorAdiantadoDetalhes || []}
                  disabled={!habilitaPagamento}
                />
              </div>
            );
          })()}

          {/* Execução só é bloqueada por pagamento se houver ato tributário '01' e o pagamento não estiver realizado */}
          {(() => {
            const temAtoTributario01 = atosPedido.some(ato => ato.codigoTributario === '01' || ato.codigoTributario === 1 || ato.codigoTributario === '1');
            const pagamentoOk = form.pagamento && (form.pagamento.status === 'pago' || form.pagamento.status === 'parcial');
            const habilitaExecucao = !temAtoTributario01 || pagamentoOk;
            return (
              <div style={!habilitaExecucao ? {
                pointerEvents: 'none',
                opacity: 0.6,
                filter: 'grayscale(0.7) contrast(0.7)',
                background: 'repeating-linear-gradient(135deg, #eee 0 8px, #fff 8px 16px)',
                borderRadius: 12,
                marginBottom: 12
              } : {}}>
                <ServicoExecucao 
                  form={form} 
                  onChange={handleExecucaoChange} 
                  pedidoId={form.protocolo} 
                  disabled={!habilitaExecucao}
                />
              </div>
            );
          })()}

          {/* Entrega só habilita se execução salva (status diferente de 'em_andamento') */}
          {(() => {
            // Habilita entrega sempre que houver uma execução salva (objeto execucao com id ou qualquer campo preenchido)
            const execucaoSalva = form.execucao && Object.keys(form.execucao).length > 0;
            const habilitaEntrega = !!execucaoSalva;
            console.log('[DEBUG ENTREGA] form.execucao:', form.execucao);
            console.log('[DEBUG ENTREGA] execucaoSalva:', execucaoSalva, '| habilitaEntrega:', habilitaEntrega);
            return (
              <div style={!habilitaEntrega ? {
                pointerEvents: 'none',
                opacity: 0.6,
                filter: 'grayscale(0.7) contrast(0.7)',
                background: 'repeating-linear-gradient(135deg, #eee 0 8px, #fff 8px 16px)',
                borderRadius: 12,
                marginBottom: 12
              } : {}}>
                <ServicoEntrega 
                  form={form} 
                  onChange={handleEntregaChange} 
                  disabled={!habilitaEntrega}
                />
              </div>
            );
          })()}
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
                🗑️ Excluir Registro
              </button>
            </div>
          )}
        </form>
        
        {/* Tabela de Histórico de Status */}
        {form.protocolo && historicoStatus.length > 0 && (
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
                    
                    // Define cor baseada no status
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
        
      </div>
    </div>
  );
}