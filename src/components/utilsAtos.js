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
  console.log("Texto recebido para extração:", texto.substring(0, 500) + "...");
  
  const atos = [];
  let dataRelatorio = null;
  
  // Extrair data do relatório
  const matchData = texto.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (matchData) {
    dataRelatorio = matchData[1];
    console.log("Data do relatório encontrada:", dataRelatorio);
  }
  
  // Extrair descrições dos atos (antes da tabela)
  const linhas = texto.split("\n");
  let capturandoDescricoes = false;
  const listaDescricoes = []; // Array para manter ordem das descrições
  
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    
    if (linha.includes("QTDE. DESCRIÇÃO DO EMOLUMENTO")) {
      capturandoDescricoes = true;
      continue;
    }
    
    if (linha.includes("QTDE. SELOS ELETRÔNICO")) {
      capturandoDescricoes = false;
      break;
    }
    
    if (capturandoDescricoes && linha) {
      // Procurar por padrão: número seguido de descrição
      const matchDescricao = linha.match(/^(\d+)$/);
      if (matchDescricao && i + 1 < linhas.length) {
        const qtde = parseInt(matchDescricao[1]);
        const proximaLinha = linhas[i + 1].trim();
        
        // A descrição está na próxima linha
        if (proximaLinha && !proximaLinha.match(/^\d+$/) && !proximaLinha.includes("QTDE. SELOS ELETRÔNICO")) {
          listaDescricoes.push({
            quantidade: qtde,
            descricao: proximaLinha
          });
          console.log(`Descrição coletada - Qtde: ${qtde}, Desc: ${proximaLinha}`);
        }
      }
    }
  }
  
  // Extrair dados da tabela de valores
  // Primeiro, vamos encontrar onde começam os códigos
  let indiceCodigo = -1;
  let indiceEmolumento = -1;
  let indiceRecompe = -1;
  let indiceTfj = -1;
  let indiceTotal = -1;
  
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (linha === "CÓDIGO") indiceCodigo = i;
    if (linha === "EMOLUMENTO") indiceEmolumento = i;
    if (linha === "RECOMPE") indiceRecompe = i;
    if (linha === "TFJ") indiceTfj = i;
    if (linha === "TOTAL") indiceTotal = i;
  }
  
  console.log("Índices encontrados:", { indiceCodigo, indiceEmolumento, indiceRecompe, indiceTfj, indiceTotal });
  
  if (indiceCodigo !== -1 && indiceEmolumento !== -1) {
    // Extrair códigos
    const codigos = [];
    for (let i = indiceCodigo + 1; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (linha.match(/^\d{4}$/)) {
        codigos.push(linha);
      } else if (linha === "EMOLUMENTO" || linha.includes("QTDE. SELOS ELETRÔNICO")) {
        break;
      }
    }
    
    // Extrair emolumentos
    const emolumentos = [];
    for (let i = indiceEmolumento + 1; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (linha.match(/^R\$\s*[\d.,]+$/)) {
        const valor = linha.replace("R$", "").trim();
        emolumentos.push(parseFloat(valor.replace(/\./g, "").replace(",", ".")));
      } else if (linha === "RECOMPE" || linha.includes("QTDE. SELOS ELETRÔNICO")) {
        break;
      }
    }
    
    // Extrair RECOMPE
    const recompes = [];
    if (indiceRecompe !== -1) {
      for (let i = indiceRecompe + 1; i < linhas.length; i++) {
        const linha = linhas[i].trim();
        if (linha.match(/^R\$\s*[\d.,]+$/)) {
          const valor = linha.replace("R$", "").trim();
          recompes.push(parseFloat(valor.replace(/\./g, "").replace(",", ".")));
        } else if (linha === "TFJ" || linha.includes("QTDE. SELOS ELETRÔNICO")) {
          break;
        }
      }
    }
    
    // Extrair TFJ
    const tfjs = [];
    if (indiceTfj !== -1) {
      for (let i = indiceTfj + 1; i < linhas.length; i++) {
        const linha = linhas[i].trim();
        if (linha.match(/^R\$\s*[\d.,]+$/)) {
          const valor = linha.replace("R$", "").trim();
          tfjs.push(parseFloat(valor.replace(/\./g, "").replace(",", ".")));
        } else if (linha === "TOTAL" || linha.includes("QTDE. SELOS ELETRÔNICO")) {
          break;
        }
      }
    }
    
    // Extrair TOTAL
    const totais = [];
    if (indiceTotal !== -1) {
      for (let i = indiceTotal + 1; i < linhas.length; i++) {
        const linha = linhas[i].trim();
        if (linha.match(/^R\$\s*[\d.,]+$/)) {
          const valor = linha.replace("R$", "").trim();
          totais.push(parseFloat(valor.replace(/\./g, "").replace(",", ".")));
        } else if (linha.includes("ASSINATURA") || linha.includes("QTDE. SELOS ELETRÔNICO")) {
          break;
        }
      }
    }
    
    console.log("Dados extraídos:", { codigos, emolumentos, recompes, tfjs, totais });
    console.log("Lista de descrições:", listaDescricoes);
    
    // Combinar os dados
    const minLength = Math.min(codigos.length, emolumentos.length, recompes.length, tfjs.length, totais.length);
    
    for (let i = 0; i < minLength; i++) {
      const codigo = codigos[i];
      
      // Usar descrição da lista por ordem (primeira descrição para primeiro código, etc.)
      const dadosDescricao = listaDescricoes[i] || { quantidade: 1, descricao: `Ato ${codigo}` };
      
      console.log(`Ato extraído - Código: ${codigo}, Emol: ${emolumentos[i]}, RECOMPE: ${recompes[i]}, TFJ: ${tfjs[i]}, Total: ${totais[i]}`);
      
      atos.push({
        id: i,
        quantidade: dadosDescricao.quantidade,
        codigo: codigo,
        descricao: dadosDescricao.descricao,
        emolumento: emolumentos[i],
        recompe: recompes[i],
        tfj: tfjs[i],
        valorTotal: totais[i],
        pagamentoDinheiro: { quantidade: 0, valor: 0, valorManual: false },
        pagamentoCartao: { quantidade: 0, valor: 0, valorManual: false },
        pagamentoPix: { quantidade: 0, valor: 0, valorManual: false },
        pagamentoCRC: { quantidade: 0, valor: 0, valorManual: false },
        depositoPrevio: { quantidade: 0, valor: 0, valorManual: false },
        observacoes: "",
      });
    }
  }
  
  console.log(`Total de atos extraídos: ${atos.length}`);
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