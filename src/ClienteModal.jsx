import React, { useState, useEffect } from 'react';
import { apiURL } from './config';
import './buttonGradients.css';

export default function ClienteModal({ isOpen, onClose, onSelect }) {
  const buildInitialClient = () => ({
    nome: '',
    filiacao: '',
    rg: '',
    cpf: '',
    endereco: '',
    estado_civil: '',
    profissao: '',
    telefone: '',
    email: '',
    senha_hash: '',
    criado_por: '',
    criado_em: '',
    cep: '',
    cidade: '',
    estado: '',
    whatsapp: '',
  });

  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState(buildInitialClient);

  useEffect(() => {
    if (!isOpen) return;
    setClients([]);
    setError('');
    const t = setTimeout(() => {
      fetchClients(search);
    }, 250);
    return () => clearTimeout(t);
  }, [search, isOpen]);

  async function fetchClients(q) {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const url = `${apiURL}/rg/clientes${q ? `?search=${encodeURIComponent(q)}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Falha ao buscar clientes');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.items || data.clientes || []);
      setClients(list);
    } catch (e) {
      console.error('Erro fetchClients', e);
      setError('Não foi possível carregar clientes');
    } finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!newClient.nome || !newClient.nome.trim()) return setError('Nome é obrigatório');
    setCreating(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const normalizeOptional = (value) => {
        const trimmed = String(value || '').trim();
        return trimmed ? trimmed : null;
      };

      const payload = {
        nome: newClient.nome.trim(),
        filiacao: normalizeOptional(newClient.filiacao),
        rg: normalizeOptional(newClient.rg),
        cpf: normalizeOptional(newClient.cpf),
        endereco: normalizeOptional(newClient.endereco),
        estado_civil: normalizeOptional(newClient.estado_civil),
        profissao: normalizeOptional(newClient.profissao),
        telefone: normalizeOptional(newClient.telefone),
        email: normalizeOptional(newClient.email),
        senha_hash: normalizeOptional(newClient.senha_hash),
        criado_por: normalizeOptional(newClient.criado_por),
        criado_em: normalizeOptional(newClient.criado_em),
        cep: normalizeOptional(newClient.cep),
        cidade: normalizeOptional(newClient.cidade),
        estado: normalizeOptional(newClient.estado),
        whatsapp: normalizeOptional(newClient.whatsapp),
      };

      const res = await fetch(`${apiURL}/rg/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Erro ao criar cliente');
      }
      const created = await res.json();
      setNewClient(buildInitialClient());
      onSelect(created);
      onClose();
    } catch (e) {
      console.error('Erro criar cliente', e);
      setError('Erro ao salvar cliente');
    } finally { setCreating(false); }
  }

  function updateClientField(field, value) {
    setNewClient((prev) => ({ ...prev, [field]: value }));
  }

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ width: 980, maxWidth: '96%', background: 'white', borderRadius: 8, padding: 16, maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Selecionar ou criar Cliente</h3>
          <button onClick={onClose} className="btn-gradient btn-gradient-red btn-compact" style={{ fontSize: 16, minWidth: 36 }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8, position: 'relative' }}>
          <input
            placeholder="Buscar por nome ou CPF"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={() => fetchClients(search)} className="btn-gradient btn-gradient-blue">Buscar</button>

          { (search && search.trim() !== '') && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #eee', boxShadow: '0 8px 20px rgba(0,0,0,0.06)', zIndex: 10000, maxHeight: 240, overflow: 'auto', marginTop: 6 }}>
              {loading ? (
                <div style={{ padding: 10, color: '#666' }}>Carregando...</div>
              ) : (
                clients && clients.length ? clients.map((c) => (
                  <div key={c.id} onClick={() => { onSelect(c); onClose(); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f6f6f6', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{c.nome}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{c.cpf || ''}</div>
                    </div>
                    <div>
                      <button type="button" className="btn-gradient btn-gradient-green btn-compact" onClick={(ev) => { ev.stopPropagation(); onSelect(c); onClose(); }}>Selecionar</button>
                    </div>
                  </div>
                )) : (
                  <div style={{ padding: 10, color: '#666' }}>Nenhum cliente encontrado.</div>
                )
              )}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Criar novo cliente</div>
          {error && <div style={{ color: 'red', marginBottom: 6 }}>{error}</div>}
          <div style={{ display: 'grid', gap: 10, marginBottom: 10 }}>
            <div style={{ border: '1px solid #ececec', borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#1f2937' }}>Documentos</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
                <input placeholder="Nome*" value={newClient.nome} onChange={(e) => updateClientField('nome', e.target.value)} />
                <input placeholder="Filiação" value={newClient.filiacao} onChange={(e) => updateClientField('filiacao', e.target.value)} />
                <input placeholder="RG" value={newClient.rg} onChange={(e) => updateClientField('rg', e.target.value)} />
                <input placeholder="CPF" value={newClient.cpf} onChange={(e) => updateClientField('cpf', e.target.value)} />
                <input placeholder="Estado civil" value={newClient.estado_civil} onChange={(e) => updateClientField('estado_civil', e.target.value)} />
                <input placeholder="Profissão" value={newClient.profissao} onChange={(e) => updateClientField('profissao', e.target.value)} />
              </div>
            </div>

            <div style={{ border: '1px solid #ececec', borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#1f2937' }}>Contato</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
                <input placeholder="Telefone" value={newClient.telefone} onChange={(e) => updateClientField('telefone', e.target.value)} />
                <input placeholder="WhatsApp" value={newClient.whatsapp} onChange={(e) => updateClientField('whatsapp', e.target.value)} />
                <input placeholder="E-mail" value={newClient.email} onChange={(e) => updateClientField('email', e.target.value)} />
              </div>
            </div>

            <div style={{ border: '1px solid #ececec', borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#1f2937' }}>Endereço</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
                <input placeholder="Endereço" value={newClient.endereco} onChange={(e) => updateClientField('endereco', e.target.value)} />
                <input placeholder="CEP" value={newClient.cep} onChange={(e) => updateClientField('cep', e.target.value)} />
                <input placeholder="Cidade" value={newClient.cidade} onChange={(e) => updateClientField('cidade', e.target.value)} />
                <input placeholder="Estado (UF)" value={newClient.estado} onChange={(e) => updateClientField('estado', e.target.value)} />
              </div>
            </div>

            <div style={{ border: '1px solid #ececec', borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#1f2937' }}>Situação</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
                <input placeholder="Criado por" value={newClient.criado_por} onChange={(e) => updateClientField('criado_por', e.target.value)} />
                <input placeholder="Senha hash" value={newClient.senha_hash} onChange={(e) => updateClientField('senha_hash', e.target.value)} />
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                  <label style={{ fontSize: 12, color: '#444' }}>Criado em</label>
                  <input type="datetime-local" value={newClient.criado_em} onChange={(e) => updateClientField('criado_em', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} className="btn-gradient btn-gradient-red">Cancelar</button>
            <button onClick={handleCreate} disabled={creating} className="btn-gradient btn-gradient-green">{creating ? 'Salvando...' : 'Salvar e Selecionar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
