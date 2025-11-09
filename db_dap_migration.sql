-- MIGRAÇÃO DAP – criação de tabelas (sem IF NOT EXISTS)
-- Observação: Este script assume que as tabelas ainda NÃO existem.
-- Se já existirem, o comando CREATE falhará. Execute apenas uma vez ou ajuste conforme seu SGBD.

-- =====================
-- UP (criação)
-- =====================

-- 1) Tabela principal: dap
CREATE TABLE public.dap (
  id                      BIGSERIAL PRIMARY KEY,
  mes_referencia          SMALLINT      NOT NULL,
  ano_referencia          SMALLINT      NOT NULL,
  retificadora            BOOLEAN       NOT NULL DEFAULT FALSE,
  retificadora_de_id      BIGINT        NULL,
  retificada_por_id       BIGINT        NULL,

  serventia_nome          VARCHAR(255)  NOT NULL,
  codigo_serventia        VARCHAR(50)   NOT NULL,
  cnpj                    CHAR(14)      NULL,

  data_transmissao        TIMESTAMP     NULL,
  codigo_recibo           VARCHAR(100)  NULL,
  observacoes             TEXT          NULL,

  emolumento_apurado                      DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  taxa_fiscalizacao_judiciaria_apurada    DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  taxa_fiscalizacao_judiciaria_paga       DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  recompe_apurado                          DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  recompe_depositado                       DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  data_deposito_recompe                    DATE          NULL,
  valores_recebidos_recompe                DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  valores_recebidos_ferrfis                DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  issqn_recebido_usuarios                  DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  repasses_responsaveis_anteriores         DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  saldo_deposito_previo                    DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  total_despesas_mes                       DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  estoque_selos_eletronicos_transmissao    INT           DEFAULT 0    NOT NULL,

  CONSTRAINT chk_dap_mes CHECK (mes_referencia BETWEEN 1 AND 12)
);

-- Auto-relacionamentos (definidos após a criação para evitar ordem de dependência)
ALTER TABLE public.dap
  ADD CONSTRAINT fk_dap_retificadora_de
  FOREIGN KEY (retificadora_de_id) REFERENCES public.dap(id);

ALTER TABLE public.dap
  ADD CONSTRAINT fk_dap_retificada_por
  FOREIGN KEY (retificada_por_id) REFERENCES public.dap(id);

-- Índices e unicidade
CREATE UNIQUE INDEX uq_dap_competencia_tipo
  ON public.dap (mes_referencia, ano_referencia, codigo_serventia, retificadora);

CREATE INDEX ix_dap_competencia
  ON public.dap (codigo_serventia, ano_referencia, mes_referencia);

CREATE INDEX ix_dap_codigo_recibo
  ON public.dap (codigo_recibo);


-- 2) Tabela de períodos: dap_periodo (sempre 4 por DAP)
CREATE TABLE public.dap_periodo (
  id                BIGSERIAL PRIMARY KEY,
  dap_id            BIGINT NOT NULL,
  ordem             SMALLINT    NOT NULL,
  quantidade_total  INT         NOT NULL DEFAULT 0,
  tfj_total         DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  CONSTRAINT fk_dap_periodo_dap FOREIGN KEY (dap_id) REFERENCES public.dap(id) ON DELETE CASCADE,
  CONSTRAINT chk_dap_periodo_ordem CHECK (ordem BETWEEN 1 AND 4)
);

CREATE UNIQUE INDEX uq_dap_periodo
  ON public.dap_periodo (dap_id, ordem);

CREATE INDEX ix_dap_periodo_dap
  ON public.dap_periodo (dap_id);


-- 3) Tabela de snapshot dos atos por período
CREATE TABLE public.dap_periodo_ato_snapshot (
  id           BIGSERIAL PRIMARY KEY,
  periodo_id   BIGINT  NOT NULL,
  codigo       CHAR(4)      NOT NULL,
  tributacao   VARCHAR(2)   NOT NULL,
  quantidade   SMALLINT     NOT NULL,
  tfj_valor    DECIMAL(15,2) NOT NULL,
  CONSTRAINT fk_dap_ato_periodo FOREIGN KEY (periodo_id) REFERENCES public.dap_periodo(id) ON DELETE CASCADE,
  CONSTRAINT chk_dap_ato_codigo CHECK (codigo ~ '^[0-9]{4}$'),
  CONSTRAINT chk_dap_ato_tribut CHECK (tributacao ~ '^[0-9]{1,2}$'),
  CONSTRAINT chk_dap_ato_qtd CHECK (quantidade BETWEEN 0 AND 999),
  CONSTRAINT chk_dap_ato_tfj CHECK (tfj_valor >= 0)
);

CREATE UNIQUE INDEX uq_dap_ato_periodo_codigo_trib
  ON public.dap_periodo_ato_snapshot (periodo_id, codigo, tributacao);

CREATE INDEX ix_dap_ato_periodo_codigo
  ON public.dap_periodo_ato_snapshot (periodo_id, codigo);


-- =====================
-- DOWN (rollback) – opcional
-- =====================
-- Descomente se precisar reverter
-- DROP INDEX ix_dap_ato_periodo_codigo;
-- DROP INDEX uq_dap_ato_periodo_codigo_trib;
-- DROP TABLE dap_periodo_ato_snapshot;
-- 
-- DROP INDEX ix_dap_periodo_dap;
-- DROP INDEX uq_dap_periodo;
-- DROP TABLE dap_periodo;
-- 
-- DROP INDEX ix_dap_codigo_recibo;
-- DROP INDEX ix_dap_competencia;
-- DROP INDEX uq_dap_competencia_tipo;
-- ALTER TABLE dap DROP CONSTRAINT fk_dap_retificada_por;
-- ALTER TABLE dap DROP CONSTRAINT fk_dap_retificadora_de;
-- DROP TABLE dap;
