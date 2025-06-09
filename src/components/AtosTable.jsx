import React, { useState, useEffect, useMemo } from 'react';
import { gerarRelatorioPDF } from './RelatorioPDF';
import './AtosTable.css';
import config from '../config';

// Função para detectar o layout do PDF
function detectarLayoutPDF(texto) {
  // Novo layout: campos colados, linha começa com 1 dígito + 4 dígitos + "R$"
  if (/^\d{5}R\$/.test(texto.replace(/\n/g, ''))) {
    return 'novo';
  }
  // Alternativamente, se encontrar linhas com padrão 1 dígito + 4 dígitos + R$
  if (texto.split('\n').some(l => /^\d{5}R\$/.test(l))) {
    return 'novo';
  }
  return 'antigo';
}

// Função de extração para o layout antigo (já existente)
function extrairDadosAntigo(texto) {
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
          if (matchValor) {
            valores.push(matchValor[1]);
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

// Função de extração para o novo layout (corrigida)
function extrairDadosNovo(texto) {
  // Junta tudo em uma linha só para facilitar a regex
  const textoLimpo = texto.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');
  console.log('Texto limpo:', textoLimpo);

  // Regex ajustada para o padrão real: 17804R$ 47,18R$ 3,55R$ 10,25R$ 60,988 - Certidões...
  const regex = /(\d)(\d{4})R\$ ([\d.,]+)R\$ ([\d.,]+)R\$ ([\d.,]+)R\$ ([\d.,]+)(\d+) - ([^]+?)(?=\d{5}R\$|$)/g;

  const atos = [];
  let match;
  let id = 0;
  while ((match = regex.exec(textoLimpo)) !== null) {
    console.log('Match encontrado:', match);
    atos.push({
      id: id++,
      quantidade: parseInt(match[1]),
      codigo: match[2],
      emolumento: parseFloat(match[3].replace('.', '').replace(',', '.')),
      recompe: parseFloat(match[4].replace('.', '').replace(',', '.')),
      tfj: parseFloat(match[5].replace('.', '').replace(',', '.')),
      valorTotal: parseFloat(match[6].replace('.', '').replace(',', '.')),
      descricao: match[8].trim(), // Note que agora é match[8] porque temos o match[7] para o número
      pagamentoDinheiro: { quantidade: 0, valor: 0, valorManual: false },
      pagamentoCartao: { quantidade: 0, valor: 0, valorManual: false },
      pagamentoPix: { quantidade: 0, valor: 0, valorManual: false },
      pagamentoCRC: { quantidade: 0, valor: 0, valorManual: false },
      depositoPrevio: { quantidade: 0, valor: 0, valorManual: false },
      observacoes: '',
    });
  }

  // Encontrar a data do relatório
  let dataRelatorio = null;
  const matchData = texto.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (matchData) dataRelatorio = matchData[1];

  console.log('Atos extraídos:', atos);
  return { dataRelatorio, atos };
}

// Função principal de extração, que escolhe a função correta
function extrairDadosDoTexto(texto) {
  const tipo = detectarLayoutPDF(texto);
  if (tipo === 'novo') {
    return extrairDadosNovo(texto);
  }
  return extrairDadosAntigo(texto);
}

function formatarMoeda(valor) {
  if (isNaN(valor) || valor === null) return '';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function moedaParaNumero(valorStr) {
  if (!valorStr) return 0;
  // Remove tudo que não for número, vírgula ou ponto
  const num = valorStr.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(num) || 0;
}

function calcularValorTotalComISS(valorTotal, percentualISS) {
  const perc = parseFloat(percentualISS) || 0;
  const resultado = valorTotal * (1 + perc / 100);
  return parseFloat(resultado.toFixed(2));
}

export default function AtosTable({ texto }) {
  const [atos, setAtos] = useState([]);
  const [dataRelatorio, setDataRelatorio] = useState(null);

  // Campos adicionais do caixa (armazenados como números para facilitar cálculos)
  const [responsavel, setResponsavel] = useState('');
  const [ISS, setISS] = useState('');
  const [valorInicialCaixa, setValorInicialCaixa] = useState(0);
  const [depositosCaixa, setDepositosCaixa] = useState(0);
  const [saidasCaixa, setSaidasCaixa] = useState(0);

  // Estados para salvar relatório
  const [salvando, setSalvando] = useState(false);
  const [mensagemSalvar, setMensagemSalvar] = useState('');

  useEffect(() => {
    if (texto) {
      const { dataRelatorio, atos } = extrairDadosDoTexto(texto);
      setDataRelatorio(dataRelatorio);
      setAtos(atos);
    }
  }, [texto]);

  // Recalcula os valores totais com ISS sempre que o ISS ou os atos mudarem
  const atosComISS = atos.map(ato => ({
    ...ato,
    valorTotalComISS: calcularValorTotalComISS(ato.valorTotal, moedaParaNumero(ISS))
  }));

  // Calcula o valor final do caixa usando useMemo para otimizar
  const valorFinalCaixa = useMemo(() => {
    const totalDinheiro = atosComISS.reduce((acc, ato) => acc + ato.pagamentoDinheiro.valor, 0);
    return valorInicialCaixa + totalDinheiro - saidasCaixa - depositosCaixa;
  }, [valorInicialCaixa, depositosCaixa, saidasCaixa, atosComISS]);

  const handleChange = (id, campo, subcampo, valor) => {
    setAtos(prevAtos =>
      prevAtos.map(ato => {
        if (ato.id === id) {
          // Calcula o valor unitário SEM arredondar
          const valorUnitario = ato.quantidade > 0 ? calcularValorTotalComISS(ato.valorTotal, moedaParaNumero(ISS)) / ato.quantidade : 0;

          if (campo === 'observacoes') {
            return { ...ato, observacoes: valor };
          }

          if (subcampo === 'quantidade') {
            const quantidadeNum = parseInt(valor) || 0;
            // Só arredonda o valor final após a multiplicação
            const valorAtual = ato[campo].valorManual ? ato[campo].valor : parseFloat((quantidadeNum * valorUnitario).toFixed(2));
            return {
              ...ato,
              [campo]: { quantidade: quantidadeNum, valor: valorAtual, valorManual: false },
            };
          }

          if (subcampo === 'valor') {
            const valorNum = moedaParaNumero(valor);
            return {
              ...ato,
              [campo]: { ...ato[campo], valor: valorNum, valorManual: true },
            };
          }
        }
        return ato;
      })
    );
  };

  // Handlers para os campos do caixa
  const handleResponsavelChange = (e) => {
    setResponsavel(e.target.value);
  };

  const handleISSChange = (e) => {
    setISS(e.target.value);
  };

  const handleValorInicialChange = (e) => {
    const valor = moedaParaNumero(e.target.value);
    setValorInicialCaixa(valor);
  };

  const handleDepositosChange = (e) => {
    const valor = moedaParaNumero(e.target.value);
    setDepositosCaixa(valor);
  };

  const handleSaidasChange = (e) => {
    const valor = moedaParaNumero(e.target.value);
    setSaidasCaixa(valor);
  };

  // Função para salvar relatório no backend
  const salvarRelatorio = async () => {
    setSalvando(true);
    setMensagemSalvar('');
    try {
      const token = localStorage.getItem('token');
      
      // Prepara o array de atos com todos os campos detalhados
      const atosDetalhados = atosComISS.map(ato => {
        const somaPagamentos = parseFloat((
          ato.pagamentoDinheiro.valor +
          ato.pagamentoCartao.valor +
          ato.pagamentoPix.valor +
          ato.pagamentoCRC.valor +
          ato.depositoPrevio.valor
        ).toFixed(2));
        
        const valorFaltante = parseFloat((ato.valorTotalComISS - somaPagamentos).toFixed(2));
        
        return {
          quantidade: ato.quantidade,
          codigo: ato.codigo,
          descricao: ato.descricao,
          valor_total: ato.valorTotalComISS,
          valor_faltante: valorFaltante,
          dinheiro_qtd: ato.pagamentoDinheiro.quantidade,
          dinheiro_valor: ato.pagamentoDinheiro.valor,
          cartao_qtd: ato.pagamentoCartao.quantidade,
          cartao_valor: ato.pagamentoCartao.valor,
          pix_qtd: ato.pagamentoPix.quantidade,
          pix_valor: ato.pagamentoPix.valor,
          crc_qtd: ato.pagamentoCRC.quantidade,
          crc_valor: ato.pagamentoCRC.valor,
          deposito_previo_qtd: ato.depositoPrevio.quantidade,
          deposito_previo_valor: ato.depositoPrevio.valor,
          observacoes: ato.observacoes || ''
        };
      });

      const payload = {
        data_hora: dataRelatorio,
        serventia: 'Nome da Serventia', // ajuste conforme necessário
        cargo: 'Cargo do Usuário',      // ajuste conforme necessário
        responsavel: responsavel,
        iss_percentual: moedaParaNumero(ISS),
        valor_inicial_caixa: valorInicialCaixa,
        depositos_caixa: depositosCaixa,
        saidas_caixa: saidasCaixa,
        valor_final_caixa: valorFinalCaixa,
        atos: atosDetalhados
      };

      const response = await fetch(`${config.apiURL}/salvar-relatorio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dadosRelatorio: payload })
      });

      const data = await response.json();

      if (response.ok) {
        setMensagemSalvar('Relatório salvo com sucesso!');
      } else {
        setMensagemSalvar(data.message || 'Erro ao salvar relatório.');
      }
    } catch (error) {
      setMensagemSalvar('Erro de conexão ao salvar relatório.');
    } finally {
      setSalvando(false);
    }
  };

  const conferirCaixa = () => {
    let totalValorPago = 0;

    atosComISS.forEach(ato => {
      totalValorPago += ato.pagamentoDinheiro.valor +
        ato.pagamentoCartao.valor +
        ato.pagamentoPix.valor +
        ato.pagamentoCRC.valor +
        ato.depositoPrevio.valor;
    });
    totalValorPago = parseFloat(totalValorPago.toFixed(2));

    const totalValorAtos = parseFloat(atosComISS.reduce((acc, ato) => acc + ato.valorTotalComISS, 0).toFixed(2));

    if (Math.abs(totalValorPago - totalValorAtos) < 0.01) {
      gerarRelatorioPDF({
        dataRelatorio,
        atos: atosComISS,
        valorInicialCaixa,
        depositosCaixa,
        saidasCaixa,
        responsavel,
        ISS: moedaParaNumero(ISS),
      });
      await salvarRelatorio(); // <-- Salva no banco após gerar o PDF
    } else {
      alert(
        `Conciliação divergente!\nTotal valor pago: ${formatarMoeda(totalValorPago)}\nTotal valor atos: ${formatarMoeda(totalValorAtos)}`
      );
    }
  };

  if (!atos.length) return null;

  const inputStyleQuantidade = { width: '50px', marginRight: '4px' };
  const inputStyleValor = { width: '110px' };
  const labelStyle = { fontSize: '0.75rem', marginRight: '4px', display: 'inline-block', width: '30px' };
  const brStyle = { display: 'block', height: '4px' };

  const renderPagamentoCell = (ato, campo) => (
    <td>
      <label style={labelStyle}>qnt.</label>
      <input
        type="number"
        min="0"
        placeholder="Qtde"
        value={ato[campo].quantidade}
        onChange={e => handleChange(ato.id, campo, 'quantidade', e.target.value)}
        style={inputStyleQuantidade}
      />
      <br style={brStyle} />
      <label style={labelStyle}>valor</label>
      <input
        type="text"
        placeholder="R$ 0,00"
        value={formatarMoeda(ato[campo].valor)}
        onChange={e => handleChange(ato.id, campo, 'valor', e.target.value)}
        style={inputStyleValor}
      />
    </td>
  );

  return (
    <div>
      <div className="atos-table-caixa-container">
        <div>
          <label>Responsável: </label>
          <input
            type="text"
            value={responsavel}
            onChange={handleResponsavelChange}
            placeholder="Nome do Responsável"
          />
        </div>
        <div>
          <label>ISS (%): </label>
          <input
            type="number"
            value={ISS}
            onChange={handleISSChange}
            placeholder="Ex: 3"
            step="0.01"
            min="0"
          />
        </div>
        <div>
          <label>Valor Inicial do Caixa: </label>
          <input
            type="text"
            value={formatarMoeda(valorInicialCaixa)}
            onChange={handleValorInicialChange}
            placeholder="R$ 0,00"
          />
        </div>
        <div>
          <label>Depósitos do Caixa: </label>
          <input
            type="text"
            value={formatarMoeda(depositosCaixa)}
            onChange={handleDepositosChange}
            placeholder="R$ 0,00"
          />
        </div>
        <div>
          <label>Saídas do Caixa: </label>
          <input
            type="text"
            value={formatarMoeda(saidasCaixa)}
            onChange={handleSaidasChange}
            placeholder="R$ 0,00"
          />
        </div>
        <div>
          <label>Valor Final do Caixa: </label>
          <input
            type="text"
            readOnly
            value={formatarMoeda(valorFinalCaixa)}
          />
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        <button className="atos-table-btn" onClick={conferirCaixa}>
          Gerar Relatório
        </button>
        
      </div>

      {mensagemSalvar && (
        <div style={{
          marginTop: 12,
          color: mensagemSalvar.includes('sucesso') ? '#155724' : '#721c24',
          background: mensagemSalvar.includes('sucesso') ? '#d4edda' : '#f8d7da',
          borderRadius: 6,
          padding: 10,
        }}>
          {mensagemSalvar}
        </div>
      )}

      <div className="atos-table-container">
        <table className="atos-table">
          <thead>
            <tr>
              <th>Qtde.</th>
              <th>Código</th>
              <th>Descrição do Ato</th>
              <th>Valor Total</th>
              <th>Valor Faltante</th>
              <th>Dinheiro</th>
              <th>Cartão</th>
              <th>Pix</th>
              <th>CRC</th>
              <th>Depósito Prévio</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            {atosComISS.map(ato => {
              const somaPagamentos = parseFloat((
                ato.pagamentoDinheiro.valor +
                ato.pagamentoCartao.valor +
                ato.pagamentoPix.valor +
                ato.pagamentoCRC.valor +
                ato.depositoPrevio.valor
              ).toFixed(2));
              const valorFaltante = parseFloat((ato.valorTotalComISS - somaPagamentos).toFixed(2));
              let linhaClass = '';
              if (Math.abs(somaPagamentos - ato.valorTotalComISS) < 0.01) {
                linhaClass = 'success-row';
              } else {
                linhaClass = 'error-row';
              }
              return (
                <tr
                  key={ato.id}
                  className={linhaClass}
                >
                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 500 }}>{ato.quantidade}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>{ato.codigo}</td>
                  <td style={{ padding: '10px 8px', minWidth: 180 }}>{ato.descricao}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 500 }}>{formatarMoeda(ato.valorTotalComISS)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: valorFaltante === 0 ? '#388e3c' : '#d32f2f', fontWeight: 500 }}>{formatarMoeda(valorFaltante)}</td>
                  {renderPagamentoCell(ato, 'pagamentoDinheiro')}
                  {renderPagamentoCell(ato, 'pagamentoCartao')}
                  {renderPagamentoCell(ato, 'pagamentoPix')}
                  {renderPagamentoCell(ato, 'pagamentoCRC')}
                  {renderPagamentoCell(ato, 'depositoPrevio')}
                  <td>
                    <textarea
                      value={ato.observacoes}
                      onChange={e => handleChange(ato.id, 'observacoes', null, e.target.value)}
                      placeholder="Observações"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}