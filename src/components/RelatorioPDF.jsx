import { jsPDF } from 'jspdf';

export function formatarMoeda(valor) {
  if (isNaN(valor) || valor === null) return '';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDataParaNomeArquivo(dataStr) {
  if (!dataStr) return 'sem_data';
  const partes = dataStr.split('/');
  if (partes.length !== 3) return 'sem_data';
  return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
}

export function gerarRelatorioPDF({
  dataRelatorio,
  atos,
  valorInicialCaixa,
  depositosCaixa,
  saidasCaixa,
  responsavel,
  ISS,
  observacoesGerais
}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const marginLeft = 40;
  const marginTop = 40;
  const lineHeight = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Relatório de Conciliação - ${dataRelatorio || ''}`, marginLeft, marginTop);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');

  // Responsável e ISS no relatório
  doc.text(`Responsável: ${responsavel || 'Não informado'}`, marginLeft, marginTop + lineHeight);
  doc.text(`ISS aplicado: ${ISS ? ISS + '%' : '0%'}`, marginLeft, marginTop + lineHeight * 2);

  const headerInfo = [
    `Valor Inicial do Caixa: ${formatarMoeda(valorInicialCaixa)}`,
    `Depósitos do Caixa: ${formatarMoeda(depositosCaixa)}`,
    `Saídas do Caixa: ${formatarMoeda(saidasCaixa)}`,
    `Valor Final do Caixa: ${formatarMoeda(valorInicialCaixa + atos.reduce((acc, ato) => acc + ato.pagamentoDinheiro.valor, 0) - saidasCaixa - depositosCaixa)}`,
  ];
  headerInfo.forEach((text, i) => {
    doc.text(text, marginLeft, marginTop + lineHeight * (i + 3));
  });

  let y = marginTop + lineHeight * (headerInfo.length + 4);

  // Observações gerais (OBS)
  if (observacoesGerais && observacoesGerais.trim() !== '') {
    doc.setFont('helvetica', 'bold');
    doc.text('Observações:', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    y += lineHeight;
    const obsLinhas = doc.splitTextToSize(observacoesGerais, pageWidth - marginLeft * 2);
    doc.text(obsLinhas, marginLeft, y);
    y += obsLinhas.length * lineHeight;
    y += lineHeight; // espaço extra antes da tabela
  }

  const colWidths = {
    qtde: 25,
    codigo: 40,
    descricao: 150,
    valorTotal: 50,
    valorFaltante: 50,
    pagamento: 90,
    observacoes: 100,
  };

  // Cabeçalho destacado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  let x = marginLeft;
  doc.setFillColor(40, 40, 40); // cinza escuro
  doc.setTextColor(255, 255, 255); // branco

  const headers = [
    { label: 'Qtde.', width: colWidths.qtde },
    { label: 'Código', width: colWidths.codigo },
    { label: 'Descrição', width: colWidths.descricao },
    { label: 'Valor Tot.', width: colWidths.valorTotal },
    { label: 'Valor Falt.', width: colWidths.valorFaltante },
    { label: 'Dinheiro', width: colWidths.pagamento },
    { label: 'Cartão', width: colWidths.pagamento },
    { label: 'Pix', width: colWidths.pagamento },
    { label: 'CRC', width: colWidths.pagamento },
    { label: 'Depósito Prévio', width: colWidths.pagamento },
    { label: 'Obs.', width: colWidths.observacoes },
  ];

  // Fundo do cabeçalho
  const headerHeight = lineHeight + 4;
  doc.rect(x, y - headerHeight + 2, headers.reduce((acc, h) => acc + h.width, 0), headerHeight, 'F');

  headers.forEach(h => {
    doc.text(h.label, x + 2, y);
    x += h.width;
  });

  // Linha preta fina abaixo do cabeçalho
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y + 4, marginLeft + headers.reduce((acc, h) => acc + h.width, 0), y + 4);

  y += lineHeight + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0); // volta para preto

  const checkPageBreak = (yPos) => {
    if (yPos > pageHeight - marginTop) {
      doc.addPage();
      return marginTop;
    }
    return yPos;
  };

  atos.forEach(ato => {
    x = marginLeft;
    y = checkPageBreak(y);

    const somaPagamentos =
      ato.pagamentoDinheiro.valor +
      ato.pagamentoCartao.valor +
      ato.pagamentoPix.valor +
      ato.pagamentoCRC.valor +
      ato.depositoPrevio.valor;

    const valorTotalAto = ato.valorTotalComISS ?? ato.valorTotal;
    const valorFaltante = valorTotalAto - somaPagamentos;

    const formatarQtdeValor = (pagamento) => {
      return `Qtde: ${pagamento.quantidade}\nVal: ${formatarMoeda(pagamento.valor)}`;
    };

    const rowData = [
      ato.quantidade.toString(),
      ato.codigo,
      ato.descricao,
      formatarMoeda(valorTotalAto),
      formatarMoeda(valorFaltante),
      formatarQtdeValor(ato.pagamentoDinheiro),
      formatarQtdeValor(ato.pagamentoCartao),
      formatarQtdeValor(ato.pagamentoPix),
      formatarQtdeValor(ato.pagamentoCRC),
      formatarQtdeValor(ato.depositoPrevio),
      ato.observacoes || '',
    ];

    rowData.forEach((text, i) => {
      const maxWidth = headers[i].width - 4;
      let displayText = text;

      if (i >= 5 && i <= 9) {
        const lines = displayText.split('\n');
        lines.forEach((line, idx) => {
          doc.text(line, x, y + idx * (lineHeight - 2));
        });
      } else {
        if (doc.getTextWidth(text) > maxWidth) {
          while (doc.getTextWidth(displayText + '...') > maxWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          displayText += '...';
        }
        doc.text(displayText, x, y);
      }

      x += headers[i].width;
    });

    // Linha preta fina abaixo de cada linha de dados (ajustada para não sobrepor o texto)
    const linhaY = y + lineHeight * 2 - 12; // ajuste fino, pode testar -2, -4, -6
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(
      marginLeft,
      linhaY,
      marginLeft + headers.reduce((acc, h) => acc + h.width, 0),
      linhaY
    );

    y += lineHeight * 2;
  });

  const dataFormatada = formatarDataParaNomeArquivo(dataRelatorio);
  doc.save(`${dataFormatada}_relatorio_conciliacao.pdf`);
}