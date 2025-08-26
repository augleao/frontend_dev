import React, { useState } from 'react';
import config from '../../config';

const statusPagamento = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Pago' }
];

export default function ServicoPagamento({ form, onChange, valorTotal = 0, valorAdiantadoDetalhes = [] }) {
  const [serventiaInfo, setServentiaInfo] = useState(null);
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
            usuario: usuario,
            valorAdicional: valorAdicional
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
              <div class="valor">R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
      
      console.log('[DEBUG] Iniciando confirmação de pagamento...');
      
      // Atualiza o status para "Aguardando Execução" no banco de dados
      const resultado = await atualizarStatusPedido('Aguardando Execução');
      
      // Se há excesso, gera automaticamente o recibo
      if (excesso > 0) {
        gerarReciboExcesso(excesso);
      }
      
      if (resultado && resultado.local) {
        alert('✅ Pagamento confirmado com sucesso! \n⚠️ Status atualizado localmente devido a problema de conectividade.');
      } else {
        alert('✅ Pagamento confirmado com sucesso! Status atualizado para "Aguardando Execução".');
      }
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      
      // Só mostra erro se realmente falhou (não foi fallback)
      if (!error.message.includes('local')) {
        alert('❌ Erro ao confirmar pagamento. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setProcessando(false);
    }
  };

  // Função para cancelar pagamento
  const handleCancelarPagamento = async () => {
    if (window.confirm('Tem certeza que deseja cancelar este pagamento? O status voltará para "Conferido".')) {
      try {
        setProcessando(true);
        
        console.log('[DEBUG] Iniciando cancelamento de pagamento...');
        
        // Atualiza o status para "Conferido" no banco de dados
        const resultado = await atualizarStatusPedido('Conferido');
        
        if (resultado && resultado.local) {
          alert('✅ Pagamento cancelado com sucesso! \n⚠️ Status atualizado localmente devido a problema de conectividade.');
        } else {
          alert('✅ Pagamento cancelado com sucesso! Status atualizado para "Conferido".');
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
      {/* Valor a ser pago */}
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
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#e53e3e',
          fontFamily: 'monospace'
        }}>
          R$ {parseFloat(valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      {/* Campo Valor Adicional */}
      <div style={{ 
          padding: '8px 12px',
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
              padding: '8px 12px',
              borderRadius: 6,
              border: '2px solid #e53e3e',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#e53e3e',
              fontFamily: 'monospace',
              marginLeft: 8,
              textAlign: 'left'
            }}
          />
      </div>
      {/* Subtotal deste pedido */}
      <div style={{ marginBottom: 20, textAlign: 'left' }}>
        <span style={{
          fontSize: '15px',
          fontWeight: 'bold',
          color: '#742a2a',
          marginRight: 12
        }}>
          Subtotal deste pedido:
        </span>
        <span style={{
          fontSize: '17px',
          fontWeight: 'bold',
          color: '#e53e3e',
          fontFamily: 'monospace'
        }}>
          R$ {(parseFloat(valorTotal || 0) + parseFloat(valorAdicional || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      
      {/* Tabela de Valores Adiantados */}
      {valorAdiantadoDetalhes && valorAdiantadoDetalhes.length > 0 && valorAdiantadoDetalhes.some(item => item.valor && item.forma) && (
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
                  padding: '8px 12px',
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
      )}
      
      {/* Botão condicional baseado no valor adiantado */}
      {valorAdiantadoDetalhes && valorAdiantadoDetalhes.length > 0 && valorAdiantadoDetalhes.some(item => item.valor && item.forma) && (
        <div style={{
          marginBottom: 20,
          textAlign: 'center'
        }}>
          {(() => {
            const totalAdiantado = calcularTotalAdiantado();
            const valorTotalComAdicional = parseFloat(valorTotal || 0) + parseFloat(valorAdicional || 0);
            const valorRestante = valorTotalComAdicional - totalAdiantado;
            const excesso = totalAdiantado - valorTotalComAdicional;
            const pagamentoConfirmado = statusPedido === 'Pago';
            
            if (totalAdiantado >= valorTotalComAdicional) {
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
                    {!pagamentoConfirmado ? (
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
                        {processando ? '⏳ Processando...' : '✅ Confirmar Pagamento'}
                      </button>
                    ) : (
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
                    ⚠️ Valor insuficiente! Faltam: R$ {valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <button
                    type="button"
                    onClick={handleSolicitarComplementacao}
                    style={{
                      padding: '14px 32px',
                      background: 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: '16px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(229,62,62,0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.target.style.transform = 'translateY(0px)'}
                  >
                    💳 Solicitar Complementação
                  </button>
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