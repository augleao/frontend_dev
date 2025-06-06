import React, { useState, useEffect } from 'react';

function extrairDadosDoTexto(texto) {
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Extrair data do relatório
  let dataRelatorio = null;
  for (const linha of linhas) {
    const matchData = linha.match(/Emissão:\s*(\d{2}\/\d{2}\/\d{4})/);
    if (matchData) {
      dataRelatorio = matchData[1];
      break;
    }
  }

  const atos = [];
  const regexInicioAto = /^(\d+)\s*-\s*(.+)$/; // linha que inicia o ato (ex: "7 - Assento de casamento")
  const regexCodigo = /^\d{4,}$/; // linha que é o código (4 ou mais dígitos)

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const matchInicio = linha.match(regexInicioAto);
    if (matchInicio) {
      // A quantidade está na linha anterior
      const quantidade = parseInt(linhas[i - 1]) || 0;

      // Começa a descrição com o texto da linha atual (após o número e hífen)
      let descricao = matchInicio[2];

      // Procurar o código nas linhas seguintes concatenando a descrição até encontrar o código
      let codigo = '';
      let j = i + 1;
      while (j < linhas.length && !regexCodigo.test(linhas[j])) {
        descricao += ' ' + linhas[j];
        j++;
      }

      if (j < linhas.length) {
        codigo = linhas[j];
      }

      atos.push({
        id: i,
        quantidade,
        codigo,
        descricao,
        pagamentoDinheiro: 0,
        pagamentoCartao: 0,
        pagamentoPix: 0,
        pagamentoCRC: 0,
        depositoPrevio: 0,
      });

      // Pular para a linha do código para continuar a busca
      i = j;
    }
  }

  console.log('Dados extraídos:', { dataRelatorio, atos });
  return { dataRelatorio, atos };
}

export default function AtosTable({ texto }) {
  const [dataRelatorio, setDataRelatorio] = useState(null);
  const [atos, setAtos] = useState([]);

  useEffect(() => {
    if (texto) {
      const { dataRelatorio, atos } = extrairDadosDoTexto(texto);
      setDataRelatorio(dataRelatorio);
      setAtos(atos);
    }
  }, [texto]);

  const handleChange = (id, campo, valor) => {
    setAtos(prevAtos =>
      prevAtos.map(ato =>
        ato.id === id ? { ...ato, [campo]: Number(valor) || 0 } : ato
      )
    );
  };

  const conferirCaixa = () => {
    let totalQtde = 0;
    let totalPagamentos = 0;

    atos.forEach(ato => {
      totalQtde += ato.quantidade;
      totalPagamentos +=
        ato.pagamentoDinheiro +
        ato.pagamentoCartao +
        ato.pagamentoPix +
        ato.pagamentoCRC +
        ato.depositoPrevio;
    });

    if (totalQtde === totalPagamentos) {
      alert('Conciliação OK! Total de atos bate com total de pagamentos.');
    } else {
      alert(
        `Conciliação divergente!\nTotal atos: ${totalQtde}\nTotal pagamentos: ${totalPagamentos}`
      );
    }
  };

  if (!texto) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Relatório de {dataRelatorio || 'Data não encontrada'}</h2>
        <button onClick={conferirCaixa} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          CONFERIR O CAIXA
        </button>
      </div>
      <table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', marginTop: '12px' }}>
        <thead>
          <tr>
            <th>Qtde.</th>
            <th>Código</th>
            <th>Descrição do Ato</th>
            <th>Dinheiro</th>
            <th>Cartão</th>
            <th>Pix</th>
            <th>CRC</th>
            <th>Depósito Prévio</th>
          </tr>
        </thead>
        <tbody>
          {atos.map(ato => (
            <tr key={ato.id}>
              <td>{ato.quantidade}</td>
              <td>{ato.codigo}</td>
              <td>{ato.descricao}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  value={ato.pagamentoDinheiro}
                  onChange={e => handleChange(ato.id, 'pagamentoDinheiro', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  value={ato.pagamentoCartao}
                  onChange={e => handleChange(ato.id, 'pagamentoCartao', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  value={ato.pagamentoPix}
                  onChange={e => handleChange(ato.id, 'pagamentoPix', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  value={ato.pagamentoCRC}
                  onChange={e => handleChange(ato.id, 'pagamentoCRC', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  value={ato.depositoPrevio}
                  onChange={e => handleChange(ato.id, 'depositoPrevio', e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}