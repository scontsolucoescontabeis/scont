-- ============================================================
-- GERADOR DE MODELOS — Logo da empresa cliente no cabeçalho dos
-- documentos gerados (Admissão e demais eventos/modelos).
-- Guarda a logo como data URI (base64) direto na linha da empresa,
-- para reaproveitamento automático em todas as gerações futuras —
-- sem precisar de bucket de storage: os PDFs são impressos a partir
-- de uma janela local (window.print), e uma <img src="data:..."> não
-- depende de rede/CORS para renderizar ali.
-- rh_empresas é compartilhada com outros módulos do Portal (RH,
-- Fechamento de Folha etc.) — a coluna é só aditiva, não afeta quem
-- já usa a tabela.
-- Execute no SQL Editor do Supabase (mesmo projeto do Gerador de
-- Modelos e do módulo de RH).
-- ============================================================

ALTER TABLE public.rh_empresas
    ADD COLUMN IF NOT EXISTS logo_base64 TEXT;
