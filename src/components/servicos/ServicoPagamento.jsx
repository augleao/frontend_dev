
import React, { useState, useMemo } from 'react';
import config from '../../config';


const statusPagamento = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Pago' }
];

export default function ServicoPagamento({ form, onChange, valorTotal = 0, valorAdiantadoDetalhes: valorAdiantadoDetalhesProp = [] }) {
  // Estado local para valorAdiantadoDetalhes
  const [valorAdiantadoDetalhes, setValorAdiantadoDetalhes] = useState(valorAdiantadoDetalhesProp);
  // Sincroniza estado local com prop se ela mudar externamente
  React.useEffect(() => {
    setValorAdiantadoDetalhes(valorAdiantadoDetalhesProp || []);
  }, [valorAdiantadoDetalhesProp]);
  // Tabela de complementos de pagamento (renderização gradual)
  const renderTabelaComplementos = () => {
    const complementos = valorAdiantadoDetalhes.filter(item => item.complemento && item.valor && item.forma);
    if (complementos.length === 0) return null;
    return (
      <div style={{
        marginBottom: 20,
        padding: 16,
        background: '#fffbe5',
        border: '2px solid #f6ad55',
        borderRadius: 8
      }}>
        <h4 style={{
          margin: '0 0 12px 0',
          color: '#b7791f',
          fontSize: '16px',
          fontWeight: '600'
        }}>➕ Complementos de Pagamento</h4>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px'
        }}>
          <thead>
            <tr style={{ background: '#fffbe5' }}>
              <th style={{
                padding: '2px 2px 2px 2px',
                textAlign: 'left',
                color: '#b7791f',
                fontWeight: '600',
                border: '1px solid #f6ad55'
              }}>Valor</th>
              <th style={{
                padding: '8px 12px',
                textAlign: 'left',
                color: '#b7791f',
                fontWeight: '600',
                border: '1px solid #f6ad55'
              }}>Forma de Pagamento</th>
            </tr>
          </thead>
          <tbody>
            {complementos.map((item, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#fffbe5' }}>
                <td style={{
                  padding: '8px 12px',
                  border: '1px solid #f6ad55',
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  color: '#b7791f'
                }}>
                  R$ {parseFloat(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{
                  padding: '8px 12px',
                  border: '1px solid #f6ad55',
                  color: '#b7791f'
                }}>{item.forma}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  const [serventiaInfo, setServentiaInfo] = useState(null);
  // Estados para modal de complemento de pagamento
  const [showComplementoModal, setShowComplementoModal] = useState(false);
  const [modalValorComplemento, setModalValorComplemento] = useState("");
  const [modalFormaComplemento, setModalFormaComplemento] = useState("");

  // Função para abrir modal
  const abrirComplementoModal = () => {
    setShowComplementoModal(true);
    setModalValorComplemento("");
    setModalFormaComplemento("");
  };

  // Função para fechar modal
  const fecharComplementoModal = () => {
    setShowComplementoModal(false);
    setModalValorComplemento("");
    setModalFormaComplemento("");
  };

  // Função para adicionar complemento de pagamento via modal
  const handleAdicionarComplementoModal = () => {
    if (!modalFormaComplemento || !modalValorComplemento || isNaN(parseFloat(modalValorComplemento))) {
      alert("Preencha a forma e o valor do complemento corretamente.");
      return;
    }
    const novoComplemento = { forma: modalFormaComplemento, valor: parseFloat(modalValorComplemento), complemento: true };
    const novosDetalhes = [...valorAdiantadoDetalhes, novoComplemento];
    setValorAdiantadoDetalhes(novosDetalhes);
    if (onChange) {
      onChange({ ...form, valorAdiantadoDetalhes: novosDetalhes });
    }
    fecharComplementoModal();
  };
  // Buscar informações completas da serventia ao montar
  React.useEffect(() => {
    async function fetchServentia() {
      let id = form.serventiaId || form.serventia_id || form.serventia || null;
      if (!id) {
        const usuarioLogado = JSON.parse(localStorage.getItem('usuario') || '{}');
        id = usuarioLogado.serventia || usuarioLogado.serventiaId || usuarioLogado.serventia_id || null;
      }
      if (!id) return;
      try {
        const token = localStorage.getItem('token');
        const url = `${config.apiURL}/serventias/${id}`;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        let text = await res.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch {}
        if (res.ok) setServentiaInfo(data.serventia || data);
      } catch {}
    }
    fetchServentia();
  }, [form.serventiaId, form.serventia_id, form.serventia]);
  const [statusPedido, setStatusPedido] = useState(form.status || 'Em Análise');
  const [processando, setProcessando] = useState(false);
  // Estado para valor adicional
  const [valorAdicional, setValorAdicional] = useState(0);
  const [valorAdicionalInput, setValorAdicionalInput] = useState('');
  // Estado para saber se já existe pagamento salvo
  const [pagamentoSalvo, setPagamentoSalvo] = useState(false);
const subtotalPedido = useMemo(() => {
  const atos = (form.atosPedido || form.atos || []);
  const combos = Array.isArray(form.combos) ? form.combos : [];
  let listaAtos = atos.length > 0 ? atos : combos;
  listaAtos = listaAtos.filter(ato => ato.codigoTributario === '01' || ato.codigo_tributario === '01');
  let subtotal = 0;
  listaAtos.forEach(ato => {
    const valor = parseFloat(ato.valor_final || ato.valorFinal || 0);
    const issqn = parseFloat(ato.issqn || 0);
    const quantidade = ato.quantidade || 1;
    let valorFinalAto = valor;
    if (!isNaN(issqn) && issqn > 0) {
      valorFinalAto = valor + issqn;
    }
    subtotal += valorFinalAto * quantidade;
  });
  let adicional = 0;
  if (!isNaN(parseFloat(valorAdicional))) {
    adicional = parseFloat(valorAdicional) || 0;
  }
  return subtotal + adicional;
}, [form.atosPedido, form.atos, form.combos, valorAdicional]);
  // Buscar pagamento salvo ao montar
  React.useEffect(() => {
    // Loga sempre que o protocolo mudar
    console.log('[Pagamento][EFFECT] Protocolo atual:', form.protocolo);
    if (!form.protocolo) {
      console.log('[Pagamento][EFFECT] Nenhum protocolo informado, não buscando pagamento salvo.');
      setPagamentoSalvo(false);
      return;
    }
    async function fetchPagamentoSalvo() {
      try {
        const token = localStorage.getItem('token');
        const url = `${config.apiURL}/pedido_pagamento/${encodeURIComponent(form.protocolo)}`;
        console.log('[Pagamento][EFFECT] Buscando pagamento salvo:', url);
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        console.log('[Pagamento][EFFECT] Status da resposta:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('[Pagamento][EFFECT] Dados recebidos do backend:', data);
          if (data && data.id) {
            setPagamentoSalvo(true);
            console.log('[Pagamento][EFFECT] Pagamento salvo detectado no backend. Exibindo botão Excluir Pagamento.');
          } else {
            setPagamentoSalvo(false);
            console.log('[Pagamento][EFFECT] Nenhum pagamento salvo detectado no backend. Exibindo botão Salvar Pagamento.');
          }
          // Aceita tanto snake_case quanto camelCase por compatibilidade
          const valorAdicionalBackend = data.valorAdicional !== undefined ? data.valorAdicional : data.valor_adicional;
          if (valorAdicionalBackend !== undefined) {
            setValorAdicional(valorAdicionalBackend);
            setValorAdicionalInput(
              valorAdicionalBackend === '' || valorAdicionalBackend === null
                ? ''
                : parseFloat(valorAdicionalBackend).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            );
          }
          // Atualiza statusPedido se vier do backend
          const statusBackend = data.status !== undefined ? data.status : data.status_pedido;
          if (statusBackend) {
            setStatusPedido(statusBackend);
            if (onChange) onChange({ ...form, status: statusBackend });
          }
          // Carrega complementos do backend, se existirem
          let complementosBackend = [];
          if (Array.isArray(data.complementos)) {
            console.log('[Pagamento][EFFECT][DEBUG] Campo "complementos" encontrado:', data.complementos);
            complementosBackend = data.complementos;
          } else if (Array.isArray(data.complementos_pagamento)) {
            console.log('[Pagamento][EFFECT][DEBUG] Campo "complementos_pagamento" encontrado:', data.complementos_pagamento);
            complementosBackend = data.complementos_pagamento;
          } else {
            console.log('[Pagamento][EFFECT][DEBUG] Nenhum campo de complementos encontrado no backend.');
          }
          if (complementosBackend.length > 0) {
            const complementosMarcados = complementosBackend.map(item => ({ ...item, complemento: true }));
            setValorAdiantadoDetalhes(prev => {
              const naoComplementos = (prev || []).filter(item => !item.complemento);
              console.log('[Pagamento][EFFECT][DEBUG] Atualizando valorAdiantadoDetalhes. Não complementos:', naoComplementos, 'Novos complementos:', complementosMarcados);
              return [...naoComplementos, ...complementosMarcados];
            });
          } else {
            console.log('[Pagamento][EFFECT][DEBUG] Nenhum complemento para adicionar ao valorAdiantadoDetalhes.');
          }
        } else {
          setPagamentoSalvo(false);
          console.log('[Pagamento][EFFECT] Resposta não OK ao buscar pagamento salvo:', res.status, res.statusText);
        }
      } catch (e) {
        setPagamentoSalvo(false);
        console.error('[Pagamento][EFFECT] Erro ao buscar pagamento salvo:', e);
      }
    }
    fetchPagamentoSalvo();
  }, [form.protocolo]);

  // Função para calcular o total adiantado
  const calcularTotalAdiantado = () => {
    return valorAdiantadoDetalhes
      .filter(item => item.valor && item.forma)
      .reduce((total, item) => total + parseFloat(item.valor || 0), 0);
  };

  // Função para atualizar status no banco de dados
  const atualizarStatusPedido = async (novoStatus) => {
    try {
      // Verifica se temos protocolo válido
      if (!form.protocolo) {
        throw new Error('Protocolo não encontrado. Não é possível atualizar o status.');
      }

      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Token de autenticação não encontrado. Faça login novamente.');
      }

      // Recupera usuário logado do localStorage
      const usuarioLogado = JSON.parse(localStorage.getItem('usuario') || '{}');
      const usuario = usuarioLogado.nome || usuarioLogado.email || 'Sistema';
      
      console.log(`[DEBUG] Tentando atualizar status para: ${novoStatus}`);
      
      try {
        // Usa a mesma API do ServicoConferencia
        const response = await fetch(`${config.apiURL}/pedidos/${encodeURIComponent(form.protocolo)}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            status: novoStatus,
            usuario: usuario
          })
        });

        if (response.ok) {
          setStatusPedido(novoStatus);
          
          if (onChange) {
            onChange({ ...form, status: novoStatus });
          }
          
          console.log('[DEBUG] Status atualizado com sucesso via POST status');
          return { status: novoStatus, success: true };
        }

        throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);

      } catch (networkError) {
        // Detecta erros de rede/CORS de forma mais específica
        if (networkError.name === 'TypeError' && 
            (networkError.message.includes('Failed to fetch') || 
             networkError.message.includes('NetworkError') ||
             networkError.message.includes('CORS'))) {
          
          console.warn('[DEBUG] Erro de rede/CORS detectado, aplicando fallback local');
          
          // Fallback: atualiza apenas localmente
          setStatusPedido(novoStatus);
          
          if (onChange) {
            onChange({ ...form, status: novoStatus });
          }
          
          return { status: novoStatus, local: true };
        }
        
        // Re-lança outros tipos de erro
        throw networkError;
      }

    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      
      // Verifica se é um erro de rede conhecido
      if (error.message.includes('Failed to fetch') || 
          error.message.includes('NetworkError') ||
          error.message.includes('CORS') ||
          error.name === 'TypeError') {
        
        console.warn('[DEBUG] Aplicando fallback devido a erro de conectividade');
        
        // Fallback final: atualiza apenas localmente
        setStatusPedido(novoStatus);
        
        if (onChange) {
          onChange({ ...form, status: novoStatus });
        }
        
        return { status: novoStatus, local: true };
      }
      
      // Para outros erros, mostra mensagem e re-lança
      alert(`❌ Erro ao atualizar status do pedido: ${error.message}`);
      throw error;
    }
  };

  // Função para gerar recibo de excesso
  const gerarReciboExcesso = (valorExcesso) => {
    const totalAdiantado = calcularTotalAdiantado();
    const cliente = form.cliente || {};
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date().toLocaleTimeString('pt-BR');
    // Dados da serventia (igual protocolo)
    const s = serventiaInfo || {};
    let serventiaHtml = `
      <div style="text-align:center; margin-bottom:2px;">
        <img src='/brasao-da-republica-do-brasil-logo-png_seeklogo-263322.png' alt='Brasão da República' style='height:28px; margin-bottom:1px;' />
      </div>
      <div><b>${s.nome_completo || ''}</b></div>
      <div>${s.endereco || ''}</div>
      <div>CNPJ: ${s.cnpj || ''}</div>
      <div>Telefone: ${s.telefone || ''}</div>
      <div>Email: ${s.email || ''}</div>
    `;
    const reciboHtml = `
      <html>
        <head>
          <title>Recibo de Devolução por Excesso de Pagamento</title>
          <style>
            @page { size: A4; margin: 1cm; }
            body { font-family: 'Times New Roman', serif; font-size: 10pt; color: black; line-height: 1.2; margin: 0; padding: 0; width: 19cm; height: 13.5cm; box-sizing: border-box; }
            .cabecalho { text-align: center; margin-bottom: 8px; border-bottom: 1.5px solid black; padding-bottom: 6px; }
            .serventia-bloco { text-align: center; margin-bottom: 4px; }
            .titulo-recibo { font-size: 13pt; font-weight: bold; margin: 8px 0 6px 0; text-decoration: underline; }
            .protocolo { font-size: 10pt; font-weight: bold; margin-bottom: 6px; }
            .secao { margin: 7px 0; }
            .linha-info { display: flex; justify-content: space-between; margin: 3px 0; border-bottom: 1px dotted #888; padding-bottom: 1.5px; }
            .label { font-weight: bold; width: 40%; }
            .valor { text-align: right; width: 55%; }
            .destaque-excesso { border: 2px double black; padding: 7px; text-align: center; margin: 10px 0; background-color: #f9f9f9; }
            .valor-excesso { font-size: 15pt; font-weight: bold; margin: 5px 0; }
            .assinatura { margin-top: 12px; display: flex; justify-content: space-between; }
            .campo-assinatura { width: 45%; text-align: center; border-top: 1px solid black; padding-top: 2px; margin-top: 15px; }
            .rodape { margin-top: 10px; font-size: 8pt; text-align: center; border-top: 1px solid black; padding-top: 5px; }
            .observacoes { margin: 7px 0; font-size: 9pt; font-style: italic; }
            @media print { body { margin: 0; padding: 0; } }
          </style>
        </head>
        <body>
          <div class="cabecalho">
            <div class="serventia-bloco">${serventiaHtml}</div>
            <div class="titulo-recibo">RECIBO DE DEVOLUÇÃO POR EXCESSO DE PAGAMENTO</div>
            <div class="protocolo">Protocolo: ${form.protocolo || 'Não informado'}</div>
          </div>
          <div class="secao">
            <div class="linha-info">
              <div class="label">Cliente:</div>
              <div class="valor">${cliente.nome || 'Não informado'}</div>
            </div>
            <div class="linha-info">
              <div class="label">CPF/CNPJ:</div>
              <div class="valor">${cliente.cpf || cliente.cnpj || 'Não informado'}</div>
            </div>
            <div class="linha-info">
              <div class="label">Endereço:</div>
              <div class="valor">${cliente.endereco || 'Não informado'}</div>
            </div>
            <div class="linha-info">
              <div class="label">Telefone:</div>
              <div class="valor">${cliente.telefone || 'Não informado'}</div>
            </div>
          </div>
          <div class="secao">
            <div class="linha-info">
              <div class="label">Data da Operação:</div>
              <div class="valor">${dataAtual}</div>
            </div>
            <div class="linha-info">
              <div class="label">Horário:</div>
              <div class="valor">${horaAtual}</div>
            </div>
          </div>
          <div class="secao">
            <div class="linha-info">
              <div class="label">Valor do Serviço:</div>
              <div class="valor">R$ ${subtotalPedido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="linha-info">
              <div class="label">Valor Total Pago:</div>
              <div class="valor">R$ ${totalAdiantado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div class="destaque-excesso">
            <div style="font-size: 12pt; font-weight: bold; margin-bottom: 5px;">VALOR DEVOLVIDO</div>
            <div class="valor-excesso">R$ ${valorExcesso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style="font-size: 9pt; margin-top: 4px;">(${valorExcesso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace('R$', '').trim()} por extenso)</div>
          </div>
          <div class="observacoes">
            <strong>Observações:</strong><br>
            • Este recibo comprova a devolução do valor pago em excesso pelo cliente.<br>
            • O valor acima foi devolvido conforme procedimentos internos da serventia.<br>
          </div>
          <div class="assinatura">
            <div class="campo-assinatura">
              <div>Assinatura do Cliente</div>
              <div style="font-size: 8pt; margin-top: 2px;">${cliente.nome || '____________________'}</div>
            </div>
            <div class="campo-assinatura">
              <div>Assinatura do Responsável</div>
              <div style="font-size: 8pt; margin-top: 2px;">Serventia</div>
            </div>
          </div>
          <div class="rodape">
            <p>Documento gerado automaticamente pelo sistema em ${dataAtual} às ${horaAtual}</p>
            <p>Este documento possui validade legal e deve ser conservado pelo cliente</p>
          </div>
        </body>
      </html>
    `;

    const novaJanela = window.open('', '_blank', 'width=794,height=550'); // Tamanho aproximado de meia folha A4
    novaJanela.document.write(reciboHtml);
    novaJanela.document.close();
    novaJanela.focus();
    
    // Aguarda o carregamento e imprime automaticamente
    setTimeout(() => {
      novaJanela.print();
    }, 500);
  };

  // Função para lidar com confirmação de pagamento
  const handleConfirmarPagamento = async () => {
    try {
      setProcessando(true);
      const totalAdiantado = calcularTotalAdiantado();
      const excesso = totalAdiantado - valorTotal;
      const usuarioLogado = JSON.parse(localStorage.getItem('usuario') || '{}');
      const usuario = usuarioLogado.nome || usuarioLogado.email || 'Sistema';
      const dataHora = new Date();
      const data = dataHora.toLocaleDateString('pt-BR');
      const hora = dataHora.toLocaleTimeString('pt-BR');

      // Filtra apenas complementos
      const complementos = (valorAdiantadoDetalhes || []).filter(item => item.complemento && item.valor && item.forma);

      // Salvar informações do pagamento na nova tabela pedido_pagamento, incluindo complementos
      try {
        const token = localStorage.getItem('token');
        await fetch(`${config.apiURL}/pedido_pagamento`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            protocolo: form.protocolo,
            valorAtos: parseFloat(valorTotal || 0),
            valorAdicional: parseFloat(valorAdicional || 0),
            totalAdiantado: totalAdiantado,
            usuario: usuario,
            data: data,
            hora: hora,
            complementos: complementos // envia array de complementos
          })
        });
        setPagamentoSalvo(true);
      } catch (e) {
        console.error('Erro ao salvar informações de pagamento:', e);
        alert('❌ Erro ao salvar informações de pagamento. Verifique sua conexão e tente novamente.');
        // Não retorna aqui, pois ainda pode tentar atualizar status
      }

      // Atualiza o status para "Aguardando Execução" no banco de dados
      const resultado = await atualizarStatusPedido('Aguardando Execução');

      // Se há excesso, não gera mais recibo automaticamente. O usuário pode clicar no botão para gerar o recibo.

      if (resultado && resultado.local) {
        alert('✅ Pagamento confirmado com sucesso! \n⚠️ Status atualizado localmente devido a problema de conectividade.');
      } else {
        alert('✅ Pagamento confirmado com sucesso! Status atualizado para "Aguardando Execução".');
      }
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      if (!error.message.includes('local')) {
        alert('❌ Erro ao confirmar pagamento. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setProcessando(false);
    }
  };

  // Função para excluir pagamento
  const handleCancelarPagamento = async () => {
    if (window.confirm('Tem certeza que deseja cancelar este pagamento? O status voltará para "Aguardando Conferência".')) {
      try {
        setProcessando(true);
        console.log('[DEBUG] Iniciando cancelamento de pagamento...');

        // Tenta excluir o pagamento salvo no backend
        try {
          const token = localStorage.getItem('token');
          const url = `${config.apiURL}/pedido_pagamento/${encodeURIComponent(form.protocolo)}`;
          console.log('[Pagamento] Enviando DELETE para:', url);
          const res = await fetch(url, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          console.log('[Pagamento] Status da resposta DELETE:', res.status);
          if (res.ok) {
            console.log('[Pagamento] Pagamento excluído do backend com sucesso.');
            setPagamentoSalvo(false);
            setValorAdicional(0);
            setValorAdicionalInput('');
          } else {
            const text = await res.text();
            console.warn('[Pagamento] Falha ao excluir pagamento do backend:', res.status, text);
          }
        } catch (e) {
          console.error('[Pagamento] Erro ao tentar excluir pagamento do backend:', e);
        }

        // Atualiza o status para "Aguardando Conferência" no banco de dados
        const resultado = await atualizarStatusPedido('Aguardando Pagamento');

        if (resultado && resultado.local) {
          alert('✅ Pagamento cancelado com sucesso! \n⚠️ Status atualizado localmente devido a problema de conectividade.');
        } else {
          alert('✅ Pagamento cancelado com sucesso! Status atualizado para "Aguardando Conferência".');
        }
      } catch (error) {
        console.error('Erro ao cancelar pagamento:', error);
        // Só mostra erro se realmente falhou (não foi fallback)
        if (!error.message.includes('local')) {
          alert('❌ Erro ao cancelar pagamento. Verifique sua conexão e tente novamente.');
        }
      } finally {
        setProcessando(false);
      }
    }
  };

  // Função para lidar com solicitação de complementação
  const handleSolicitarComplementacao = () => {
    const valorAdiantado = calcularTotalAdiantado();
    const valorRestante = valorTotal - valorAdiantado;
    alert(`É necessário complementar R$ ${valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para completar o pagamento.`);
    // Aqui você pode adicionar lógica adicional, como redirecionar para pagamento
  };

  const inputStyle = {
    width: '100%', 
    padding: '12px 16px',
    borderRadius: 8,
    border: '3px solid #b30202ff',
    fontSize: '14px',
    backgroundColor: 'white',
    transition: 'border-color 0.2s ease',
    marginBottom: 16,
    '&:focus': {
      borderColor: '#e53e3e',
      outline: 'none',
      boxShadow: '0 0 0 3px rgba(229,62,62,0.1)'
    }
  };

  const labelStyle = {
    fontWeight: '600', 
    color: '#742a2a',
    fontSize: '14px',
    display: 'block',
    marginBottom: 6
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer'
  };

  return (
    <div
      style={{
        background: '#fef5f5',
        borderRadius: 16,
        padding: 28,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        marginBottom: 24,
        border: '3px solid #8b1a1a'
      }}
    >
      <h3 style={{
        color: '#742a2a',
        fontSize: '20px',
        fontWeight: '700',
        marginBottom: 20,
        borderBottom: '2px solid #e53e3e',
        paddingBottom: 8
      }}>💳 Informações de Pagamento</h3>
      {/* Valor a ser pago (incluindo ISS, igual ServicoEntrada) */}
      <div style={{
        marginBottom: 20,
        textAlign: 'left'
      }}>
        <span style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#742a2a',
          marginRight: 12
        }}>
          Valor dos Atos:
        </span>
        <span style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#e53e3e',
          fontFamily: 'monospace'
        }}>
          {(() => {
            // Replica a lógica do calcularTotalAtosPagos do ServicoEntrada
            const atos = (form.atosPedido || form.atos || []);
            // Se não vier, tenta pegar de combos
            const combos = Array.isArray(form.combos) ? form.combos : [];
            let listaAtos = atos.length > 0 ? atos : combos;
            // Filtro igual ao ServicoEntrada
            listaAtos = listaAtos.filter(ato => ato.codigoTributario === '01' || ato.codigo_tributario === '01');
            let subtotal = 0;
            listaAtos.forEach(ato => {
              const valor = parseFloat(ato.valor_final || ato.valorFinal || 0);
              const issqn = parseFloat(ato.issqn || 0);
              const quantidade = ato.quantidade || 1;
              // ISS: se vier campo issqn e for >0, soma
              let valorFinalAto = valor;
              if (!isNaN(issqn) && issqn > 0) {
                valorFinalAto = valor + issqn;
              }
              subtotal += valorFinalAto * quantidade;
            });
            return `R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          })()}
        </span>
      </div>
      {/* Campo Valor Adicional */}
    <div style={{ 
      padding: '0',
      margin: '0 0 8px 0',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 'bold', color: '#742a2a', marginRight: 12 }} htmlFor="valorAdicionalInput">
            Valor Adicional:
          </label>
          <input
            id="valorAdicionalInput"
            type="text"
            inputMode="decimal"
            placeholder={"Ex. valor cobrado pela CRC, Correios, etc. ..."}
            value={valorAdicionalInput}
            onChange={e => {
              setValorAdicionalInput(e.target.value);
              // Aceita vírgula ou ponto como separador decimal
              let v = e.target.value.replace(/[^\d,\.]/g, '').replace(',', '.');
              // Permite apenas um ponto
              const parts = v.split('.');
              if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
              setValorAdicional(v ? parseFloat(v) : 0);
            }}
            onBlur={e => {
              // Formata como moeda ao perder o foco
              setValorAdicionalInput(
                (valorAdicional === '' || valorAdicional === null)
                  ? ''
                  : parseFloat(valorAdicional).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              );
            }}
            onFocus={e => {
              // Remove máscara ao focar
              setValorAdicionalInput(valorAdicional ? String(valorAdicional).replace('.', ',') : '');
            }}
            style={{
              width: 120,
              padding: '1px 1px',
              borderRadius: 6,
              border: '1px solid #e0b9b9ff',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#e53e3e',
              fontFamily: 'monospace',
              marginLeft: 0,
              textAlign: 'left'
            }}
          />
      </div>
      {/* Subtotal deste pedido */}
      <div style={{ marginBottom: 20, textAlign: 'left' }}>
        <span style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#742a2a',
          marginRight: 12
        }}>
          Subtotal deste pedido:
        </span>
        <span style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#e53e3e',
          fontFamily: 'monospace'
        }}>
          {`R$ ${subtotalPedido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </span>
      </div>
      



      {/* Tabela de Valores Adiantados */}
      {valorAdiantadoDetalhes && valorAdiantadoDetalhes.length > 0 && valorAdiantadoDetalhes.some(item => item.valor && item.forma) && (
        <>
          <div style={{
            marginBottom: 20,
            padding: 16,
            background: '#fff5f5',
            border: '2px solid #feb2b2',
            borderRadius: 8
          }}>
            <h4 style={{
              margin: '0 0 12px 0',
              color: '#742a2a',
              fontSize: '16px',
              fontWeight: '600'
            }}>💰 Valores Adiantados pelo Usuário</h4>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ background: '#fdf2f8' }}>
                  <th style={{
                    padding: '2px 2px 2px 2px',
                    textAlign: 'left',
                    color: '#742a2a',
                    fontWeight: '600',
                    border: '1px solid #feb2b2'
                  }}>
                    Valor
                  </th>
                  <th style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    color: '#742a2a',
                    fontWeight: '600',
                    border: '1px solid #feb2b2'
                  }}>
                    Forma de Pagamento
                  </th>
                </tr>
              </thead>
              <tbody>
                {valorAdiantadoDetalhes
                  .filter(item => item.valor && item.forma)
                  .map((item, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#fef5f5' }}>
                    <td style={{
                      padding: '8px 12px',
                      border: '1px solid #feb2b2',
                      fontFamily: 'monospace',
                      fontWeight: '600',
                      color: '#e53e3e'
                    }}>
                      R$ {parseFloat(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{
                      padding: '8px 12px',
                      border: '1px solid #feb2b2',
                      color: '#742a2a'
                    }}>
                      {item.forma}
                    </td>
                  </tr>
                ))}
                {/* Linha de Total */}
                <tr style={{ background: '#f3d5d5', fontWeight: 'bold' }}>
                  <td style={{
                    padding: '10px 12px',
                    border: '2px solid #e53e3e',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: '#8b1a1a',
                    fontSize: '16px'
                  }}>
                    R$ {calcularTotalAdiantado().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{
                    padding: '10px 12px',
                    border: '2px solid #e53e3e',
                    fontWeight: 'bold',
                    color: '#8b1a1a'
                  }}>
                    TOTAL ADIANTADO
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </>
      )}
      
  {/* Tabela de complementos de pagamento acima do bloco de mensagens */}
  {renderTabelaComplementos()}
  {/* Botão condicional baseado no valor adiantado */}
      {valorAdiantadoDetalhes && valorAdiantadoDetalhes.length > 0 && valorAdiantadoDetalhes.some(item => item.valor && item.forma) && (
        <div style={{
          marginBottom: 20,
          textAlign: 'center'
        }}>
          {(() => {
            const totalAdiantado = calcularTotalAdiantado();
            const valorRestante = subtotalPedido - totalAdiantado;
const excesso = totalAdiantado - subtotalPedido;
            const pagamentoConfirmado = statusPedido === 'Pago';

            if (totalAdiantado >= subtotalPedido) {
              return (
                <div>
                  <div style={{
                    marginBottom: 12,
                    padding: 12,
                    background: pagamentoConfirmado ? '#e8f5e8' : '#e8f5e8',
                    border: `2px solid ${pagamentoConfirmado ? '#38a169' : '#38a169'}`,
                    borderRadius: 8,
                    color: '#2d5016',
                    fontWeight: 'bold'
                  }}>
                    {pagamentoConfirmado ? '✅ Pagamento Confirmado!' : '✅ Valor adiantado suficiente!'} 
                    {excesso > 0 && ` Excesso: R$ ${excesso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {/* Exibe apenas um dos botões: Salvar ou Excluir Pagamento */}
                    {!pagamentoConfirmado && !pagamentoSalvo && (
                      <button
                        type="button"
                        onClick={handleConfirmarPagamento}
                        disabled={processando}
                        style={{
                          padding: '14px 32px',
                          background: processando ? '#a0aec0' : 'linear-gradient(135deg, #38a169 0%, #2f855a 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: '16px',
                          fontWeight: '700',
                          cursor: processando ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 12px rgba(56,161,105,0.3)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => !processando && (e.target.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => !processando && (e.target.style.transform = 'translateY(0px)')}
                      >
                        {processando ? '⏳ Processando...' : '✅ Salvar Pagamento'}
                      </button>
                    )}
                    {!pagamentoConfirmado && pagamentoSalvo && (
                      <button
                        type="button"
                        onClick={handleCancelarPagamento}
                        disabled={processando}
                        style={{
                          padding: '14px 32px',
                          background: processando ? '#a0aec0' : 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: '16px',
                          fontWeight: '700',
                          cursor: processando ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 12px rgba(229,62,62,0.3)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => !processando && (e.target.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => !processando && (e.target.style.transform = 'translateY(0px)')}
                      >
                        {processando ? '⏳ Processando...' : '❌ Excluir Pagamento'}
                      </button>
                    )}
                    {pagamentoConfirmado && (
                      <button
                        type="button"
                        onClick={handleCancelarPagamento}
                        disabled={processando}
                        style={{
                          padding: '14px 32px',
                          background: processando ? '#a0aec0' : 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: '16px',
                          fontWeight: '700',
                          cursor: processando ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 12px rgba(229,62,62,0.3)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => !processando && (e.target.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => !processando && (e.target.style.transform = 'translateY(0px)')}
                      >
                        {processando ? '⏳ Processando...' : '❌ Cancelar Pagamento'}
                      </button>
                    )}
                    {/* Botão para gerar recibo do excesso - sempre visível quando há excesso */}
                    {excesso > 0 && (
                      <button
                        type="button"
                        onClick={() => gerarReciboExcesso(excesso)}
                        style={{
                          padding: '14px 32px',
                          background: 'linear-gradient(135deg, #3182ce 0%, #2c5282 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: '16px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(49,130,206,0.3)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.target.style.transform = 'translateY(0px)'}
                      >
                        📄 Gerar Recibo do Troco
                      </button>
                    )}
                  </div>
                </div>
              );
            } else {
              return (
                <div>
                  <div style={{
                    marginBottom: 12,
                    padding: 12,
                    background: '#fff5f5',
                    border: '2px solid #e53e3e',
                    borderRadius: 8,
                    color: '#8b1a1a',
                    fontWeight: 'bold'
                  }}>
                    ⚠️ Valor insuficiente! Falta: R$ {valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {/* Botão Salvar Pagamento sempre visível quando não confirmado */}
                  {!pagamentoConfirmado && (
                    <>
                      <button
                        type="button"
                        onClick={handleConfirmarPagamento}
                        disabled={processando}
                        style={{
                          padding: '14px 32px',
                          background: processando ? '#a0aec0' : 'linear-gradient(135deg, #38a169 0%, #2f855a 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: '16px',
                          fontWeight: '700',
                          cursor: processando ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 12px rgba(56,161,105,0.3)',
                          transition: 'all 0.2s ease',
                          marginRight: 8
                        }}
                        onMouseEnter={e => !processando && (e.target.style.transform = 'translateY(-2px)')}
                        onMouseLeave={e => !processando && (e.target.style.transform = 'translateY(0px)')}
                      >
                        {processando ? '⏳ Processando...' : '✅ Salvar Pagamento'}
                      </button>
                      <button
                        type="button"
                        onClick={abrirComplementoModal}
                        style={{
                          padding: '14px 32px',
                          background: 'linear-gradient(135deg, #f6ad55 0%, #dd6b20 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: '16px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(237,137,54,0.3)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.target.style.transform = 'translateY(0px)'}
                      >
                        ➕ Adicionar Complemento
                      </button>
                    </>
                  )}
                  {/* Modal de complemento de pagamento */}
                  {showComplementoModal && !pagamentoConfirmado && (
                    <div style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      width: '100vw',
                      height: '100vh',
                      background: 'rgba(0,0,0,0.25)',
                      zIndex: 9999,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        background: '#fffbe5',
                        border: '2px solid #f6ad55',
                        borderRadius: 12,
                        padding: 32,
                        minWidth: 320,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.18)'
                      }}>
                        <h3 style={{ color: '#b7791f', marginBottom: 18, textAlign: 'center' }}>Adicionar Complemento</h3>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18, justifyContent: 'center' }}>
                          <select value={modalFormaComplemento} onChange={e => setModalFormaComplemento(e.target.value)} style={{ padding: '10px', borderRadius: 6, border: '1.5px solid #f6ad55', fontSize: '16px', minWidth: 140 }}>
                            <option value="">Selecione a forma</option>
                            <option value="Dinheiro">Dinheiro</option>
                            <option value="Cartão de Débito">Cartão de Débito</option>
                            <option value="Cartão de Crédito">Cartão de Crédito</option>
                            <option value="PIX">PIX</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={modalValorComplemento}
                            onChange={e => setModalValorComplemento(e.target.value)}
                            placeholder="Valor"
                            style={{ padding: '10px', borderRadius: 6, border: '1.5px solid #f6ad55', fontSize: '16px', width: 120 }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={handleAdicionarComplementoModal}
                            style={{ padding: '10px 28px', background: 'linear-gradient(135deg, #38a169 0%, #2f855a 100%)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                          >Adicionar</button>
                          <button
                            type="button"
                            onClick={fecharComplementoModal}
                            style={{ padding: '10px 28px', background: 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                          >Cancelar</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
          })()}
        </div>
      )}
      
      {form.pagamento.status === 'pago' && (
        <div style={{ 
          marginTop: 20, 
          padding: 16,
          background: 'linear-gradient(135deg, #c53030 0%, #9b2c2c 100%)',
          color: '#fff',
          borderRadius: 8,
          fontWeight: '600',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(197,48,48,0.3)'
        }}>
          ✅ Recibo digital gerado para protocolo {form.protocolo}
        </div>
      )}
      
      {/* Cálculo do valor pendente */}
      {form.pagamento.valorTotal && form.pagamento.valorPago && (
        <div style={{
          marginTop: 20,
          padding: 16,
          background: '#fff5f5',
          border: '1px solid #feb2b2',
          borderRadius: 8
        }}>
          <div style={{ 
            fontSize: '14px', 
            color: '#742a2a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span><strong>Valor Total:</strong></span>
            <span style={{ fontWeight: 'bold' }}>R$ {parseFloat(form.pagamento.valorTotal || 0).toFixed(2)}</span>
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: '#742a2a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8
          }}>
            <span><strong>Valor Pago:</strong></span>
            <span style={{ fontWeight: 'bold' }}>R$ {parseFloat(form.pagamento.valorPago || 0).toFixed(2)}</span>
          </div>
          <hr style={{ margin: '12px 0', border: '1px solid #feb2b2' }} />
          <div style={{ 
            fontSize: '16px', 
            color: '#742a2a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 'bold'
          }}>
            <span>Valor Pendente:</span>
            <span style={{ 
              color: parseFloat(form.pagamento.valorTotal || 0) - parseFloat(form.pagamento.valorPago || 0) <= 0 ? '#38a169' : '#e53e3e'
            }}>
              R$ {(parseFloat(form.pagamento.valorTotal || 0) - parseFloat(form.pagamento.valorPago || 0)).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}