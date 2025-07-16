import React from 'react';

export default function ServicoDetalhes({ servico, statusExecucao, statusPagamento, onClose }) {
  if (!servico) return null;
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      padding: 32,
      marginBottom: 32
    }}>
      <h3>Detalhes do Serviço</h3>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <strong>Protocolo:</strong> {servico.protocolo}<br />
          <strong>Tipo:</strong> {servico.tipo}<br />
          <strong>Descrição:</strong> {servico.descricao}<br />
          <strong>Prazo:</strong> {servico.prazo}<br />
          <strong>Status Execução:</strong> {statusExecucao.find(st => st.value === servico.execucao.status)?.label}<br />
          <strong>Observações:</strong> {servico.execucao.observacoes}<br />
          <strong>Funcionário:</strong> {servico.execucao.responsavel}<br />
        </div>
        <div style={{ flex: 1 }}>
          <strong>Cliente:</strong> {servico.cliente.nome}<br />
          <strong>CPF/CNPJ:</strong> {servico.cliente.cpf}<br />
          <strong>Endereço:</strong> {servico.cliente.endereco}<br />
          <strong>Telefone:</strong> {servico.cliente.telefone}<br />
          <strong>E-mail:</strong> {servico.cliente.email}<br />
        </div>
        <div style={{ flex: 1 }}>
          <strong>Status Pagamento:</strong> {statusPagamento.find(st => st.value === servico.pagamento.status)?.label}<br />
          <strong>Valor Total:</strong> R$ {servico.pagamento.valorTotal}<br />
          <strong>Valor Pago:</strong> R$ {servico.pagamento.valorPago}<br />
          <strong>Data Pagamento:</strong> {servico.pagamento.data}<br />
          <strong>Forma Pagamento:</strong> {servico.pagamento.forma}<br />
          {servico.pagamento.status === 'pago' && (
            <span style={{ color: '#27ae60', fontWeight: '600' }}>
              Recibo digital emitido para protocolo {servico.protocolo}
            </span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <strong>Entrega:</strong> {servico.entrega.data ? `${servico.entrega.data} ${servico.entrega.hora}` : '-'}<br />
          <strong>Retirado por:</strong> {servico.entrega.retiradoPor}<br />
          <strong>Documento:</strong> {servico.entrega.documentoRetirada}<br />
          <strong>Assinatura Digital:</strong> {servico.entrega.assinaturaDigital ? 'Sim' : 'Não'}<br />
        </div>
      </div>
      <button onClick={onClose} style={{
        marginTop: 24,
        padding: '10px 24px',
        background: '#e74c3c',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer'
      }}>
        Fechar
      </button>
    </div>
  );
}