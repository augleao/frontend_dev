import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ServicoEntrada from './ServicoEntrada';
import ServicoCliente from './ServicoCliente';
import ServicoPagamento from './ServicoPagamento';
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
          let prazoFormatado = '';
          if (data.pedido.prazo) {
            const d = new Date(data.pedido.prazo);
            prazoFormatado = d.toISOString().slice(0, 10);
          }
          setForm(f => ({
            ...f,
            ...data.pedido,
            prazo: prazoFormatado,
            valorAdiantado: data.pedido.valor_adiantado || 0,
            observacao: data.pedido.observacao ?? '',
            clienteId: data.pedido.cliente?.id || null, // Use null ao invés de string vazia
            novoCliente: false, // Define como cliente existente
            cliente: { ...f.cliente, ...data.pedido.cliente },
            pagamento: { ...f.pagamento, ...data.pedido.pagamento },
            execucao: { ...f.execucao, ...data.pedido.execucao },
            entrega: { ...f.entrega, ...data.pedido.entrega }
          }));
          
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
    setForm(f => ({
      ...f,
      execucao: { ...f.execucao, [field]: value }
    }));
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
              background: '#fff',
              color: '#884ea0',
              border: '2px solid #9b59b6',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 18,
              padding: '8px 22px',
              marginLeft: 24,
              boxShadow: '0 2px 8px rgba(155,89,182,0.10)',
              textShadow: '0 2px 8px #fff, 0 1px 0 #fff',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              minWidth: 120,
              textAlign: 'center'
            }}>
              {form.status}
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
          {/* Moldura lilás envolvendo ServicoEntrada e ServicoCliente */}
          <div style={{
            border: '3px solid #9b59b6',
            borderRadius: 24,
            background: '#fdf8feff',
            padding: 12,
            marginBottom: 18,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            boxShadow: '0 6px 32px rgba(155,89,182,0.10)'
          }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <ServicoEntrada
                form={form}
                tiposServico={tiposServico}
                onChange={handleFormChange}
                combosDisponiveis={combosDisponiveis}
                atosPedido={atosPedido}
                setAtosPedido={setAtosPedido}
              />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <ServicoCliente form={form} clientes={clientes} onChange={handleFormChange} onClienteChange={handleClienteChange} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 18 }}>
            {/* Exibe ServicoPagamento apenas se houver ato com codigoTributario '01' */}
            {atosPedido.some(ato => ato.codigoTributario === '01') && (
              <div style={{ flex: 1, minWidth: 260 }}>
                <ServicoPagamento form={form} onChange={handlePagamentoChange} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 260 }}>
              <ServicoExecucao form={form} onChange={handleExecucaoChange} />
            </div>
          </div>
          <ServicoEntrega form={form} onChange={handleEntregaChange} />
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
        
      </div>
    </div>
  );
}