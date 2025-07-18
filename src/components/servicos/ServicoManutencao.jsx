import React, { useState, useEffect } from 'react';
import ServicoEntrada from './ServicoEntrada';
import ServicoCliente from './ServicoCliente';
import ServicoPagamento from './ServicoPagamento';
import ServicoExecucao from './ServicoExecucao';
import ServicoEntrega from './ServicoEntrega';
import ServicoAlertas from './ServicoAlertas';

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
        maxWidth: "95%", // <-- alterado de 900 para 95%
        margin: '0 auto',
        padding: '48px 24px 0 24px'
      }}>
        <h2 style={{
          marginBottom: 10,
          color: '#2c3e50',
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: 1
        }}>
          Cadastro de Pedido de Serviço
        </h2>
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
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 18 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <ServicoEntrada form={form} tiposServico={tiposServico} onChange={handleFormChange} />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <ServicoCliente form={form} clientes={clientes} onChange={handleFormChange} onClienteChange={handleClienteChange} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 18 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <ServicoPagamento form={form} onChange={handlePagamentoChange} />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <ServicoExecucao form={form} onChange={handleExecucaoChange} />
            </div>
          </div>
          <ServicoEntrega form={form} onChange={handleEntregaChange} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
            <button
              type="submit"
              style={{
                padding: '12px 32px',
                background: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(44,62,80,0.12)'
              }}
            >
              Registrar Serviço
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}