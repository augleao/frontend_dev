# Componentes Detalhados — Hubs (a partir de `Home2.jsx`)

Este documento descreve os componentes acessados a partir dos hubs principais exibidos em `Home2.jsx`. Para cada hub listei os componentes filhos presentes em `src/` e uma descrição rápida da sua responsabilidade.

---

**CAIXA** (`/caixa`)
- [src/CaixaHub.jsx](src/CaixaHub.jsx): Página/hub principal do módulo Caixa que agrega visualizações, filtros e navegação entre funções do caixa.
- [src/CaixaDiario.jsx](src/CaixaDiario.jsx): Gerencia os lançamentos diários (entradas/saídas) e interface principal para registros de caixa.
- [src/CaixaInputs.jsx](src/CaixaInputs.jsx): Componentes de formulário para registrar entradas e saídas manuais.
- [src/CaixaTableEscrevente.jsx](src/CaixaTableEscrevente.jsx): Tabela de lançamentos formatada para o escrevente/usuário.
- [src/EntradasSaidasManuais.jsx](src/EntradasSaidasManuais.jsx): UI específica para registrar movimentos manuais e ajustar lançamentos.
- [src/Fechamento.jsx](src/Fechamento.jsx): Lógica e UI para fechamento de caixa (agrupar lançamentos do dia).
- [src/FechamentoDiarioButton.jsx](src/FechamentoDiarioButton.jsx): Botão/ação rápida para disparar o fechamento diário.
- [src/FormasPagamento.jsx](src/FormasPagamento.jsx): Helper para seleção e gestão das formas de pagamento.
- [src/ResumoCaixa.jsx](src/ResumoCaixa.jsx): Visão resumida dos valores do caixa e totais por categoria.
- [src/RelatoriosCaixaDiario.jsx](src/RelatoriosCaixaDiario.jsx): Relatórios financeiros específicos do caixa diário.
- [src/RGCaixa.jsx](src/RGCaixa.jsx): Integração do módulo RG com relatórios/caixa (quando aplicável).
**CAIXA** (`/caixa`)
- `src/CaixaHub.jsx` — Hub do módulo Caixa (página agregadora).
	- Props: nenhum (componente de rota).
	- Uso: acessível via rota `/caixa`.

- `src/CaixaDiario.jsx` — Gerencia lançamentos diários, cálculos de totais e persistência.
	- Props: nenhum (usa `localStorage` e chamadas `fetch` para `apiURL`).
	- Principais responsabilidades: seleção de data, carregar atos, adicionar/remover lançamentos, fechamento diário.
	- Exemplo de uso (rota):

```jsx
// Em App.jsx (rota)
<Route path="/caixa-diario" element={<CaixaDiario/>} />
```

- `src/CaixaInputs.jsx` — Painel resumido de valores do caixa (valor inicial, entradas, saídas, final).
	- Props principais:
		- `valorInicialCaixa` (number)
		- `valorFinalCaixa` (number)
		- `ISS` (number) — percentual ISS opcional
		- `depositosCaixa` (number)
		- `saidasCaixa` (number)
		- `setValorInicialCaixa` (fn)
		- `setDepositosCaixa` (fn)
		- `setSaidasCaixa` (fn)
		- `atos` (array)
	- Exemplo:

```jsx
<CaixaInputs
	valorInicialCaixa={100.0}
	valorFinalCaixa={420.5}
	ISS={3}
	depositosCaixa={300}
	saidasCaixa={-20}
	setValorInicialCaixa={(v)=>{/*...*/}}
	atos={atos}
 />
```

- `src/CaixaTableEscrevente.jsx` — Tabela específica para o escrevente/verificação de lançamentos.
	- Props comuns: `atos` (array), `onRemove` (fn), `loading` (bool).

- `src/EntradasSaidasManuais.jsx` — Formulário para inserção rápida de entradas/saídas locais.
	- Props:
		- `atos` (array)
		- `setAtos` (fn)
		- `nomeUsuario` (string)
	- Exemplo:

```jsx
<EntradasSaidasManuais atos={atos} setAtos={setAtos} nomeUsuario={usuario.nome} />
```

- `src/Fechamento.jsx` — Wrapper que exibe o botão de fechamento diário.
	- Props: `onFechar` (fn) — callback acionado ao fechar o caixa.
	- Exemplo: `<Fechamento onFechar={() => handleFechamento()} />`

- `src/FechamentoDiarioButton.jsx` — Botão que dispara a rotina de fechamento.
	- Props: `onClick` (fn), `disabled` (bool).

- `src/FormasPagamento.jsx` — Helper para exibir e editar formas de pagamento.
	- Props: `pagamentos` (object), `onChange` (fn).

- `src/ResumoCaixa.jsx` — Visão rápida com totais (sem props obrigatórias se usado internamente).

- `src/RelatoriosCaixaDiario.jsx` — Gera relatórios/exportações do caixa.
	- Props: usualmente `dataInicial`, `dataFinal` (strings) ou ausência (usa seleção interna).

- `src/RGCaixa.jsx` — Integração financeira específica do módulo RG.


---

**PEDIDOS / SERVIÇOS** (`/lista-servicos`)

**PEDIDOS / SERVIÇOS** (`/lista-servicos`)
- `src/ListaServicos.jsx` — Hub/rota principal (se presente) para listar e gerenciar pedidos.
	- Props: geralmente componente de rota (nenhuma prop requerida).

- `src/ReciboPedido.jsx` — Gera e exibe recibos para pedidos/serviços.
	- Props: `pedido` (object) ou `pedidoId` (string/number) para recuperar dados.
	- Exemplo:

```jsx
<ReciboPedido pedido={pedidoObj} />
// ou
<ReciboPedido pedidoId={123} />
```

- `src/ProtocoloAcesso.jsx` — Utilitário para gerar/exibir protocolos de atendimento.
	- Props: `dadosProtocolo` (object).

- `src/UploadForm.jsx` — Componente de upload reutilizável.
	- Props: `onUpload` (fn), `accept` (string), `multiple` (bool).
	- Exemplo: `<UploadForm onUpload={(files)=>handleFiles(files)} accept="application/pdf" />`

- `src/UsuarioInfo.jsx` — Exibe/edita dados do cliente/usuário ligados ao pedido.
	- Props: `usuario` (object), `onSave` (fn).

- `src/UsuariosAdmin.jsx` — Gestão de usuários pelo admin.
	- Props: nenhum obrigatório (usa chamadas ao backend).

(Observação: `lista-servicos` pode mapear para nomes diferentes; verificar `App.jsx`/rotas para confirmação.)

---

**ATOS PRATICADOS** (`/atos`)
- [src/AtosHub.jsx](src/AtosHub.jsx): Hub central de atos praticados, com filtros e navegação entre buscas e importações.
- [src/AtosPraticados.jsx](src/AtosPraticados.jsx): Listagem e gestão dos atos praticados registrados.
- [src/TabelaAtos.jsx](src/TabelaAtos.jsx): Tabela reutilizável para exibir atos.
- [src/AtoBuscaEPagamento.jsx](src/AtoBuscaEPagamento.jsx): Busca específica de atos com opção de registrar pagamento.
- [src/AtoSearch.jsx](src/AtoSearch.jsx): Componente de busca genérico para atos.
- [src/AtoSearchAtosPraticados.jsx](src/AtoSearchAtosPraticados.jsx): Variante de busca específica para atos praticados.
- [src/ImportarAtos.jsx](src/ImportarAtos.jsx): UI e lógica para importar atos (CSV, XLS ou integração).
- [src/Conciliacao.jsx](src/Conciliacao.jsx): Ferramentas de conciliação entre registros importados e atos existentes.
- [src/TabelaAtos.jsx](src/TabelaAtos.jsx): Componente de tabela para visualização de atos (listado também acima).

**ATOS PRATICADOS** (`/atos`)
- `src/AtosHub.jsx` — Hub de navegação para funcionalidades relacionadas a atos.
	- Props: nenhum.

- `src/AtosPraticados.jsx` — Página principal de atos praticados; contém busca, seleção de data, pagamentos e remoção.
	- Props: nenhum (usa `localStorage` e `fetch` para `apiURL`).
	- Principais estados/entradas internas (úteis ao integrar): `dataSelecionada` (string), `pagamentos` (object), `quantidade` (number).
	- Exemplo de rota: `<Route path="/atos-praticados" element={<AtosPraticados/>} />`

- `src/TabelaAtos.jsx` — Tabela reaproveitável para listagem de atos.
	- Props: `atos` (array), `onRemove` (fn), `onEdit` (fn), `loading` (bool).

- `src/AtoBuscaEPagamento.jsx` — Busca específica que permite registrar/ou conferir pagamento.
	- Props: `onSelectAto` (fn), `onRegistrarPagamento` (fn).

- `src/AtoSearch.jsx` / `src/AtoSearchAtosPraticados.jsx` — Componentes de sugestão/busca.
	- Props: `value` (string), `onChange` (fn), `onSelect` (fn).

- `src/ImportarAtos.jsx` — Importação de atos (UI + upload).
	- Props: `onImport` (fn), `accept` (ex.: 'text/csv').

- `src/Conciliacao.jsx` — Ferramenta para conciliar atos importados vs base existente.
	- Props: `onConciliar` (fn), `periodo` (object).

---

**RELATÓRIOS** (`/relatorios`)
- [src/Relatorios.jsx](src/Relatorios.jsx): Hub de relatórios que organiza diferentes tipos de relatórios disponíveis.
- [src/RelatorioCNJ.jsx](src/RelatorioCNJ.jsx): Relatórios formatados conforme exigências do CNJ.
- [src/RelatoriosCaixaDiario.jsx](src/RelatoriosCaixaDiario.jsx): Relatórios específicos do caixa diário.
- [src/RGRelatorioFinanceiro.jsx](src/RGRelatorioFinanceiro.jsx): Relatórios financeiros relacionados ao módulo RG.

**RELATÓRIOS** (`/relatorios`)
- `src/Relatorios.jsx` — Hub de relatórios.
	- Props: nenhum obrigatório.

- `src/RelatorioCNJ.jsx` — Gera relatórios no formato CNJ.
	- Props: `dataInicial`/`dataFinal` (strings), `serventia` (string).

- `src/RelatoriosCaixaDiario.jsx` — Exportações e filtros do caixa.
	- Props: `data` (string) ou seleção interna.

- `src/RGRelatorioFinanceiro.jsx` — Relatórios ligados ao módulo RG.
	- Props: filtros por `periodo`/`serventia`.

---

**DAP** (`/relatorios/dap`)
- [src/RelatoriosDAP.jsx] - (se existir; caso contrário, o DAP é tratado dentro de `src/Relatorios.jsx` ou arquivos relacionados a DAP): Área para processamento e geração de relatórios DAP.
- [src/UploadForm.jsx](src/UploadForm.jsx): Usado para upload de PDFs de DAP.
- [src/AtoBuscaEPagamento.jsx](src/AtoBuscaEPagamento.jsx): Pode ser usado para checagens de pagamentos relacionados à DAP.

**DAP** (`/relatorios/dap`)
- `src/RelatoriosDAP.jsx` — Área dedicada a DAP (upload, parse e relatórios).* 
	- Props: `serventia` (string), `periodo` (object) — opcional.
	- Observação: o processamento de PDF e parsing pode ser realizado pelo backend; o frontend fornece upload e visualização.

- `src/UploadForm.jsx` — Usado para upload de PDFs (aceita `onUpload` callback).
	- Props: `onUpload` (fn), `accept` (string), `multiple` (bool).

- `src/AtoBuscaEPagamento.jsx` — Útil para cruzar pagamentos vs DAP.
	- Props: `onSelect` (fn).

(Observação: o projeto contém suporte a DAP e parsing de PDF — entradas mais específicas podem estar em `src/dap` ou nas rotas backend correspondentes.)

---

**FERRAMENTAS DE IA** (`/ferramentas-ia`)
- [src/FerramentasIA.jsx](src/FerramentasIA.jsx): Hub das ferramentas de IA com acesso a utilitários, agentes e integração de modelos.
- [src/ConfigurarIA.jsx](src/ConfigurarIA.jsx): Tela/configuração para chaves e preferências de IA.
- [src/ConfigurarServentia.jsx](src/ConfigurarServentia.jsx): Configuração por serventia (pode afetar comportamentos de IA por serventia).
- [src/analytics/](src/analytics/): Pasta com ferramentas analíticas que podem complementar as utilidades de IA.

**FERRAMENTAS DE IA** (`/ferramentas-ia`)
- `src/FerramentasIA.jsx` — Hub que agrupa utilitários de IA (extrair texto, run-prompt, agentes).
	- Props: nenhum (usa chamadas a `/api/ia/*`).

- `src/ConfigurarIA.jsx` — Formulário para configurar chaves/credenciais de provedores.
	- Props: `onSave` (fn), `config` (object).

- `src/ConfigurarServentia.jsx` — Ajustes por serventia que podem alterar comportamento das ferramentas.
	- Props: `serventia` (string), `onSave` (fn).

- `src/analytics/` — Scripts e componentes auxiliares para visualizações que complementam IA.

---

**RG (Carteira de Identidade)** (`/rg`)
- [src/RG.jsx](src/RG.jsx): Hub principal do módulo RG (agenda, emissão e financeiro relacionado).
- [src/RGAgenda.jsx](src/RGAgenda.jsx): Agenda de atendimentos para emissão de RG.
- [src/RGAgenda.css](src/RGAgenda.css): Estilos associados à agenda RG.
- [src/RGCaixa.jsx](src/RGCaixa.jsx): Integração financeira específica do módulo RG com o caixa.
- [src/RGRelatorioFinanceiro.jsx](src/RGRelatorioFinanceiro.jsx): Relatórios e resumo financeiro do módulo RG.

**RG (Carteira de Identidade)** (`/rg`)
- `src/RG.jsx` — Hub do módulo RG (agenda, emissão e finanças).
	- Props: nenhum obrigatório.

- `src/RGAgenda.jsx` — Agenda de atendimentos.
	- Props: `agendamentos` (array), `onAgendar` (fn), `onCancelar` (fn).
	- Exemplo:

```jsx
<RGAgenda agendamentos={lista} onAgendar={handleAgendar} onCancelar={handleCancelar} />
```

- `src/RGCaixa.jsx` — Integra o módulo RG com o fluxo financeiro/caixa.
	- Props: `rgMovimentos` (array), `onRegistrar` (fn).

- `src/RGRelatorioFinanceiro.jsx` — Relatórios do módulo RG.
	- Props: filtros por período/serventia.

---

**Arquivos utilitários e compartilhados**
- [src/components/](src/components/): Componentes genéricos reutilizáveis.
- [src/DataTable.jsx](src/DataTable.jsx): Tabela genérica usada em várias listagens.
- [src/DataSelector.jsx](src/DataSelector.jsx): Seletor de datas reutilizável.
- [src/UploadForm.jsx](src/UploadForm.jsx): Upload genérico (mencionado acima).
- [src/utils/](src/utils/): Helpers e utilitários.

---

Observações finais:
- Alguns hubs referenciados em `Home2.jsx` mapeiam para arquivos cujo nome pode variar (por exemplo, `lista-servicos` pode não ter um `ListaServicos.jsx` exato). Recomendo checar as rotas em `src/App.jsx` e `src/routes/` para confirmar a correspondência exata entre rota e componente.
- Deseja que eu atualize este arquivo com links de linha (ex.: apontando para os locais específicos nos arquivos) ou expanda cada entrada com uma lista dos subcomponentes internos e props principais?