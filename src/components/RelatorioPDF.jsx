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

// Função utilitária para garantir que o campo OBS seja passado corretamente
function extrairObservacoesGerais(dados) {
  // Tenta camelCase, depois snake_case, depois vazio
  return dados.observacoesGerais || dados.observacoes_gerais || '';
}

export function gerarRelatorioPDF(relatorio) {
  // Se o parâmetro for um objeto com todos os campos, use normalmente.
  // Se for um objeto "dados" vindo do banco, converta os campos.
  const {
    dataRelatorio,
    data_hora,
    atos,
    valorInicialCaixa,
    valor_inicial_caixa,
    depositosCaixa,
    depositos_caixa,
    saidasCaixa,
    saidas_caixa,
    responsavel,
    ISS,
    iss_percentual,
    observacoesGerais,
  } = relatorio;

  // Garante compatibilidade entre camelCase e snake_case
  const _dataRelatorio = dataRelatorio || data_hora || '';
  const _atos = atos || relatorio.atos || [];
  const _valorInicialCaixa = valorInicialCaixa ?? valor_inicial_caixa ?? 0;
  const _depositosCaixa = depositosCaixa ?? depositos_caixa ?? 0;
  const _saidasCaixa = saidasCaixa ?? saidas_caixa ?? 0;
  const _responsavel = responsavel || relatorio.responsavel || '';
  const _ISS = ISS ?? iss_percentual ?? 0;
  const _observacoesGerais = extrairObservacoesGerais(relatorio);

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
  doc.text(`Relatório de Conciliação - ${_dataRelatorio || ''}`, marginLeft, marginTop);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');

  // Responsável e ISS no relatório
  doc.text(`Responsável: ${_responsavel || 'Não informado'}`, marginLeft, marginTop + lineHeight);
  doc.text(`ISS aplicado: ${_ISS ? _ISS + '%' : '0%'}`, marginLeft, marginTop + lineHeight * 2);

  const headerInfo = [
    `Valor Inicial do Caixa: ${formatarMoeda(_valorInicialCaixa)}`,
    `Depósitos do Caixa: ${formatarMoeda(_depositosCaixa)}`,
    `Saídas do Caixa: ${formatarMoeda(_saidasCaixa)}`,
    `Valor Final do Caixa: ${formatarMoeda(_valorInicialCaixa + _atos.reduce((acc, ato) => acc + (ato.pagamentoDinheiro?.valor ?? ato.dinheiro_valor ?? 0), 0) - _saidasCaixa - _depositosCaixa)}`,
  ];
  headerInfo.forEach((text, i) => {
    doc.text(text, marginLeft, marginTop + lineHeight * (i + 3));
  });

  let y = marginTop + lineHeight * (headerInfo.length + 4);

  // Adiciona as observações gerais (OBS) se houver
  if (_observacoesGerais && _observacoesGerais.trim() !== '') {
    doc.setFont('helvetica', 'bold');
    doc.text('OBS:', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    y += lineHeight;
    const obsLinhas = doc.splitTextToSize(_observacoesGerais, pageWidth - marginLeft * 2);
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

  _atos.forEach(ato => {
    x = marginLeft;
    y = checkPageBreak(y);

    // Compatibilidade para os campos de pagamento
    const dinheiro = ato.pagamentoDinheiro?.valor ?? ato.dinheiro_valor ?? 0;
    const cartao = ato.pagamentoCartao?.valor ?? ato.cartao_valor ?? 0;
    const pix = ato.pagamentoPix?.valor ?? ato.pix_valor ?? 0;
    const crc = ato.pagamentoCRC?.valor ?? ato.crc_valor ?? 0;
    const depositoPrevio = ato.depositoPrevio?.valor ?? ato.deposito_previo_valor ?? 0;

    const somaPagamentos = dinheiro + cartao + pix + crc + depositoPrevio;

    const valorTotalAto = ato.valorTotalComISS ?? ato.valor_total ?? ato.valorTotal ?? 0;
    const valorFaltante = valorTotalAto - somaPagamentos;

    const formatarQtdeValor = (pagamento, qtd, val) => {
      if (pagamento && typeof pagamento === 'object') {
        return `Qtde: ${pagamento.quantidade}\nVal: ${formatarMoeda(pagamento.valor)}`;
      }
      return `Qtde: ${qtd ?? 0}\nVal: ${formatarMoeda(val ?? 0)}`;
    };

    const rowData = [
      ato.quantidade?.toString() ?? ato.qtde?.toString() ?? '',
      ato.codigo,
      ato.descricao,
      formatarMoeda(valorTotalAto),
      formatarMoeda(valorFaltante),
      formatarQtdeValor(ato.pagamentoDinheiro, ato.dinheiro_qtd, dinheiro),
      formatarQtdeValor(ato.pagamentoCartao, ato.cartao_qtd, cartao),
      formatarQtdeValor(ato.pagamentoPix, ato.pix_qtd, pix),
      formatarQtdeValor(ato.pagamentoCRC, ato.crc_qtd, crc),
      formatarQtdeValor(ato.depositoPrevio, ato.deposito_previo_qtd, depositoPrevio),
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
    const linhaY = y + lineHeight * 2 - 12;
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

  const dataFormatada = formatarDataParaNomeArquivo(_dataRelatorio);
  doc.save(`${dataFormatada}_relatorio_conciliacao.pdf`);
}