import React, { useState } from 'react';
import UploadForm from './UploadForm';
import DataTable from './DataTable';

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

  return (
    <div>
      <h1>Controle de Caixa</h1>
      <UploadForm onUpload={handleUpload} />
      {data.length > 0 && (
        <DataTable data={data} onPaymentChange={handlePaymentChange} />
      )}
    </div>
  );
}

export default App;
