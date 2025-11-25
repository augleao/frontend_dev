-- Migration: criar tabela para armazenar atos praticados gratuitos
-- Data: 2025-11-25
-- Estrutura baseada na tabela `atos_praticados`

-- Remover tabela se já existir (seguro para reexecução)
DROP TABLE IF EXISTS public.atos_praticados_gratuitos;

-- Sequência (seguindo padrão `serial` equivalente)
CREATE TABLE public.atos_praticados_gratuitos (
    id serial NOT NULL,
    "data" date NOT NULL,
    hora time NOT NULL,
    codigo varchar(10) NOT NULL,
    tributacao varchar(10),
    descricao text NOT NULL,
    quantidade int4 DEFAULT 1 NOT NULL,
    valor_unitario numeric(12,2) NOT NULL,
    pagamentos jsonb NOT NULL,
    usuario varchar(100) NOT NULL,
    detalhes_pagamentos jsonb,
    selo_final varchar(20) DEFAULT NULL::character varying,
    origem_importacao varchar(50) DEFAULT NULL::character varying,
    selo_inicial varchar(20) DEFAULT NULL::character varying,
    CONSTRAINT atos_praticados_gratuitos_pkey PRIMARY KEY (id),
    CONSTRAINT fk_ato_gratuito FOREIGN KEY (codigo) REFERENCES public.atos(codigo),
    CONSTRAINT fk_tributacao_gratuito FOREIGN KEY (tributacao) REFERENCES public.codigos_gratuitos(codigo)
);

CREATE INDEX idx_atos_praticados_gratuitos_importacao ON public.atos_praticados_gratuitos ("data", usuario, codigo, origem_importacao);

-- Observações:
-- 1) Mantive a mesma estrutura/colunas da tabela `atos_praticados` para compatibilidade.
-- 2) Usei o esquema `public`. Se você prefere o prefixo `db_yq0x.public` (como no DDL original), me diga para ajustar.
-- 3) `valor_unitario` permanece NOT NULL (mesmo para gratuitos); caso queira permitir NULL ou default 0, posso ajustar.
