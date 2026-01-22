import React, { useEffect, useState, useRef } from 'react';

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
  const [rangeEnd, setRangeEnd] = useState('12:00');
  const [rangeStep, setRangeStep] = useState(30);
  const [clienteQuery, setClienteQuery] = useState('');
  const [clienteSuggestions, setClienteSuggestions] = useState([]);
  const nameInputRef = useRef(null);
  const dateInputRef = useRef(null);
  const [slots, setSlots] = useState([]);
  const [slotsByDay, setSlotsByDay] = useState({});

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
      // also load slot markers for the month
      loadSlotsForMonth(m);
    } catch (e) { setDaysMeta({}); }
  }

  async function loadSlotsForMonth(m){
    try{
      // try month-based query first
      const res = await apiFetch(`/rg/agendamentos/slots?month=${m}`);
      if (res.ok){
        const j = await res.json();
        // if API returns days summary
        if (j.days) {
          const map = Object.fromEntries((j.days||[]).map(d => [d.data, d.count || (d.slots?d.slots.length:0)]));
          setSlotsByDay(map);
          return;
        }
        // if API returns slots array
        if (Array.isArray(j.slots)){
          const map = {};
          j.slots.forEach(s=>{ if (s.data) map[s.data] = (map[s.data]||0) + 1; });
          setSlotsByDay(map);
          return;
        }
      }
      // fallback: request each day in month (up to 31 requests)
      const [y, mm] = m.split('-').map(Number);
      const last = new Date(y, mm, 0).getDate();
      const map = {};
      for (let d=1; d<=last; d++){
        const dateStr = `${y}-${String(mm).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        try{
          const r = await apiFetch(`/rg/agendamentos/slots?data=${dateStr}`);
          if (!r.ok) continue;
          const jj = await r.json();
          const arr = jj.slots || jj || [];
          if (Array.isArray(arr) && arr.length>0) map[dateStr] = arr.length;
        } catch(e){}
      }
      setSlotsByDay(map);
    } catch(e){ setSlotsByDay({}); }
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
    // load slots for this day as well
    loadSlots(d);
  }

  async function loadSlots(d){
    try{
      const res = await apiFetch(`/rg/agendamentos/slots?data=${d}`);
      if (!res.ok) { setSlots([]); return; }
      const j = await res.json();
      setSlots(j.slots || j || []);
    } catch(e){ setSlots([]); }
  }

  function changeMonth(delta){
    const [y, m] = month.split('-').map(Number);
    const dt = new Date(y, m-1 + delta, 1);
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`);
  }

  function openNew(date){
    setEditing({ id: null, nome_cliente: '', data: date, hora: '08:00', observacoes: '' });
    setClienteQuery('');
    setClienteSuggestions([]);
    setShowModal(true);
  }

  function openEdit(a){ setEditing({...a}); setClienteQuery(''); setClienteSuggestions([]); setShowModal(true); }

  useEffect(() => {
    if (showModal && nameInputRef.current) {
      try { nameInputRef.current.focus(); } catch(e){}
    }
  }, [showModal]);

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
    if (!window.confirm('Excluir agendamento?')) return;
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
    // refresh slots for the selected day
    loadSlots(slotDate);
  }

  async function toggleRange(open){
    // generate times from slotTime to rangeEnd with rangeStep minutes
    try{
      const [sh, sm] = slotTime.split(':').map(Number);
      const [eh, em] = rangeEnd.split(':').map(Number);
      let start = new Date(0,0,0,sh,sm,0,0);
      const end = new Date(0,0,0,eh,em,0,0);
      const promises = [];
      while (start <= end){
        const hh = String(start.getHours()).padStart(2,'0');
        const mm = String(start.getMinutes()).padStart(2,'0');
        const timeStr = `${hh}:${mm}:00`;
        promises.push(apiFetch(`/rg/agendamentos/slots`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ data: slotDate, hora: timeStr, aberto: !!open }) }));
        start = new Date(start.getTime() + (rangeStep||30)*60000);
      }
      const results = await Promise.all(promises);
      const ok = results.every(r => r.ok);
      if (!ok) throw new Error('erro');
      alert('Operação de faixa concluída'); loadMonth(month);
    } catch (e){ alert('Erro na operação de faixa'); }
    // refresh slots for selected date
    loadSlots(slotDate);
  }

  async function toggleSingleSlot(hora, open){
    try{
      const r = await apiFetch(`/rg/agendamentos/slots`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ data: day, hora: hora+':00', aberto: !!open }) });
      if (!r.ok) throw new Error('erro');
      loadSlots(day); loadMonth(month);
    } catch(e){ alert('Erro ao alterar slot'); }
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
                const slotsCount = slotsByDay[dateStr] || 0;
                const isToday = dateStr===new Date().toISOString().slice(0,10);
                cells.push(
                  <div key={dateStr} className={isToday?'today':''} style={{ border:'1px solid #eee', padding:6, minHeight:48, cursor:'pointer', position:'relative' }} onClick={() => setDay(dateStr)}>
                    <div style={{ fontSize:12 }}>{d}</div>
                    {meta && meta.total>0 && <div style={{ marginTop:6 }}><span className="badge">{meta.total}</span></div>}
                    {slotsCount>0 && (
                      <div style={{ position:'absolute', top:6, right:6, width:10, height:10, borderRadius:5, background:'#2b7cff', boxShadow:'0 0 0 2px rgba(43,124,255,0.12)' }} title={`${slotsCount} slot(s) abertos`} />
                    )}
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
              <div style={{ marginTop:8, display:'flex', gap:8, alignItems:'center' }}>
                <button className="btn" onClick={()=>toggleSlot(true)} style={{ padding:'6px 10px', borderRadius:6, background:'#2b7cff', color:'#fff', border:'none' }}>Abrir</button>
                <button className="btn outline" onClick={()=>toggleSlot(false)} style={{ padding:'6px 10px', borderRadius:6 }}>Fechar</button>
                <div style={{ marginLeft:12 }}>
                  <div style={{ fontSize:12, color:'#444', marginBottom:6 }}>Rápido:</div>
                  <div style={{ display:'flex', gap:6 }}>
                    {['08:00','09:00','10:00','11:00','14:00','15:00'].map(t=> (
                      <button key={t} className="btn outline" onClick={()=>setSlotTime(t)} style={{ padding:'6px 8px', borderRadius:6 }}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop:10, borderTop:'1px dashed #eee', paddingTop:10 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <div style={{ fontSize:12, color:'#444' }}>Faixa:</div>
                  <input type="time" value={slotTime} onChange={e=>setSlotTime(e.target.value)} style={{ padding:6, borderRadius:6, border:'1px solid #ccc' }} />
                  <span style={{ color:'#666' }}>até</span>
                  <input type="time" value={rangeEnd} onChange={e=>setRangeEnd(e.target.value)} style={{ padding:6, borderRadius:6, border:'1px solid #ccc' }} />
                  <input type="number" min={5} step={5} value={rangeStep} onChange={e=>setRangeStep(Number(e.target.value))} style={{ width:80, padding:6, borderRadius:6, border:'1px solid #ccc' }} />
                  <div style={{ fontSize:12, color:'#666' }}>min</div>
                  <button className="btn" onClick={()=>toggleRange(true)} style={{ padding:'6px 10px', borderRadius:6, background:'#2b7cff', color:'#fff', border:'none' }}>Abrir Faixa</button>
                  <button className="btn outline" onClick={()=>toggleRange(false)} style={{ padding:'6px 10px', borderRadius:6 }}>Fechar Faixa</button>
                </div>
                <div style={{ marginTop:8, fontSize:12, color:'#666' }}>Use faixas para abrir/fechar vários horários de uma vez.</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h3 style={{ margin:0 }}>Atendimentos de {day}</h3>
            <div>
              <button className="btn" onClick={()=>openNew(day)}>Adicionar Agendamento</button>
            </div>
          </div>

          <div style={{ marginTop:12 }}>
            {slots && slots.length>0 && (
              <div style={{ marginBottom:12, padding:8, border:'1px solid #f0f4ff', borderRadius:6, background:'#fbfdff' }}>
                <div style={{ fontWeight:700, marginBottom:6 }}>Slots abertos</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {slots.map(s=> (
                    <div key={s.hora} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', border:'1px solid #e6eefc', borderRadius:6, background:'#fff' }}>
                      <div style={{ fontWeight:600 }}>{s.hora.slice(0,5)}</div>
                      <div style={{ fontSize:12, color:'#666' }}>{s.aberto ? 'Aberto' : 'Fechado'}</div>
                      <div>
                        {s.aberto ? (
                          <button className="btn outline" onClick={()=>toggleSingleSlot(s.hora, false)} style={{ padding:'4px 8px' }}>Fechar</button>
                        ) : (
                          <button className="btn" onClick={()=>toggleSingleSlot(s.hora, true)} style={{ padding:'4px 8px' }}>Abrir</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                <input ref={nameInputRef} autoFocus placeholder="Nome do cliente" value={editing.nome_cliente} onChange={e=>{ setEditing({...editing, nome_cliente:e.target.value, cliente_id: null}); setClienteQuery(e.target.value); }} onKeyDown={e=>{
                  if (e.key === 'Enter'){
                    if (clienteSuggestions && clienteSuggestions.length>0){
                      const c = clienteSuggestions[0];
                      setEditing(prev=>({...prev, nome_cliente: c.nome, cliente_id: c.id}));
                      setClienteSuggestions([]);
                      setClienteQuery('');
                      if (dateInputRef.current) dateInputRef.current.focus();
                      e.preventDefault();
                    } else {
                      if (dateInputRef.current) dateInputRef.current.focus();
                      e.preventDefault();
                    }
                  }
                }} />
                {clienteSuggestions.length>0 && (
                  <div style={{ position:'absolute', zIndex:40, background:'#fff', border:'1px solid #ddd', width:'100%', maxHeight:160, overflow:'auto' }}>
                    {clienteSuggestions.map(c=> (
                      <div key={c.id} style={{ padding:8, cursor:'pointer' }} onClick={()=>{ setEditing(prev=>({...prev, nome_cliente:c.nome, cliente_id:c.id})); setClienteSuggestions([]); setClienteQuery(''); if (dateInputRef.current) dateInputRef.current.focus(); }}>
                        <div style={{ fontWeight:600 }}>{c.nome}</div>
                        <div className="small">{c.cpf || c.rg || c.telefone}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input ref={dateInputRef} type="date" value={editing.data} onChange={e=>setEditing({...editing, data:e.target.value})} />
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
