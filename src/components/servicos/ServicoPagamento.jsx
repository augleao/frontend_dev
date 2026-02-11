
import React, { useState, useMemo } from 'react';
import config from '../../config';
import './servicos.css';
import '../../buttonGradients.css';

const palette = {
  primary: '#1d4ed8',
  primaryDark: '#1e3a8a',
  softBg: '#eef5ff',
  softBorder: '#d6e4ff',
  text: '#0f172a'
};


const statusPagamento = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Pago' }
];

export default function ServicoPagamento({ form, onChange, valorTotal = 0, valorAdiantadoDetalhes: valorAdiantadoDetalhesProp = [], onAvancarEtapa, onVoltarEtapa }) {
  console.debug('[DEBUG-RECIBO] COMPONENTE RENDERIZADO. Props recebidas:');
  console.debug('[DEBUG-RECIBO] - form.protocolo:', form.protocolo);
  console.debug('[DEBUG-RECIBO] - valorTotal:', valorTotal);
  console.debug('[DEBUG-RECIBO] - valorAdiantadoDetalhesProp:', valorAdiantadoDetalhesProp);
  
  // Estado para valor adicional (deve vir antes do useMemo)
  const [valorAdicional, setValorAdicional] = useState(0);
  const [valorAdicionalInput, setValorAdicionalInput] = useState('');

  // Estado local para valorAdiantadoDetalhes
  const [valorAdiantadoDetalhes, setValorAdiantadoDetalhes] = useState(valorAdiantadoDetalhesProp);
  React.useEffect(() => {
    // Atualiza sempre que o prop mudar, independente do pagamento salvo
    setValorAdiantadoDetalhes(valorAdiantadoDetalhesProp || []);
  }, [valorAdiantadoDetalhesProp]);

  // Calcular subtotalPedido antes de qualquer uso
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

  // Estado para tabela de edição da distribuição final
  const [pagamentoFinal, setPagamentoFinal] = useState([]);
  // Inicializa tabela de pagamento final ao montar ou ao mudar valores adiantados
  React.useEffect(() => {
    // Garante que subtotalPedido está definido e é número
    // Inicializa se não há dados na tabela de pagamento final
    if (pagamentoFinal.length === 0 && typeof subtotalPedido === 'number' && !isNaN(subtotalPedido)) {
      if (valorAdiantadoDetalhes.length > 0) {
        setPagamentoFinal([
          {
            valor: subtotalPedido,
            forma: valorAdiantadoDetalhes[0].forma || ''
          }
        ]);
      } else {
        setPagamentoFinal([
          {
            valor: subtotalPedido,
            forma: ''
          }
        ]);
      }
    }
  }, [valorAdiantadoDetalhes, subtotalPedido]);

  // Editar valor/forma de pagamento final
  const handleEditPagamentoFinal = (idx, field, value) => {
    setPagamentoFinal(pagamentoFinal => pagamentoFinal.map((item, i) => i === idx ? { ...item, [field]: field === 'valor' ? value.replace(',', '.') : value } : item));
  };
  // Remover linha da tabela de pagamento final
  const handleRemoverPagamentoFinal = (idx) => {
    setPagamentoFinal(pagamentoFinal => pagamentoFinal.filter((_, i) => i !== idx));
  };
  // Adicionar nova linha de pagamento final
  const handleAdicionarPagamentoFinal = () => {
    setPagamentoFinal(pagamentoFinal => [...pagamentoFinal, { valor: '', forma: '' }]);
  };
  // Salvar pagamento final no backend
  const handleSalvarPagamentoFinal = async () => {
    try {
      console.log('[FRONTEND][LOG] handleSalvarPagamentoFinal chamado');
      setProcessando(true);
      console.log('[FRONTEND][LOG] setProcessando(true) executado');
      // Verifica se pagamentoFinal está definido
      if (!pagamentoFinal) {
        console.warn('[FRONTEND][LOG] pagamentoFinal está undefined ou null');
      } else {
        console.log('[FRONTEND][LOG] pagamentoFinal existe, length:', pagamentoFinal.length);
      }
      // Filtra apenas linhas válidas
      const valoresPagos = pagamentoFinal ? pagamentoFinal.filter(item => item.valor && item.forma) : [];
      console.log('[FRONTEND][LOG] valoresPagos calculado, length:', valoresPagos.length);
      // Log para depuração do formato enviado
      console.log('[FRONTEND] pagamentoFinal:', pagamentoFinal);
      console.log('[FRONTEND] valoresPagos (detalhes_pagamento):', valoresPagos);
      const usuarioLogado = JSON.parse(localStorage.getItem('usuario') || '{}');
      const usuario = usuarioLogado.nome || usuarioLogado.email || 'Sistema';
      const dataHora = new Date();
      const data = dataHora.toLocaleDateString('pt-BR');
      const hora = dataHora.toLocaleTimeString('pt-BR');
      // Salvar informações do pagamento final no backend
      try {
        const token = localStorage.getItem('token');
        // Log do valor enviado para o backend
        console.log('[FRONTEND] detalhes_pagamento enviado:', valoresPagos);
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
            totalAdiantado: calcularTotalAdiantado(),
            usuario: usuario,
            data: data,
            hora: hora,
            detalhes_pagamento: Array.isArray(valoresPagos) ? valoresPagos : [] // envia array editado
          })
        });
        setPagamentoSalvo(true);
        // Atualiza status para 'Aguardando Execução'
        await atualizarStatusPedido('Aguardando Execução');
        // Avança automaticamente para a etapa de execução
        if (typeof onAvancarEtapa === 'function') {
          onAvancarEtapa('execucao');
        }
      } catch (e) {
        console.error('Erro ao salvar informações de pagamento:', e);
        alert('❌ Erro ao salvar informações de pagamento. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setProcessando(false);
    }
  };

  // Modal de conferência/edição dos valores adiantados
  const [showEditarValoresModal, setShowEditarValoresModal] = useState(false);
  const [editValores, setEditValores] = useState([]);

  // Abrir modal de edição
  const abrirEditarValoresModal = () => {
    setEditValores(valorAdiantadoDetalhes.map(item => ({ ...item })));
    setShowEditarValoresModal(true);
  };
  // Fechar modal de edição
  const fecharEditarValoresModal = () => {
    setShowEditarValoresModal(false);
    setEditValores([]);
  };
  // Atualizar valor/forma de pagamento editado
  const handleEditValorChange = (idx, field, value) => {
    setEditValores(editValores => editValores.map((item, i) => i === idx ? { ...item, [field]: field === 'valor' ? value.replace(',', '.') : value } : item));
  };
  // Remover linha
  const handleRemoverEditValor = (idx) => {
    setEditValores(editValores => editValores.filter((_, i) => i !== idx));
  };
  // Confirmar edição
  const handleConfirmarEditarValores = () => {
    // Filtra apenas valores válidos
    const novosDetalhes = editValores.filter(item => item.valor && item.forma);
    setValorAdiantadoDetalhes(novosDetalhes);
    if (onChange) {
      onChange({ ...form, valorAdiantadoDetalhes: novosDetalhes });
    }
    fecharEditarValoresModal();
  };
  // Tabela de complementos de pagamento (renderização gradual)
  const renderTabelaComplementos = () => {
    const complementos = valorAdiantadoDetalhes.filter(item => item.complemento && item.valor && item.forma);
    if (complementos.length === 0) return null;
    return (
      <div style={{
        marginBottom: 20,
        padding: 16,
        background: palette.softBg,
        border: `2px solid ${palette.softBorder}`,
        borderRadius: 8
      }}>
        <h4 style={{
          margin: '0 0 12px 0',
          color: palette.primary,
          fontSize: '16px',
          fontWeight: '600'
        }}>➕ Complementos de Pagamento</h4>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px'
        }}>
          <thead>
            <tr style={{ background: palette.softBg }}>
              <th style={{
                padding: '2px 2px 2px 2px',
                textAlign: 'left',
                color: palette.primary,
                fontWeight: '600',
                border: `1px solid ${palette.softBorder}`
              }}>Valor</th>
              <th style={{
                padding: '8px 12px',
                textAlign: 'left',
                color: palette.primary,
                fontWeight: '600',
                border: `1px solid ${palette.softBorder}`
              }}>Forma de Pagamento</th>
            </tr>
          </thead>
          <tbody>
            {complementos.map((item, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : palette.softBg }}>
                <td style={{
                  padding: '8px 12px',
                  border: `1px solid ${palette.softBorder}`,
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  color: palette.text
                }}>
                  R$ {parseFloat(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{
                  padding: '8px 12px',
                  border: `1px solid ${palette.softBorder}`,
                  color: palette.text
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
  // ...existing code...
  // Estado para saber se já existe pagamento salvo
  const [pagamentoSalvo, setPagamentoSalvo] = useState(false);
// ...existing code...
  // Buscar pagamento salvo ao montar
  React.useEffect(() => {
    // Loga sempre que o protocolo mudar
    console.debug('[DEBUG-RECIBO] useEffect fetchPagamentoSalvo executado. Protocolo:', form.protocolo);
    if (!form.protocolo) {
      console.debug('[DEBUG-RECIBO] Sem protocolo, setPagamentoSalvo(false)');
      setPagamentoSalvo(false);
      return;
    }
    async function fetchPagamentoSalvo() {
      try {
        const token = localStorage.getItem('token');
        const url = `${config.apiURL}/pedido_pagamento/${encodeURIComponent(form.protocolo)}`;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          console.debug('[DEBUG-RECIBO] Dados recebidos do backend:', data);
          if (data && data.id) {
            console.debug('[DEBUG-RECIBO] Pagamento encontrado, setPagamentoSalvo(true)');
            setPagamentoSalvo(true);
          } else {
            console.debug('[DEBUG-RECIBO] Nenhum pagamento encontrado, setPagamentoSalvo(false)');
            setPagamentoSalvo(false);
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
          // Carrega valores adiantados do backend, se existirem
          let detalhesBackend = [];
          // Preferencialmente busca por complementos_pagamento (backend padronizado), senão detalhes_pagamento
          if (Array.isArray(data.complementos_pagamento)) {
            detalhesBackend = data.complementos_pagamento;
          } else if (typeof data.complementos_pagamento === 'string') {
            try {
              detalhesBackend = JSON.parse(data.complementos_pagamento);
            } catch {
              detalhesBackend = [];
            }
          } else if (Array.isArray(data.detalhes_pagamento)) {
            detalhesBackend = data.detalhes_pagamento;
          } else if (typeof data.detalhes_pagamento === 'string') {
            try {
              detalhesBackend = JSON.parse(data.detalhes_pagamento);
            } catch {
              detalhesBackend = [];
            }
          }
          console.debug('[DEBUG-RECIBO] detalhesBackend processados:', detalhesBackend);
          
          // CORREÇÃO: NÃO sobrescrever valorAdiantadoDetalhes com dados do backend
          // Os valores adiantados originais devem ser preservados para calcular o excesso corretamente
          // O backend retorna os dados da "distribuição final" que não são os mesmos que os "valores adiantados"
          console.debug('[DEBUG-RECIBO] Preservando valorAdiantadoDetalhes originais para manter cálculo de excesso');

          // NOVO: Atualiza pagamentoFinal com os dados salvos do backend
          // Atualiza pagamentoFinal sempre que há dados do backend
          if (Array.isArray(detalhesBackend) && detalhesBackend.length > 0) {
            console.debug('[DEBUG-RECIBO] Atualizando pagamentoFinal com detalhesBackend');
            setPagamentoFinal(
              detalhesBackend.map(item => ({
                valor: item.valor,
                forma: item.forma || '',
                complemento: item.complemento || false
              }))
            );
          }
        } else {
          setPagamentoSalvo(false);
        }
      } catch (e) {
        setPagamentoSalvo(false);
      }
    }
    fetchPagamentoSalvo();
  }, [form.protocolo]);

  // Função para calcular o total adiantado
  const calcularTotalAdiantado = () => {
    const detalhesValidos = (valorAdiantadoDetalhes || []).filter(item => {
      const valor = parseFloat(item?.valor ?? item?.valor_pago ?? 0);
      return !isNaN(valor) && valor !== 0;
    });
    const total = detalhesValidos.reduce((acc, item) => {
      const valor = parseFloat(item?.valor ?? item?.valor_pago ?? 0);
      return acc + (isNaN(valor) ? 0 : valor);
    }, 0);
    console.debug('[DEBUG-RECIBO] calcularTotalAdiantado - valorAdiantadoDetalhes:', valorAdiantadoDetalhes);
    console.debug('[DEBUG-RECIBO] calcularTotalAdiantado - detalhesValidos:', detalhesValidos);
    console.debug('[DEBUG-RECIBO] calcularTotalAdiantado - total:', total);
    return total;
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
      
      console.debug(`[DEBUG] Tentando atualizar status para: ${novoStatus}`);
      
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
          
          console.debug('[DEBUG] Status atualizado com sucesso via POST status');
          return { status: novoStatus, success: true };
        }

        throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);

      } catch (networkError) {
        // Detecta erros de rede/CORS de forma mais específica
        if (networkError.name === 'TypeError' && 
            (networkError.message.includes('Failed to fetch') || 
             networkError.message.includes('NetworkError') ||
             networkError.message.includes('CORS'))) {
          
          console.debug('[DEBUG] Erro de rede/CORS detectado, aplicando fallback local');
          
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
        
        console.debug('[DEBUG] Aplicando fallback devido a erro de conectividade');
        
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
            .destaque-excesso { border: 2px double black; padding: 7px; text-align: center; margin: 10px 0; background-color: #eef5ff; }
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
      } else {}
      // Avança para o componente ServicoExecucao.jsx via prop
      if (typeof onAvancarEtapa === 'function') {
        onAvancarEtapa('execucao');
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
        console.debug('[DEBUG] Iniciando cancelamento de pagamento...');

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
          alert('✅ Pagamento cancelado com sucesso! Status atualizado para "Aguardando Pagamento.".');
        }
        // Volta para o componente ServicoConferencia.jsx via prop
        if (typeof onVoltarEtapa === 'function') {
          onVoltarEtapa();
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
    border: `2px solid ${palette.softBorder}`,
    fontSize: '14px',
    backgroundColor: 'white',
    transition: 'border-color 0.2s ease',
    marginBottom: 16
  };

  const labelStyle = {
    fontWeight: '600', 
    color: palette.primaryDark,
    fontSize: '14px',
    display: 'block',
    marginBottom: 6
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer'
  };

  return (
    <div className="servico-section" style={{ background: palette.softBg, border: `1px solid ${palette.softBorder}` }}>
      <div className="servico-header">
        <h3 className="servico-title" style={{ color: palette.primaryDark }}>💳 Informações de Pagamento</h3>
      </div>
      {/* Valor a ser pago (incluindo ISS, igual ServicoEntrada) */}
      <div style={{
        marginBottom: 20,
        textAlign: 'left'
      }}>
        <span style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: palette.primaryDark,
          marginRight: 12
        }}>
          Valor dos Atos:
        </span>
        <span style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: palette.primary,
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
          <label style={{ fontWeight: 'bold', color: palette.primaryDark, marginRight: 12 }} htmlFor="valorAdicionalInput">
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
              border: `1px solid ${palette.softBorder}`,
              fontSize: '16px',
              fontWeight: 'bold',
              color: palette.primary,
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
          color: palette.primaryDark,
          marginRight: 12
        }}>
          Subtotal deste pedido:
        </span>
        <span style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: palette.primary,
          fontFamily: 'monospace'
        }}>
          {`R$ ${subtotalPedido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </span>
      </div>
      



      {/* Tabela de Valores Adiantados (não editável) */}
      {Array.isArray(valorAdiantadoDetalhes) && valorAdiantadoDetalhes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="servico-table-container">
          <h4 style={{
            margin: '0 0 12px 0',
            color: palette.primaryDark,
            fontSize: '16px',
            fontWeight: '600'
          }}>💰 Valores Adiantados pelo Usuário</h4>
          <table className="servico-table">
            <thead>
              <tr style={{ background: palette.softBg }}>
                <th style={{
                  padding: '2px 2px 2px 2px',
                  textAlign: 'left',
                  color: palette.primaryDark,
                  fontWeight: '600',
                  border: `1px solid ${palette.softBorder}`
                }}>
                  Valor
                </th>
                <th style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  color: palette.primaryDark,
                  fontWeight: '600',
                  border: `1px solid ${palette.softBorder}`
                }}>
                  Forma de Pagamento
                </th>
              </tr>
            </thead>
            <tbody>
              {valorAdiantadoDetalhes.map((item, idx) => {
                const valorNumero = parseFloat(item.valor || item.valor_pago || 0) || 0;
                const forma = item.forma || item.meio || item.metodo || '—';
                return (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : palette.softBg }}>
                    <td style={{
                      padding: '8px 12px',
                      border: `1px solid ${palette.softBorder}`,
                      fontFamily: 'monospace',
                      fontWeight: '600',
                      color: palette.primary
                    }}>
                      R$ {valorNumero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{
                      padding: '8px 12px',
                      border: `1px solid ${palette.softBorder}`,
                      color: palette.primaryDark
                    }}>
                      {forma}
                    </td>
                  </tr>
                );
              })}
              {/* Linha de Total */}
              <tr style={{ background: palette.softBg, fontWeight: 'bold' }}>
                <td style={{
                  padding: '10px 12px',
                  border: `2px solid ${palette.primary}`,
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  color: palette.primaryDark,
                  fontSize: '16px'
                }}>
                  R$ {calcularTotalAdiantado().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{
                  padding: '10px 12px',
                  border: `2px solid ${palette.primary}`,
                  fontWeight: 'bold',
                  color: palette.primaryDark
                }}>
                  TOTAL ADIANTADO
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Tabela de edição da distribuição final entre formas de pagamento */}
      <div style={{ marginBottom: 24 }}>
        <div className="servico-table-container">
        <h4 style={{
          margin: '0 0 12px 0',
          color: palette.primaryDark,
          fontSize: '16px',
          fontWeight: '600'
        }}>📝 Distribuição Final do Pagamento</h4>
        <table className="servico-table" style={{ fontSize: '15px', marginBottom: 18 }}>
          <thead>
            <tr style={{ background: palette.softBg }}>
              <th style={{ padding: '8px', border: `1px solid ${palette.softBorder}`, color: palette.primaryDark }}>Valor</th>
              <th style={{ padding: '8px', border: `1px solid ${palette.softBorder}`, color: palette.primaryDark }}>Forma</th>
              <th style={{ padding: '8px', border: `1px solid ${palette.softBorder}`, color: palette.primaryDark }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pagamentoFinal.map((item, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : palette.softBg }}>
                <td style={{ padding: '8px', border: `1px solid ${palette.softBorder}` }}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.valor}
                    onChange={e => handleEditPagamentoFinal(idx, 'valor', e.target.value)}
                    style={{ width: 90, padding: '4px', borderRadius: 4, border: `1px solid ${palette.softBorder}`, fontSize: '15px' }}
                  />
                </td>
                <td style={{ padding: '8px', border: `1px solid ${palette.softBorder}` }}>
                  <select value={item.forma} onChange={e => handleEditPagamentoFinal(idx, 'forma', e.target.value)} style={{ width: 140, padding: '4px', borderRadius: 4, border: `1px solid ${palette.softBorder}`, fontSize: '15px' }}>
                    <option value="">Selecione</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="CRC">CRC</option>
                    <option value="Depósito Prévio">Depósito Prévio</option>
                  </select>
                </td>
                <td style={{ padding: '8px', border: `1px solid ${palette.softBorder}`, textAlign: 'center' }}>
                  <button type="button" onClick={() => handleRemoverPagamentoFinal(idx)} className="btn-gradient btn-gradient-red btn-compact" style={{ padding: '4px 10px', fontWeight: 'bold' }}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="servico-actions">
          <button type="button" onClick={handleAdicionarPagamentoFinal} className="btn-gradient btn-gradient-blue btn-compact">Adicionar Forma</button>
        </div>
      </div>

      {/* Tabela de complementos de pagamento */}
      {renderTabelaComplementos()}

      {/* Seção simplificada de botões de pagamento */}
      {Array.isArray(valorAdiantadoDetalhes) && (
        <div style={{
          marginBottom: 20,
          textAlign: 'center'
        }}>
          {(() => {
            const totalAdiantado = calcularTotalAdiantado();
            const totalDistribuido = pagamentoFinal.reduce((acc, item) => {
              const valor = parseFloat(item.valor || 0);
              return acc + (isNaN(valor) ? 0 : valor);
            }, 0);
            // Usa qualquer uma das fontes (adiantado ou distribuição) para liberar o salvamento
            const totalParaPagamento = Math.max(totalAdiantado, totalDistribuido);
            const valorRestante = subtotalPedido - totalParaPagamento;
            const excesso = totalParaPagamento - subtotalPedido;
            const pagamentoConfirmado = statusPedido === 'Pago';
            
            console.log('[DEBUG-RECIBO] Renderização dos botões:');
            console.log('[DEBUG-RECIBO] - subtotalPedido:', subtotalPedido);
            console.log('[DEBUG-RECIBO] - totalAdiantado:', totalAdiantado);
            console.log('[DEBUG-RECIBO] - totalDistribuido:', totalDistribuido);
            console.log('[DEBUG-RECIBO] - totalParaPagamento:', totalParaPagamento);
            console.log('[DEBUG-RECIBO] - excesso:', excesso);
            console.log('[DEBUG-RECIBO] - pagamentoSalvo:', pagamentoSalvo);
            console.log('[DEBUG-RECIBO] - valorAdiantadoDetalhes.length:', valorAdiantadoDetalhes.length);
            console.log('[DEBUG-RECIBO] - Condição excesso > 0:', excesso > 0);

            // Status do pagamento - simplificado para focar na funcionalidade
            let statusMessage = '';
            let statusStyle = {};
            
            if (pagamentoSalvo) {
              statusMessage = '✅ Pagamento salvo com sucesso!';
              statusStyle = { background: palette.softBg, border: `2px solid ${palette.softBorder}`, color: palette.primaryDark };
            } else if (totalParaPagamento >= subtotalPedido) {
              statusMessage = '✅ Valor disponível suficiente para pagamento!';
              statusStyle = { background: palette.softBg, border: `2px solid ${palette.softBorder}`, color: palette.primaryDark };
            } else {
              statusMessage = `⚠️ Valor insuficiente para pagamento. Restam: R$ ${valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              statusStyle = { background: palette.softBg, border: `2px solid ${palette.softBorder}`, color: palette.primary };
            }

            return (
              <div>
                {/* Status do pagamento */}
                <div style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 8,
                  fontWeight: 'bold',
                  ...statusStyle
                }}>
                  {statusMessage}
                  {excesso > 0 && ` Excesso: R$ ${excesso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>

                {/* Botões de ação */}
                <div className="servico-actions">
                  {/* Botão Salvar Pagamento - só aparece se não foi salvo e valor é suficiente */}
                  {!pagamentoSalvo && totalParaPagamento >= subtotalPedido && (
                    <button
                      type="button"
                      onClick={() => {
                        console.log('[FRONTEND][LOG] Clique no botão Salvar Pagamento');
                        handleSalvarPagamentoFinal();
                      }}
                      disabled={processando}
                      className="btn-gradient btn-gradient-green"
                    >
                      {processando ? '⏳ Salvando...' : '💾 Salvar Pagamento'}
                    </button>
                  )}

                  {/* Botão Excluir/Cancelar Pagamento - aparece se foi salvo */}
                  {pagamentoSalvo && (
                    <button type="button" onClick={handleCancelarPagamento} disabled={processando} className="btn-gradient btn-gradient-red">
                      {processando ? '⏳ Processando...' : '❌ Excluir Pagamento'}
                    </button>
                  )}

                  {/* Botão Adicionar Complemento - aparece se valor é insuficiente e não foi salvo */}
                  {!pagamentoSalvo && totalAdiantado < subtotalPedido && (
                    <button type="button" onClick={abrirComplementoModal} className="btn-gradient btn-gradient-orange">➕ Adicionar Complemento</button>
                  )}

                  {/* Botão Gerar Recibo do Troco - SEMPRE VISÍVEL quando há excesso */}
                  {excesso > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        console.log('[FRONTEND][LOG] Gerando recibo do troco para excesso de:', excesso);
                        gerarReciboExcesso(excesso);
                      }}
                      className="btn-gradient btn-gradient-blue"
                    >
                      📄 Gerar Recibo do Troco
                    </button>
                  ) : (
                    console.log('[DEBUG-RECIBO] Botão do troco NÃO renderizado. Excesso:', excesso, 'Condição excesso > 0:', excesso > 0)
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal de complemento de pagamento */}
      {showComplementoModal && (
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
          <div className="servico-section" style={{ minWidth: 320 }}>
            <h3 style={{ color: palette.primary, marginBottom: 18, textAlign: 'center' }}>Adicionar Complemento</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18, justifyContent: 'center' }}>
              <select value={modalFormaComplemento} onChange={e => setModalFormaComplemento(e.target.value)} style={{ padding: '10px', borderRadius: 6, border: `1.5px solid ${palette.softBorder}`, fontSize: '16px', minWidth: 140 }}>
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
                style={{ padding: '10px', borderRadius: 6, border: `1.5px solid ${palette.softBorder}`, fontSize: '16px', width: 120 }}
              />
            </div>
            <div className="servico-actions">
              <button type="button" onClick={handleAdicionarComplementoModal} className="btn-gradient btn-gradient-blue">Adicionar</button>
              <button type="button" onClick={fecharComplementoModal} className="btn-muted">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      
      {form.pagamento.status === 'pago' && (
        <div style={{ 
          marginTop: 20, 
          padding: 16,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #0b2f6a 100%)',
          color: '#fff',
          borderRadius: 8,
          fontWeight: '600',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(30,62,138,0.35)'
        }}>
          ✅ Recibo digital gerado para protocolo {form.protocolo}
        </div>
      )}
      
      {/* Cálculo do valor pendente */}
      {form.pagamento.valorTotal && form.pagamento.valorPago && (
        <div style={{
          marginTop: 20,
          padding: 16,
          background: palette.softBg,
          border: `1px solid ${palette.softBorder}`,
          borderRadius: 8
        }}>
          <div style={{ 
            fontSize: '14px', 
            color: palette.primaryDark,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span><strong>Valor Total:</strong></span>
            <span style={{ fontWeight: 'bold' }}>R$ {parseFloat(form.pagamento.valorTotal || 0).toFixed(2)}</span>
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: palette.primaryDark,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8
          }}>
            <span><strong>Valor Pago:</strong></span>
            <span style={{ fontWeight: 'bold' }}>R$ {parseFloat(form.pagamento.valorPago || 0).toFixed(2)}</span>
          </div>
          <hr style={{ margin: '12px 0', border: `1px solid ${palette.softBorder}` }} />
          <div style={{ 
            fontSize: '16px', 
            color: palette.primaryDark,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 'bold'
          }}>
            <span>Valor Pendente:</span>
            <span style={{ 
              color: parseFloat(form.pagamento.valorTotal || 0) - parseFloat(form.pagamento.valorPago || 0) <= 0 ? palette.primaryDark : palette.primary
            }}>
              R$ {(parseFloat(form.pagamento.valorTotal || 0) - parseFloat(form.pagamento.valorPago || 0)).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}