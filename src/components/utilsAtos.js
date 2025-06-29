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
  console.log('Texto recebido para extração:', texto.substring(0, 500));
  
  const atos = [];
  let dataRelatorio = null;
  
  // Extrair data do relatório
  const matchData = texto.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (matchData) {
    dataRelatorio = matchData[1];
    console.log('Data do relatório encontrada:', dataRelatorio);
  }
  
  // Extrair quantidades e descrições da primeira seção
  const quantidadesDescricoes = {};
  const linhas = texto.split('\n');
  let capturandoDescricoes = false;
  let numeroAto = 1;
  
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    
    // Detectar início da seção de descrições
    if (linha.includes('QTDE. DESCRIÇÃO DO EMOLUMENTO')) {
      capturandoDescricoes = true;
      continue;
    }
    
    // Parar quando chegar na seção de totais
    if (linha.includes('TOTAL EMOLUMENTO LÍQUIDO') || linha.includes('CÓDIGO')) {
      capturandoDescricoes = false;
      break;
    }
    
    if (capturandoDescricoes && linha) {
      // Se a linha é apenas um número, é a quantidade
      if (/^\d+$/.test(linha)) {
        const quantidade = parseInt(linha);
        // A próxima linha deve ser a descrição
        if (i + 1 < linhas.length) {
          const descricao = linhas[i + 1].trim();
          // Filtrar linhas que não são descrições válidas
          if (descricao && 
              !(/^\d+$/.test(descricao)) && 
              !descricao.includes('QTDE. SELOS') &&
              !descricao.includes('TOTAL EMOLUMENTO') &&
              !descricao.includes('R$') &&
              descricao.includes(' - ')) {
            quantidadesDescricoes[numeroAto] = {
              quantidade: quantidade,
              descricao: descricao
            };
            console.log(`Ato ${numeroAto}: Qtd=${quantidade}, Desc=${descricao}`);
            numeroAto++;
            i++; // Pular a próxima linha já processada
          }
        }
      }
    }
  }
  
  // Extrair códigos e valores da tabela
  const tabelaMatch = texto.match(/CÓDIGO[\s\S]*?TOTAL[\s\S]*?ASSINATURA/);
  if (tabelaMatch) {
    const tabelaTexto = tabelaMatch[0];
    console.log('Texto da tabela encontrado:', tabelaTexto);
    
    // Extrair códigos
    const codigosMatch = tabelaTexto.match(/CÓDIGO\s+((?:\d{4}\s*)+)/);
    const codigos = codigosMatch ? codigosMatch[1].trim().split(/\s+/) : [];
    console.log('Códigos encontrados:', codigos);
    
    // Extrair emolumentos
    const emolumentosMatch = tabelaTexto.match(/EMOLUMENTO\s+((?:R\$\s*[\d,]+\s*)+)/);
    const emolumentos = emolumentosMatch ? 
      emolumentosMatch[1].match(/R\$\s*([\d,]+)/g)?.map(v => 
        parseFloat(v.replace('R$', '').replace(',', '.').trim())
      ) || [] : [];
    console.log('Emolumentos encontrados:', emolumentos);
    
    // Extrair RECOMPE
    const recompeMatch = tabelaTexto.match(/RECOMPE\s+((?:R\$\s*[\d,]+\s*)+)/);
    const recompes = recompeMatch ? 
      recompeMatch[1].match(/R\$\s*([\d,]+)/g)?.map(v => 
        parseFloat(v.replace('R$', '').replace(',', '.').trim())
      ) || [] : [];
    console.log('RECOMPE encontrados:', recompes);
    
    // Extrair TFJ
    const tfjs = [];
    const tfjMatch = tabelaTexto.match(/TFJ\s+((?:R\$\s*[\d,]+\s*)+)/);
    if (tfjMatch) {
      const tfjValues = tfjMatch[1].match(/R\$\s*([\d,]+)/g);
      if (tfjValues) {
        tfjValues.forEach(v => {
          tfjs.push(parseFloat(v.replace('R$', '').replace(',', '.').trim()));
        });
      }
    }
    console.log('TFJ encontrados:', tfjs);
    
    // Extrair totais
    const totaisMatch = tabelaTexto.match(/TOTAL\s+((?:R\$\s*[\d,]+\s*)+)/);
    const totais = totaisMatch ? 
      totaisMatch[1].match(/R\$\s*([\d,]+)/g)?.map(v => 
        parseFloat(v.replace('R$', '').replace(',', '.').trim())
      ) || [] : [];
    console.log('Totais encontrados:', totais);
    
    // Combinar todos os dados
    const maxLength = Math.max(codigos.length, emolumentos.length, recompes.length, tfjs.length, totais.length);
    
    for (let i = 0; i < maxLength; i++) {
      const codigo = codigos[i] || '';
      const emolumento = emolumentos[i] || 0;
      const recompe = recompes[i] || 0;
      const tfj = tfjs[i] || 0;
      const valorTotal = totais[i] || 0;
      
      // Buscar quantidade e descrição correspondente
      const dadosAto = quantidadesDescricoes[i + 1] || { quantidade: 1, descricao: 'Descrição não encontrada' };
      
      if (codigo) {
        atos.push({
          id: i,
          quantidade: dadosAto.quantidade,
          codigo: codigo,
          emolumento: emolumento,
          recompe: recompe,
          tfj: tfj,
          valorTotal: valorTotal,
          descricao: dadosAto.descricao,
          pagamentoDinheiro: { quantidade: 0, valor: 0, valorManual: false },
          pagamentoCartao: { quantidade: 0, valor: 0, valorManual: false },
          pagamentoPix: { quantidade: 0, valor: 0, valorManual: false },
          pagamentoCRC: { quantidade: 0, valor: 0, valorManual: false },
          depositoPrevio: { quantidade: 0, valor: 0, valorManual: false },
          observacoes: '',
        });
      }
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