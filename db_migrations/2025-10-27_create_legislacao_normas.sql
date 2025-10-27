-- Tabela de legislação/regras para análise de mandados
-- Compatível com PostgreSQL (sem extensões não padrão)

CREATE TABLE IF NOT EXISTS public.legislacao_normas (
    id               BIGSERIAL PRIMARY KEY,
    indexador        TEXT NOT NULL,              -- ex.: "averbacao_divorcio", "averbacao_reconhecimento_paternidade"
    base_legal       TEXT NOT NULL,              -- ex.: "Provimento 149/2023 CNJ", "Lei 6.015/73"
    titulo           TEXT,                       -- opcional: título amigável
    artigo           TEXT,                       -- opcional: referência do artigo, ex.: "Art. 1º"
    jurisdicao       TEXT,                       -- opcional: CNJ, TJMG, Federal, etc.
    tags             TEXT[],                     -- opcional: categorias livres
    vigente_desde    DATE,                       -- opcional
    vigente_ate      DATE,                       -- opcional
    ativo            BOOLEAN NOT NULL DEFAULT TRUE,
    texto            TEXT NOT NULL,              -- texto integral do dispositivo
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    searchable       tsvector GENERATED ALWAYS AS (
        to_tsvector('portuguese',
            coalesce(indexador,'') || ' ' ||
            coalesce(base_legal,'') || ' ' ||
            coalesce(titulo,'') || ' ' ||
            coalesce(artigo,'') || ' ' ||
            coalesce(texto,'')
        )
    ) STORED
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_legislacao_normas_indexador
    ON public.legislacao_normas (indexador);

CREATE INDEX IF NOT EXISTS idx_legislacao_normas_base_legal
    ON public.legislacao_normas (base_legal);

CREATE INDEX IF NOT EXISTS idx_legislacao_normas_ativo
    ON public.legislacao_normas (ativo);

-- GIN index para busca textual
CREATE INDEX IF NOT EXISTS idx_legislacao_normas_searchable
    ON public.legislacao_normas USING GIN (searchable);

-- Função de carimbo de data/hora (reutilizável)
CREATE OR REPLACE FUNCTION public.set_timestamp()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para manter updated_at atualizado
DROP TRIGGER IF EXISTS set_timestamp_on_legislacao_normas ON public.legislacao_normas;
CREATE TRIGGER set_timestamp_on_legislacao_normas
BEFORE UPDATE ON public.legislacao_normas
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

-- (Opcional) Restrição para vigência coerente
-- ALTER TABLE public.legislacao_normas
--   ADD CONSTRAINT chk_vigencia_periodo CHECK (
--       vigente_ate IS NULL OR vigente_desde IS NULL OR vigente_ate >= vigente_desde
--   );

-- (Opcional) Evitar duplicidade básica por fonte+artigo+indexador
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_legislacao_normas_chave
--   ON public.legislacao_normas (lower(base_legal), lower(coalesce(artigo,'')), lower(indexador));
