// Serviço para atualizar selo de execução de serviço
export async function atualizarSeloExecucaoServico(id, seloData) {
  const response = await fetch(`/api/selos-execucao-servico/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(seloData),
  });
  if (!response.ok) {
    throw new Error('Erro ao atualizar selo');
  }
  return response.json();
}