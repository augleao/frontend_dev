const fs = require('fs');
const pdfParse = require('pdf-parse');

async function debugPdfText() {
  const pdfPath = process.argv[2];
  
  if (!pdfPath) {
    console.error('❌ Uso: node debug_pdf_text.js <caminho-para-pdf>');
    process.exit(1);
  }

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ Arquivo não encontrado: ${pdfPath}`);
    process.exit(1);
  }

  console.log(`📄 Analisando: ${pdfPath}\n`);

  try {
    const buffer = fs.readFileSync(pdfPath);
    const result = await pdfParse(buffer);
    const text = result.text;
    
    console.log('=== TEXTO COMPLETO DO PDF ===\n');
    console.log(text);
    console.log('\n=== FIM DO TEXTO ===\n');
    
    console.log('=== LINHAS RELEVANTES (busca por palavras-chave) ===\n');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    
    const keywords = [
      'recompe',
      'ferrfis',
      'repasse',
      'responsável',
      'responsavel',
      'depósito',
      'deposito',
      'prévio',
      'previo',
      'saldo',
      'apurado',
      'depositado',
      'valores recebidos'
    ];
    
    lines.forEach((line, idx) => {
      const lowerLine = line.toLowerCase();
      const hasKeyword = keywords.some(kw => lowerLine.includes(kw.toLowerCase()));
      
      if (hasKeyword) {
        console.log(`[Linha ${idx + 1}] ${line}`);
      }
    });
    
    console.log('\n=== ANÁLISE ESTATÍSTICA ===');
    console.log(`Total de caracteres: ${text.length}`);
    console.log(`Total de linhas: ${lines.length}`);
    console.log(`Linhas com palavras-chave: ${lines.filter(line => {
      const lowerLine = line.toLowerCase();
      return keywords.some(kw => lowerLine.includes(kw.toLowerCase()));
    }).length}`);

  } catch (error) {
    console.error('❌ Erro ao processar PDF:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugPdfText();
