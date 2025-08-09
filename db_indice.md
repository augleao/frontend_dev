# Índice do Banco de Dados - Tabelas, Colunas e Relações

Este arquivo serve como referência para o modelo de dados do sistema de serviços/pedidos. Atualize sempre que houver alterações no banco.

---

## Tabelas Principais

### 1. pedidos
- **Colunas:**
  - id (PK)
  - protocolo (string, único)
  - tipo
  - descricao
  - prazo
  - status
  - cliente_id (FK -> clientes.id)
  - pagamento_id (FK -> pagamentos.id)
  - execucao_id (FK -> execucoes.id)
  - entrega_id (FK -> entregas.id)
  - serventia_id (FK -> serventias.id)
  - data_criacao
  - data_atualizacao
- **Relações:**
  - Um pedido pertence a um cliente
  - Um pedido pode ter vários combos/atos
  - Um pedido tem um pagamento, execução e entrega

### 2. clientes
- **Colunas:**
  - id (PK)
  - nome
  - cpf
  - endereco
  - telefone
  - email

### 3. combos
- **Colunas:**
  - id (PK)
  - pedido_id (FK -> pedidos.id)
  - combo_nome
  - ato_id (FK -> atos.id)
  - quantidade
  - codigo_tributario
  - valor_final

### 4. atos
- **Colunas:**
  - id (PK)
  - descricao
  - codigo_tributario

### 5. pagamentos
- **Colunas:**
  - id (PK)
  - pedido_id (FK -> pedidos.id)
  - status (pendente, parcial, pago)
  - valor_total
  - valor_pago
  - data
  - forma

### 6. execucoes
- **Colunas:**
  - id (PK)
  - pedido_id (FK -> pedidos.id)
  - status (em_andamento, aguardando, concluido, cancelado)
  - observacoes
  - responsavel

### 7. entregas
- **Colunas:**
  - id (PK)
  - pedido_id (FK -> pedidos.id)
  - data
  - hora
  - retirado_por
  - documento_retirada
  - assinatura_digital

### 8. historico_status
- **Colunas:**
  - id (PK)
  - pedido_id (FK -> pedidos.id)
  - status
  - data_alteracao
  - responsavel
  - observacoes

### 9. serventias
- **Colunas:**
  - id (PK)
  - nome
  - endereco

---

## Relações Resumidas
- **pedidos** → 1:N **combos**
- **pedidos** → 1:N **historico_status**
- **pedidos** → 1:1 **pagamentos**, **execucoes**, **entregas**
- **pedidos** → N:1 **clientes**
- **combos** → N:1 **atos**
- **pedidos** → N:1 **serventias**

---

> Atualize este arquivo sempre que houver mudanças no modelo de dados.
