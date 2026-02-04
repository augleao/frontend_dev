import React, { useEffect, useState, useRef } from 'react';
import { apiURL } from './config';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './RGAgenda.css';

const authToken = localStorage.getItem('token') || localStorage.getItem('rg_token');

// Always derive date strings in local time to avoid UTC/off-by-one shifts
function toYMD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(d) {
  return toYMD(d);
}

function formatDayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

const todayDefault = toYMD(new Date());
const monthDefault = todayDefault.slice(0, 7);

export default function RGAgenda() {
  const [month, setMonth] = useState(monthDefault);
  const [day, setDay] = useState(todayDefault);
  const [daysMeta, setDaysMeta] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
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
  const [calendarMode, setCalendarMode] = useState('month'); // 'month' or 'day'
  const [monthChanging, setMonthChanging] = useState(false);

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  // Bulk slot config state
  const [bulkStart, setBulkStart] = useState(todayDefault);
  const [bulkEnd, setBulkEnd] = useState(todayDefault);
  const [weekdays, setWeekdays] = useState({ 1:true, 2:true, 3:true, 4:true, 5:true, 6:false, 0:false }); // default: seg-sex
  const [timeRanges, setTimeRanges] = useState([
    { start:'09:00', end:'12:00' },
    { start:'13:00', end:'17:00' },
  ]);
  const [slotDuration, setSlotDuration] = useState(30);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessages, setBulkMessages] = useState([]);
  const [suspensos, setSuspensos] = useState([]);
  const [suspLoading, setSuspLoading] = useState(false);
  const [suspActionId, setSuspActionId] = useState(null);
  const [suspQuery, setSuspQuery] = useState('');
  const [suspResults, setSuspResults] = useState([]);
  const [showSuspModal, setShowSuspModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportStart, setReportStart] = useState(todayDefault);
  const [reportEnd, setReportEnd] = useState(todayDefault);
  const [reportLoading, setReportLoading] = useState(false);

  const OPEN_TIME_START = '09:00';
  const OPEN_TIME_END = '17:00';

  function isWeekend(dateStr){
    try{
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m-1, d);
      const day = dt.getDay(); // 0 = Sunday, 6 = Saturday
      return day === 0 || day === 6;
    }catch(e){ return false; }
  }

  function nextWeekday(dateStr){
    try{
      const [y,m,day] = dateStr.split('-').map(Number);
      let d = new Date(y, m-1, day);
      do { d.setDate(d.getDate()+1); } while (d.getDay()===0 || d.getDay()===6);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }catch(e){ return dateStr; }
  }

  // Avoid UTC parsing of ISO strings by always constructing dates with numeric parts
  function dayOfWeek(dateStr){
    try{
      const [y,m,d] = dateStr.split('-').map(Number);
      return new Date(y, m-1, d).getDay();
    } catch(e){ return new Date(dateStr).getDay(); }
  }

  // Helpers for bulk config
  function listDaysInRange(startStr, endStr){
    const days = [];
    const [ys, ms, ds] = startStr.split('-').map(Number);
    const [ye, me, de] = endStr.split('-').map(Number);
    let cur = new Date(ys, ms-1, ds);
    const end = new Date(ye, me-1, de);
    while (cur <= end){
      days.push(toYMD(cur));
      cur.setDate(cur.getDate()+1);
    }
    return days;
  }

  function generateSlotsForRanges(ranges, duration){
    const slots = [];
    ranges.forEach(r => {
      const [sh, sm] = r.start.split(':').map(Number);
      const [eh, em] = r.end.split(':').map(Number);
      let start = new Date(0,0,0,sh,sm,0,0);
      const end = new Date(0,0,0,eh,em,0,0);
      if (end <= start) return; // invalid range
      while (start < end){
        const hh = String(start.getHours()).padStart(2,'0');
        const mm = String(start.getMinutes()).padStart(2,'0');
        slots.push(`${hh}:${mm}:00`);
        start = new Date(start.getTime() + duration*60000);
      }
    });
    return slots;
  }

  function listDays(startStr, endStr){
    const res = [];
    const [ys, ms, ds] = startStr.split('-').map(Number);
    const [ye, me, de] = endStr.split('-').map(Number);
    let cur = new Date(ys, ms-1, ds);
    const end = new Date(ye, me-1, de);
    while (cur <= end){
      res.push(toYMD(cur));
      cur.setDate(cur.getDate()+1);
    }
    return res;
  }

  function countPreview(){
    const days = listDaysInRange(bulkStart, bulkEnd).filter(d => weekdays[dayOfWeek(d)]);
    const perDay = generateSlotsForRanges(timeRanges, slotDuration).length;
    return { days: days.length, perDay, total: days.length * perDay };
  }

  function findSlotByTime(time){
    if (!slots || !Array.isArray(slots)) return null;
    return slots.find(s => (s.hora||'').slice(0,5) === time);
  }

  useEffect(() => {
    loadMonth(month);
  }, [month]);

  useEffect(() => {
    loadDay(day);
  }, [day]);

  // Always open in current month on mount
  useEffect(() => {
    const now = new Date();
    const currentMonth = toYMD(now).slice(0,7);
    const currentDay = toYMD(now);
    if (month !== currentMonth) setMonth(currentMonth);
    if (day !== currentDay) setDay(currentDay);
    setCalendarMode('month');
  }, []);

  useEffect(() => {
    loadSuspensos();
  }, []);

  async function apiFetch(path, opts={}){
    const headers = opts.headers || {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    // Use apiURL from config explicitly; do not fallback to relative /api
    if (!apiURL) throw new Error('apiURL is not configured in src/config.js');
    const res = await fetch(`${apiURL}${path}`, {...opts, headers});
    return res;
  }

  // load suspended list
  async function loadSuspensos(){
    try {
      setSuspLoading(true);
      const res = await apiFetch('/rg/clientes/suspensos');
      if (res.ok) {
        const j = await res.json();
        setSuspensos(j.clientes || []);
      }
    } catch(e){ /* ignore */ }
    setSuspLoading(false);
  }

  // fetch cliente suggestions (debounced)
  useEffect(() => {
    if (!clienteQuery || clienteQuery.length < 2) { setClienteSuggestions([]); return; }
    let mounted = true;
    const t = setTimeout(async () => {
      try {
        let res = await apiFetch(`/rg/clientes?query=${encodeURIComponent(clienteQuery)}`);
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

  // search clients to suspend (debounced)
  useEffect(() => {
    if (!suspQuery || suspQuery.length < 2) { setSuspResults([]); return; }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/rg/clientes?query=${encodeURIComponent(suspQuery)}`);
        if (!active) return;
        if (res.ok) {
          const j = await res.json();
          setSuspResults(j.clientes || []);
        }
      } catch(e){ /* ignore */ }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [suspQuery]);

  async function loadMonth(m) {
    try {
      const res = await apiFetch(`/rg/agendamentos/calendar?month=${m}`);
      if (!res.ok) { console.error('[RG-AGENDA] calendar fetch failed', res.status); return; }
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
      if (res.status === 404) { // server doesn't support month endpoint
        setSlotsByDay({});
        return;
      }
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
      if (!authToken) {
        // without token, the endpoint 401s; avoid noisy requests
        setAppointments([]);
        setLoading(false);
        return;
      }
      const res = await apiFetch(`/rg/agendamentos?data=${d}`);
      if (!res.ok) {
        if (res.status === 401) {
          alert('Você precisa estar logado para visualizar os agendamentos.');
        } else {
          console.error('Erro ao carregar agendamentos:', res.status);
        }
        setAppointments([]);
        setLoading(false);
        return;
      }
      const j = await res.json();
      setAppointments(j.agendamentos || []);
    } catch (e) {
      console.error('Erro ao carregar agendamentos:', e);
      setAppointments([]);
    }
    setLoading(false);
    // load slots for this day as well
    loadSlots(d);
  }

  async function loadSlots(d){
    try{
      const res = await apiFetch(`/rg/agendamentos/slots?data=${d}`);
      if (res.status === 404) { setSlots([]); return; }
      if (!res.ok) { setSlots([]); return; }
      const j = await res.json();
      setSlots(j.slots || j || []);
    } catch(e){ setSlots([]); }
  }

  function changeMonth(delta){
    if (monthChanging) return;
    setMonthChanging(true);
    const [y, m] = month.split('-').map(Number);
    const dt = new Date(y, m-1 + delta, 1);
    const newMonth = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
    setMonth(newMonth);
    setDay(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-01`); // reset day to 1st of new month
    setCalendarMode('month'); // reset to month view when navigating months
    setTimeout(() => setMonthChanging(false), 500);
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
      if (isWeekend(slotDate) && open) { alert('Fins de semana permanecem fechados. Escolha outro dia.'); return; }
      // ensure time within allowed hours
      if (slotTime < OPEN_TIME_START || slotTime > OPEN_TIME_END) { alert(`Horário permitido: ${OPEN_TIME_START} - ${OPEN_TIME_END}`); return; }
      const r = await apiFetch(`/rg/agendamentos/slots`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ data: slotDate, hora: slotTime+':00', abrir: !!open }) });
      if (!r.ok) throw new Error('erro');
      alert('Operação concluída'); loadMonth(month);
    } catch(e){ alert('Erro na operação de slot'); }
    // refresh slots for the selected day
    loadSlots(slotDate);
  }

  async function toggleRange(open){
    // generate times from slotTime to rangeEnd with rangeStep minutes
    try{
      if (isWeekend(slotDate) && open) { alert('Fins de semana permanecem fechados. Escolha outro dia.'); return; }
      // clamp start/end within allowed hours
      let s = slotTime;
      let e = rangeEnd;
      if (s < OPEN_TIME_START) { s = OPEN_TIME_START; }
      if (e > OPEN_TIME_END) { e = OPEN_TIME_END; }
      const [sh, sm] = s.split(':').map(Number);
      const [eh, em] = e.split(':').map(Number);
      let start = new Date(0,0,0,sh,sm,0,0);
      const end = new Date(0,0,0,eh,em,0,0);
      const promises = [];
      while (start <= end){
        const hh = String(start.getHours()).padStart(2,'0');
        const mm = String(start.getMinutes()).padStart(2,'0');
        const timeStr = `${hh}:${mm}:00`;
        // only post times inside allowed window
        if (timeStr >= OPEN_TIME_START+':00' && timeStr <= OPEN_TIME_END+':00'){
          promises.push(apiFetch(`/rg/agendamentos/slots`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ data: slotDate, hora: timeStr, abrir: !!open }) }));
        }
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

  async function applyBulk(open){
    setBulkBusy(true);
    const messages = [];
    try {
      const days = listDaysInRange(bulkStart, bulkEnd).filter(d => weekdays[dayOfWeek(d)]);
      const slotsList = generateSlotsForRanges(timeRanges, slotDuration);
      if (slotsList.length === 0) throw new Error('Nenhum slot gerado. Ajuste faixas/horários.');
      for (const d of days){
        if (isWeekend(d) && !weekdays[dayOfWeek(d)]) continue;
        if (!open && daysMeta[d]?.total > 0) {
          messages.push(`Dia ${d}: possui agendamentos, não fechado.`);
          continue;
        }
        for (const hora of slotsList){
          const body = { data: d, hora, abrir: !!open };
          const r = await apiFetch(`/rg/agendamentos/slots`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
          if (!r.ok) {
            messages.push(`Falha em ${d} ${hora}`);
          }
        }
      }
      messages.push(open ? 'Abertura concluída.' : 'Fechamento concluído (agendamentos existentes foram mantidos).');
      loadMonth(month);
    } catch (e){
      messages.push(e.message || 'Erro na configuração em lote');
    }
    setBulkMessages(messages);
    setBulkBusy(false);
  }

  async function handleOpenNextWeekday(){
    const next = nextWeekday(slotDate);
    setSlotDate(next);
    // allow state to update, then open the slot
    setTimeout(()=>toggleSlot(true), 50);
  }

  async function toggleSingleSlot(hora, open){
    try{
      const r = await apiFetch(`/rg/agendamentos/slots`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ data: day, hora: hora+':00', abrir: !!open }) });
      if (!r.ok) throw new Error('erro');
      loadSlots(day); loadMonth(month);
    } catch(e){ alert('Erro ao alterar slot'); }
  }

  async function toggleSuspensao(id, suspenso){
    if (!id) return;
    setSuspActionId(id);
    try {
      const res = await apiFetch(`/rg/clientes/${id}/suspensao`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ suspenso }) });
      if (res.ok) {
        await loadSuspensos();
      }
    } catch(e){ /* ignore */ }
    setSuspActionId(null);
  }

  async function generateReport(){
    if (!reportStart || !reportEnd) { alert('Selecione o intervalo de datas.'); return; }
    if (reportEnd < reportStart) { alert('Data fim deve ser maior ou igual à data início.'); return; }
    setReportLoading(true);
    try {
      const dates = listDays(reportStart, reportEnd);
      const rows = [];
      for (const d of dates){
        try {
          const res = await apiFetch(`/rg/agendamentos?data=${d}`);
          if (!res.ok) continue;
          const j = await res.json();
          const list = j.agendamentos || [];
          list.filter(a => a.status === 'agendado').forEach(a => {
            rows.push({ data: d, hora: (a.hora||'').slice(0,5), nome: a.nome_cliente || a.telefone || '-', cpf: a.cpf || '-' });
          });
        } catch(e){ /* ignore */ }
      }
      if (rows.length === 0){
        alert('Nenhum agendamento no período.');
        setReportLoading(false);
        return;
      }
      const doc = new jsPDF();
      doc.setFontSize(12);
      doc.text('Relatório de Agendamentos', 14, 18);
      doc.setFontSize(10);
      doc.text(`Período: ${formatDayLabel(reportStart)} a ${formatDayLabel(reportEnd)}`, 14, 26);
      autoTable(doc, {
        startY: 32,
        head: [['Data', 'Hora', 'Cliente', 'CPF']],
        body: rows.map(r => [formatDayLabel(r.data), r.hora, r.nome, r.cpf]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [43,124,255] }
      });
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setShowReportModal(false);
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div className="rg-shell" style={{ padding:24 }}>
      <h1>Agenda de Atendimentos — RG (Escrevente)</h1>
      <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
        <div style={{ width:360 }}>
          <div className={`rg-panel ${calendarMode==='day' ? 'day-mode' : ''}`}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:700 }}>{(() => { const [y, mm] = month.split('-').map(Number); return `${monthNames[mm-1]} ${y}`; })()}</div>
            <div>
              <button className="btn outline" disabled={monthChanging} onClick={() => changeMonth(-1)}>‹</button>
              <button className="btn outline" disabled={monthChanging} onClick={() => changeMonth(1)}>›</button>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, marginTop:8 }}>
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((w,i)=>(<div key={i} style={{ textAlign:'center', fontSize:12, color:'#666' }}>{w}</div>))}
          </div>
          {calendarMode === 'month' ? (
            <div className="month-view" style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, marginTop:6 }}>
              {(() => {
                const [y, mm] = month.split('-').map(Number);
                const first = new Date(y, mm - 1, 1);
                const mIndex = mm - 1; // 0-based
                const last = new Date(y, mIndex + 1, 0);
                const blanks = first.getDay();
                const cells = [];
                for (let i=0;i<blanks;i++) cells.push(<div key={'b'+i} />);
                for (let d=1; d<=last.getDate(); d++) {
                  const dateStr = `${y}-${String(mIndex+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const meta = daysMeta[dateStr];
                  const slotsCount = slotsByDay[dateStr] || 0;
                  const isToday = dateStr===toYMD(new Date());
                  const weekend = isWeekend(dateStr);
                  const hasAppt = !!(meta && meta.total > 0);
                  const statusClass = hasAppt ? 'rg-has-appt' : (slotsCount > 0 ? 'rg-has-slots' : 'rg-no-slots');
                  const cellClass = `rg-cell ${statusClass} ${!weekend ? 'selectable' : ''} ${isToday ? 'today' : ''} ${weekend ? 'rg-weekend' : ''}`.trim();
                  cells.push(
                    <div key={dateStr} className={cellClass} style={{ padding:6, position:'relative' }} onClick={() => { if (!weekend) { setDay(dateStr); setCalendarMode('day'); } }}>
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
          ) : (
            <div className="day-view">
              <div style={{ marginTop:12 }} className="rg-card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontWeight:700 }}>{formatDayLabel(day)}</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="rg-btn rg-btn-outline" onClick={() => setCalendarMode('month')}>Voltar ao Mês</button>
                  </div>
                </div>
                <div style={{ marginTop:12 }}>
                  {(() => {
                    const slotsList = [];
                    const start = 9 * 60; const end = 17 * 60; const step = 30;
                    for (let t = start; t <= end; t += step){
                      const hh = String(Math.floor(t/60)).padStart(2,'0');
                      const mm = String(t%60).padStart(2,'0');
                      const time = `${hh}:${mm}`;
                      const matches = appointments.filter(a => (a.hora||'').slice(0,5) === time);
                      const slotInfo = findSlotByTime(time);
                      slotsList.push({ time, matches, slotInfo });
                    }
                    return (
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {slotsList.map(s => (
                          <div key={s.time} className="rg-card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                              <div style={{ fontWeight:700 }}>{s.time}</div>
                              <div className="rg-small">{s.matches.length>0 ? `${s.matches.length} agendamento(s)` : 'Livre'}</div>
                            </div>
                            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                              {s.slotInfo ? (
                                <div className={`rg-slot-status ${s.slotInfo.aberto ? 'rg-slot-open' : 'rg-slot-closed'}`}>{s.slotInfo.aberto ? 'Aberto' : 'Fechado'}</div>
                              ) : (
                                <div className="rg-slot-status rg-slot-free">Livre</div>
                              )}
                              {s.matches.length>0 ? s.matches.map(m => (
                                <div key={m.id} style={{ padding:8, borderRadius:8, background:'#fff' }}>{m.nome_cliente || m.telefone}</div>
                              )) : (
                                s.slotInfo ? (
                                  s.slotInfo.aberto ? (
                                    <button className="rg-btn rg-btn-outline" onClick={()=>toggleSingleSlot(s.time, false)}>Fechar</button>
                                  ) : (
                                    <button className="rg-btn rg-btn-success" onClick={()=>toggleSingleSlot(s.time, true)}>Abrir</button>
                                  )
                                ) : (
                                  <button className="rg-btn rg-btn-success" onClick={()=>{ setSlotDate(day); setSlotTime(s.time); toggleSlot(true); }}>Abrir</button>
                                )
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          <div className="rg-legend" style={{ marginTop:10 }}>
            <span className="rg-legend-item"><span className="rg-legend-dot rg-legend-open" /> Slots abertos</span>
            <span className="rg-legend-item"><span className="rg-legend-dot rg-legend-appt" /> Agendamento</span>
            <span className="rg-legend-item"><span className="rg-legend-dot rg-legend-closed" /> Sem slots</span>
          </div>
          </div>
        </div>

        <div style={{ flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h3 style={{ margin:0 }}>Atendimentos de {formatDayLabel(day)}</h3>
            <div style={{ display:'flex', gap:8 }}>
                <button className="rg-btn rg-btn-success" onClick={()=>setShowReportModal(true)}>Relatórios</button>
                <button className="rg-btn" style={{ background:'linear-gradient(90deg,#ef4444,#b91c1c)', border:'none', color:'#fff' }} onClick={()=>{ setShowSuspModal(true); loadSuspensos(); }}>Clientes Suspensos</button>
              <button className="rg-btn rg-btn-success" onClick={()=>openNew(day)}>Adicionar Agendamento</button>
              <button className="rg-btn rg-btn-success" onClick={()=>setShowSlotModal(true)}>Configurar Agenda</button>
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
                appointments.map((a, idx) => (
                  <div key={a.id || idx} className="item" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, paddingBottom:12, marginBottom:12, borderBottom:'1px dashed #d9e2f3' }}>
                    <div>
                      <div><strong>{a.hora.slice(0,5)}</strong> — {a.nome_cliente || a.telefone}</div>
                      <div className="small">Usuário: {a.usuario || a.criado_por || '-' } • Status: {a.status}</div>
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end', minWidth:280 }}>
                      <button className="btn" style={{ background:'linear-gradient(90deg,#60a5fa,#2563eb)', border:'none', color:'#fff' }} onClick={()=>openEdit(a)}>Editar</button>
                      <button className="btn" style={{ background:'linear-gradient(90deg,#60a5fa,#2563eb)', border:'none', color:'#fff' }} onClick={()=>deleteAppt(a.id)}>Excluir</button>
                      <button className="btn" style={{ background:'linear-gradient(90deg,#10b981,#059669)', border:'none', color:'#fff' }} onClick={()=>patchStatus(a.id,'realizado')}>Realizado</button>
                      <button className="btn" style={{ background:'linear-gradient(90deg,#ef4444,#b91c1c)', border:'none', color:'#fff' }} onClick={()=>patchStatus(a.id,'nao_compareceu')}>Não compareceu</button>
                      <button className="btn" style={{ background:'linear-gradient(90deg,#f97316,#ea580c)', border:'none', color:'#fff' }} onClick={()=>patchStatus(a.id,'cancelado')}>Cancelado</button>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>

      {showModal && editing && (
            <div className="rg-modal">
              <div className="rg-modal-content">
                <h3 className="rg-modal-title">{editing.id ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
                <div className="rg-form">
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

      {showReportModal && (
        <div className="rg-modal" onClick={(e)=>{ if (e.target.classList.contains('rg-modal')) setShowReportModal(false); }}>
          <div className="rg-modal-content" style={{ maxWidth:420 }}>
            <h3 className="rg-modal-title" style={{ marginBottom:8 }}>Relatórios de Agendamentos</h3>
            <div className="rg-form" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <div className="rg-small">Data início</div>
                <input className="rg-input" type="date" value={reportStart} onChange={e=>setReportStart(e.target.value)} />
              </div>
              <div>
                <div className="rg-small">Data fim</div>
                <input className="rg-input" type="date" value={reportEnd} onChange={e=>setReportEnd(e.target.value)} />
              </div>
              <div className="rg-small" style={{ color:'#555' }}>O PDF traz apenas agendamentos com status "agendado".</div>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginTop:4 }}>
                <button className="rg-btn rg-btn-outline" onClick={()=>setShowReportModal(false)}>Fechar</button>
                <button className="rg-btn rg-btn-primary" disabled={reportLoading} onClick={generateReport}>{reportLoading ? 'Gerando...' : 'Gerar PDF'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSlotModal && (
        <div className="rg-modal">
          <div className="rg-modal-content">
            <h3 className="rg-modal-title">Configurar Agenda — Lote</h3>

            <div className="rg-row" style={{gap:12, alignItems:'flex-start', flexWrap:'wrap'}}>
              <div className="rg-col">
                <div className="rg-small">Data início</div>
                <input className="rg-input" type="date" value={bulkStart} onChange={e=>setBulkStart(e.target.value)} />
              </div>
              <div className="rg-col">
                <div className="rg-small">Data fim</div>
                <input className="rg-input" type="date" value={bulkEnd} onChange={e=>setBulkEnd(e.target.value)} />
              </div>
              <div className="rg-col">
                <div className="rg-small">Duração (min)</div>
                <input className="rg-input" type="number" min={5} step={5} value={slotDuration} onChange={e=>setSlotDuration(Number(e.target.value)||30)} style={{width:120}} />
              </div>
            </div>

            <div style={{ marginTop:12 }}>
              <div className="rg-small" style={{ marginBottom:6 }}>Dias da semana</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((lbl, idx)=>(
                  <label key={idx} style={{ display:'flex', alignItems:'center', gap:6, border:'1px solid #e5eaf3', padding:'6px 8px', borderRadius:8, background: weekdays[idx] ? '#f0f6ff' : '#fff' }}>
                    <input type="checkbox" checked={!!weekdays[idx]} onChange={e=> setWeekdays(prev=>({...prev, [idx]: e.target.checked})) } />
                    <span>{lbl}</span>
                  </label>
                ))}
              </div>
              <div className="rg-small" style={{ marginTop:6 }}>Finais de semana ficam desmarcados por padrão.</div>
            </div>

            <div style={{ marginTop:12, borderTop:'1px dashed #eee', paddingTop:12 }}>
              <div className="rg-small" style={{ marginBottom:6 }}>Faixas de horário</div>
              {timeRanges.map((tr, idx)=>(
                <div key={idx} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                  <span className="rg-small">Início</span>
                  <input className="rg-input" type="time" value={tr.start} onChange={e=>{
                    const v = e.target.value;
                    setTimeRanges(prev => prev.map((r,i)=> i===idx ? {...r, start:v} : r));
                  }} />
                  <span className="rg-small">Fim</span>
                  <input className="rg-input" type="time" value={tr.end} onChange={e=>{
                    const v = e.target.value;
                    setTimeRanges(prev => prev.map((r,i)=> i===idx ? {...r, end:v} : r));
                  }} />
                  <button className="rg-btn rg-btn-outline" onClick={()=> setTimeRanges(prev => prev.filter((_,i)=>i!==idx))} disabled={timeRanges.length<=1}>Remover</button>
                </div>
              ))}
              <button className="rg-btn rg-btn-success-outline" onClick={()=> setTimeRanges(prev => [...prev, { start:'09:00', end:'17:00' }])}>Adicionar faixa</button>
            </div>

            <div style={{ marginTop:12, padding:12, background:'#f8fbff', border:'1px solid #e6eefc', borderRadius:10 }}>
              {(() => {
                const preview = countPreview();
                return <div className="rg-small">Você está prestes a gerar aproximadamente <strong>{preview.total}</strong> slots de <strong>{slotDuration} minutos</strong> em <strong>{preview.days}</strong> dia(s), com ~<strong>{preview.perDay}</strong> slots por dia.</div>;
              })()}
            </div>

            {bulkMessages.length>0 && (
              <div style={{ marginTop:10 }} className="rg-small">
                {bulkMessages.map((m,i)=>(<div key={i}>{m}</div>))}
              </div>
            )}

            <div className="rg-footer" style={{ display:'flex', justifyContent:'space-between', marginTop:16 }}>
              <div style={{ display:'flex', gap:8 }}>
                <button className="rg-btn rg-btn-primary" disabled={bulkBusy} onClick={()=>applyBulk(true)}>Abrir Agenda</button>
                <button className="rg-btn rg-btn-outline" disabled={bulkBusy} onClick={()=>applyBulk(false)}>Fechar Agenda</button>
                <button className="rg-btn rg-btn-outline" disabled={bulkBusy} onClick={()=>{ setBulkMessages([]); setTimeRanges([{start:'09:00', end:'17:00'}]); }}>Limpar faixas</button>
              </div>
              <button className="rg-btn" onClick={()=>{ setShowSlotModal(false); setBulkMessages([]); }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {showSuspModal && (
        <div className="rg-modal" onClick={(e)=>{ if (e.target.classList.contains('rg-modal')) setShowSuspModal(false); }}>
          <div className="rg-modal-content" style={{ maxWidth:900 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div>
                <h3 className="rg-modal-title" style={{ marginBottom:4 }}>Suspensões de clientes</h3>
                <div className="small">Visualize suspensos, prazos e libere ou aplique nova suspensão (30 dias).</div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button className="rg-btn rg-btn-outline" onClick={loadSuspensos} disabled={suspLoading}>Atualizar lista</button>
                <button className="rg-btn rg-btn-outline" onClick={()=>setShowSuspModal(false)}>Fechar</button>
              </div>
            </div>

            <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:12 }}>
              <div style={{ border:'1px solid #e6eefc', borderRadius:8, padding:12, background:'#fff' }}>
                <div style={{ fontWeight:700, marginBottom:8 }}>Suspensos atuais</div>
                {suspLoading ? <div className="small">Carregando...</div> : (
                  suspensos.length === 0 ? <div className="small">Nenhum cliente suspenso.</div> : (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {suspensos.map(c => {
                        const release = c.releaseAt || c.releaseat || c.suspenso_inicio;
                        return (
                          <div key={c.id} style={{ border:'1px solid #edf2ff', borderRadius:8, padding:8, background:'#f9fbff' }}>
                            <div style={{ fontWeight:600 }}>{c.nome}</div>
                            <div className="small">CPF: {c.cpf || '-'}</div>
                            <div className="small">Início: {c.suspenso_inicio ? formatDayLabel(c.suspenso_inicio.slice(0,10)) : '-'}</div>
                            <div className="small">Liberação: {release ? formatDayLabel(release.slice(0,10)) : '-'}</div>
                            <div style={{ marginTop:6 }}>
                              <button className="rg-btn rg-btn-outline" disabled={suspActionId === c.id} onClick={()=>toggleSuspensao(c.id, false)}>Cancelar suspensão</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>

              <div style={{ border:'1px solid #e6eefc', borderRadius:8, padding:12, background:'#fff' }}>
                <div style={{ fontWeight:700, marginBottom:8 }}>Aplicar suspensão (30 dias)</div>
                <input className="rg-input" placeholder="Buscar por nome ou CPF" value={suspQuery} onChange={e=>setSuspQuery(e.target.value)} />
                {suspResults.length > 0 && (
                  <div style={{ marginTop:8, maxHeight:240, overflow:'auto', border:'1px solid #eee', borderRadius:6 }}>
                    {suspResults.map(c => (
                      <div key={c.id} style={{ padding:8, borderBottom:'1px solid #f2f4f8', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                        <div>
                          <div style={{ fontWeight:600 }}>{c.nome}</div>
                          <div className="small">CPF: {c.cpf || '-'} | Email: {c.email || '-'}</div>
                        </div>
                        <button className="rg-btn rg-btn-outline" disabled={suspActionId === c.id} onClick={()=>toggleSuspensao(c.id, true)}>Suspender</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="small" style={{ marginTop:8 }}>Selecione um cliente para suspender por 30 dias. A suspensão começa hoje.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
