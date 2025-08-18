import React from 'react';

// Componente para gerar e imprimir o recibo de protocolo
export default function ReciboProtocolo({ form, serventiaInfo, usuario }) {
  const handleImprimir = () => {
    const protocolo = form.protocolo || '(sem número)';
    const nomeUsuario = usuario?.nome || '';
    const nomeServentia = serventiaInfo?.nome_completo || '';
    const dataCriacao = form.criado_em ? new Date(form.criado_em).toLocaleString('pt-BR') : '';
    // Monta HTML do protocolo
    const html = `
      <html>
        <head>
          <title>Recibo de Protocolo</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 13px; color: #000; }
            .info { margin-bottom: 6px; }
            .label { font-weight: bold; }
            .valor { margin-left: 4px; }
          </style>
        </head>
        <body>
          <h2 style="color: #000; text-align: center; font-size: 15px; margin: 2px 0 8px 0; font-weight: bold;">Recibo de Protocolo nº ${protocolo}</h2>
          <div class="info"><span class="label">Escrevente responsável pelo Protocolo:</span> <span class="valor">${nomeUsuario}</span></div>
          <div class="info"><span class="label">Serventia:</span> <span class="valor">${nomeServentia}</span></div>
          <div class="info"><span class="label">Data de criação:</span> <span class="valor">${dataCriacao}</span></div>
          <!-- Adicione mais campos conforme necessário -->
        </body>
      </html>
    `;
    const win = window.open('', '_blank', 'width=600,height=600');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  return (
    <button type="button" onClick={handleImprimir} style={{ marginLeft: 8, background: '#6c3483', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}>
      Imprimir Protocolo
    </button>
  );
}
