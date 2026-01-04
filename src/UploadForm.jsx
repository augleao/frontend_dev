import React, { useState } from 'react';
import axios from 'axios';
import AtosTable from './components/AtosTable';
import './components/AtosTable.css';
import { apiURL } from './config';

function UploadForm() {
  const [file, setFile] = useState(null);
  const [tipoEscrita, setTipoEscrita] = useState('digitado');
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
    if (tipoEscrita) formData.append('tipoEscrita', tipoEscrita);

    // Pegue o token do localStorage (ou do seu contexto de autenticação, se preferir)
    const token = localStorage.getItem('token');

    try {
      const response = await axios.post(
        `${apiURL}/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      // Não exiba mensagem de sucesso
      setMessage('');
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
        <label style={{ marginRight: 8 }}>Tipo de escrita:</label>
        <select value={tipoEscrita} onChange={(e) => setTipoEscrita(e.target.value)} style={{ marginRight: 12, minWidth: 200 }}>
          <option value="digitado">Digitado</option>
          <option value="manuscrito">Manuscrito</option>
          <option value="misto">Misto</option>
        </select>
        <label htmlFor="fileInput" className="custom-file-button" style={{ marginRight: 12, marginBottom: 0 }}>
          {file ? file.name : 'Escolher Arquivo PDF'}
        </label>
        <input
          type="file"
          id="fileInput"
          accept=".pdf"
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
            padding: 5,
            marginTop: 5,
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