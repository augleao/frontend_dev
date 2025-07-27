
# Rotas do Backend - Projeto Bibliofilia

## Pedidos
- `GET    /api/pedidos`                → Lista todos os pedidos
- `POST   /api/pedidos`                → Cria um novo pedido
- `GET    /api/pedidos/:protocolo`     → Busca detalhes de um pedido
- `DELETE /api/pedidos/:protocolo`     → Exclui um pedido
- `POST   /api/pedidos/:protocolo/status`         → Adiciona um novo status ao pedido
- `GET    /api/pedidos/:protocolo/status/ultimo`  → Busca o status mais recente do pedido

## Combos
- `GET    /api/combos`                  → Lista todos os combos
- `GET    /api/admin/combos/listar`     → Lista combos (admin)
- `GET    /api/admin/combos`            → Lista combos (admin)
- `GET    /api/admin/combos/:id`        → Detalhe combo (admin)

## Códigos Tributários
- `GET    /api/codigos-tributarios?s=...` → Busca sugestões de códigos tributários
- `GET    /api/codigos-gratuitos?search=...` → Busca códigos gratuitos

## Clientes
- `GET    /api/clientes`                 → Lista todos os clientes
- `POST   /api/clientes`                 → Cria um novo cliente
- `GET    /api/clientes?search=...`      → Busca clientes por termo
- `GET    /api/clientes/:id`             → Busca detalhes de um cliente

## Atos
- `GET    /api/atos`                     → Lista todos os atos
- `GET    /api/atos?search=...`          → Busca atos por termo
- `GET    /api/atos?busca=...`           → Busca atos por busca
- `GET    /api/atos-tabela?data=...`     → Busca tabela de atos por data
- `GET    /api/atos-praticados?data=...` → Busca atos praticados por data
- `GET    /api/atos-praticados/:id`      → Busca ato praticado por id
- `DELETE /api/atos-praticados/:id`      → Remove ato praticado

## Relatórios
- `GET    /api/meus-relatorios`           → Lista relatórios do usuário
- `POST   /api/salvar-relatorio`          → Salva relatório
- `DELETE /api/excluir-relatorio/:id`     → Exclui relatório

## Caixa Diário
- `GET    /api/meus-fechamentos`          → Lista fechamentos do caixa diário

## Upload
- `POST   /api/upload`                    → Upload de arquivos

## Autenticação e Usuários
- `POST   /api/login`                     → Login
- `POST   /api/signup`                    → Cadastro
- `GET    /api/users`                     → Lista usuários

## Outros
- `GET    /api/importar-atos-pdf`         → Importa atos via PDF
- `GET    /api/busca-atos/pesquisa?...`   → Pesquisa de atos

---

> **Observação:**
> Esta lista foi atualizada automaticamente a partir dos componentes do frontend. Rotas duplicadas ou variantes podem ser ajustadas conforme a padronização do backend.
