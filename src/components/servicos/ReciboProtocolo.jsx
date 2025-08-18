import React from 'react';

// Componente para gerar e imprimir o recibo de protocolo
export default function ReciboProtocolo({ form, serventiaInfo, usuario }) {
  const handleImprimir = () => {
    const protocolo = form.protocolo || '(sem número)';
    const nomeUsuario = usuario?.nome || '';
    const nomeServentia = serventiaInfo?.nome_completo || '';
    const data = form.criado_em ? new Date(form.criado_em).toLocaleString('pt-BR') : '';
    // Cliente
    const cliente = form.cliente || {};
    const clienteNome = cliente.nome || form.clienteNome || '-';
    const clienteDoc = cliente.cpf || cliente.cnpj || form.clienteCpf || form.clienteCnpj || '-';
    const clienteEmail = cliente.email || form.clienteEmail || '-';
    const clienteTel = cliente.telefone || form.clienteTelefone || '-';
    // Serventia bloco
const s = serventiaInfo || {};
    // LOG para rastrear dados recebidos da serventia
    if (!s || typeof s !== 'object') {
      console.warn('[PROTOCOLO LOG] serventiaInfo está indefinido ou não é objeto:', s);
    }
    if (!s.nome_completo) {
      console.warn('[PROTOCOLO LOG] nome_completo ausente na serventia:', s);
    }
    let serventiaHtml = `
      <div style="text-align:center; margin-bottom:4px;">
        <img src='/brasao-da-republica-do-brasil-logo-png_seeklogo-263322.png' alt='Brasão da República' style='height:38px; margin-bottom:2px;' />
      </div>
      <div><b>${s.nome_completo || ''}</b></div>
      <div>${s.endereco || ''}</div>
      <div>CNPJ: ${s.cnpj || ''}</div>
      <div>Telefone: ${s.telefone || ''}</div>
      <div>Email: ${s.email || ''}</div>
    `;

    // Valores adiantados
    const valorAdiantadoDetalhes = form.valorAdiantadoDetalhes || [];
    // Atos do pedido
    const atosPedido = form.combos || [];
    // Monta HTML do protocolo
    const html = `
      <html>
      <head>
        <title>Recibo de Protocolo</title>
        <style>
          @page { size: A4; margin: 1cm; }
          body { font-family: 'Times New Roman', serif; font-size: 11pt; color: black; line-height: 1.4; margin: 0; padding: 0; width: 19cm; height: 13.5cm; box-sizing: border-box; }
          .serventia-bloco { text-align: center; margin-bottom: 10px; }
          .info { margin-bottom: 4px; text-align: center; }
          .label { color: #000; font-weight: bold; }
          .valor { color: #000; }
          .atos-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          .atos-table th, .atos-table td { border: 1px solid #000; padding: 2px 3px; font-size: 10px; color: #000; }
          .atos-table th { background: #fff; color: #000; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="serventia-bloco">${serventiaHtml}</div>
        <h2 style="color: #000; text-align: center; font-size: 15px; margin: 2px 0 8px 0; font-weight: bold;">Recibo de Protocolo nº ${protocolo}</h2>
        <div class="info"><span class="label">Data/Hora:</span> <span class="valor">${data}</span></div>
        <div class="info"><span class="label">Escrevente responsável pelo Protocolo:</span> <span class="valor">${nomeUsuario}</span></div>
        <div class="info"><span class="label">Cliente:</span> <span class="valor">${clienteNome}</span></div>
        <div class="info"><span class="label">CPF/CNPJ:</span> <span class="valor">${clienteDoc}</span></div>
        <div class="info"><span class="label">E-mail:</span> <span class="valor">${clienteEmail}</span></div>
        <div class="info"><span class="label">Tel:</span> <span class="valor">${clienteTel}</span></div>
        <div class="info"><span class="label">Descrição:</span> <span class="valor">${form.descricao || ''}</span></div>
        <div class="info"><span class="label">Origem:</span> <span class="valor">${form.origem || ''} ${form.origemInfo ? '(' + form.origemInfo + ')' : ''}</span></div>
        <div class="info"><span class="label">Previsão de Entrega:</span> <span class="valor">${form.prazo || ''}</span></div>
        <div class="info"><span class="label">Obs:</span> <span class="valor">${form.observacao || ''}</span></div>
        <div class="info"><span class="label">Valor(es) Adiantado(s):</span> <span class="valor">${(valorAdiantadoDetalhes || []).map(v => v.valor ? `R$${parseFloat(v.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})} (${v.forma})` : '').filter(Boolean).join(' | ') || '-'}</span></div>
        <table class="atos-table">
          <thead>
            <tr>
              <th>Combo</th>
              <th>Cód.</th>
              <th>Desc.</th>
              <th>Qtd</th>
              <th>Trib.</th>
            </tr>
          </thead>
          <tbody>
            ${(atosPedido || []).map(ato => `
              <tr>
                <td>${ato.comboNome || ''}</td>
                <td>${ato.atoCodigo || ''}</td>
                <td>${ato.atoDescricao ? ato.atoDescricao.slice(0, 18) : ''}</td>
                <td>${ato.quantidade || 1}</td>
                <td>${ato.codigoTributario || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const win = window.open('', '_blank', 'width=600,height=600');
    win.document.write(html);
    win.document.close();
    // Removido window.print() automático. Usuário pode imprimir manualmente na janela.
  };

  return (
    <button type="button" onClick={handleImprimir} style={{ marginLeft: 8, background: '#6c3483', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}>
      Imprimir Protocolo
    </button>
  );
}
