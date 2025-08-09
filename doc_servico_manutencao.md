# Documentação Funcional: ServicoManutencao e Componentes Relacionados

## Visão Geral
O módulo `ServicoManutencao` é o núcleo do fluxo de manutenção de pedidos/serviços do sistema. Ele orquestra a jornada de um pedido desde a criação, passando por todas as etapas (cliente, entrada, conferência, pagamento, execução, entrega), até a finalização, integrando-se ao backend para persistência e atualização dos dados.

---

## 1. Papel de Cada Componente
- **ServicoManutencao**: Componente principal. Gerencia o estado global do pedido, controla o fluxo entre etapas, integra com o backend, exibe alertas e histórico, e determina as condições de habilitação de cada etapa.
- **ServicoCliente**: Coleta e exibe informações do cliente associado ao pedido. Permite selecionar cliente existente ou cadastrar novo.
- **ServicoEntrada**: Permite selecionar o tipo de serviço, descrever o pedido, escolher combos/atos e definir detalhes iniciais.
- **ServicoConferencia**: Responsável pela conferência dos atos do pedido. Permite validar informações e, ao salvar, define o status do pedido para “Aguardando Pagamento” (se houver ato pago) ou “Aguardando Execução” (caso contrário).
- **ServicoPagamento**: Exibe e gerencia o pagamento do pedido. Só aparece se houver ato tributário “01” (ato pago). Permite registrar pagamentos parciais ou totais.
- **ServicoExecucao**: Gerencia a execução do serviço. Só é habilitado após conferência e, se houver ato pago, após pagamento.
- **ServicoEntrega**: Permite registrar a entrega do serviço ao cliente. Só é habilitado quando há uma execução salva.
- **ServicoAlertas**: Exibe alertas de serviços atrasados ou situações especiais.
- **ServicoLista**: (Não detalhado no fluxo principal, mas serve para exibir uma lista de serviços/pedidos).

---

## 2. Condições de Habilitação/Visibilidade de Cada Etapa
- **Cliente/Entrada**: Sempre habilitados para novo pedido.
- **Conferência**: Só habilitada se o protocolo do pedido existir (pedido salvo).
- **Pagamento**: Só exibido se houver ato tributário “01” no pedido. Só habilitado se o protocolo existir, houver ato “01” e houver conferência salva com status “conferido”.
- **Execução**: Só bloqueada se houver ato “01” e o pagamento não estiver realizado. Caso contrário, sempre habilitada após conferência.
- **Entrega**: Habilitada sempre que houver uma execução salva (independente do status da execução).
- **Exclusão**: Botão só aparece se o pedido já foi salvo (possui protocolo).
A interface utiliza UI hachurada (opacidade, grayscale, pointer-events: none) para indicar etapas bloqueadas.

---

## 3. Fluxo de Dados Entre Componentes
- O estado global do pedido é mantido em `form` no `ServicoManutencao`.
- Cada subcomponente recebe via props os dados relevantes (`form`, listas, callbacks de alteração).
- Alterações em campos de cada etapa são propagadas para o estado global via callbacks (`onChange`, `onClienteChange`, etc).
- Ao salvar uma etapa (ex: conferência, pagamento, execução), o backend é chamado e o estado global é atualizado com os dados retornados.
- O histórico de status é buscado do backend e atualizado no estado local.

---

## 4. Regras de Negócio Implementadas
- **Pagamento obrigatório**: Só se houver ato com código tributário “01”. Caso contrário, etapa de pagamento é omitida.
- **Status após conferência**: Se houver ato pago, status vai para “Aguardando Pagamento”; caso contrário, “Aguardando Execução”.
- **Execução**: Só bloqueada se houver ato pago e pagamento não realizado.
- **Entrega**: Habilitada sempre que houver execução salva.
- **Exclusão**: Remove o pedido do backend e limpa o estado local.
- **Campos obrigatórios**: Cliente, tipo de serviço, atos, e outros campos são validados em cada etapa.

---

## 5. Carregamento, Atualização e Exclusão de Pedidos
- **Carregamento**: Ao acessar um pedido existente (via protocolo na query string), os dados são buscados do backend e populam o estado global.
- **Atualização**: Cada etapa pode atualizar parcialmente o pedido, enviando dados ao backend e atualizando o estado local.
- **Exclusão**: Remove o pedido do backend e reseta o formulário.

---

## 6. Alertas, Histórico de Status e Informações Auxiliares
- **Alertas**: Serviços atrasados (prazo vencido e execução não concluída) são destacados no topo.
- **Histórico de Status**: Exibido em tabela, mostrando todas as alterações de status do pedido, com data/hora, responsável e observações.
- **Resumo estatístico**: Mostra total de alterações e última atualização.

---

## 7. Campos e Informações Obrigatórias em Cada Etapa
- **Cliente**: Nome, CPF, endereço, telefone, email.
- **Entrada**: Tipo de serviço, descrição, atos/combos.
- **Conferência**: Validação dos atos.
- **Pagamento**: Valor total, valor pago, data, forma (se houver ato pago).
- **Execução**: Status, observações, responsável.
- **Entrega**: Data, hora, retirado por, documento, assinatura digital.

---

## 8. Diferentes Tipos de Serviço, Clientes e Atos
- O sistema permite múltiplos tipos de serviço e atos, definidos em listas.
- Clientes podem ser selecionados de uma lista ou cadastrados na hora.
- Atos/combos são selecionados conforme o tipo de serviço.

---

## 9. Interface e Progresso
- Etapas bloqueadas são visualmente hachuradas e desabilitadas.
- Só é possível avançar para a próxima etapa se as condições de negócio forem atendidas.
- O progresso do pedido é refletido pelo status e pela habilitação das etapas.

---

## 10. Integrações com Backend
- **GET/POST/PUT** para `/pedidos`, `/execucao-servico`, `/pedidoshistoricostatus`, `/combos`, etc.
- Busca e atualização de dados do pedido, histórico de status, combos/atos, execução, pagamento e entrega.
- Exclusão de pedidos via DELETE.
- Todas as integrações servem para garantir persistência, consistência e atualização em tempo real do estado do pedido.

---

## Resumo do Fluxo
1. Usuário inicia um novo pedido, preenche cliente e entrada.
2. Salva o pedido, gerando protocolo.
3. Realiza conferência dos atos.
4. Se houver ato pago, realiza pagamento; caso contrário, vai direto para execução.
5. Após execução salva, entrega é habilitada.
6. Todo o progresso é registrado no histórico de status.
7. Alertas e bloqueios são exibidos conforme regras de negócio.

---

Esta documentação cobre todos os fluxos, regras e integrações do módulo de manutenção de serviços/pedidos, servindo como referência funcional completa para desenvolvedores e analistas.
