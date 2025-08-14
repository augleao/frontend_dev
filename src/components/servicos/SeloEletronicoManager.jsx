import React, { useRef, useState } from 'react';
import config from '../../config';

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
          console.log(`[LOG SELAGEM] FormData -> imagem: nome=${pair[1].name}, tipo=${pair[1].type}, tamanho=${pair[1].size}`);
        } else {
          console.log(`[LOG SELAGEM] FormData -> ${pair[0]}: ${pair[1]}`);
        }
      }
      console.log('[SeloEletronicoManager] Enviando imagem para backend:', { execucao_servico_id: protocolo, file });
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiURL}/execucaoservico/${protocolo}/selo`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const text = await res.text();
      console.log('[SeloEletronicoManager] Resposta do backend:', text);
      
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
      
      console.log('[SeloEletronicoManager] Campos extraídos - qtd_atos:', data.qtd_atos, 'atos_praticados_por:', data.atos_praticados_por || 'VAZIO');
      
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
                <td style={{ padding: 6, fontSize: 12 }}>{selo.seloConsulta || selo.selo_consulta || '-'}</td>
                <td style={{ padding: 6, fontSize: 12 }}>{selo.codigoSeguranca || selo.codigo_seguranca || '-'}</td>
                <td style={{ padding: 6, fontSize: 12, color: selo.qtdAtos || selo.qtd_atos ? '#000' : '#999' }}>
                  {selo.qtdAtos || selo.qtd_atos || 'Não identificado'}
                </td>
                <td style={{ padding: 6, fontSize: 12, color: (selo.atosPraticadosPor || selo.atos_praticados_por) ? '#000' : '#999' }}>
                  {selo.atosPraticadosPor || selo.atos_praticados_por || 'Não identificado'}
                </td>
                <td style={{ padding: 6, fontSize: 12, color: selo.valores ? '#000' : '#999' }}>
                  {selo.valores || 'Não identificado'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
