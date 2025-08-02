import React, { useRef, useState } from 'react';

export default function SeloEletronicoManager({ pedidoId, onSelosChange }) {
  const [selos, setSelos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef();

  // Handler para colar imagem da área de transferência
  const handlePaste = async (e) => {
    setError('');
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        await handleImageUpload(blob);
        break;
      }
    }
  };

  // Handler para upload manual
  const handleFileChange = async (e) => {
    setError('');
    const file = e.target.files[0];
    if (file) {
      await handleImageUpload(file);
    }
  };

  // Envia imagem para o backend e salva selo
  const handleImageUpload = async (file) => {
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('imagem', file);
      formData.append('pedidoId', pedidoId);
      const res = await fetch('/api/selos-eletronicos', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Erro ao processar selo.');
      const data = await res.json();
      setSelos(prev => [...prev, data]);
      if (onSelosChange) onSelosChange([...selos, data]);
    } catch (err) {
      setError('Falha ao processar selo: ' + (err.message || err));
    }
    setUploading(false);
  };

  return (
    <div style={{ margin: '24px 0', padding: 16, border: '2px dashed #9b59b6', borderRadius: 12, background: '#fdf8fe' }}>
      <h4 style={{ color: '#6c3483', marginBottom: 8 }}>Selos Eletrônicos</h4>
      <div
        tabIndex={0}
        onPaste={handlePaste}
        style={{
          minHeight: 80,
          border: '1.5px dashed #aed6f1',
          borderRadius: 8,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9b59b6',
          fontWeight: 600,
          fontSize: 15,
          marginBottom: 12,
          cursor: 'pointer',
        }}
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        title="Clique ou cole a imagem do selo eletrônico aqui"
      >
        {uploading ? 'Processando selo...' : 'Clique ou cole a imagem do selo eletrônico aqui'}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {selos.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
          <thead>
            <tr style={{ background: '#ede1f7' }}>
              <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Imagem</th>
              <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Selo Consulta</th>
              <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Código de Segurança</th>
              <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Qtd. Atos</th>
              <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Atos praticados por</th>
              <th style={{ padding: 6, fontSize: 12, color: '#6c3483' }}>Valores</th>
            </tr>
          </thead>
          <tbody>
            {selos.map((selo, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#f8f4fc' : '#fff' }}>
                <td style={{ padding: 6 }}>
                  <img src={selo.imagemUrl} alt="Selo" style={{ maxWidth: 80, maxHeight: 60, borderRadius: 4 }} />
                </td>
                <td style={{ padding: 6, fontSize: 12 }}>{selo.seloConsulta}</td>
                <td style={{ padding: 6, fontSize: 12 }}>{selo.codigoSeguranca}</td>
                <td style={{ padding: 6, fontSize: 12 }}>{selo.qtdAtos}</td>
                <td style={{ padding: 6, fontSize: 12 }}>{selo.atosPraticadosPor}</td>
                <td style={{ padding: 6, fontSize: 12 }}>{selo.valores}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
