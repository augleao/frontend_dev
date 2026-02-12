# Resumo dos Componentes Pais (acessíveis via Home2.jsx)

Arquivo com descrição curta das responsabilidades dos componentes "pais" ligados aos menus principais exibidos em `Home2.jsx`.

- **CAIXA** (rota: `/caixa`): Hub do caixa — gerencia lançamentos financeiros diários (entradas/saídas), fechamento de caixas, registros de pagamentos em espécie e conciliações básicas. (ex.: `Caixa.jsx` / `CaixaDiario.jsx`)

- **PEDIDOS** (rota: `/lista-servicos`): Gerencia o ciclo de pedidos/serviços — cadastro/edição de pedidos, dados do cliente, registro de pagamento, acompanhamento da execução e entrega. (ex.: `ListaServicos.jsx` / `Pedidos.jsx`)

- **ATOS PRATICADOS** (rota: `/atos`): Hub de atos praticados — listagem, pesquisa, importação/conciliação e visualização de detalhes dos atos registrados no sistema. (ex.: `AtosPraticados.jsx`)

- **RELATÓRIOS** (rota: `/relatorios`): Central de relatórios e análises — geração, filtros e exportação de relatórios relacionados a atos e finanças (visão geral de DAPs, somatórios e históricos). (ex.: `Relatorios.jsx`)

- **DAP** (rota: `/relatorios/dap`): Área específica para DAP — gerenciamento de declarações de arrecadação e pagamento, processamento de arquivos PDF (upload/parse) e emissão de retificadoras. (ex.: `RelatoriosDAP.jsx` / `DAP.jsx`)

- **FERRAMENTAS DE IA** (rota: `/ferramentas-ia`): Utilitários de IA — helpers para extração de texto, prompts, agentes e outras automações que auxiliam processamento de documentos e dados. (ex.: `FerramentasIA.jsx` / `IA.jsx`)

- **RG (Carteira de Identidade)** (rota: `/rg`): Módulo de emissão de RG — gerenciamento de atendimentos, agenda e aspectos financeiros relacionados à emissão. (ex.: `RG.jsx`)

**Observações:**
- Estas descrições são intencionadas ser um resumo rápido dos hubs/menus expostos em `Home2.jsx` (componentes pais).
- Para descrições mais detalhadas ou inclusão de subcomponentes, posso expandir este arquivo em seguida.
