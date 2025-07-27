import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCode } from 'qrcode.react';
import config from './config';

export default function ReciboPedido() {
  const { protocolo } = useParams();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function fetchPedido() {
      try {
        const res = await fetch(`${config.apiURL}/recibo/${encodeURIComponent(protocolo)}`);
        const data = await res.json();
        if (data.pedido) setPedido(data.pedido);
        else setErro('Pedido não encontrado.');
      } catch (err) {
        setErro('Erro ao buscar pedido.');
      }
      setLoading(false);
    }
    fetchPedido();
  }, [protocolo]);

  if (loading) return <div style={{padding: 32}}>Carregando...</div>;
  if (erro) return <div style={{padding: 32, color: 'red'}}>{erro}</div>;
  if (!pedido) return null;

  // Monta URL do recibo para QR code
  const urlRecibo = `${window.location.origin}/recibo/${encodeURIComponent(pedido.protocolo)}`;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(44,62,80,0.08)', padding: 32, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 700 }}>Recibo de serviço</h2>
          <div style={{ fontSize: 16, margin: '8px 0' }}>
            <b>Tipo serviço:</b> <span style={{ fontWeight: 600 }}>Inscrição de CPF</span>
          </div>
          <div style={{ fontSize: 14 }}>
            <b>Cartório:</b> Eugênio de Melo - Distrito do Município de São José dos Campos<br/>
            Avenida José Francisco Marcondes, 387, Jd. São Vicente - São José dos Campos/SP<br/>
            (12) 3929-5200
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14 }}>
            <b>Pedido nº:</b> {pedido.protocolo}<br/>
            <b>CNS cartório:</b> 123125
          </div>
          <img src="/logo-crc.png" alt="CRC" style={{ height: 32, marginTop: 8 }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 15 }}>
          <b>Data de solicitação:</b> {pedido.criado_em ? new Date(pedido.criado_em).toLocaleDateString() : '-'}<br/>
          <b>Data de entrega:</b> Acompanhar pelo portal
        </div>
        <div style={{ border: '2px dashed #aaa', borderRadius: 8, padding: 8, background: '#fafafa' }}>
          <QRCode value={urlRecibo} size={100} />
        </div>
      </div>
      <div style={{ border: '1px solid #aaa', borderRadius: 8, padding: 12, marginBottom: 16, background: '#f8f8f8' }}>
        Consulte o andamento do seu pedido pelo QR Code ao lado ou pelo site<br/>
        <b>Protocolo:</b> {pedido.protocolo}<br/>
        <b>Chave:</b> fe345
      </div>
      <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: 18 }}>Dados da inscrição</h3>
      <div style={{ fontSize: 15, marginBottom: 8 }}>
        <b>Nome do registrado:</b> {pedido.cliente?.nome || '-'}<br/>
        <b>Telefone:</b> {pedido.cliente?.telefone || '-'} &nbsp; <b>Nº do CPF:</b> Ainda não gerado
      </div>
      <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: 18 }}>Valores pagos pela inscrição</h3>
      <div style={{ fontSize: 15, marginBottom: 8 }}>
        <b>Serviço:</b> R$ 0,00<br/>
        <b>Valor total cobrado:</b> R$ 0,00
      </div>
      <div style={{ marginTop: 32, fontSize: 13, color: '#444' }}>
        Renata Magnusson Sea<br/>
        Convênio homologado pela Lei Federal nº 13.487/17 e executado via Central Nacional de informações do Registro Civil (CRC Nacional)
      </div>
      <div style={{ marginTop: 16, fontSize: 13, color: '#888' }}>
        ARPENBRASIL - ASSOCIAÇÃO NACIONAL DOS REGISTRADORES DE PESSOAS NATURAIS
      </div>
    </div>
  );
}
