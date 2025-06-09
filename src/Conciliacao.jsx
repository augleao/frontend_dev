import React, { useState } from 'react';
import UploadForm from './UploadForm';
import DataTable from './DataTable';
import Tooltip from './Tooltip'; // Importe o componente Tooltip
import './Tooltip.css'; // Importe o CSS do Tooltip

function App() {
  const [data, setData] = useState([]);

  const handleUpload = (data) => {
    setData(data);
  };

  const handlePaymentChange = (id, field, value) => {
    setData((prevData) =>
      prevData.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const tooltipText = (
    <>
      Gere no Cartosoft ou CartosoftWEB o relatório de Selos Pagos para o dia e salve em PDF.
      <br /><br />
      Carregue o arquivo pelo botão Escolher arquivo PDF e envie-o para o sistema pelo botão Enviar.
      Aguarde a leitura e Lance as informações de pagamento, indicando o número de atos praticados na forma de pagamento respectiva.
      Após indicar a forma de pagamento de todos os atos, todas as linhas ficarão verde e será possível gerar o relatório de conciliação.
      <br /><br />
      <b>OBS1.:</b> O sistema não salva os dados, simplesmente gera um relatório PDF da conciliação.
      <br />
      <b>OBS2.:</b> O sistema comporta pagamento de um ato por mais de uma forma de pagamento, para isto corrija manualmente o valor do ato sugerido pelo sistema e adicione o restante na outra forma de pagamento.
      <br />
      <b>OBS3.:</b> Pode haver pequenas diferenças nos centavos decorrentes dos cálculos necessarios para fixar o valor do ISS.
    </>
  );

  return (
    <div>
      <h1>
        Controle de Caixa diário pra Cartosoft
        <Tooltip text={tooltipText}>
          <span className="info-icon">i</span>
        </Tooltip>
      </h1>
      <UploadForm onUpload={handleUpload} />
      {data.length > 0 && (
        <DataTable data={data} onPaymentChange={handlePaymentChange} />
      )}
    </div>
  );
}

export default Conciliacao;