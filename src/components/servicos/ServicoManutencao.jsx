import React, { useState, useEffect } from 'react';
import ServicoEntrada from './ServicoEntrada';
import ServicoCliente from './ServicoCliente';
import ServicoPagamento from './ServicoPagamento';
import ServicoExecucao from './ServicoExecucao';
import ServicoEntrega from './ServicoEntrega';
import ServicoLista from './ServicoLista';
import ServicoAlertas from './ServicoAlertas';
import ServicoDetalhes from './ServicoDetalhes';

// ...mock data, status arrays, gerarProtocolo...

export default function ServicoManutencao() {
  // ...mesma lógica de estado e handlers do exemplo anterior...

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
      <h2 style={{ marginBottom: 24, color: '#2c3e50' }}>Manutenção de Serviços</h2>
      <ServicoAlertas alertas={alertas} />
      <form onSubmit={registrarServico} style={{ background: '#f4f6f8', borderRadius: 12, padding: 24, marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <ServicoEntrada form={form} tiposServico={tiposServico} onChange={handleFormChange} />
          </div>
          <div style={{ flex: 1 }}>
            <ServicoCliente form={form} clientes={clientes} onChange={handleFormChange} onClienteChange={handleClienteChange} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <ServicoPagamento form={form} onChange={handlePagamentoChange} />
          </div>
          <div style={{ flex: 1 }}>
            <ServicoExecucao form={form} onChange={handleExecucaoChange} />
          </div>
        </div>
        <ServicoEntrega form={form} onChange={handleEntregaChange} />
        <button type="submit" style={{
          marginTop: 24,
          padding: '12px 32px',
          background: '#27ae60',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer'
        }}>
          Registrar Serviço
        </button>
      </form>
      <ServicoLista
        servicos={servicosFiltrados}
        filtro={filtro}
        setFiltro={setFiltro}
        tiposServico={tiposServico}
        statusExecucao={statusExecucao}
        statusPagamento={statusPagamento}
        onVerDetalhes={setVisualizando}
      />
      <ServicoDetalhes
        servico={visualizando}
        statusExecucao={statusExecucao}
        statusPagamento={statusPagamento}
        onClose={() => setVisualizando(null)}
      />
    </div>
  );
}