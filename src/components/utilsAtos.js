// utilsAtos.js

// Detecta o layout do PDF
export function detectarLayoutPDF(texto) {
  if (/^\d{5}R\$/.test(texto.replace(/\n/g, ''))) return 'novo';
  if (texto.split('\n').some(l => /^\d{5}R\$/.test(l))) return 'novo';
  return 'antigo';
}

// Extração para layout antigo
export function extrairDadosAntigo(texto) {
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let dataRelatorio = null;
  for (const linha of linhas) {
    const matchData = linha.match(/Emissão:\s*(\d{2}\/\d{2}\/\d{4})/);
    if (matchData) {
      dataRelatorio = matchData[1];
      break;
    }
  }
  const atos = [];
  const regexInicioAto = /^(\d+)\s*-\s*(.+)$/;
  const regexCodigo = /^\d{4,}$/;
  const regexValor = /^R\$\s?([\d\.,]+)/;
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const matchInicio = linha.match(regexInicioAto);
    if (matchInicio) {
      const quantidade = parseInt(linhas[i - 1]) || 0;
      let descricao = matchInicio[2];
      let codigo = '';
      let valores = [];
      let j = i + 1;
      while (j < linhas.length && !regexCodigo.test(linhas[j])) {
        descricao += ' ' + linhas[j];
        j++;
      }
      if (j < linhas.length) {
        codigo = linhas[j];
        let k = j + 1;
        while (k < linhas.length) {
          // Interrompe se encontrar início de novo ato ou linha de totalização
          if (linhas[k].match(regexInicioAto)) break;
          if (/Qtde. Selo/i.test(linhas[k])) break;
          // Só coleta se for valor
          const matchValor = linhas[k].match(regexValor);
          if (matchValor) {
            valores.push(matchValor[1]);
            k++;
          } else {
            // Se não for valor, para de coletar
            break;
          }
        }
      }
      let valorTotal = 0;
      if (valores.length > 0) {
        const ultimoValor = valores[valores.length - 1];
        valorTotal = parseFloat(ultimoValor.replace(/\./g, '').replace(',', '.')) || 0;
      }
      atos.push({
        id: i,
        quantidade,
        codigo,
        descricao,
        valorTotal,
        pagamentoDinheiro: { quantidade: 0, valor: 0, valorManual: false },
        pagamentoCartao: { quantidade: 0, valor: 0, valorManual: false },
        pagamentoPix: { quantidade: 0, valor: 0, valorManual: false },
        pagamentoCRC: { quantidade: 0, valor: 0, valorManual: false },
        depositoPrevio: { quantidade: 0, valor: 0, valorManual: false },
        observacoes: '',
      });
      i = j;
    }
  }
  return { dataRelatorio, atos };
}

// Extração para layout novo
export function extrairDadosNovo(texto) {
  console.log('Texto recebido para extração:', texto.substring(0, 500));

  const atos = [];
  let dataRelatorio = null;

  // Extrair data do relatório
  const matchData = texto.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (matchData) {
    dataRelatorio = matchData[1];
    console.log('Data do relatório encontrada:', dataRelatorio);
  }

  // Extrair linhas da tabela de atos
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Encontrar o início da tabela (linha com "CÓDIGO")
  let idxTabela = linhas.findIndex(l => l.toUpperCase().includes('CÓDIGO'));
  if (idxTabela === -1) {
    console.warn('Cabeçalho da tabela não encontrado!');
    return { dataRelatorio, atos };
  }

  // Percorrer linhas após o cabeçalho até encontrar "TOTAL" ou "ASSINATURA"
  for (let i = idxTabela + 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (/TOTAL|ASSINATURA/i.test(linha)) break;

    // Regex para linha de ato: código, emolumento, recompe, tfj, total, descrição
    // Exemplo: 1001   R$ 100,00   R$ 10,00   R$ 5,00   R$ 115,00   Descrição do ato
    const match = linha.match(/^(\d{4,5})\s+R\$ ?([\d,.]+)\s+R\$ ?([\d,.]+)\s+R\$ ?([\d,.]+)\s+R\$ ?([\d,.]+)\s+(.+)$/);
    if (match) {
      atos.push({
        id: atos.length,
        quantidade: 1, // Se houver campo de quantidade, ajuste aqui
        codigo: match[1],
        emolumento: parseFloat(match[2].replace('.', '').replace(',', '.')),
        recompe: parseFloat(match[3].replace('.', '').replace(',', '.')),
        tfj: parseFloat(match[4].replace('.', '').replace(',', '.')),
        valorTotal: parseFloat(match[5].replace('.', '').replace(',', '.')),
        descricao: match[6],
        pagamentoDinheiro: { quantidade: 0, valor: 0, valorManual: false },
        pagamentoCartao: { quantidade: 0, valor: 0, valorManual: false },
        pagamentoPix: { quantidade: 0, valor: 0, valorManual: false },
        pagamentoCRC: { quantidade: 0, valor: 0, valorManual: false },
        depositoPrevio: { quantidade: 0, valor: 0, valorManual: false },
        observacoes: '',
      });
    }
  }

  console.log('Atos extraídos:', atos);
  return { dataRelatorio, atos };
}

// Função principal de extração
export function extrairDadosDoTexto(texto) {
  const tipo = detectarLayoutPDF(texto);
  if (tipo === 'novo') return extrairDadosNovo(texto);
  return extrairDadosAntigo(texto);
}

// Formata número para moeda BRL
export function formatarMoeda(valor) {
  if (isNaN(valor) || valor === null) return '';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Converte string moeda para número
export function moedaParaNumero(valorStr) {
  if (!valorStr) return 0;
  
  // Remove todos os caracteres que não são dígitos, vírgula ou ponto
  let num = valorStr.toString().replace(/[^\d,.-]/g, '');
  
  // Se tem vírgula e ponto, assume formato brasileiro (1.234,56)
  if (num.includes(',') && num.includes('.')) {
    num = num.replace(/\./g, '').replace(',', '.');
  }
  // Se tem apenas vírgula, assume que é decimal brasileiro (123,45)
  else if (num.includes(',') && !num.includes('.')) {
    num = num.replace(',', '.');
  }
  // Se tem apenas ponto, pode ser decimal americano (123.45) ou separador de milhares (1.234)
  else if (num.includes('.') && !num.includes(',')) {
    // Se tem mais de 3 dígitos após o ponto, provavelmente é separador de milhares
    const partes = num.split('.');
    if (partes.length === 2 && partes[1].length <= 2) {
      // Formato decimal americano (123.45)
      num = num;
    } else {
      // Formato com separador de milhares (1.234)
      num = num.replace(/\./g, '');
    }
  }
  
  const resultado = parseFloat(num) || 0;
  console.log('moedaParaNumero:', { entrada: valorStr, processado: num, resultado });
  return resultado;
}

// Calcula valor total com ISS
export function calcularValorTotalComISS(valorTotal, percentualISS) {
  const perc = parseFloat(percentualISS) || 0;
  const resultado = valorTotal * (1 + perc / 100);
  return parseFloat(resultado.toFixed(2));
}