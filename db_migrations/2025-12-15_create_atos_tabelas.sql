-- Versões históricas das tabelas TJMG (tabelas 07/08)
-- Permite armazenar múltiplas referências oficiais e alternar qual
-- conjunto abastece a tabela operacional "atos".

CREATE TABLE IF NOT EXISTS public.atos_tabelas (
    id            BIGSERIAL PRIMARY KEY,
    origem        VARCHAR(255) NOT NULL,          -- ex.: '01-2025', '01-2026'
    codigo        VARCHAR(255) NOT NULL,
    descricao     TEXT        NOT NULL,
    emol_bruto    NUMERIC(10,2),
    recompe       NUMERIC(10,2),
    emol_liquido  NUMERIC(10,2),
    issqn         NUMERIC(10,2),
    taxa_fiscal   NUMERIC(10,2),
    valor_final   NUMERIC(10,2),
    criado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Mantém updated_at sincronizado em updates
CREATE OR REPLACE FUNCTION public.atos_tabelas_set_timestamp()
RETURNS trigger AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_on_atos_tabelas ON public.atos_tabelas;
CREATE TRIGGER set_timestamp_on_atos_tabelas
BEFORE UPDATE ON public.atos_tabelas
FOR EACH ROW EXECUTE FUNCTION public.atos_tabelas_set_timestamp();

-- Restrições/índices auxiliares
CREATE UNIQUE INDEX IF NOT EXISTS uq_atos_tabelas_origem_codigo
    ON public.atos_tabelas (origem, codigo);

CREATE INDEX IF NOT EXISTS idx_atos_tabelas_origem
    ON public.atos_tabelas (origem);

CREATE INDEX IF NOT EXISTS idx_atos_tabelas_codigo
    ON public.atos_tabelas (codigo);
