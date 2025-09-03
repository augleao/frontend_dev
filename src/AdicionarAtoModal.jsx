import React, { useState } from 'react';

// Este componente é um extrato do modal de adicionar ato/combos do ServicoEntrada.jsx
// Adapte conforme necessário para o contexto de AtosPraticados
export default function AdicionarAtoModal({ open, onClose, onAdicionar, combosDisponiveis = [] }) {
  const [modalComboSelecionado, setModalComboSelecionado] = useState('');
  const [modalAtoSelecionado, setModalAtoSelecionado] = useState('');
  const [modalAtoSelecionadoObj, setModalAtoSelecionadoObj] = useState(null);
  const [modalAtoTerm, setModalAtoTerm] = useState('');
  const [atosSuggestions, setAtosSuggestions] = useState([]);
  const [loadingAtos, setLoadingAtos] = useState(false);
  const [modalCodigoTributario, setModalCodigoTributario] = useState('');
  const [codigoTributarioSuggestions, setCodigoTributarioSuggestions] = useState([]);
  const [loadingCodigoTributario, setLoadingCodigoTributario] = useState(false);
  const [modalTipoRegistro, setModalTipoRegistro] = useState('');
  const [modalNomeRegistrados, setModalNomeRegistrados] = useState('');
  const [modalLivro, setModalLivro] = useState('');
  const [modalFolha, setModalFolha] = useState('');
  const [modalTermo, setModalTermo] = useState('');

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, minWidth: 400, maxWidth: 600, boxShadow: '0 4px 32px rgba(0,0,0,0.18)' }}>
        <h2 style={{ marginTop: 0 }}>Adicionar Ato ou Combo</h2>
        {/* Aqui você pode adaptar os campos e sugestões conforme o ServicoEntrada.jsx */}
        <div style={{ marginBottom: 16 }}>
          <label>Combo:</label>
          <select value={modalComboSelecionado} onChange={e => setModalComboSelecionado(e.target.value)}>
            <option value="">Selecione um combo (opcional)</option>
            {combosDisponiveis.map(combo => (
              <option key={combo.id} value={combo.id}>{combo.nome}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Ato individual:</label>
          <input type="text" value={modalAtoTerm} onChange={e => setModalAtoTerm(e.target.value)} placeholder="Buscar ato..." />
          {/* Aqui você pode exibir sugestões de atos se desejar */}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Código Tributário:</label>
          <input type="text" value={modalCodigoTributario} onChange={e => setModalCodigoTributario(e.target.value)} placeholder="Código tributário..." />
          {/* Aqui você pode exibir sugestões de códigos tributários se desejar */}
        </div>
        {/* Campos adicionais: tipo de registro, nome, livro, folha, termo... */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input type="text" value={modalTipoRegistro} onChange={e => setModalTipoRegistro(e.target.value)} placeholder="Tipo de Registro" />
          <input type="text" value={modalNomeRegistrados} onChange={e => setModalNomeRegistrados(e.target.value)} placeholder="Nome(s) Registrado(s)" />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input type="text" value={modalLivro} onChange={e => setModalLivro(e.target.value)} placeholder="Livro" style={{ width: 80 }} />
          <input type="text" value={modalFolha} onChange={e => setModalFolha(e.target.value)} placeholder="Folha" style={{ width: 80 }} />
          <input type="text" value={modalTermo} onChange={e => setModalTermo(e.target.value)} placeholder="Termo" style={{ width: 80 }} />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancelar</button>
          <button onClick={() => {
            // Chame onAdicionar passando os dados do ato/combo
            onAdicionar({
              comboId: modalComboSelecionado || null,
              atoTerm: modalAtoTerm,
              codigoTributario: modalCodigoTributario,
              tipoRegistro: modalTipoRegistro,
              nomeRegistrados: modalNomeRegistrados,
              livro: modalLivro,
              folha: modalFolha,
              termo: modalTermo
            });
            onClose();
          }} style={{ background: '#27ae60', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px' }}>Adicionar</button>
        </div>
      </div>
    </div>
  );
}
