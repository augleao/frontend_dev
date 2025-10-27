-- Pós-criação: índices e triggers para public.legislacao_normas

-- 1) Índices úteis
CREATE INDEX IF NOT EXISTS idx_legislacao_normas_indexador
  ON public.legislacao_normas (indexador);

CREATE INDEX IF NOT EXISTS idx_legislacao_normas_base_legal
  ON public.legislacao_normas (base_legal);

CREATE INDEX IF NOT EXISTS idx_legislacao_normas_ativo
  ON public.legislacao_normas (ativo);

-- Full-Text Search (GIN)
CREATE INDEX IF NOT EXISTS idx_legislacao_normas_searchable
  ON public.legislacao_normas USING GIN (searchable);

-- 2) Trigger para manter searchable atualizado (caso a coluna seja DEFAULT e não GENERATED)
CREATE OR REPLACE FUNCTION public.legislacao_normas_set_searchable()
RETURNS trigger AS $$
BEGIN
  NEW.searchable := to_tsvector('portuguese',
    coalesce(NEW.indexador,'') || ' ' ||
    coalesce(NEW.base_legal,'') || ' ' ||
    coalesce(NEW.titulo,'') || ' ' ||
    coalesce(NEW.artigo,'') || ' ' ||
    coalesce(NEW.texto,'')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legislacao_normas_searchable ON public.legislacao_normas;
CREATE TRIGGER trg_legislacao_normas_searchable
BEFORE INSERT OR UPDATE ON public.legislacao_normas
FOR EACH ROW EXECUTE FUNCTION public.legislacao_normas_set_searchable();

-- Atualiza linhas existentes para preencher searchable corretamente
UPDATE public.legislacao_normas l
SET searchable = to_tsvector('portuguese',
  coalesce(l.indexador,'') || ' ' ||
  coalesce(l.base_legal,'') || ' ' ||
  coalesce(l.titulo,'') || ' ' ||
  coalesce(l.artigo,'') || ' ' ||
  coalesce(l.texto,'')
)
WHERE l.searchable IS NULL;

-- 3) Trigger para updated_at (se ainda não existir)
CREATE OR REPLACE FUNCTION public.set_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_on_legislacao_normas ON public.legislacao_normas;
CREATE TRIGGER set_timestamp_on_legislacao_normas
BEFORE UPDATE ON public.legislacao_normas
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();
