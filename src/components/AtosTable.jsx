import React, { useState, useEffect, useMemo } from 'react';
import { gerarRelatorioPDF } from './RelatorioPDF';
import './AtosTable.css';

// ... (todas as funções auxiliares permanecem iguais)

export default function AtosTable({ texto }) {
  const [dataRelatorio, setDataRelatorio] = useState(null);
  const [atos, setAtos] = useState([]);

  // Campos adicionais do caixa
  const [responsavel, setResponsavel] = useState('');
  const [ISS, setISS] = useState('');
  const [valorInicialCaixa, setValorInicialCaixa] = useState(0);
  const [depositosCaixa, setDepositosCaixa] = useState(0);
  const [saidasCaixa, setSaidasCaixa] = useState(0);

  useEffect(() => {
    if (texto) {
      const { dataRelatorio, atos } = extrairDadosDoTexto(texto);
      setDataRelatorio(dataRelatorio);
      setAtos(atos);
    }
  }, [texto]);

  const atosComISS = atos.map(ato => ({
    ...ato,
    valorTotalComISS: calcularValorTotalComISS(ato.valorTotal, moedaParaNumero(ISS))
  }));

  const valorFinalCaixa = useMemo(() => {
    const totalDinheiro = atosComISS.reduce((acc, ato) => acc + ato.pagamentoDinheiro.valor, 0);
    return valorInicialCaixa + totalDinheiro - saidasCaixa - depositosCaixa;
  }, [valorInicialCaixa, depositosCaixa, saidasCaixa, atosComISS]);

  const handleChange = (id, campo, subcampo, valor) => {
    setAtos(prevAtos =>
      prevAtos.map(ato => {
        if (ato.id === id) {
          const valorUnitario = ato.quantidade > 0 ? calcularValorTotalComISS(ato.valorTotal, moedaParaNumero(ISS)) / ato.quantidade : 0;

          if (campo === 'observacoes') {
            return { ...ato, observacoes: valor };
          }

          if (subcampo === 'quantidade') {
            const quantidadeNum = parseInt(valor) || 0;
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
  const handleResponsavelChange = (e) => setResponsavel(e.target.value);
  const handleISSChange = (e) => setISS(e.target.value);
  const handleValorInicialChange = (e) => setValorInicialCaixa(moedaParaNumero(e.target.value));
  const handleDepositosChange = (e) => setDepositosCaixa(moedaParaNumero(e.target.value));
  const handleSaidasChange = (e) => setSaidasCaixa(moedaParaNumero(e.target.value));

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
      alert('Conciliação OK! Total dos valores pagos bate com o valor total dos atos selados.');
      gerarRelatorioPDF({
        dataRelatorio,
        atos: atosComISS,
        valorInicialCaixa,
        depositosCaixa,
        saidasCaixa,
        responsavel,
        ISS: moedaParaNumero(ISS),
      });
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

      <button className="atos-table-btn" onClick={conferirCaixa}>
        CONCILIAÇÃO
      </button>

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