// Serviço para atualizar selo de execução de serviço
export async function atualizarSeloExecucaoServico(id, seloData) {
  console.log('[atualizarSeloExecucaoServico] Enviando dados para backend:', { id, seloData });
  const response = await fetch(`/selos-execucao-servico/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(seloData),
  });
  console.log('[atualizarSeloExecucaoServico] Status da resposta:', response.status);
  if (!response.ok) {
    throw new Error('Erro ao atualizar selo');
  }
  const text = await response.text();
  let result = null;
  if (text) {
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.warn('[atualizarSeloExecucaoServico] Erro ao fazer parse do JSON:', e, text);
    }
  }
  console.log('[atualizarSeloExecucaoServico] Resposta do backend:', result);
  return result;
}