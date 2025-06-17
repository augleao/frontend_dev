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