// Função utilitária para gerar PDF do recibo de protocolo usando jsPDF
// Recebe um objeto pedido e retorna um Blob PDF
import jsPDF from 'jspdf';

export function gerarReciboProtocoloPDF(pedido) {
  const doc = new jsPDF();
  let y = 15;
  doc.setFontSize(16);
  doc.text('Recibo de Protocolo', 105, y, { align: 'center' });
  y += 10;
  doc.setFontSize(12);
  doc.text(`Protocolo: ${pedido.protocolo || '-'}`, 15, y);
  y += 8;
  doc.text(`Tipo serviço: ${pedido.descricao || '-'}`, 15, y);
  y += 8;
  doc.text(`Cartório: ${pedido.serventia?.nome_completo || '-'}`, 15, y);
  y += 8;
  doc.text(`Endereço: ${pedido.serventia?.endereco || '-'}`, 15, y);
  y += 8;
  doc.text(`Telefone: ${pedido.serventia?.telefone || '-'}${pedido.serventia?.whatsapp ? ' / ' + pedido.serventia.whatsapp : ''}`, 15, y);
  y += 8;
  if (pedido.serventia?.email) {
    doc.text(`Email: ${pedido.serventia.email}`, 15, y);
    y += 8;
  }
  if (pedido.serventia?.cnpj) {
    doc.text(`CNPJ: ${pedido.serventia.cnpj}`, 15, y);
    y += 8;
  }
  doc.text(`CNS cartório: ${pedido.serventia?.cns || '-'}`, 15, y);
  y += 8;
  doc.text(`Data de solicitação: ${pedido.criado_em ? new Date(pedido.criado_em).toLocaleDateString() : '-'}`, 15, y);
  y += 8;
  doc.text(`Previsão de entrega: ${pedido.previsao_entrega ? new Date(pedido.previsao_entrega).toLocaleDateString() : '-'}`, 15, y);
  y += 10;
  doc.setFontSize(14);
  doc.text('Dados do Cliente:', 15, y);
  y += 8;
  doc.setFontSize(12);
  doc.text(`Nome: ${pedido.cliente?.nome || '-'}`, 15, y);
  y += 8;
  doc.text(`Telefone: ${pedido.cliente?.telefone || '-'}`, 15, y);
  y += 8;
  doc.text(`CPF: ${pedido.cliente?.cpf || '-'}`, 15, y);
  y += 10;
  doc.setFontSize(14);
  doc.text('Valores pagos pelo cliente:', 15, y);
  y += 8;
  doc.setFontSize(12);
  if (Array.isArray(pedido.valorAdiantadoDetalhes) && pedido.valorAdiantadoDetalhes.length > 0) {
    pedido.valorAdiantadoDetalhes.forEach((item, idx) => {
      doc.text(`Valor: R$ ${parseFloat(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${item.forma ? ' (' + item.forma + ')' : ''}`, 15, y);
      y += 8;
    });
  } else {
    doc.text('Nenhum valor antecipado informado.', 15, y);
    y += 8;
  }
  // QRCode não incluso no PDF (jsPDF não suporta canvas nativamente)
  return doc.output('blob');
}
