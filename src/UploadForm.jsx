import React, { useState } from 'react';
import axios from 'axios';
import AtosTable from './components/AtosTable';

function UploadForm() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [textoExtraido, setTextoExtraido] = useState('');

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    setMessage('');
    setTextoExtraido('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      alert('Por favor, selecione um arquivo PDF.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('https://backend-goby.onrender.com/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMessage(response.data.message);
      setTextoExtraido(response.data.texto);
      console.log('Texto extraído:', response.data.texto);
    } catch (error) {
      alert('Erro ao enviar o arquivo.');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="file" accept="application/pdf" onChange={handleFileChange} />
        <button type="submit">Enviar</button>
      </form>
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {textoExtraido && <AtosTable texto={textoExtraido} />}
    </div>
  );
}

export default UploadForm
