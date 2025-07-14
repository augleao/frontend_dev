// utilsAtos.js

// Detecta o layout do PDF
export function detectarLayoutPDF(texto) {
  console.log("Detectando layout do PDF...");
  console.log("Primeiros 300 caracteres:", texto.substring(0, 300));
  
  // Layout 3: Formato tabular específico do RELATORIO2.pdf
  // Detecta pela presença de indicadores do formato tabular
  const indicadoresLayout3 = [
    'QTDE. DESCRIÇÃO DO EMOLUMENTO CÓDIGO EMOLUMENTO RECOMPE TFJ FUNDO TOTAL',
    'DESCRIÇÃO DO EMOLUMENTO CÓDIGO EMOLUMENTO RECOMPE TFJ FUNDO',
    'CÓDIGO EMOLUMENTO RECOMPE TFJ FUNDO TOTAL'
  ];
  
  for (const indicador of indicadoresLayout3) {
    if (texto.includes(indicador)) {
      console.log("Layout 3 detectado (formato tabular) - indicador:", indicador);
      return 'layout3';
    }
  }
  
  // Verificação adicional: procurar por padrão específico do layout 3
  // Formato: QTDE + NÚMERO - DESCRIÇÃO + CÓDIGO + múltiplos R$ valores
  if (texto.includes('QTDE. DESCRIÇÃO DO EMOLUMENTO') && 
      texto.includes('CÓDIGO') && 
      texto.includes('EMOLUMENTO') && 
      texto.includes('RECOMPE') && 
      texto.includes('TFJ')) {
    console.log("Layout 3 detectado (formato tabular) - por padrão de colunas");
    return 'layout3';
  }
  
  // Layout 2: Formato com dados concatenados (mantido inalterado)
  if (/^\d{5}R\$/.test(texto.replace(/\n/g, ''))) {
    console.log("Layout 2 detectado (dados concatenados)");
    return 'novo';
  }
  if (texto.split('\n').some(l => /^\d{5}R\$/.test(l))) {
    console.log("Layout 2 detectado (dados concatenados - método 2)");
    return 'novo';
  }
  
  // Layout 1: Formato antigo (mantido inalterado)
  console.log("Layout 1 detectado (formato antigo)");
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
  
  const linhas = texto.split("\n");
  
  // MÉTODO 1: Tentar extração com dados concatenados (formato antigo)
  console.log("Tentando método 1: dados concatenados...");
  const regexAto = /(\d+)(\d{4})R\$\s*([\d.,]+)R\$\s*([\d.,]+)R\$\s*([\d.,]+)R\$\s*([\d.,]+)(.+)/g;
  let match;
  let id = 0;
  
  while ((match = regexAto.exec(texto)) !== null) {
    const quantidade = parseInt(match[1]);
    const codigo = match[2];
    const emolumento = parseFloat(match[3].replace(/\./g, "").replace(",", "."));
    const recompe = parseFloat(match[4].replace(/\./g, "").replace(",", "."));
    const tfj = parseFloat(match[5].replace(/\./g, "").replace(",", "."));
    const valorTotal = parseFloat(match[6].replace(/\./g, "").replace(",", "."));
    const descricao = match[7].trim();
    
    console.log(`Ato extraído (método 1) - Qtde: ${quantidade}, Código: ${codigo}, Emol: ${emolumento}, RECOMPE: ${recompe}, TFJ: ${tfj}, Total: ${valorTotal}, Desc: ${descricao}`);
    
    atos.push({
      id: id++,
      quantidade: quantidade,
      codigo: codigo,
      descricao: descricao,
      emolumento: emolumento,
      recompe: recompe,
      tfj: tfj,
      valorTotal: valorTotal,
      pagamentoDinheiro: { quantidade: 0, valor: 0, valorManual: false },
      pagamentoCartao: { quantidade: 0, valor: 0, valorManual: false },
      pagamentoPix: { quantidade: 0, valor: 0, valorManual: false },
      pagamentoCRC: { quantidade: 0, valor: 0, valorManual: false },
      depositoPrevio: { quantidade: 0, valor: 0, valorManual: false },
      observacoes: "",
    });
  }
  
  // MÉTODO 2: Se não encontrou atos, tentar extração por seções separadas (formato novo)
  if (atos.length === 0) {
    console.log("Método 1 falhou. Tentando método 2: seções separadas...");
    
    // Extrair descrições dos atos
    const listaDescricoes = [];
    let capturandoDescricoes = false;
    
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      
      if (linha.includes("QTDE.") && linha.includes("DESCRIÇÃO DO EMOLUMENTO")) {
        capturandoDescricoes = true;
        continue;
      }
      
      if (linha.includes("QTDE. SELOS ELETRÔNICO")) {
        capturandoDescricoes = false;
        break;
      }
      
      if (capturandoDescricoes && linha) {
        const matchDescricao = linha.match(/^(\d+)$/);
        if (matchDescricao && i + 1 < linhas.length) {
          const qtde = parseInt(matchDescricao[1]);
          const proximaLinha = linhas[i + 1].trim();
          
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
    
    // Extrair dados da tabela de valores por seções
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
        } else if (linha === "RECOMPE" || linha === "RECO" || linha.includes("QTDE. SELOS ELETRÔNICO")) {
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
      
      console.log("Dados extraídos (método 2):", { codigos, emolumentos, recompes, tfjs, totais });
      console.log("Lista de descrições:", listaDescricoes);
      
      // Combinar os dados por ordem
      const minLength = Math.min(
        codigos.length, 
        emolumentos.length, 
        Math.max(recompes.length, 1), // RECOMPE pode estar vazio
        Math.max(tfjs.length, 1),     // TFJ pode estar vazio
        Math.max(totais.length, 1)    // TOTAL pode estar vazio
      );
      
      for (let i = 0; i < minLength; i++) {
        const codigo = codigos[i];
        const dadosDescricao = listaDescricoes[i] || { quantidade: 1, descricao: `Ato ${codigo}` };
        const emolumento = emolumentos[i] || 0;
        const recompe = recompes[i] || 0;
        const tfj = tfjs[i] || 0;
        const valorTotal = totais[i] || emolumento + recompe + tfj;
        
        console.log(`Ato extraído (método 2) - Código: ${codigo}, Emol: ${emolumento}, RECOMPE: ${recompe}, TFJ: ${tfj}, Total: ${valorTotal}`);
        
        atos.push({
          id: id++,
          quantidade: dadosDescricao.quantidade,
          codigo: codigo,
          descricao: dadosDescricao.descricao,
          emolumento: emolumento,
          recompe: recompe,
          tfj: tfj,
          valorTotal: valorTotal,
          pagamentoDinheiro: { quantidade: 0, valor: 0, valorManual: false },
          pagamentoCartao: { quantidade: 0, valor: 0, valorManual: false },
          pagamentoPix: { quantidade: 0, valor: 0, valorManual: false },
          pagamentoCRC: { quantidade: 0, valor: 0, valorManual: false },
          depositoPrevio: { quantidade: 0, valor: 0, valorManual: false },
          observacoes: "",
        });
      }
    }
  }
  
  // MÉTODO 3: Se ainda não encontrou atos, tentar extração direta das linhas de dados
  if (atos.length === 0) {
    console.log("Método 2 falhou. Tentando método 3: extração direta das linhas de dados...");
    
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      
      // Regex para capturar dados diretamente das linhas
      // Formato: QTDE + CÓDIGO + R$ valor + R$ valor + descrição
      const matchDados = linha.match(/^(\d+)(\d{4})R\$\s*([\d.,]+)R\$\s*([\d.,]+)(.*)$/);
      if (matchDados) {
        const quantidade = parseInt(matchDados[1]);
        const codigo = matchDados[2];
        const emolumento = parseFloat(matchDados[3].replace(/\./g, "").replace(",", "."));
        const recompe = parseFloat(matchDados[4].replace(/\./g, "").replace(",", "."));
        let descricao = matchDados[5].trim();
        
        // Remover hífen inicial se existir
        if (descricao.startsWith("- ")) {
          descricao = descricao.substring(2);
        }
        
        // Calcular total (assumindo TFJ = 0 se não informado)
        const tfj = 0;
        const valorTotal = emolumento + recompe + tfj;
        
        console.log(`Ato extraído (método 3) - Qtde: ${quantidade}, Código: ${codigo}, Emol: ${emolumento}, RECOMPE: ${recompe}, TFJ: ${tfj}, Total: ${valorTotal}, Desc: ${descricao}`);
        
        atos.push({
          id: id++,
          quantidade: quantidade,
          codigo: codigo,
          descricao: descricao,
          emolumento: emolumento,
          recompe: recompe,
          tfj: tfj,
          valorTotal: valorTotal,
          pagamentoDinheiro: { quantidade: 0, valor: 0, valorManual: false },
          pagamentoCartao: { quantidade: 0, valor: 0, valorManual: false },
          pagamentoPix: { quantidade: 0, valor: 0, valorManual: false },
          pagamentoCRC: { quantidade: 0, valor: 0, valorManual: false },
          depositoPrevio: { quantidade: 0, valor: 0, valorManual: false },
          observacoes: "",
        });
      }
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