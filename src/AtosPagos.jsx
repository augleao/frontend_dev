import React, { useState, useEffect } from 'react';
import DataSelector from './DataSelector';
import {
  formasPagamento,
  gerarRelatorioPDF,
} from './utils';
import ResumoCaixa from './ResumoCaixa';
import AtoBuscaEPagamento from './AtoBuscaEPagamento';
import EntradasSaidasManuais from './EntradasSaidasManuais';
import TabelaAtos from './TabelaAtos';
import Fechamento from './Fechamento';

function AtosPagos() {
  const [dataSelecionada, setDataSelecionada] = useState(() => new Date().toISOString().slice(0, 10));
  const [valorInicialCaixa, setValorInicialCaixa] = useState(0);
  const [depositosCaixa, setDepositosCaixa] = useState(0);
  const [saidasCaixa, setSaidasCaixa] = useState(0);
  const [atos, setAtos] = useState([]);

  const [nomeUsuario, setNomeUsuario] = useState(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    return usuario?.nome || 'Usuário não identificado';
  });

  // Função para buscar atos por data
  const buscarAtosPorData = async (data) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos?data=${data}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const dados = await res.json();
        // Garantir que dados é array
        if (Array.isArray(dados)) {
          setAtos(dados);
        } else {
          console.warn('Dados recebidos não são array:', dados);
          setAtos([]);
        }
      } else {
        alert('Erro ao buscar atos para a data selecionada.');
        setAtos([]);
      }
    } catch (e) {
      console.error('Erro ao buscar atos:', e);
      alert('Erro ao buscar atos para a data selecionada.');
      setAtos([]);
    }
  };

  useEffect(() => {
    buscarAtosPorData(dataSelecionada);
  }, [dataSelecionada]);

  // Função para calcular o valor final do caixa
  const calcularValorFinalCaixa = () => {
    if (!Array.isArray(atos)) return 0;
    const totalDinheiro = atos.reduce((acc, ato) => {
      const valorDinheiro = parseFloat(ato.pagamentos?.dinheiro?.valor) || 0;
      return acc + valorDinheiro;
    }, 0);
    return valorInicialCaixa + totalDinheiro - depositosCaixa - saidasCaixa;
  };

  // Função para remover ato
  const removerAto = async (index) => {
    const atoParaRemover = atos[index];
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos/${atoParaRemover.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        setAtos(atos.filter((_, i) => i !== index));
      } else {
        alert('Erro ao remover ato.');
      }
    } catch (e) {
      console.error('Erro ao remover ato:', e);
      alert('Erro ao remover ato.');
    }
  };

  // Função para fechamento diário
  const fechamentoDiario = async () => {
    if (!window.confirm('Confirma o fechamento diário do caixa?')) return;

    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const nomeUsuario = usuario?.nome || 'Usuário não identificado';

    const { data, hora } = (() => {
      const agora = new Date();
      return {
        data: agora.toISOString().slice(0, 10),
        hora: agora.toLocaleTimeString('pt-BR', { hour12: false }),
      };
    })();

    const pagamentosZerados = formasPagamento.reduce((acc, fp) => {
      acc[fp.key] = { quantidade: 0, valor: 0, manual: false };
      return acc;
    }, {});

    const linhasFechamento = [
      {
        data,
        hora,
        codigo: '0000',
        descricao: 'Valor Inicial do Caixa',
        quantidade: 1,
        valor_unitario: valorInicialCaixa,
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,
      },
      {
        data,
        hora,
        codigo: '0000',
        descricao: 'Depósitos do Caixa',
        quantidade: 1,
        valor_unitario: depositosCaixa,
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,
      },
      {
        data,
        hora,
        codigo: '0000',
        descricao: 'Saídas do Caixa',
        quantidade: 1,
        valor_unitario: saidasCaixa,
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,
      },
      {
        data,
        hora,
        codigo: '0000',
        descricao: 'Valor Final do Caixa',
        quantidade: 1,
        valor_unitario: calcularValorFinalCaixa(),
        valor_total: calcularValorFinalCaixa(),
        pagamentos: pagamentosZerados,
        usuario: nomeUsuario,
      },
    ];

    try {
      const token = localStorage.getItem('token');

      for (const linha of linhasFechamento) {
        const res = await fetch(
          `${process.env.REACT_APP_API_URL || 'https://backend-dev-ypsu.onrender.com'}/api/atos-pagos`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(linha),
          }
        );

        if (!res.ok) {
          const json = await res.json();
          alert('Erro ao salvar fechamento no banco: ' + (json.message || JSON.stringify(json)));
          return;
        }
      }

      setAtos((prev) => [...prev, ...linhasFechamento]);

      gerarRelatorioPDF({
        dataRelatorio: dataSelecionada.split('-').reverse().join('/'),
        atos,
        valorInicialCaixa,
        depositosCaixa,
        saidasCaixa,
        responsavel: nomeUsuario,
      });

      alert('Fechamento diário realizado com sucesso!');
    } catch (e) {
      console.error('Erro no fechamento diário:', e);
      alert('Erro ao realizar fechamento diário.');
    }
  };

  return (
    <div
      style={{
        maxWidth: '100%',
        margin: '10px auto',
        padding: 32,
        background: '#fff',
        boxShadow: '0 2px 8px #0001',
        borderRadius: 12,
      }}
    >
      {/* Nome do usuário acima do título */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <input
          type="text"
          value={nomeUsuario}
          readOnly
          style={{
            width: 320,
            textAlign: 'center',
            fontSize: 16,
            padding: 8,
            borderRadius: 6,
            border: '1px solid #1976d2',
            background: '#f5faff',
            color: '#1976d2',
            fontWeight: 'bold',
            margin: 0,
          }}
        />
      </div>

      {/* Título e seletor de data na mesma linha */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 24,
          gap: 26,
        }}
      >
        <h2 style={{ margin: 0 }}>Movimento Diário do Caixa</h2>
        <DataSelector
          dataSelecionada={dataSelecionada}
          onChange={(e) => setDataSelecionada(e.target.value)}
        />
      </div>

      <ResumoCaixa
        valorInicialCaixa={valorInicialCaixa}
        setValorInicialCaixa={setValorInicialCaixa}
        depositosCaixa={depositosCaixa}
        setDepositosCaixa={setDepositosCaixa}
        saidasCaixa={saidasCaixa}
        setSaidasCaixa={setSaidasCaixa}
        valorFinalCaixa={calcularValorFinalCaixa()}
      />

      <AtoBuscaEPagamento
        dataSelecionada={dataSelecionada}
        atos={atos}
        setAtos={setAtos}
      />

      <EntradasSaidasManuais
        atos={atos}
        setAtos={setAtos}
      />

      <Fechamento onFechar={fechamentoDiario} />

      <h3 style={{ marginBottom: 12 }}>
        Atos Pagos em {dataSelecionada.split('-').reverse().join('/')}
      </h3>

      <TabelaAtos atos={atos} removerAto={removerAto} />
    </div>
  );
}

export default AtosPagos;