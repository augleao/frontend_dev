import React, { useState, useEffect } from 'react';
import ServicoEntrada from './ServicoEntrada';
import ServicoCliente from './ServicoCliente';
import ServicoPagamento from './ServicoPagamento';
import ServicoExecucao from './ServicoExecucao';
import ServicoEntrega from './ServicoEntrega';
import ServicoLista from './ServicoLista';
import ServicoAlertas from './ServicoAlertas';
import ServicoDetalhes from './ServicoDetalhes';

// Mock e helpers
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
  // Estados e handlers
  const [servicos, setServicos] = useState([]);
  const [clientes, setClientes] = useState(clientesMock);
  const [filtro, setFiltro] = useState({ status: '', protocolo: '', tipo: '', cliente: '' });
  const [alertas, setAlertas] = useState([]);
  const [form, setForm] = useState({
    protocolo: gerarProtocolo(),
    tipo: '',
    descricao: '',
    prazo: '',
    clienteId: '',
    novoCliente: false,
    cliente: { nome: '', cpf: '', endereco: '', telefone: '', email: '' },
    pagamento: { status: 'pendente', valorTotal: '', valorPago: '', data: '', forma: '' },
    execucao: { status: 'em_andamento', observacoes: '', responsavel: '' },
    entrega: { data: '', hora: '', retiradoPor: '', documentoRetirada: '', assinaturaDigital: false }
  });
  const [visualizando, setVisualizando] = useState(null);

  // Handlers
  function handleFormChange(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }
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

  // Cadastro de novo serviço
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
      clienteId: '',
      novoCliente: false,
      cliente: { nome: '', cpf: '', endereco: '', telefone: '', email: '' },
      pagamento: { status: 'pendente', valorTotal: '', valorPago: '', data: '', forma: '' },
      execucao: { status: 'em_andamento', observacoes: '', responsavel: '' },
      entrega: { data: '', hora: '', retiradoPor: '', documentoRetirada: '', assinaturaDigital: false }
    });
  }

  // Alertas de prazo
  useEffect(() => {
    const hoje = new Date();
    const atrasados = servicos.filter(s => s.prazo && new Date(s.prazo) < hoje && s.execucao.status !== 'concluido');
    setAlertas(atrasados.map(s => `Serviço ${s.protocolo} está atrasado!`));
  }, [servicos]);

  // Filtragem
  const servicosFiltrados = servicos.filter(s => {
    return (
      (!filtro.status || s.execucao.status === filtro.status || s.pagamento.status === filtro.status) &&
      (!filtro.protocolo || s.protocolo.includes(filtro.protocolo)) &&
      (!filtro.tipo || s.tipo === filtro.tipo) &&
      (!filtro.cliente || s.cliente.nome.toLowerCase().includes(filtro.cliente.toLowerCase()))
    );
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
      <h2 style={{ marginBottom: 24, color: '#2c3e50' }}>Manutenção de Serviços</h2>
      <ServicoAlertas alertas={alertas} />
      <form onSubmit={registrarServico} style={{ background: '#f4f6f8', borderRadius: 12, padding: 24, marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <ServicoEntrada form={form} tiposServico={tiposServico} onChange={handleFormChange} />
          </div>
          <div style={{ flex: 1 }}>
            <ServicoCliente form={form} clientes={clientes} onChange={handleFormChange} onClienteChange={handleClienteChange} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <ServicoPagamento form={form} onChange={handlePagamentoChange} />
          </div>
          <div style={{ flex: 1 }}>
            <ServicoExecucao form={form} onChange={handleExecucaoChange} />
          </div>
        </div>
        <ServicoEntrega form={form} onChange={handleEntregaChange} />
        <button type="submit" style={{
          marginTop: 24,
          padding: '12px 32px',
          background: '#27ae60',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer'
        }}>
          Registrar Serviço
        </button>
      </form>
      <ServicoLista
        servicos={servicosFiltrados}
        filtro={filtro}
        setFiltro={setFiltro}
        tiposServico={tiposServico}
        statusExecucao={statusExecucao}
        statusPagamento={statusPagamento}
        onVerDetalhes={setVisualizando}
      />
      <ServicoDetalhes
        servico={visualizando}
        statusExecucao={statusExecucao}
        statusPagamento={statusPagamento}
        onClose={() => setVisualizando(null)}
      />
    </div>
  );
}