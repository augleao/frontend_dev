import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';

// Desabilitar worker para evitar problemas de carregamento
pdfjsLib.GlobalWorkerOptions.workerSrc = false;

function RelatorioCNJ() {
  const navigate = useNavigate();
  const [arquivos, setArquivos] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [progresso, setProgresso] = useState('');

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length !== 6) {
      setErro('É necessário selecionar exatamente 6 arquivos PDF.');
      return;
    }

    // Verificar se todos são PDFs
    const todosPDFs = files.every(file => file.type === 'application/pdf');
    if (!todosPDFs) {
      setErro('Todos os arquivos devem ser PDFs.');
      return;
    }

    setArquivos(files);
    setErro('');
  };

  const extrairTextoPDF = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Configurar PDF.js para não usar worker
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      });
      
      const pdf = await loadingTask.promise;
      let textoCompleto = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        textoCompleto += pageText + ' ';
      }

      return textoCompleto;
    } catch (error) {
      console.error('Erro na extração de texto:', error);
      throw error;
    }
  };

  const extrairValorMonetario = (texto, padrao) => {
    try {
      // Múltiplas tentativas de regex para capturar valores monetários
      const patterns = [
        new RegExp(padrao + '\\s*R?\\$?\\s*([\\d.,]+)', 'i'),
        new RegExp(padrao + '.*?R\\$\\s*([\\d.,]+)', 'i'),
        new RegExp(padrao + '.*?([\\d.,]+)', 'i')
      ];

      for (const regex of patterns) {
        const match = texto.match(regex);
        if (match && match[1]) {
          // Converter formato brasileiro para número
          let valor = match[1].replace(/\./g, '').replace(',', '.');
          const numero = parseFloat(valor);
          if (!isNaN(numero)) {
            return numero;
          }
        }
      }
      return 0;
    } catch (error) {
      console.error('Erro ao extrair valor monetário:', error);
      return 0;
    }
  };

  const extrairAtosPraticados = (texto) => {
    try {
      // Procurar por padrões de total de atos
      const patterns = [
        /Total\s+(\d+)\s+R?\$?[\d.,]+$/gm,
        /Total\s+(\d+)$/gm,
        /(\d+)\s+Total/gm
      ];

      let maiorTotal = 0;
      
      for (const pattern of patterns) {
        const matches = [...texto.matchAll(pattern)];
        for (const match of matches) {
          const numero = parseInt(match[1]);
          if (!isNaN(numero) && numero > maiorTotal) {
            maiorTotal = numero;
          }
        }
      }

      return maiorTotal;
    } catch (error) {
      console.error('Erro ao extrair atos praticados:', error);
      return 0;
    }
  };

  const extrairDadosPDF = async (file) => {
    try {
      const texto = await extrairTextoPDF(file);
      console.log(`Texto extraído de ${file.name}:`, texto.substring(0, 1000));
      
      // Extrair dados específicos baseados no padrão do TJMG
      const atosPraticados = extrairAtosPraticados(texto);
      const emolumentoApurado = extrairValorMonetario(texto, 'Emolumento Apurado');
      const tfj = extrairValorMonetario(texto, 'Taxa de Fiscalização Judiciária Apurada');
      const valoresRecompe = extrairValorMonetario(texto, 'Valores recebidos do RECOMPE');
      const issqn = extrairValorMonetario(texto, 'ISSQN recebido dos usuários');
      const recompeApurado = extrairValorMonetario(texto, 'RECOMPE.*?Apurado');
      const totalDespesas = extrairValorMonetario(texto, 'Total de despesas do mês');

      const dadosExtraidos = {
        atosPraticados,
        emolumentoApurado: emolumentoApurado.toFixed(2),
        tfj: tfj.toFixed(2),
        valoresRecompe: valoresRecompe.toFixed(2),
        issqn: issqn.toFixed(2),
        recompeApurado: recompeApurado.toFixed(2),
        totalDespesas: totalDespesas.toFixed(2),
        nomeArquivo: file.name
      };

      console.log(`Dados extraídos de ${file.name}:`, dadosExtraidos);
      return dadosExtraidos;

    } catch (error) {
      console.error('Erro ao extrair dados do PDF:', error);
      throw new Error(`Erro ao processar ${file.name}: ${error.message}`);
    }
  };

  const processarArquivos = async () => {
    if (arquivos.length !== 6) {
      setErro('Selecione exatamente 6 arquivos PDF.');
      return;
    }

    setProcessando(true);
    setErro('');
    setProgresso('Iniciando processamento...');

    try {
      const dadosExtraidos = [];
      
      for (let i = 0; i < arquivos.length; i++) {
        setProgresso(`Processando arquivo ${i + 1} de 6: ${arquivos[i].name}`);
        const dados = await extrairDadosPDF(arquivos[i]);
        dadosExtraidos.push(dados);
      }

      setProgresso('Calculando totais...');

      // Calcular totais conforme especificado
      const totais = {
        atosPraticados: dadosExtraidos.reduce((sum, item) => sum + item.atosPraticados, 0),
        arrecadacao: dadosExtraidos.reduce((sum, item) => 
          sum + parseFloat(item.emolumentoApurado) + parseFloat(item.tfj) + 
          parseFloat(item.valoresRecompe) + parseFloat(item.issqn), 0
        ).toFixed(2),
        custeio: dadosExtraidos.reduce((sum, item) => sum + parseFloat(item.totalDespesas), 0).toFixed(2),
        repasses: dadosExtraidos.reduce((sum, item) => 
          sum + parseFloat(item.recompeApurado) + parseFloat(item.issqn) + parseFloat(item.tfj), 0
        ).toFixed(2)
      };

      setResultado({
        dadosIndividuais: dadosExtraidos,
        totais: totais
      });

      setProgresso('Processamento concluído!');

    } catch (error) {
      setErro('Erro ao processar os arquivos: ' + error.message);
      console.error('Erro detalhado:', error);
    } finally {
      setProcessando(false);
    }
  };

  const gerarRelatorio = () => {
    if (!resultado) return;

    const relatorioTexto = `
RELATÓRIO SEMESTRAL CNJ
=======================

RESUMO CONSOLIDADO:
- Atos Praticados: ${resultado.totais.atosPraticados}
- Arrecadação Total: R$ ${resultado.totais.arrecadacao}
- Custeio Total: R$ ${resultado.totais.custeio}
- Repasses Total: R$ ${resultado.totais.repasses}

DETALHAMENTO POR ARQUIVO:
${resultado.dadosIndividuais.map((item, index) => `
Arquivo ${index + 1}: ${item.nomeArquivo}
- Atos Praticados: ${item.atosPraticados}
- Emolumento Apurado: R$ ${item.emolumentoApurado}
- Taxa de Fiscalização Judiciária: R$ ${item.tfj}
- Valores RECOMPE: R$ ${item.valoresRecompe}
- ISSQN: R$ ${item.issqn}
- RECOMPE Apurado: R$ ${item.recompeApurado}
- Total de Despesas: R$ ${item.totalDespesas}
`).join('')}

Data de Geração: ${new Date().toLocaleDateString('pt-BR')}
    `;

    const blob = new Blob([relatorioTexto], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_semestral_cnj_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(44, 62, 80, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{
          color: 'white',
          margin: 0,
          fontSize: '28px',
          fontWeight: '600'
        }}>
          📊 Relatório Semestral CNJ
        </h1>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(52, 152, 219, 0.8)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          ← Voltar
        </button>
      </div>

      <div style={{
        maxWidth: '1000px',
        margin: '0 auto'
      }}>
        {/* Upload Section */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '30px',
          marginBottom: '30px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{
            color: '#2c3e50',
            marginBottom: '20px',
            fontSize: '24px'
          }}>
            Upload dos Arquivos PDF
          </h2>
          
          <div style={{
            border: '2px dashed #3498db',
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            marginBottom: '20px',
            background: '#f8f9fa'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
            <p style={{ fontSize: '18px', color: '#7f8c8d', marginBottom: '20px' }}>
              Selecione exatamente 6 arquivos PDF do TJMG
            </p>
            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={handleFileUpload}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #bdc3c7',
                fontSize: '16px',
                width: '300px'
              }}
            />
          </div>

          {arquivos.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>
                Arquivos Selecionados ({arquivos.length}/6):
              </h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {arquivos.map((file, index) => (
                  <li key={index} style={{
                    background: '#ecf0f1',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    marginBottom: '5px',
                    fontSize: '14px'
                  }}>
                    📄 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {progresso && processando && (
            <div style={{
              background: '#3498db',
              color: 'white',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              🔄 {progresso}
            </div>
          )}

          {erro && (
            <div style={{
              background: '#e74c3c',
              color: 'white',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              ⚠️ {erro}
            </div>
          )}

          <button
            onClick={processarArquivos}
            disabled={arquivos.length !== 6 || processando}
            style={{
              background: arquivos.length === 6 && !processando ? '#27ae60' : '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '15px 30px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: arquivos.length === 6 && !processando ? 'pointer' : 'not-allowed',
              width: '100%'
            }}
          >
            {processando ? '🔄 Processando...' : '🚀 Processar Arquivos'}
          </button>
        </div>

        {/* Results Section */}
        {resultado && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '30px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px'
            }}>
              <h2 style={{
                color: '#2c3e50',
                margin: 0,
                fontSize: '24px'
              }}>
                📈 Resultados do Processamento
              </h2>
              <button
                onClick={gerarRelatorio}
                style={{
                  background: '#e67e22',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                📥 Baixar Relatório
              </button>
            </div>

            {/* Resumo Consolidado */}
            <div style={{
              background: 'linear-gradient(135deg, #3498db, #2980b9)',
              borderRadius: '12px',
              padding: '25px',
              marginBottom: '30px',
              color: 'white'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>
                📊 Resumo Consolidado (6 meses)
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '20px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                    {resultado.totais.atosPraticados}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>Atos Praticados</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    R$ {resultado.totais.arrecadacao}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>Arrecadação</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    R$ {resultado.totais.custeio}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>Custeio</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    R$ {resultado.totais.repasses}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>Repasses</div>
                </div>
              </div>
            </div>

            {/* Detalhamento por Arquivo */}
            <h3 style={{ color: '#2c3e50', marginBottom: '20px' }}>
              📋 Detalhamento por Arquivo
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {resultado.dadosIndividuais.map((item, index) => (
                <div key={index} style={{
                  background: '#f8f9fa',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #e9ecef'
                }}>
                  <h4 style={{
                    color: '#2c3e50',
                    marginBottom: '15px',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}>
                    📄 Arquivo {index + 1}
                  </h4>
                  <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '10px' }}>
                    {item.nomeArquivo}
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    <div><strong>Atos:</strong> {item.atosPraticados}</div>
                    <div><strong>Emolumento:</strong> R$ {item.emolumentoApurado}</div>
                    <div><strong>TFJ:</strong> R$ {item.tfj}</div>
                    <div><strong>RECOMPE:</strong> R$ {item.valoresRecompe}</div>
                    <div><strong>ISSQN:</strong> R$ {item.issqn}</div>
                    <div><strong>Despesas:</strong> R$ {item.totalDespesas}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RelatorioCNJ;

