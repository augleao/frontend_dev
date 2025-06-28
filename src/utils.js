// utils.js
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const formasPagamento = [
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'cartao', label: 'Cartão' },
  { key: 'pix', label: 'PIX' },
  { key: 'crc', label: 'CRC' },
  { key: 'depositoPrevio', label: 'Depósito Previo' },
];

// Função auxiliar para normalizar strings (usuário)
function normalizar(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

// Função auxiliar para formatar moeda
export function formatarMoeda(valor) {
  return (valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDataParaNomeArquivo(dataStr) {
  if (!dataStr) return 'sem_data';
  const partes = dataStr.split('/');
  if (partes.length !== 3) return 'sem_data';
  return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
}

export function formatarDataBR(dataISO) {
  if (!dataISO) return '';
  if (dataISO.includes('/')) return dataISO;
  const [ano, mes, dia] = dataISO.substring(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatarValor(valor) {
  const num = parseFloat(valor);
  return !isNaN(num) ? num.toFixed(2) : '0.00';
}

export function gerarRelatorioPDF({ dataRelatorio, atos, valorInicialCaixa, depositosCaixa, saidasCaixa, responsavel }) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  // ... (copie aqui a função completa de gerarRelatorioPDF do seu código)

  // Salvar PDF
  const dataFormatada = formatarDataParaNomeArquivo(dataRelatorio);
  doc.save(`${dataFormatada}_relatorio_atos_pagos.pdf`);
}

export function gerarRelatorioPDFatosPagos({
  dataRelatorio,
  atos,
  valorFinalCaixa,
  depositosCaixa,
  saidasCaixa,
  responsavel,
  ISS,
}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const marginLeft = 40;
  const marginTop = 40;
  const lineHeight = 16;

  // Busca o valor inicial do caixa (ato 0005) do usuário e data do relatório
  const atoValorInicial = (atos || []).find(
    ato =>
      ato.codigo === '0005' &&
      normalizar(ato.usuario) === normalizar(responsavel) &&
      (ato.data === dataRelatorio || ato.data === dataRelatorio.split('/').reverse().join('-'))
  );
  const valorInicialCaixa = atoValorInicial ? parseFloat(atoValorInicial.valor_unitario) || 0 : 0;

  // Cabeçalho
  doc.setFontSize(12);
  doc.text(`Fechamento Diário do Caixa - ${dataRelatorio}`, marginLeft, marginTop);
  doc.setFontSize(10);
  doc.text(`Responsável: ${responsavel || 'Não informado'}`, marginLeft, marginTop + lineHeight);
  doc.text(`ISS aplicado: ${ISS ? ISS + '%' : '0%'}`, marginLeft, marginTop + lineHeight * 2);

  // Resumo dos valores
  doc.text(`Valor Inicial do Caixa: ${formatarMoeda(valorInicialCaixa)}`, marginLeft, marginTop + lineHeight * 3);
  doc.text(`Entradas do Caixa: ${formatarMoeda(Array.isArray(depositosCaixa) ? depositosCaixa.reduce((acc, ato) => acc + (parseFloat(ato.valor_unitario) || 0), 0) : 0)}`, marginLeft, marginTop + lineHeight * 4);
  doc.text(`Saídas do Caixa: ${formatarMoeda(Array.isArray(saidasCaixa) ? saidasCaixa.reduce((acc, ato) => acc + (parseFloat(ato.valor_unitario) || 0), 0) : 0)}`, marginLeft, marginTop + lineHeight * 5);
  doc.text(`Valor Final do Caixa: ${formatarMoeda(valorFinalCaixa)}`, marginLeft, marginTop + lineHeight * 6);

  // a tabela de atos pagos, 
  
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

  // Salvar PDF
  const dataFormatada = dataRelatorio.replace(/\//g, '-');
  doc.save(`${dataFormatada}_relatorio_atos_pagos.pdf`);
}