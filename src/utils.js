// Função fetch autenticada com tratamento de token expirado
export async function fetchComAuth(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...(options.headers || {}),
    Authorization: token ? `Bearer ${token}` : undefined,
  };

  const finalOptions = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, finalOptions);
    if (response.status === 401 || response.status === 403) {
      // Token expirado ou inválido: limpa storage e redireciona
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
      return;
    }
    return response;
  } catch (err) {
    // Erro de rede
    throw err;
  }
}
// utils.js
import { jsPDF } from 'jspdf';

export const formasPagamento = [
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'cartao', label: 'Cartão' },
  { key: 'pix', label: 'PIX' },
  { key: 'crc', label: 'CRC' },
  { key: 'depositoPrevio', label: 'Depósito Previo' },
];

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



export function gerarRelatorioPDFCaixaDiario({
  dataRelatorio,
  atos,
  valorInicialCaixa,
  valorFinalCaixa,
  depositosCaixa,
  saidasCaixa,
  responsavel,
  ISS,
  observacoesGerais,
  nomeArquivo
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

  // Função para agrupar atos pelo código
  const agruparAtosPorCodigo = (atos) => {
    const atosAgrupados = {};
    
    atos.forEach(ato => {
      // Filtrar apenas atos normais (não entradas/saídas manuais nem fechamento)
      if (ato.codigo !== '0001' && ato.codigo !== '0002' && ato.codigo !== '0003') {
        const codigo = ato.codigo;
        
        if (!atosAgrupados[codigo]) {
          atosAgrupados[codigo] = {
            codigo: codigo,
            descricao: ato.descricao,
            quantidade: 0,
            valorUnitario: ato.valor_unitario || 0,
            valorTotal: 0
          };
        }
        
        // Somar quantidades
        atosAgrupados[codigo].quantidade += (ato.quantidade || 1);
        
        // Calcular valor total
        const valorAto = (ato.valor_unitario || 0) * (ato.quantidade || 1);
        atosAgrupados[codigo].valorTotal += valorAto;
      }
    });
    
    return Object.values(atosAgrupados);
  };

  const checkPageBreak = (yPos) => {
    if (yPos > pageHeight - marginTop) {
      doc.addPage();
      return marginTop;
    }
    return yPos;
  };

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Relatório de Fechamento de Caixa Diário - ${dataRelatorio || ''}`, marginLeft, marginTop);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');

  // Responsável e ISS no relatório
  doc.text(`Responsável: ${responsavel || 'Não informado'}`, marginLeft, marginTop + lineHeight);
  doc.text(`ISS aplicado: ${ISS ? ISS + '%' : '0%'}`, marginLeft, marginTop + lineHeight * 2);

  const headerInfo = [
    `Valor Inicial do Caixa: ${formatarMoeda(valorInicialCaixa)}`,
    `Depósitos do Caixa: ${formatarMoeda(depositosCaixa || 0)}`,
    `Saídas do Caixa: ${formatarMoeda(saidasCaixa || 0)}`,
    `Valor Final do Caixa: ${formatarMoeda(valorInicialCaixa + atos.reduce((acc, ato) => acc + (ato.pagamentos?.dinheiro?.valor || 0), 0) - (saidasCaixa || 0) - (depositosCaixa || 0))}`,
  ];
  headerInfo.forEach((text, i) => {
    doc.text(text, marginLeft, marginTop + lineHeight * (i + 3));
  });

  let y = marginTop + lineHeight * (headerInfo.length + 4);

  // Adiciona as observações gerais (OBS) se houver
  if (observacoesGerais && observacoesGerais.trim() !== '') {
    doc.setFont('helvetica', 'bold');
    doc.text('OBS:', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    y += lineHeight;
    const obsLinhas = doc.splitTextToSize(observacoesGerais, pageWidth - marginLeft * 2);
    doc.text(obsLinhas, marginLeft, y);
    y += obsLinhas.length * lineHeight;
    y += lineHeight; // espaço extra antes da tabela
  }

  // ===== NOVA TABELA DE ATOS AGRUPADOS =====
  const atosAgrupados = agruparAtosPorCodigo(atos);
  
  if (atosAgrupados.length > 0) {
    y = checkPageBreak(y + lineHeight);
    
    // Título da tabela de atos agrupados
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ATOS PRATICADOS NO DIA (AGRUPADOS)', marginLeft, y);
    y += lineHeight + 5;
    
    // Cabeçalho da tabela de atos agrupados
    const colWidthsAgrupados = {
      codigo: 60,
      descricao: 200,
      quantidade: 60,
      valorUnitario: 80,
      valorTotal: 80
    };
    
    let x = marginLeft;
    doc.setFillColor(40, 40, 40);
    doc.setTextColor(255, 255, 255);
    
    const headersAgrupados = [
      { label: 'Código', width: colWidthsAgrupados.codigo },
      { label: 'Descrição', width: colWidthsAgrupados.descricao },
      { label: 'Qtd. Total', width: colWidthsAgrupados.quantidade },
      { label: 'Valor Unit.', width: colWidthsAgrupados.valorUnitario },
      { label: 'Valor Total', width: colWidthsAgrupados.valorTotal }
    ];
    
    // Fundo do cabeçalho
    const headerHeight = lineHeight + 4;
    doc.rect(x, y - headerHeight + 2, headersAgrupados.reduce((acc, h) => acc + h.width, 0), headerHeight, 'F');
    
    headersAgrupados.forEach(h => {
      doc.text(h.label, x + 2, y);
      x += h.width;
    });
    
    // Linha abaixo do cabeçalho
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, y + 4, marginLeft + headersAgrupados.reduce((acc, h) => acc + h.width, 0), y + 4);
    
    y += lineHeight + 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    
    // Dados dos atos agrupados
    atosAgrupados.forEach(ato => {
      y = checkPageBreak(y);
      x = marginLeft;
      
      const rowDataAgrupados = [
        ato.codigo,
        ato.descricao,
        ato.quantidade.toString(),
        formatarMoeda(ato.valorUnitario),
        formatarMoeda(ato.valorTotal)
      ];
      
      rowDataAgrupados.forEach((text, i) => {
        const maxWidth = headersAgrupados[i].width - 4;
        let displayText = text;
        
        if (doc.getTextWidth(text) > maxWidth) {
          while (doc.getTextWidth(displayText + '...') > maxWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          displayText += '...';
        }
        
        doc.text(displayText, x + 2, y);
        x += headersAgrupados[i].width;
      });
      
      // Linha abaixo de cada linha de dados
      const linhaY = y + lineHeight - 2;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      doc.line(
        marginLeft,
        linhaY,
        marginLeft + headersAgrupados.reduce((acc, h) => acc + h.width, 0),
        linhaY
      );
      
      y += lineHeight + 2;
    });
    
    y += lineHeight; // Espaço antes da próxima seção
  }

  // ===== TABELA DETALHADA ORIGINAL =====
  y = checkPageBreak(y + lineHeight);
  
  // Título da tabela detalhada
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DETALHAMENTO DOS PAGAMENTOS', marginLeft, y);
  y += lineHeight + 5;

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

  atos.forEach(ato => {
    x = marginLeft;
    y = checkPageBreak(y);

    // Compatibilidade para os campos de pagamento
    const dinheiro = ato.pagamentos?.dinheiro?.valor || 0;
    const cartao = ato.pagamentos?.cartao?.valor || 0;
    const pix = ato.pagamentos?.pix?.valor || 0;
    const crc = ato.pagamentos?.crc?.valor || 0;
    const depositoPrevio = ato.pagamentos?.depositoPrevio?.valor || 0;

    const somaPagamentos = dinheiro + cartao + pix + crc + depositoPrevio;
    const valorTotalAto = (ato.valor_unitario || 0) * (ato.quantidade || 1);
    const valorFaltante = valorTotalAto - somaPagamentos;

    const formatarQtdeValor = (pagamento) => {
      if (pagamento && typeof pagamento === 'object') {
        return `Qtde: ${pagamento.quantidade || 0}\nVal: ${formatarMoeda(pagamento.valor || 0)}`;
      }
      return `Qtde: 0\nVal: ${formatarMoeda(0)}`;
    };

    const rowData = [
      (ato.quantidade || 1).toString(),
      ato.codigo || '',
      ato.descricao || '',
      formatarMoeda(valorTotalAto),
      formatarMoeda(valorFaltante),
      formatarQtdeValor(ato.pagamentos?.dinheiro),
      formatarQtdeValor(ato.pagamentos?.cartao),
      formatarQtdeValor(ato.pagamentos?.pix),
      formatarQtdeValor(ato.pagamentos?.crc),
      formatarQtdeValor(ato.pagamentos?.depositoPrevio),
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

    // Linha preta fina abaixo de cada linha de dados
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

  // Adicionando o valor final do caixa (código 0001) no relatório
  const valorFinalCaixaRelatorio = atos.find(ato => ato.codigo === '0001');
  if (valorFinalCaixaRelatorio) {
    const valorFinal = valorFinalCaixaRelatorio.pagamentos?.dinheiro?.valor || 0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Valor Final do Caixa (código 0001): R$ ${valorFinal.toFixed(2)}`, marginLeft, y);
    y += lineHeight + 5;
  }

  const dataFormatada = formatarDataParaNomeArquivo(dataRelatorio);
  doc.save(`${dataFormatada}_${nomeArquivo || 'FechamentoCaixa.pdf'}`);
}

export function gerarRelatorioPDFAtosPraticados({
  dataRelatorio,
  atos,
  valorInicialCaixa,
  depositosCaixa,
  saidasCaixa,
  responsavel,
  ISS,
  observacoesGerais,
  nomeArquivo // <-- adicione aqui!
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

  // Função para agrupar atos pelo código
  const agruparAtosPorCodigo = (atos) => {
    const atosAgrupados = {};
    
    atos.forEach(ato => {
      // Filtrar apenas atos normais (não entradas/saídas manuais nem fechamento)
      if (ato.codigo !== '0001' && ato.codigo !== '0002' && ato.codigo !== '0003') {
        const codigo = ato.codigo;
        
        if (!atosAgrupados[codigo]) {
          atosAgrupados[codigo] = {
            codigo: codigo,
            descricao: ato.descricao,
            quantidade: 0,
            valorUnitario: ato.valor_unitario || 0,
            valorTotal: 0
          };
        }
        
        // Somar quantidades
        atosAgrupados[codigo].quantidade += (ato.quantidade || 1);
        
        // Calcular valor total
        const valorAto = (ato.valor_unitario || 0) * (ato.quantidade || 1);
        atosAgrupados[codigo].valorTotal += valorAto;
      }
    });
    
    return Object.values(atosAgrupados);
  };

  const checkPageBreak = (yPos) => {
    if (yPos > pageHeight - marginTop) {
      doc.addPage();
      return marginTop;
    }
    return yPos;
  };

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Relatório de Fechamento de Caixa Diário - ${dataRelatorio || ''}`, marginLeft, marginTop);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');

  // Responsável e ISS no relatório
  doc.text(`Responsável: ${responsavel || 'Não informado'}`, marginLeft, marginTop + lineHeight);
  doc.text(`ISS aplicado: ${ISS ? ISS + '%' : '0%'}`, marginLeft, marginTop + lineHeight * 2);

  const headerInfo = [
    `Valor Inicial do Caixa: ${formatarMoeda(valorInicialCaixa)}`,
    `Depósitos do Caixa: ${formatarMoeda(depositosCaixa || 0)}`,
    `Saídas do Caixa: ${formatarMoeda(saidasCaixa || 0)}`,
    `Valor Final do Caixa: ${formatarMoeda(valorInicialCaixa + atos.reduce((acc, ato) => acc + (ato.pagamentos?.dinheiro?.valor || 0), 0) - (saidasCaixa || 0) - (depositosCaixa || 0))}`,
  ];
  headerInfo.forEach((text, i) => {
    doc.text(text, marginLeft, marginTop + lineHeight * (i + 3));
  });

  let y = marginTop + lineHeight * (headerInfo.length + 4);

  // Adiciona as observações gerais (OBS) se houver
  if (observacoesGerais && observacoesGerais.trim() !== '') {
    doc.setFont('helvetica', 'bold');
    doc.text('OBS:', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    y += lineHeight;
    const obsLinhas = doc.splitTextToSize(observacoesGerais, pageWidth - marginLeft * 2);
    doc.text(obsLinhas, marginLeft, y);
    y += obsLinhas.length * lineHeight;
    y += lineHeight; // espaço extra antes da tabela
  }

  // ===== NOVA TABELA DE ATOS AGRUPADOS =====
  const atosAgrupados = agruparAtosPorCodigo(atos);
  
  if (atosAgrupados.length > 0) {
    y = checkPageBreak(y + lineHeight);
    
    // Título da tabela de atos agrupados
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ATOS PRATICADOS NO DIA (AGRUPADOS)', marginLeft, y);
    y += lineHeight + 5;
    
    // Cabeçalho da tabela de atos agrupados
    const colWidthsAgrupados = {
      codigo: 60,
      descricao: 200,
      quantidade: 60,
      valorUnitario: 80,
      valorTotal: 80
    };
    
    let x = marginLeft;
    doc.setFillColor(40, 40, 40);
    doc.setTextColor(255, 255, 255);
    
    const headersAgrupados = [
      { label: 'Código', width: colWidthsAgrupados.codigo },
      { label: 'Descrição', width: colWidthsAgrupados.descricao },
      { label: 'Qtd. Total', width: colWidthsAgrupados.quantidade },
      { label: 'Valor Unit.', width: colWidthsAgrupados.valorUnitario },
      { label: 'Valor Total', width: colWidthsAgrupados.valorTotal }
    ];
    
    // Fundo do cabeçalho
    const headerHeight = lineHeight + 4;
    doc.rect(x, y - headerHeight + 2, headersAgrupados.reduce((acc, h) => acc + h.width, 0), headerHeight, 'F');
    
    headersAgrupados.forEach(h => {
      doc.text(h.label, x + 2, y);
      x += h.width;
    });
    
    // Linha abaixo do cabeçalho
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, y + 4, marginLeft + headersAgrupados.reduce((acc, h) => acc + h.width, 0), y + 4);
    
    y += lineHeight + 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    
    // Dados dos atos agrupados
    atosAgrupados.forEach(ato => {
      y = checkPageBreak(y);
      x = marginLeft;
      
      const rowDataAgrupados = [
        ato.codigo,
        ato.descricao,
        ato.quantidade.toString(),
        formatarMoeda(ato.valorUnitario),
        formatarMoeda(ato.valorTotal)
      ];
      
      rowDataAgrupados.forEach((text, i) => {
        const maxWidth = headersAgrupados[i].width - 4;
        let displayText = text;
        
        if (doc.getTextWidth(text) > maxWidth) {
          while (doc.getTextWidth(displayText + '...') > maxWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          displayText += '...';
        }
        
        doc.text(displayText, x + 2, y);
        x += headersAgrupados[i].width;
      });
      
      // Linha abaixo de cada linha de dados
      const linhaY = y + lineHeight - 2;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      doc.line(
        marginLeft,
        linhaY,
        marginLeft + headersAgrupados.reduce((acc, h) => acc + h.width, 0),
        linhaY
      );
      
      y += lineHeight + 2;
    });
    
    y += lineHeight; // Espaço antes da próxima seção
  }

  // ===== TABELA DETALHADA ORIGINAL =====
  y = checkPageBreak(y + lineHeight);
  
  // Título da tabela detalhada
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DETALHAMENTO DOS PAGAMENTOS', marginLeft, y);
  y += lineHeight + 5;

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

  atos.forEach(ato => {
    x = marginLeft;
    y = checkPageBreak(y);

    // Compatibilidade para os campos de pagamento
    const dinheiro = ato.pagamentos?.dinheiro?.valor || 0;
    const cartao = ato.pagamentos?.cartao?.valor || 0;
    const pix = ato.pagamentos?.pix?.valor || 0;
    const crc = ato.pagamentos?.crc?.valor || 0;
    const depositoPrevio = ato.pagamentos?.depositoPrevio?.valor || 0;

    const somaPagamentos = dinheiro + cartao + pix + crc + depositoPrevio;
    const valorTotalAto = (ato.valor_unitario || 0) * (ato.quantidade || 1);
    const valorFaltante = valorTotalAto - somaPagamentos;

    const formatarQtdeValor = (pagamento) => {
      if (pagamento && typeof pagamento === 'object') {
        return `Qtde: ${pagamento.quantidade || 0}\nVal: ${formatarMoeda(pagamento.valor || 0)}`;
      }
      return `Qtde: 0\nVal: ${formatarMoeda(0)}`;
    };

    const rowData = [
      (ato.quantidade || 1).toString(),
      ato.codigo || '',
      ato.descricao || '',
      formatarMoeda(valorTotalAto),
      formatarMoeda(valorFaltante),
      formatarQtdeValor(ato.pagamentos?.dinheiro),
      formatarQtdeValor(ato.pagamentos?.cartao),
      formatarQtdeValor(ato.pagamentos?.pix),
      formatarQtdeValor(ato.pagamentos?.crc),
      formatarQtdeValor(ato.pagamentos?.depositoPrevio),
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

    // Linha preta fina abaixo de cada linha de dados
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

  const dataFormatada = formatarDataParaNomeArquivo(dataRelatorio);
  doc.save(`${dataFormatada}_${nomeArquivo || 'FechamentoCaixa.pdf'}`);
}