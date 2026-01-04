const fs = require('fs');
const path = require('path');
const { parseDapPdf } = require('./services/dapParser');

async function testExtraction() {
  // Procura por um arquivo PDF de teste
  const testPdfPath = process.argv[2];
  
  if (!testPdfPath) {
    console.error('❌ Uso: node teste_extracao_campos.js <caminho-para-pdf>');
    process.exit(1);
  }

  if (!fs.existsSync(testPdfPath)) {
    console.error(`❌ Arquivo não encontrado: ${testPdfPath}`);
    process.exit(1);
  }

  console.log(`📄 Testando extração de: ${path.basename(testPdfPath)}\n`);

  try {
    const buffer = fs.readFileSync(testPdfPath);
    const result = await parseDapPdf({ buffer });

    console.log('✅ Parser executado com sucesso!\n');
    console.log('=== HEADER EXTRAÍDO ===');
    console.log(`Mês/Ano: ${result.header.mesReferencia}/${result.header.anoReferencia}`);
    console.log(`Serventia: ${result.header.serventiaNome}`);
    console.log(`Código: ${result.header.codigoServentia}`);
    console.log(`CNPJ: ${result.header.cnpj}`);
    console.log(`Código Recibo: ${result.header.codigoRecibo}`);
    console.log(`Data Transmissão: ${result.header.dataTransmissao}`);
    console.log(`Observações: ${result.header.observacoes || '(nenhuma)'}\n`);

    console.log('=== CAMPOS MONETÁRIOS ===');
    const monetaryFields = [
      { label: 'Emolumento Apurado', value: result.header.emolumentoApurado },
      { label: 'TFJ Apurada', value: result.header.taxaFiscalizacaoJudiciariaApurada },
      { label: 'TFJ Paga', value: result.header.taxaFiscalizacaoJudiciariaPaga },
      { label: 'RECOMPE Apurado', value: result.header.recompeApurado },
      { label: 'RECOMPE Depositado', value: result.header.recompeDepositado },
      { label: 'Valores Recebidos RECOMPE', value: result.header.valoresRecebidosRecompe },
      { label: 'Valores Recebidos FERRFIS', value: result.header.valoresRecebidosFerrfis },
      { label: 'ISSQN Recebido Usuários', value: result.header.issqnRecebidoUsuarios },
      { label: 'Repasses Responsáveis Anteriores', value: result.header.repassesResponsaveisAnteriores },
      { label: 'Saldo Depósito Prévio', value: result.header.saldoDepositoPrevio },
      { label: 'Total Despesas Mês', value: result.header.totalDespesasMes },
      { label: 'Estoque Selos Eletrônicos', value: result.header.estoqueSelosEletronicosTransmissao }
    ];

    let extractedCount = 0;
    monetaryFields.forEach(({ label, value }) => {
      const status = value !== null && value !== undefined ? '✅' : '❌';
      const display = value !== null && value !== undefined ? value : 'NÃO EXTRAÍDO';
      console.log(`${status} ${label}: ${display}`);
      if (value !== null && value !== undefined) extractedCount++;
    });

    console.log(`\n📊 Campos extraídos: ${extractedCount}/${monetaryFields.length}`);

    if (result.periodosDap && result.periodosDap.length > 0) {
      console.log(`\n=== PERÍODOS ===`);
      console.log(`Total de períodos: ${result.periodosDap.length}`);
      result.periodosDap.forEach(p => {
        console.log(`  Período ${p.ordem}: ${p.atos ? p.atos.length : 0} atos`);
      });
    }

    if (extractedCount < monetaryFields.length / 2) {
      console.warn('\n⚠️  Muitos campos não foram extraídos. Possíveis causas:');
      console.warn('   - Labels no PDF diferem dos esperados');
      console.warn('   - Estrutura do PDF não padrão');
      console.warn('   - Valores em formato inesperado');
    }

  } catch (error) {
    console.error('❌ Erro ao processar PDF:', error.message);
    if (error.name === 'DapParseError') {
      console.error('   Tipo: Erro de parsing da DAP');
    }
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

testExtraction();
