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

  // ... continue com a tabela de atos pagos, se desejar ...

  // Salvar PDF
  const dataFormatada = dataRelatorio.replace(/\//g, '-');
  doc.save(`${dataFormatada}_relatorio_atos_pagos.pdf`);
}