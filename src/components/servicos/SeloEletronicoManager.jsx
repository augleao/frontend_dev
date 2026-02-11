import React, { useRef, useState } from 'react';
import config from '../../config';
import '../../buttonGradients.css';

// protocolo: string identificador do pedido
export default function SeloEletronicoManager({ protocolo, onSelosChange }) {
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
      // Garante que execucao_servico_id é o protocolo do pedido
      if (!protocolo || typeof protocolo !== 'string') {
        setError('Protocolo inválido para upload de selo.');
        setUploading(false);
        return;
      }
      formData.append('execucao_servico_id', protocolo);
      // LOG: Mostra todos os valores do FormData
      for (let pair of formData.entries()) {
        if (pair[0] === 'imagem') {
        } else {
        }
      }
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/execucaoservico/${protocolo}/selo`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const text = await res.text();
      
      if (!res.ok) throw new Error('Erro ao processar selo.');
      
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        console.error('[SeloEletronicoManager] Erro ao fazer parse do JSON:', parseErr);
        throw new Error('Resposta inválida do backend.');
      }
      
      // Mapeia os campos do backend para o formato esperado pelo frontend
      const seloMapeado = {
        ...data,
        seloConsulta: data.selo_consulta || data.seloConsulta || '',
        codigoSeguranca: data.codigo_seguranca || data.codigoSeguranca || '',
        qtdAtos: data.qtd_atos || data.qtdAtos || '',
        atosPraticadosPor: data.atos_praticados_por || data.atosPraticadosPor || '',
        valores: data.valores || ''
      };
      
      
      setSelos(prev => [...prev, seloMapeado]);
      if (onSelosChange) onSelosChange(prev => [...(Array.isArray(prev) ? prev : []), seloMapeado]);
    } catch (err) {
      console.error('[SeloEletronicoManager] Falha ao processar selo:', err);
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
  {/* Tabela de selos removida. Renderização centralizada no componente pai. */}
    </div>
  );
}
