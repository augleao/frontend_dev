import React, { useState } from 'react';
import axios from 'axios';
import AtosTable from './components/AtosTable';
import './components/AtosTable.css';

function UploadForm() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [textoExtraido, setTextoExtraido] = useState('');
  const [uploading, setUploading] = useState(false);

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

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    // Pegue o token do localStorage (ou do seu contexto de autenticação, se preferir)
    const token = localStorage.getItem('token');

    try {
      const response = await axios.post(
        'https://backend-dev-ypsu.onrender.com/api/upload',
        formData,
        {
          headers: {
            // NÃO defina 'Content-Type' manualmente, o axios faz isso para FormData!
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      setMessage(response.data.message);
      setTextoExtraido(response.data.texto);
      setUploading(false);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setMessage('Você precisa estar logado para enviar arquivos.');
      } else {
        setMessage('Erro ao enviar o arquivo.');
      }
      setUploading(false);
    }
  };

  return (
    <div className="upload-form-container">
      <form onSubmit={handleSubmit}>
        <label htmlFor="fileInput" className="custom-file-button" style={{ marginRight: 12, marginBottom: 0 }}>
          {file ? file.name : 'Escolher Arquivo PDF'}
        </label>
        <input
          type="file"
          id="fileInput"
          accept=".txt"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          type="submit"
          className="custom-file-button"
          style={{ marginLeft: 0 }}
          disabled={!file || uploading}
        >
          {uploading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
      {message && (
        <p
          style={{
            color: message.toLowerCase().includes('sucesso') ? '#155724' : '#721c24',
            background: message.toLowerCase().includes('sucesso') ? '#d4edda' : '#f8d7da',
            borderRadius: 6,
            padding: 10,
            marginTop: 16,
          }}
        >
          {message}
        </p>
      )}
      {textoExtraido && <AtosTable texto={textoExtraido} />}
    </div>
  );
}

export default UploadForm;