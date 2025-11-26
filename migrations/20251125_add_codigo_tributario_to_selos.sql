-- Migration: add codigo_tributario to selos_execucao_servico
-- Run this migration against the database used by the backend API that handles selos

ALTER TABLE selos_execucao_servico
  ADD COLUMN codigo_tributario varchar(128);

-- Optionally, if you want an index for faster lookup by code:
-- CREATE INDEX idx_selos_codigo_tributario ON selos_execucao_servico (codigo_tributario);
