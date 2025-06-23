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
        for (let k = j + 1; k < linhas.length; k++) {
          if (linhas[k].match(regexInicioAto)) break;
          const matchValor = linhas[k].match(regexValor);
          if (matchValor) valores.push(matchValor[1]);
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

  // Ajuste do valorTotal na última linha dos atos
  if (atos.length > 0) {
    const ultimoAto = atos[atos.length - 1];
    if (ultimoAto.quantidade > 0 && ultimoAto.valorTotal > 0) {
      // Dividir o valor total da última coluna pela quantidade para obter valor unitário
      ultimoAto.valorTotal = ultimoAto.valorTotal / ultimoAto.quantidade;
    }
  }

  return { dataRelatorio, atos };
}
// Extração para layout novo CARTOSOFT DESKTOP
function preprocessarTexto(texto) {
  // Insere espaço entre número e "R$" para separar valores
  let textoProcessado = texto.replace(/(\d)(R\$)/g, '$1 $2');
  // Insere espaço entre "R$" e número para separar valores
  textoProcessado = textoProcessado.replace(/(R\$)(\d)/g, '$1 $2');
  // Insere espaço entre número e letra para separar código e descrição
  textoProcessado = textoProcessado.replace(/(\d)([A-Za-z])/g, '$1 $2');
  // Remove múltiplos espaços
  textoProcessado = textoProcessado.replace(/\s{2,}/g, ' ');
  return textoProcessado;
}

export function extrairDadosNovo(texto) {
  const textoProcessado = preprocessarTexto(texto);
  console.log('Texto processado (início):', textoProcessado.slice(0, 500));

  const regex = /(\d+)\s+(\d{4})\s+R\$ ([\d.,]+)\s+R\$ ([\d.,]+)\s+R\$ ([\d.,]+)\s+R\$ ([\d.,]+)\s+-\s+(.*?)(?=\d+\s+\d{4}\s+R\$|$)/g;
  const atos = [];
  let match;
  let id = 0;

  while ((match = regex.exec(textoProcessado)) !== null) {
    atos.push({
      id: id++,
      quantidade: parseInt(match[1]),
      codigo: match[2],
      emolumento: parseFloat(match[3].replace(/\./g, '').replace(',', '.')),
      recompe: parseFloat(match[4].replace(/\./g, '').replace(',', '.')),
      tfj: parseFloat(match[5].replace(/\./g, '').replace(',', '.')),
      valorTotal: parseFloat(match[6].replace(/\./g, '').replace(',', '.')),
      descricao: match[7].trim(),
      pagamentoDinheiro: { quantidade: 0, valor: 0, valorManual: false },
      pagamentoCartao: { quantidade: 0, valor: 0, valorManual: false },
      pagamentoPix: { quantidade: 0, valor: 0, valorManual: false },
      pagamentoCRC: { quantidade: 0, valor: 0, valorManual: false },
      depositoPrevio: { quantidade: 0, valor: 0, valorManual: false },
      observacoes: '',
    });
  }

  // Ajuste do valorTotal da última linha
  if (atos.length > 0) {
    const ultimoAto = atos[atos.length - 1];
    if (ultimoAto.quantidade > 0 && ultimoAto.valorTotal > 0) {
      ultimoAto.valorTotal = ultimoAto.valorTotal / ultimoAto.quantidade;
    }
  }

  return { dataRelatorio: null, atos };
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
  const num = valorStr.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(num) || 0;
}

// Calcula valor total com ISS
export function calcularValorTotalComISS(valorTotal, percentualISS) {
  const perc = parseFloat(percentualISS) || 0;
  const resultado = valorTotal * (1 + perc / 100);
  return parseFloat(resultado.toFixed(2));
}