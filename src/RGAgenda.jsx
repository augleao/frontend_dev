import React, { useEffect, useState } from 'react';

const API_BASE = window.API_BASE || '/api';
const authToken = localStorage.getItem('token') || localStorage.getItem('rg_token');

function formatDate(d) {
  return d.toISOString().slice(0,10);
}

export default function RGAgenda() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [day, setDay] = useState(() => new Date().toISOString().slice(0,10));
  const [daysMeta, setDaysMeta] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [slotDate, setSlotDate] = useState(formatDate(new Date()));
  const [slotTime, setSlotTime] = useState('08:00');
  const [clienteQuery, setClienteQuery] = useState('');
  const [clienteSuggestions, setClienteSuggestions] = useState([]);

  useEffect(() => {
    loadMonth(month);
  }, [month]);

  useEffect(() => {
    loadDay(day);
  }, [day]);

  async function apiFetch(path, opts={}){
    const headers = opts.headers || {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE}${path}`, {...opts, headers});
    return res;
  }

  // fetch cliente suggestions (debounced)
  useEffect(() => {
    if (!clienteQuery || clienteQuery.length < 2) { setClienteSuggestions([]); return; }
    let mounted = true;
    const t = setTimeout(async () => {
      try {
        let res = await apiFetch(`/rg/clientes?search=${encodeURIComponent(clienteQuery)}`);
        if (!res.ok) {
          // fallback to list
          res = await apiFetch(`/rg/clientes`);
        }
        if (!res.ok) return;
        const j = await res.json();
        if (!mounted) return;
        setClienteSuggestions(j.clientes || j || []);
      } catch (e) { /* ignore */ }
    }, 300);
    return () => { mounted = false; clearTimeout(t); };
  }, [clienteQuery]);

  async function loadMonth(m) {
    try {
      const res = await apiFetch(`/rg/agendamentos/calendar?month=${m}`);
      if (!res.ok) return setDaysMeta({});
      const j = await res.json();
      const map = Object.fromEntries((j.days||[]).map(d => [d.data, d]));
      setDaysMeta(map);
    } catch (e) { setDaysMeta({}); }
  }

  async function loadDay(d) {
    setLoading(true);
    try {
      const res = await apiFetch(`/rg/agendamentos?data=${d}`);
      if (!res.ok) { setAppointments([]); setLoading(false); return; }
      const j = await res.json();
      setAppointments(j.agendamentos || []);
    } catch (e) { setAppointments([]); }
    setLoading(false);
  }

  function changeMonth(delta){
    const [y, m] = month.split('-').map(Number);
    const dt = new Date(y, m-1 + delta, 1);
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`);
  }

  function openNew(date){
    setEditing({ id: null, nome_cliente: '', data: date, hora: '08:00', observacoes: '' });
    setShowModal(true);
  }

  function openEdit(a){ setEditing({...a}); setShowModal(true); }

  async function saveEditing(){
    if (!editing) return;
    const body = { cliente_id: editing.cliente_id || null, nome_cliente: editing.nome_cliente, data: editing.data, hora: editing.hora, observacoes: editing.observacoes };
    try{
      if (editing.id) {
        const r = await apiFetch(`/rg/agendamentos/${editing.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)});
        if (!r.ok) throw new Error('erro');
      } else {
        const r = await apiFetch(`/rg/agendamentos`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)});
        if (!r.ok) throw new Error('erro');
      }
      setShowModal(false);
      loadDay(day);
      loadMonth(month);
    } catch (e){ alert('Erro ao salvar agendamento'); }
  }

  async function deleteAppt(id){
    if (!confirm('Excluir agendamento?')) return;
    try{
      const r = await apiFetch(`/rg/agendamentos/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('erro');
      loadDay(day); loadMonth(month);
    } catch(e){ alert('Erro ao excluir'); }
  }

  async function patchStatus(id, status){
    try{
      const r = await apiFetch(`/rg/agendamentos/${id}/status`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error('erro');
      loadDay(day); loadMonth(month);
    } catch(e){ alert('Erro ao atualizar status'); }
  }

  async function toggleSlot(open){
    try{
      const r = await apiFetch(`/rg/agendamentos/slots`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ data: slotDate, hora: slotTime+':00', aberto: !!open }) });
      if (!r.ok) throw new Error('erro');
      alert('Operação concluída'); loadMonth(month);
    } catch(e){ alert('Erro na operação de slot'); }
  }

  return (
    <div style={{ padding:24 }}>
      <h1>Agenda de Atendimentos — RG (Escrevente)</h1>
      <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
        <div style={{ width:360 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:700 }}>{new Date(month+'-01').toLocaleString('pt-BR', { month:'long', year:'numeric' })}</div>
            <div>
              <button className="btn outline" onClick={() => changeMonth(-1)}>‹</button>
              <button className="btn outline" onClick={() => changeMonth(1)}>›</button>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, marginTop:8 }}>
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((w,i)=>(<div key={i} style={{ textAlign:'center', fontSize:12, color:'#666' }}>{w}</div>))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, marginTop:6 }}>
            {(() => {
              const [y,m] = month.split('-').map(Number);
              const first = new Date(y, m-1, 1);
              const last = new Date(y, m, 0);
              const blanks = first.getDay();
              const cells = [];
              for (let i=0;i<blanks;i++) cells.push(<div key={'b'+i} />);
              for (let d=1; d<=last.getDate(); d++) {
                const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const meta = daysMeta[dateStr];
                cells.push(
                  <div key={dateStr} className={dateStr===new Date().toISOString().slice(0,10)?'today':''} style={{ border:'1px solid #eee', padding:6, minHeight:48, cursor:'pointer' }} onClick={() => setDay(dateStr)}>
                    <div style={{ fontSize:12 }}>{d}</div>
                    {meta && meta.total>0 && <div style={{ marginTop:6 }}><span className="badge">{meta.total}</span></div>}
                  </div>
                );
              }
              return cells;
            })()}
          </div>

          <div style={{ marginTop:12, padding:8, border:'1px solid #eee', borderRadius:6 }}>
            <h4 style={{ margin:0 }}>Abrir/Fechar Slot</h4>
            <div style={{ marginTop:8 }}>
              <input style={{ padding:6, borderRadius:6, border:'1px solid #ccc' }} type="date" value={slotDate} onChange={e=>setSlotDate(e.target.value)} />
              <input style={{ padding:6, borderRadius:6, border:'1px solid #ccc', marginLeft:8 }} type="time" value={slotTime} step={1800} onChange={e=>setSlotTime(e.target.value)} />
              <div style={{ marginTop:8 }}>
                <button className="btn" onClick={()=>toggleSlot(true)} style={{ padding:'6px 10px', borderRadius:6, background:'#2b7cff', color:'#fff', border:'none' }}>Abrir</button>
                <button className="btn outline" onClick={()=>toggleSlot(false)} style={{ marginLeft:8, padding:'6px 10px', borderRadius:6 }}>Fechar</button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h3 style={{ margin:0 }}>Atendimentos de {day}</h3>
            <div>
              <button className="btn" onClick={()=>openNew(day)}>Adicionar</button>
            </div>
          </div>

          <div style={{ marginTop:12 }}>
            {loading ? <div>Carregando...</div> : (
              appointments.length===0 ? <div className="small">Nenhum agendamento neste dia.</div> : (
                appointments.map(a=> (
                  <div key={a.id} className="item" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div><strong>{a.hora.slice(0,5)}</strong> — {a.nome_cliente || a.telefone}</div>
                      <div className="small">Usuário: {a.usuario || a.criado_por || '-' } • Status: {a.status}</div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button className="btn outline" onClick={()=>openEdit(a)}>Editar</button>
                      <button className="btn outline" onClick={()=>deleteAppt(a.id)}>Excluir</button>
                      <div style={{ display:'flex', flexDirection:'column' }}>
                        <button className="btn" onClick={()=>patchStatus(a.id,'realizado')}>Realizado</button>
                        <button className="btn outline" onClick={()=>patchStatus(a.id,'nao_compareceu')} style={{ marginTop:6 }}>Não compareceu</button>
                        <button className="btn outline" onClick={()=>patchStatus(a.id,'cancelado')} style={{ marginTop:6 }}>Cancelado</button>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>

      {showModal && editing && (
        <div className="modal" style={{ display:'flex' }}>
          <div className="modal-content">
            <h3>{editing.id ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ position:'relative' }}>
                <input placeholder="Nome do cliente" value={editing.nome_cliente} onChange={e=>{ setEditing({...editing, nome_cliente:e.target.value, cliente_id: null}); setClienteQuery(e.target.value); }} />
                {clienteSuggestions.length>0 && (
                  <div style={{ position:'absolute', zIndex:40, background:'#fff', border:'1px solid #ddd', width:'100%', maxHeight:160, overflow:'auto' }}>
                    {clienteSuggestions.map(c=> (
                      <div key={c.id} style={{ padding:8, cursor:'pointer' }} onClick={()=>{ setEditing({...editing, nome_cliente:c.nome, cliente_id:c.id}); setClienteSuggestions([]); setClienteQuery(''); }}>
                        <div style={{ fontWeight:600 }}>{c.nome}</div>
                        <div className="small">{c.cpf || c.rg || c.telefone}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input type="date" value={editing.data} onChange={e=>setEditing({...editing, data:e.target.value})} />
              <input type="time" value={editing.hora} onChange={e=>setEditing({...editing, hora:e.target.value})} />
              <textarea placeholder="Observações" value={editing.observacoes} onChange={e=>setEditing({...editing, observacoes:e.target.value})} />
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn" onClick={saveEditing} style={{ padding:'8px 14px', borderRadius:6, background:'#2b7cff', color:'#fff', border:'none' }}>Salvar</button>
                  <button className="btn outline" onClick={()=>setShowModal(false)} style={{ padding:'8px 12px', borderRadius:6 }}>Fechar</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
