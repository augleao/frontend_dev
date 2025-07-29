import React, { useState } from 'react';
import config from '../../config';

const statusPagamento = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Pago' }
];

export default function ServicoPagamento({ form, onChange, valorTotal = 0, valorAdiantadoDetalhes = [] }) {
  const [statusPedido, setStatusPedido] = useState(form.status || 'Em Análise');
  const [processando, setProcessando] = useState(false);
  // Função para calcular o total adiantado
  const calcularTotalAdiantado = () => {
    return valorAdiantadoDetalhes
      .filter(item => item.valor && item.forma)
      .reduce((total, item) => total + parseFloat(item.valor || 0), 0);
  };

  // Função para atualizar status no banco de dados
  const atualizarStatusPedido = async (novoStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.apiURL}/pedidos/${form.protocolo}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: novoStatus })
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar status do pedido');
      }

      const resultado = await response.json();
      setStatusPedido(novoStatus);
      
      // Atualiza o form se onChange estiver disponível
      if (onChange) {
        onChange({ ...form, status: novoStatus });
      }
      
      return resultado;
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do pedido. Tente novamente.');
      throw error;
    }
  };

  // Função para gerar recibo de excesso
  const gerarReciboExcesso = (valorExcesso) => {
    const totalAdiantado = calcularTotalAdiantado();
    const cliente = form.cliente || {};
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date().toLocaleTimeString('pt-BR');

    const reciboHtml = `
      <html>
        <head>
          <title>Recibo de Excesso de Pagamento</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
              line-height: 1.6;
            }
            .header { 
              text-align: center; 
              border-bottom: 3px solid #e53e3e; 
              margin-bottom: 20px; 
              padding-bottom: 15px; 
            }
            .info { 
              margin: 12px 0; 
              display: flex; 
              justify-content: space-between;
              border-bottom: 1px solid #eee;
              padding: 8px 0;
            }
            .valor-excesso { 
              font-size: 20px; 
              font-weight: bold; 
              color: #e53e3e; 
              text-align: center;
              margin: 20px 0;
              padding: 15px;
              border: 2px solid #e53e3e;
              border-radius: 8px;
            }
            .footer { 
              margin-top: 30px; 
              border-top: 2px solid #ccc; 
              padding-top: 15px; 
              font-size: 12px; 
              text-align: center;
              color: #666;
            }
            .protocolo {
              background: #f5f5f5;
              padding: 10px;
              border-radius: 5px;
              font-family: monospace;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="color: #e53e3e; margin: 0;">RECIBO DE EXCESSO DE PAGAMENTO</h1>
            <div class="protocolo">Protocolo: ${form.protocolo}</div>
          </div>
          
          <div class="info">
            <strong>Cliente:</strong> 
            <span>${cliente.nome || 'Não informado'}</span>
          </div>
          <div class="info">
            <strong>CPF/CNPJ:</strong> 
            <span>${cliente.cpf || 'Não informado'}</span>
          </div>
          <div class="info">
            <strong>Data/Hora:</strong> 
            <span>${dataAtual} às ${horaAtual}</span>
          </div>
          <div class="info">
            <strong>Valor do Serviço:</strong> 
            <span>R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="info">
            <strong>Valor Adiantado:</strong> 
            <span>R$ ${totalAdiantado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          
          <div class="valor-excesso">
            <div>VALOR DE EXCESSO A SER DEVOLVIDO</div>
            <div style="font-size: 28px; margin-top: 10px;">
              R$ ${valorExcesso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Este recibo comprova o excesso de pagamento realizado pelo cliente.</strong></p>
            <p>O valor acima deverá ser devolvido ao cliente conforme procedimentos internos.</p>
            <p>Documento gerado automaticamente pelo sistema em ${dataAtual} às ${horaAtual}</p>
          </div>
        </body>
      </html>
    `;

    const novaJanela = window.open('', '_blank', 'width=800,height=600');
    novaJanela.document.write(reciboHtml);
    novaJanela.document.close();
    novaJanela.focus();
    novaJanela.print();
  };

  // Função para lidar com confirmação de pagamento
  const handleConfirmarPagamento = async () => {
    try {
      setProcessando(true);
      
      const totalAdiantado = calcularTotalAdiantado();
      const excesso = totalAdiantado - valorTotal;
      
      // Atualiza o status para "Pago" no banco de dados
      await atualizarStatusPedido('Pago');
      
      // Se há excesso, gera automaticamente o recibo
      if (excesso > 0) {
        gerarReciboExcesso(excesso);
      }
      
      alert('✅ Pagamento confirmado com sucesso! Status atualizado para "Pago".');
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      alert('❌ Erro ao confirmar pagamento. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  // Função para cancelar pagamento
  const handleCancelarPagamento = async () => {
    if (window.confirm('Tem certeza que deseja cancelar este pagamento? O status voltará para "Conferido".')) {
      try {
        setProcessando(true);
        
        // Atualiza o status para "Conferido" no banco de dados
        await atualizarStatusPedido('Conferido');
        
        alert('✅ Pagamento cancelado com sucesso! Status atualizado para "Conferido".');
      } catch (error) {
        console.error('Erro ao cancelar pagamento:', error);
        alert('❌ Erro ao cancelar pagamento. Tente novamente.');
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
          Valor a ser pago:
        </span>
        <span style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#e53e3e',
          fontFamily: 'monospace'
        }}>
          R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            const valorRestante = valorTotal - totalAdiantado;
            const excesso = totalAdiantado - valorTotal;
            const pagamentoConfirmado = statusPedido === 'Pago';
            
            if (totalAdiantado >= valorTotal) {
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
                        📄 Gerar Recibo de Excesso
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
      
      {/* Status atual do pedido */}
      <div style={{
        marginBottom: 20,
        padding: 16,
        background: statusPedido === 'Pago' ? '#e8f5e8' : '#fff5f5',
        border: `2px solid ${statusPedido === 'Pago' ? '#38a169' : '#feb2b2'}`,
        borderRadius: 12,
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 14,
          color: statusPedido === 'Pago' ? '#2d5016' : '#742a2a',
          marginBottom: 8,
          fontWeight: '600'
        }}>
          Status atual do pedido:
        </div>
        <div style={{
          fontSize: 18,
          fontWeight: 'bold',
          color: statusPedido === 'Pago' ? '#38a169' : '#e53e3e'
        }}>
          {statusPedido === 'Pago' ? '✅ PAGO' : `📋 ${statusPedido.toUpperCase()}`}
        </div>
      </div>
      
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