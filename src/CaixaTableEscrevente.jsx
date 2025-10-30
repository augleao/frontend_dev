// AtosTable.jsx
import React from 'react';
import { formasPagamento, formatarDataBR, formatarValor, formatarMoeda } from './utils';
import { apiURL } from './config';

export default function CaixaTableEscrevente({ atos, onRemover }) {
  console.log("Atos recebidos na tabela caixa-table:", atos);

  // Função para determinar a cor de fundo baseada no código do ato
  const getCorFundo = (codigo) => {
    switch (codigo) {
      case '0002': // Saída manual
        return '#ffcccb'; // Vermelho mais forte
      case '0001': // Valor final do caixa (fechamento)
        return '#bbdefb'; // Azul mais forte
      default: // Todos os outros códigos (0003, 0005 e atos normais)
        return '#c8e6c9'; // Verde mais forte
    }
  };

  // Extrai informações de devolução a partir da máscara na descrição
  const parseDevolucaoInfo = (descricao) => {
    if (!descricao || typeof descricao !== 'string') return { cliente: '', ticket: '' };
    const clienteMatch = descricao.match(/Devolução p\/Cliente:\s*([^;]+)/i);
    const ticketMatch = descricao.match(/ticket:\s*([^;]+)/i);
    return {
      cliente: clienteMatch ? clienteMatch[1].trim() : '',
      ticket: ticketMatch ? ticketMatch[1].trim() : '',
    };
  };

  const extrairCidadeDaServentia = (serventia) => {
    if (!serventia) return '';
    const idx = serventia.toLowerCase().lastIndexOf(' de ');
    return idx !== -1 ? serventia.substring(idx + 4).trim() : serventia.trim();
  };

  const gerarReciboDevolucao = async (ato) => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const token = localStorage.getItem('token');
    // Preferir o mesmo padrão do protocolo/serviço: buscar por id quando disponível
    const serventiaId = usuario?.serventiaId || usuario?.serventia_id || usuario?.serventia || '';
    const serventiaNome = usuario?.serventia || '';
    const responsavel = usuario?.nome || '';
    const { cliente, ticket } = parseDevolucaoInfo(ato?.descricao || '');
    const hoje = new Date();
    const dataHoje = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const valorSaida = formatarMoeda(parseFloat(ato?.valor_unitario || 0));

    // Buscar informações completas da serventia
    let serv = {};
    try {
      if (serventiaId) {
        const resId = await fetch(`${apiURL}/serventias/${encodeURIComponent(serventiaId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (resId.ok) {
          const text = await resId.text();
          const parsed = text ? JSON.parse(text) : {};
          serv = parsed?.serventia || parsed || {};
        }
      }
      if ((!serv || Object.keys(serv).length === 0) && serventiaNome) {
        const resNome = await fetch(`${apiURL}/configuracoes-serventia?serventia=${encodeURIComponent(serventiaNome)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (resNome.ok) {
          const text = await resNome.text();
          serv = text ? JSON.parse(text) : {};
        }
      }
    } catch (e) {
      // segue com fallback local
    }

    const nomeServentia = serv.nome_completo || serv.nome || serv.serventia || serventiaNome || 'Serventia não informada';
    const endereco = serv.endereco || '';
    const cidade = serv.cidade || extrairCidadeDaServentia(nomeServentia) || '';
    const uf = serv.uf || '';
    const telefone = serv.telefone || '';
    const whatsapp = serv.whatsapp || '';
    const email = serv.email || '';
    const cnpj = serv.cnpj || '';
    const cns = serv.cns || '';
    const telLinha = [telefone, whatsapp].filter(Boolean).join(' / ');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recibo de Devolução</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body { font-family: Arial, sans-serif; color: #222; }
    .recibo { width: 100%; max-height: 99mm; border: 1px solid #ddd; padding: 10mm; box-sizing: border-box; }
    .header { display: flex; align-items: center; gap: 12px; }
    .header img { height: 20mm; }
    .header .info { display: flex; flex-direction: column; }
    .title { text-align: center; font-weight: 800; margin: 6mm 0 4mm; font-size: 16px; }
    .content { font-size: 12px; line-height: 1.5; }
    .linha { margin: 2mm 0; }
    .assinatura { margin-top: 10mm; text-align: center; }
    .assinatura .linha-assinatura { width: 70%; border-top: 1px solid #000; margin: 12px auto 4px; }
    .small { font-size: 11px; color: #555; }
  </style>
  </head>
  <body>
    <div class="recibo">
      <div class="header">
        <img src="/brasao-da-republica-do-brasil-logo-png_seeklogo-263322.png" alt="Brasão da República" />
        <div class="info">
          <div><strong>${nomeServentia}</strong></div>
          ${endereco ? `<div class="small">${endereco}</div>` : ''}
          ${(cidade || uf) ? `<div class="small">${[cidade, uf].filter(Boolean).join(' - ')}</div>` : ''}
          ${telLinha ? `<div class="small">Tel/WhatsApp: ${telLinha}</div>` : ''}
          ${email ? `<div class="small">E-mail: ${email}</div>` : ''}
          ${(cnpj || cns) ? `<div class="small">${[cnpj ? `CNPJ: ${cnpj}` : '', cns ? `CNS: ${cns}` : ''].filter(Boolean).join(' | ')}</div>` : ''}
          ${responsavel ? `<div class="small">Responsável: ${responsavel}</div>` : ''}
        </div>
      </div>
      <div class="title">RECIBO DE DEVOLUÇÃO</div>
      <div class="content">
        <div class="linha">
          Recebi da serventia acima especificada a devolução de valores pagos na importância de <strong>${valorSaida}</strong>
          referente ao serviço de (  ) Nascimento, (  ) Casamento, (  ) Óbito, (  ) Outros: ____________________, referente ao Ticket: <strong>${ticket || '__________'}</strong>.
        </div>
        <div class="linha">${cidade ? cidade + ',' : ''} ${dataHoje}.</div>
      </div>
      <div class="assinatura">
        <div class="linha-assinatura"></div>
        <div>${cliente || 'Nome do Cliente'}</div>
      </div>
    </div>
    <script>
      window.onload = function() { window.focus(); };
    </script>
  </body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) return alert('Não foi possível abrir a janela do recibo. Verifique o bloqueador de pop-ups.');
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fafafa', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Data</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Hora</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Código</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Descrição</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Quantidade</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Valor Unitário</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Usuário</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Pagamentos</th>
            <th style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px', fontWeight: '600' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {atos.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', padding: '12px', color: '#888', fontSize: '13px' }}>
                Nenhum ato cadastrado para esta data.
              </td>
            </tr>
          )}
          {atos.map((ato, idx) => (
            <tr key={idx} style={{ backgroundColor: getCorFundo(ato.codigo) }}>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>{formatarDataBR(ato.data)}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>{ato.hora}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>{ato.codigo}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>{ato.descricao}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>{ato.quantidade}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>R$ {formatarValor(ato.valor_unitario)}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '12px' }}>{ato.usuario || ''}</td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px', fontSize: '11px' }}>
                {formasPagamento
                  .filter((fp) => {
                    const val = ato.pagamentos[fp.key]?.valor;
                    return val !== undefined && val !== null && !isNaN(parseFloat(val)) && parseFloat(val) > 0;
                  })
                  .map((fp) => {
                    const val = ato.pagamentos[fp.key]?.valor;
                    const valorNum = parseFloat(val);
                    const valorFormatado = !isNaN(valorNum) ? valorNum.toFixed(2) : '0.00';
                    return `${fp.label}: Qtd ${ato.pagamentos[fp.key]?.quantidade ?? 0}, Valor R$ ${valorFormatado}`;
                  })
                  .join(' | ')}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '4px 6px' }}>
                {/* Botão Excluir */}
                <button
                  style={{
                    background: '#d32f2f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    marginRight: 6
                  }}
                  onClick={() => onRemover(idx)}
                >
                  Excluir
                </button>
                {/* Botão Recibo para saídas com cliente */}
                {(() => {
                  const { cliente } = parseDevolucaoInfo(ato?.descricao || '');
                  const podeRecibo = ato.codigo === '0002' && cliente;
                  if (!podeRecibo) return null;
                  return (
                    <button
                      style={{
                        background: '#1976d2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}
                      onClick={() => gerarReciboDevolucao(ato)}
                    >
                      Recibo
                    </button>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

