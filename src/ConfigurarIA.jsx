import React, { useState, useEffect } from 'react';
import config from './config';

export default function ConfigurarIA({ onClose }) {
  const [activeEngine, setActiveEngine] = useState('gemini');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`${config.apiURL}/ia/config`)
      .then(res => res.json())
      .then(data => {
        if (data.active_engine) setActiveEngine(data.active_engine);
        setLoading(false);
      })
      .catch(err => {
        setError('Erro ao carregar configuração de IA');
        setLoading(false);
      });
  }, []);

  const handleSave = () => {
    setSaving(true);
    setSuccess(false);
    setError(null);
    const token = localStorage.getItem('token');
    fetch(`${config.apiURL}/ia/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ active_engine: activeEngine })
    })
      .then(res => {
        if (!res.ok) throw new Error('Erro ao salvar');
        return res.json();
      })
      .then(() => {
        setSuccess(true);
        setSaving(false);
      })
      .catch(err => {
        setError(err.message);
        setSaving(false);
      });
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Configuração Global de IA</h2>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
      </div>

      {loading ? <div>Carregando...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>Selecione a Engine de IA Ativa:</label>
            <div style={{ display: 'flex', gap: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="engine" 
                  value="gemini" 
                  checked={activeEngine === 'gemini'} 
                  onChange={() => setActiveEngine('gemini')}
                />
                Google Gemini
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="engine" 
                  value="deepseek" 
                  checked={activeEngine === 'deepseek'} 
                  onChange={() => setActiveEngine('deepseek')}
                />
                DeepSeek
              </label>
            </div>
          </div>

          {error && <div style={{ color: 'red', fontSize: 14 }}>{error}</div>}
          {success && <div style={{ color: 'green', fontSize: 14 }}>Configuração salva com sucesso!</div>}

          <div style={{ marginTop: 10 }}>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="btn-gradient btn-gradient-green"
              style={{ padding: '10px 20px', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Salvando...' : 'Salvar Alteração'}
            </button>
          </div>
          
          <div style={{ marginTop: 20, padding: 15, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Informação</h4>
            <p style={{ margin: 0, fontSize: 14, color: '#4b5563' }}>
              Esta alteração afeta todo o sistema. Certifique-se de que os modelos configurados nas serventias 
              são compatíveis com a engine escolhida (ex: modelos 'gemini-*' para Google e 'deepseek-*' para DeepSeek).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
