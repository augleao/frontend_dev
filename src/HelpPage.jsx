import React, { useEffect, useState, useMemo } from 'react';
import './HelpPage.css';

function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function renderMarkdown(md){
  const lines = md.replace(/\r\n/g,'\n').split('\n');
  let out = '';
  let inList = false;
  let inCode = false;
  for(let i=0;i<lines.length;i++){
    let line = lines[i];
    if(line.startsWith('```')){ inCode = !inCode; out += inCode ? '<pre><code>' : '</code></pre>'; continue; }
    if(inCode){ out += escapeHtml(line)+'\n'; continue; }
    if(/^#{1,6}\s/.test(line)){
      const m = line.match(/^(#{1,6})\s+(.*)$/);
      out += `<h${m[1].length}>${m[2]}</h${m[1].length}>`;
      continue;
    }
    if(/^!\[.*\]\(.*\)/.test(line)){
      const m = line.match(/^!\[(.*)\]\((.*)\)/);
      out += `<p><img src="${m[2]}" alt="${m[1]}" style="max-width:100%"/></p>`; continue;
    }
    if(/^\[.*\]\(.*\)/.test(line)){
      const m = line.match(/^\[(.*)\]\((.*)\)/);
      out += `<p><a href="${m[2]}">${m[1]}</a></p>`; continue;
    }
    if(/^\s*[-*+]\s+/.test(line)){
      if(!inList){ inList = true; out += '<ul>'; }
      out += `<li>${line.replace(/^\s*[-*+]\s+/,'')}</li>`;
      const next = lines[i+1]||'';
      if(!/^\s*[-*+]\s+/.test(next)){ inList = false; out += '</ul>'; }
      continue;
    }
    if(line.trim()===''){ out += '<p></p>'; continue; }
    out += `<p>${line}</p>`;
  }
  return out;
}

export default function HelpPage(){
  const [md, setMd] = useState('Carregando...');
  const [query, setQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(()=>{
    fetch('/help/USER_MANUAL.md')
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); })
      .then(t=> setMd(t))
      .catch(e=> setMd('Erro ao carregar manual: '+e));
  },[]);

  const html = useMemo(()=> renderMarkdown(md), [md]);

  // build TOC from rendered HTML
  const toc = useMemo(()=>{
    const wrapper = document.createElement('div'); wrapper.innerHTML = html;
    const headings = wrapper.querySelectorAll('h1,h2,h3');
    const items = [];
    headings.forEach(h=>{ const level = Number(h.tagName.substring(1)); const text = h.textContent || ''; const id = text.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-'); items.push({ level, text, id }); });
    return items;
  },[html]);

  // filtered HTML by query — simple client side show/hide
  useEffect(()=>{
    if(!query){
      Array.from(document.querySelectorAll('.help-content p, .help-content li, .help-content h1, .help-content h2, .help-content h3')).forEach(n=> n.style.display='block');
      return;
    }
    Array.from(document.querySelectorAll('.help-content p, .help-content li, .help-content h1, .help-content h2, .help-content h3')).forEach(n=>{
      n.style.display = (n.textContent||'').toLowerCase().includes(query.toLowerCase()) ? 'block' : 'none';
    });
  },[query, html]);

  return (
    <div className="help-root">
      <div className="help-container">
        <aside className={`help-sidebar ${showSidebar? 'open':'closed'}`}>
          <button className="help-toggle" onClick={()=>setShowSidebar(!showSidebar)}>{showSidebar? '⟨' : '⟩'}</button>
          <h3>Índice</h3>
          <ul>
            {toc.map((it,idx)=> (
              <li key={idx} className={`lvl-${it.level}`}>
                <a href={`#${it.id}`}>{it.text}</a>
              </li>
            ))}
          </ul>
        </aside>

        <main className="help-main">
          <div className="help-header">
            <h1>Manual do Usuário</h1>
            <div className="help-controls">
              <input placeholder="Pesquisar..." value={query} onChange={e=>setQuery(e.target.value)} />
            </div>
          </div>
          <article className="help-content" dangerouslySetInnerHTML={{ __html: html }} />
        </main>
      </div>
    </div>
  );
}
