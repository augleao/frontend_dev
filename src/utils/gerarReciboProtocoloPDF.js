// Função utilitária para gerar PDF do recibo de protocolo usando jsPDF
// Recebe um objeto pedido e retorna um Blob PDF

import jsPDF from 'jspdf';

// Substitua pelo base64 do brasão quando disponível
const BRASAO_BASE64 = '';

export function gerarReciboProtocoloPDF(pedido) {
  // Margens e limites para metade da página A4
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 20;
  let y = 20;
  // Brasão centralizado no topo (altura 24mm)
  if (BRASAO_BASE64) {
    doc.addImage(BRASAO_BASE64, 'PNG', (pageWidth - 30) / 2, y, 30, 24);
    y += 28;
  } else {
    y += 10;
  }
  // Título
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.text('RECIBO DE PROTOCOLO', pageWidth / 2, y, { align: 'center' });
  y += 10;
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.text(`Nº: ${pedido.protocolo || '-'}`, pageWidth / 2, y, { align: 'center' });
  y += 10;
  // Linha separadora
  doc.setDrawColor(150);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;
  // Dados do cartório
  doc.setFontSize(11);
  doc.text(`Cartório: ${pedido.serventia?.nome_completo || '-'}`, marginX, y);
  y += 6;
  doc.text(`Endereço: ${pedido.serventia?.endereco || '-'}`, marginX, y);
  y += 6;
  doc.text(`Telefone: ${pedido.serventia?.telefone || '-'}${pedido.serventia?.whatsapp ? ' / ' + pedido.serventia.whatsapp : ''}`, marginX, y);
  y += 6;
  if (pedido.serventia?.email) {
    doc.text(`Email: ${pedido.serventia.email}`, marginX, y);
    y += 6;
  }
  if (pedido.serventia?.cnpj) {
    doc.text(`CNPJ: ${pedido.serventia.cnpj}`, marginX, y);
    y += 6;
  }
  doc.text(`CNS: ${pedido.serventia?.cns || '-'}`, marginX, y);
  y += 6;
  // Dados do pedido
  doc.text(`Tipo de serviço: ${pedido.descricao || '-'}`, marginX, y);
  y += 6;
  doc.text(`Data de solicitação: ${pedido.criado_em ? new Date(pedido.criado_em).toLocaleDateString() : '-'}`, marginX, y);
  y += 6;
  doc.text(`Previsão de entrega: ${pedido.previsao_entrega ? new Date(pedido.previsao_entrega).toLocaleDateString() : '-'}`, marginX, y);
  y += 8;
  // Linha separadora
  doc.setDrawColor(200);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;
  // Dados do cliente
  doc.setFont('times', 'bold');
  doc.text('Dados do Cliente', marginX, y);
  doc.setFont('times', 'normal');
  y += 6;
  doc.text(`Nome: ${pedido.cliente?.nome || '-'}`, marginX, y);
  y += 6;
  doc.text(`Telefone: ${pedido.cliente?.telefone || '-'}`, marginX, y);
  y += 6;
  doc.text(`CPF: ${pedido.cliente?.cpf || '-'}`, marginX, y);
  y += 8;
  // Valores pagos
  doc.setFont('times', 'bold');
  doc.text('Valores pagos', marginX, y);
  doc.setFont('times', 'normal');
  y += 6;
  if (Array.isArray(pedido.valorAdiantadoDetalhes) && pedido.valorAdiantadoDetalhes.length > 0) {
    pedido.valorAdiantadoDetalhes.forEach((item) => {
      doc.text(`R$ ${parseFloat(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${item.forma ? ' (' + item.forma + ')' : ''}`, marginX, y);
      y += 6;
    });
  } else {
    doc.text('Nenhum valor antecipado informado.', marginX, y);
    y += 6;
  }
  // Espaço para assinatura
  y += 16;
  doc.setDrawColor(100);
  doc.line(pageWidth / 2 - 35, y, pageWidth / 2 + 35, y);
  y += 5;
  doc.setFontSize(10);
  doc.text('Assinatura do responsável', pageWidth / 2, y, { align: 'center' });
  // Rodapé
  const cidade = pedido.serventia?.cidade || '';
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  y += 12;
  doc.setFontSize(10);
  doc.text(`${cidade}, ${dataHoje}`, pageWidth - marginX, y, { align: 'right' });
  // Limitar a metade da página A4 (148mm)
  // Opcional: pode adicionar uma linha ou texto indicando fim do recibo
  // doc.line(marginX, 148, pageWidth - marginX, 148);
  return doc.output('blob');
}
