import React, { useState, useEffect } from 'react';
import UploadForm from './UploadForm';
import DataTable from './DataTable';
import Tooltip from './Tooltip';
import './Tooltip.css';

function Conciliacao() {
  const [data, setData] = useState([]);
  const [uploadMsg, setUploadMsg] = useState('');

  const handleUpload = (data) => {
    setData(data);
  };

  useEffect(() => {
    if (uploadMsg) {
      const timer = setTimeout(() => setUploadMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [uploadMsg]);

  const handlePaymentChange = (id, field, value) => {
    setData((prevData) =>
      prevData.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const tooltipText = (
    <>
      Gere no Cartosoft ou Cartosoft WEB ou Cartosoft Desktop o relatório de Selos Pagos para o dia e salve em PDF.
      <br /><br />
      Carregue o arquivo pelo botão Escolher arquivo PDF e envie-o para o sistema pelo botão Enviar.
      Aguarde a leitura e Lance as informações de pagamento, indicando o número de atos praticados na forma de pagamento respectiva.
      Após indicar a forma de pagamento de todos os atos, todas as linhas ficarão verde e será possível gerar o relatório de conciliação.
      <br /><br />
      <b>OBS1.:</b> As linhas vermelhas correspondem a valores ainda não conciliados e as verdes a valores já conciliados.
      <br />
      <b>OBS2.:</b> O sistema comporta pagamento de um ato por mais de uma forma de pagamento, para isto corrija manualmente o valor do ato sugerido pelo sistema e adicione o restante na outra forma de pagamento.
      <br />
      <b>OBS3.:</b> Pode haver pequenas diferenças nos centavos decorrentes dos cálculos necessarios para fixar o valor do ISS.
    </>
  );

  return (
    <div
      style={{
        background: '#667eea',
        borderRadius: '24px',
        padding: '24px 12px', // diminui padding vertical
        margin: '16px 0 12px 0', // diminui margin vertical
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        border: '1px solid rgba(255,255,255,0.18)',
        minHeight: 0,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10, // diminui espaço abaixo do header
        flexWrap: 'wrap'
      }}>
        <h2 style={{
          color: 'white',
          fontSize: '20px', // diminui fonte
          fontWeight: 700,
          margin: 0,
          textShadow: '0 2px 4px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center'
        }}>
          Controle de Caixa diário pra Cartosoft Web ou Desktop
          <Tooltip text={tooltipText}>
            <span className="info-icon" style={{
              marginLeft: 8, // diminui espaço
              background: '#e53935', // fundo vermelho
              color: 'white',
              borderRadius: '50%',
              width: 24,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.25)'
            }}>i</span>
          </Tooltip>
        </h2>
      </div>
      <div style={{ marginBottom: 6 }}> {/* diminui espaço */}
        <UploadForm onUpload={handleUpload} />
        {uploadMsg && (
          <div style={{
            marginTop: 6, // diminui espaço
            color: '#27ae60',
            background: 'rgba(255,255,255,0.85)',
            borderRadius: 8,
            padding: '6px 12px', // diminui padding
            fontWeight: 600,
            fontSize: 14, // diminui fonte
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(39,174,96,0.08)'
          }}>
            {uploadMsg}
          </div>
        )}
      </div>
      {data.length > 0 && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          padding: '8px 4px', // diminui padding
          marginTop: 4, // diminui espaço
          marginBottom: 0,
          overflowX: 'auto'
        }}>
          <DataTable data={data} onPaymentChange={handlePaymentChange} />
        </div>
      )}
    </div>
  );
}

export default Conciliacao;