// utilsAtos.js

// Detecta o layout do PDF
export function detectarLayoutPDF(texto) {
  if (/^\d{5}R\$/.test(texto.replace(/\n/g, ''))) return 'novo';
  if (texto.split('\n').some(l => /^\d{5}R\$/.test(l))) return 'novo';
  return 'antigo';
}

// Extração para layout CartosoftWeb
export function extrairDadosWEB(texto) {
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

// Extração para layout Cartosoft Desktop
export function extrairDadosDesktop(texto) {
  console.log('Texto recebido para extração:', texto.substring(0, 200));
  
  const atos = [];
  let dataRelatorio = null;
  
  // Extrair data do relatório
  const matchData = texto.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (matchData) {
    dataRelatorio = matchData[1];
    console.log('Data do relatório encontrada:', dataRelatorio);
  }
  
  // Novo padrão baseado no log: quantidade + código + valores + descrição
  // Exemplo: "11501R$ 7,60R$ 0,57R$ 2,54R$ 10,715 - Reconhecimento de firma - a) Por assinatura"
  const padraoAto = /(\d)(\d{4})R\$\s*([\d,]+)R\$\s*([\d,]+)R\$\s*([\d,]+)R\$\s*([\d,]+)(\d+\s*-\s*[^]+?)(?=\d\d{4}R\$|$)/g;
  
  let match;
  let id = 0;
  
  while ((match = padraoAto.exec(texto)) !== null) {
    const quantidade = parseInt(match[1]);
    const codigo = match[2];
    const emolumento = parseFloat(match[3].replace(',', '.'));
    const recompe = parseFloat(match[4].replace(',', '.'));
    const tfj = parseFloat(match[5].replace(',', '.'));
    const valorTotal = parseFloat(match[6].replace(',', '.'));
    const descricao = match[7].trim();
    
    console.log(`Ato encontrado: Qtd=${quantidade}, Código=${codigo}, Desc=${descricao}`);
    
    atos.push({
      id: id++,
      quantidade: quantidade,
      codigo: codigo,
      emolumento: emolumento,
      recompe: recompe,
      tfj: tfj,
      valorTotal: valorTotal,
      descricao: descricao
    });
  }
  
  // Se não encontrou atos com o padrão principal, tentar abordagem alternativa
  if (atos.length === 0) {
    console.log('Tentando abordagem alternativa...');
    
    // Buscar por padrões individuais no texto
    const linhasAtos = texto.match(/\d\d{4}R\$[\s\S]*?(?=\d\d{4}R\$|Emitido em:|$)/g);
    
    if (linhasAtos) {
      console.log('Linhas de atos encontradas:', linhasAtos.length);
      
      linhasAtos.forEach((linha, index) => {
        console.log(`Linha ${index + 1}:`, linha);
        // Extrair dados de cada linha
        const matchLinha = linha.match(/(\d)(\d{4})R\$\s*([\d,]+)R\$\s*([\d,]+)R\$\s*([\d,]+)R\$\s*([\d,]+)(.+)/);
        
        if (matchLinha) {
          const quantidade = parseInt(matchLinha[1]);
          const codigo = matchLinha[2];
          const emolumento = parseFloat(matchLinha[3].replace(',', '.'));
          const recompe = parseFloat(matchLinha[4].replace(',', '.'));
          const tfj = parseFloat(matchLinha[5].replace(',', '.'));
          const valorTotal = parseFloat(matchLinha[6].replace(',', '.'));
          let descricao = matchLinha[7].trim();
          
          // Limpar a descrição removendo números e caracteres extras
          descricao = descricao.replace(/^\d+\s*-\s*/, '').trim();
          
          console.log(`Ato alternativo encontrado: Qtd=${quantidade}, Código=${codigo}, Desc=${descricao}`);
          
          atos.push({
            id: index,
            quantidade: quantidade,
            codigo: codigo,
            emolumento: emolumento,
            recompe: recompe,
            tfj: tfj,
            valorTotal: valorTotal,
            descricao: descricao
          });
        }
      });
    }
  }
  
  console.log('Atos extraídos:', atos);
  return { dataRelatorio, atos };
}

// Função principal de extração
export function extrairDadosDoTexto(texto) {
  const tipo = detectarLayoutPDF(texto);
  if (tipo === 'novo') return extrairDadosWEB(texto);
  return extrairDadosDeskstop(texto);
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