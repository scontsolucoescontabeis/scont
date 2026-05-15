-- ============================================================
-- RLS: liberar acesso anônimo para formulários externos
-- Formulários preenchidos por clientes sem autenticação no portal
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ── 1. formularios ───────────────────────────────────────────
ALTER TABLE public.formularios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formularios: anon insert"  ON public.formularios;
DROP POLICY IF EXISTS "formularios: anon select"  ON public.formularios;
DROP POLICY IF EXISTS "formularios: auth all"     ON public.formularios;

CREATE POLICY "formularios: anon insert"
    ON public.formularios FOR INSERT TO anon WITH CHECK (TRUE);

CREATE POLICY "formularios: anon select"
    ON public.formularios FOR SELECT TO anon USING (TRUE);

CREATE POLICY "formularios: auth all"
    ON public.formularios FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT, INSERT ON public.formularios TO anon;


-- ── 2. socios ────────────────────────────────────────────────
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "socios: anon insert"  ON public.socios;
DROP POLICY IF EXISTS "socios: anon select"  ON public.socios;
DROP POLICY IF EXISTS "socios: auth all"     ON public.socios;

CREATE POLICY "socios: anon insert"
    ON public.socios FOR INSERT TO anon WITH CHECK (TRUE);

CREATE POLICY "socios: anon select"
    ON public.socios FOR SELECT TO anon USING (TRUE);

CREATE POLICY "socios: auth all"
    ON public.socios FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT, INSERT ON public.socios TO anon;


-- ── 3. empregados ────────────────────────────────────────────
ALTER TABLE public.empregados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empregados: anon insert"  ON public.empregados;
DROP POLICY IF EXISTS "empregados: anon select"  ON public.empregados;
DROP POLICY IF EXISTS "empregados: auth all"     ON public.empregados;

CREATE POLICY "empregados: anon insert"
    ON public.empregados FOR INSERT TO anon WITH CHECK (TRUE);

CREATE POLICY "empregados: anon select"
    ON public.empregados FOR SELECT TO anon USING (TRUE);

CREATE POLICY "empregados: auth all"
    ON public.empregados FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT, INSERT ON public.empregados TO anon;


-- ── 4. dependentes ───────────────────────────────────────────
ALTER TABLE public.dependentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dependentes: anon insert"  ON public.dependentes;
DROP POLICY IF EXISTS "dependentes: anon select"  ON public.dependentes;
DROP POLICY IF EXISTS "dependentes: auth all"     ON public.dependentes;

CREATE POLICY "dependentes: anon insert"
    ON public.dependentes FOR INSERT TO anon WITH CHECK (TRUE);

CREATE POLICY "dependentes: anon select"
    ON public.dependentes FOR SELECT TO anon USING (TRUE);

CREATE POLICY "dependentes: auth all"
    ON public.dependentes FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT, INSERT ON public.dependentes TO anon;


-- ── 5. Storage bucket "documentos" ──────────────────────────
-- Permite upload e leitura anônima no bucket de documentos dos formulários

DROP POLICY IF EXISTS "storage documentos: anon insert" ON storage.objects;
DROP POLICY IF EXISTS "storage documentos: anon select" ON storage.objects;
DROP POLICY IF EXISTS "storage documentos: auth all"    ON storage.objects;

CREATE POLICY "storage documentos: anon insert"
    ON storage.objects FOR INSERT TO anon
    WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "storage documentos: anon select"
    ON storage.objects FOR SELECT TO anon
    USING (bucket_id = 'documentos');

CREATE POLICY "storage documentos: auth all"
    ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'documentos') WITH CHECK (bucket_id = 'documentos');
