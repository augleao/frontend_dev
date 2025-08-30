import React, { useEffect, useState } from 'react';
import { formatarMoeda } from './utilsAtos';

export default function CaixaInfo({
  responsavel, setResponsavel,
  ISS: propISS, setISS: setPropISS,
  valorInicialCaixa, setValorInicialCaixa,
  depositosCaixa, setDepositosCaixa,
  saidasCaixa, setSaidasCaixa,
  observacoesGerais, setObservacoesGerais,
  atos
}) {
  const [ISS, setISS] = useState(propISS);

  // Definir ISS conforme serventia do usuário no carregamento
  useEffect(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    console.log('Usuário carregado:', usuario);
    if (usuario?.serventia === 'RCPN de Campanha') {
      setISS(3);
      setPropISS(3);
      console.log('ISS definido como 3 para RCPN de Campanha');
    } else if (usuario?.serventia === 'RCPN de Lavras') {
      setISS(0);
      setPropISS(0);
      console.log('ISS definido como 0 para RCPN de Lavras');
    } else {
      setISS(0);
      setPropISS(0);
      console.log('ISS padrão definido como 0');
    }
  }, [setPropISS]);

  // Sincronizar ISS com a prop
  useEffect(() => {
    setPropISS(ISS);
    console.log('ISS sincronizado com prop:', ISS);
  }, [ISS, setPropISS]);

  // Estilo para campos somente leitura (informação)
  const infoStyle = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '15px',
    backgroundColor: 'transparent',
    color: '#2c3e50',
    fontWeight: 'bold',
    marginBottom: '4px',
    minHeight: '32px',
    lineHeight: '1.4'
  };

  // Estilo para inputs editáveis
  const inputStyle = {
    width: '90%',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1.5px solid #e3f2fd',
    fontSize: '15px',
    marginBottom: '4px',
    backgroundColor: '#f0f0f0',
    color: '#2c3e50',
    fontWeight: '600',
    minHeight: '32px',
    lineHeight: '1.4'
  };

  const valorFinalCaixa = Number(valorInicialCaixa) + Number(depositosCaixa) - Number(saidasCaixa);

  // Exemplo: recalculando sempre que atos mudam
  useEffect(() => {
    if (Array.isArray(atos)) {
      const totalDinheiro = atos
        .filter(ato => ato.formaPagamento === 'Dinheiro')
        .reduce((soma, ato) => soma + Number(ato.valor), 0);
      setDepositosCaixa(totalDinheiro);
    }
  }, [atos, setDepositosCaixa]);

  return (
    <div
      className="atos-table-caixa-container"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8, // reduzido de 16
        rowGap: 4, // adiciona gap vertical menor
        alignItems: 'flex-start'
      }}
    >
      <div style={{ flex: '1 1 140px', minWidth: 120, maxWidth: 200 }}>
        <label style={{ fontSize: 14, color: '#fff', marginBottom: 2, display: 'block', fontWeight: 'bold' }}>Responsável:</label>
        <div style={{ ...infoStyle, marginBottom: 2 }}>{responsavel}</div>
      </div>
      <div style={{ flex: '1 1 80px', minWidth: 80, maxWidth: 120 }}>
        <label style={{ fontSize: 14, color: '#fff', marginBottom: 2, display: 'block', fontWeight: 'bold' }}>ISS (%):</label>
        <div style={{ ...infoStyle, marginBottom: 2 }}>{ISS}</div>
      </div>
      <div style={{ flex: '1 1 120px', minWidth: 100, maxWidth: 160 }}>
        <label style={{ fontSize: 14, color: '#fff', marginBottom: 2, display: 'block' }}></label>
        <div style={{ ...infoStyle, marginBottom: 2 }}>{}</div>
      </div>
      <div style={{ flex: '1 1 120px', minWidth: 100, maxWidth: 160 }}>
        <label style={{ fontSize: 14, color: '#fff', marginBottom: 2, display: 'block', fontWeight: 'bold' }}>Valor Inicial do Caixa:</label>
        <input
          type="number"
          step="0.01"
          value={valorInicialCaixa}
          onChange={e => setValorInicialCaixa(Number(e.target.value))}
          placeholder="0.00"
          style={{ ...inputStyle, marginBottom: 2 }}
        />
      </div>
      <div style={{ flex: '1 1 120px', minWidth: 100, maxWidth: 160 }}>
        <label style={{ fontSize: 14, color: '#fff', marginBottom: 2, display: 'block', fontWeight: 'bold' }}>Entradas do Caixa:</label>
        <input
          type="number"
          step="0.01"
          value={depositosCaixa}
          onChange={e => setDepositosCaixa(Number(e.target.value))}
          placeholder="0.00"
          style={{ ...inputStyle, marginBottom: 2 }}
        />
      </div>
      <div style={{ flex: '1 1 120px', minWidth: 100, maxWidth: 160 }}>
        <label style={{ fontSize: 14, color: '#fff', marginBottom: 2, display: 'block', fontWeight: 'bold' }}>Saídas do Caixa:</label>
        <input
          type="number"
          step="0.01"
          value={saidasCaixa}
          onChange={e => setSaidasCaixa(Number(e.target.value))}
          placeholder="0.00"
          style={{ ...inputStyle, marginBottom: 2 }}
        />
      </div>
      <div style={{ flex: '1 1 100%', minWidth: 180 }}>
        <label style={{ fontSize: 14, color: '#fff', verticalAlign: 'top', marginBottom: 2, display: 'block', fontWeight: 'bold' }}>OBS:</label>
        <textarea
          value={observacoesGerais}
          onChange={e => setObservacoesGerais(e.target.value)}
          placeholder="Observações gerais do relatório"
          style={{
            width: '100%',
            height: '48px', // reduzido de 60px
            resize: 'vertical',
            marginTop: 2, // reduzido de 4
            background: '#f0f0f0',
            borderRadius: '6px',
            border: '1.5px solid #e3f2fd',
            fontSize: '15px',
            color: '#2c3e50',
            fontWeight: '600',
            padding: '6px 10px'
          }}
        />
      </div>
    </div>
  );
}