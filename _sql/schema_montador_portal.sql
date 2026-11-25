-- =====================================================================
-- Montador de Escala no Portal do Cliente: dados minimos da empresa.
-- Os clientes NAO leem rh_* diretamente (politica restritiva da Parte 1);
-- esta funcao SECURITY DEFINER entrega so o necessario, depois de checar
-- se a empresa pertence ao usuario (empresas_do_cliente(); o admin recebe
-- todas). Idempotente. Pressupoe schema_portal_cliente*.sql ja aplicados.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.montador_dados_empresa(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_empresa    jsonb;
    v_empregados jsonb;
    v_jornadas   jsonb;
    v_ferias     jsonb;
BEGIN
    -- Autorizacao ANTES de tocar em qualquer dado.
    -- O admin passa sempre (codigo inexistente devolve empresa: null).
    IF NOT COALESCE(public.is_admin(), false) AND (p_codigo IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.empresas_do_cliente() e WHERE e = p_codigo
    )) THEN
        RAISE EXCEPTION 'Sem acesso a esta empresa' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
               'codigo_empresa', r.codigo_empresa,
               'nome_empresa',   r.nome_empresa,
               'uf',             r.uf,
               'municipio',      r.municipio)
      INTO v_empresa
      FROM public.rh_empresas r
     WHERE r.codigo_empresa = p_codigo;

    -- Somente campos necessarios: nada de CPF, salario ou endereco.
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'codigo_empregado', e.codigo_empregado,
               'nome_empregado',   e.nome_empregado,
               'cargo',            COALESCE(NULLIF(e.desc_cargo, ''), NULLIF(e.desc_funcao, '')),
               'tipo_empregado',   e.tipo_empregado)
           ORDER BY e.nome_empregado, e.codigo_empregado), '[]'::jsonb)
      INTO v_empregados
      FROM public.rh_empregados e
     WHERE e.codigo_empresa = p_codigo
       AND e.situacao = 'Trabalhando'
       AND e.tipo_empregado IN ('Empregado', 'Estagiário');

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'codigo_empregado', j.codigo_empregado,
               'dia_semana',       j.dia_semana,
               'entrada',          j.entrada,
               'intervalo_inicio', j.intervalo_inicio,
               'intervalo_fim',    j.intervalo_fim,
               'saida',            j.saida)
           ORDER BY j.codigo_empregado, j.dia_semana), '[]'::jsonb)
      INTO v_jornadas
      FROM public.rh_jornada_trabalho j
     WHERE j.codigo_empresa = p_codigo
       -- so empregados elegiveis, casando as DUAS chaves (empresa + empregado)
       AND EXISTS (SELECT 1 FROM public.rh_empregados e
                    WHERE e.codigo_empresa = j.codigo_empresa
                      AND e.codigo_empregado = j.codigo_empregado
                      AND e.situacao = 'Trabalhando'
                      AND e.tipo_empregado IN ('Empregado', 'Estagiário'));

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'codigo_empregado', f.codigo_empregado,
               'ferias_inicio',    f.ferias_inicio,
               'ferias_fim',       f.ferias_fim)
           ORDER BY f.codigo_empregado, f.ferias_inicio), '[]'::jsonb)
      INTO v_ferias
      FROM public.rh_ferias_calculadas f
     WHERE f.codigo_empresa = p_codigo
       -- so empregados elegiveis, casando as DUAS chaves (empresa + empregado)
       AND EXISTS (SELECT 1 FROM public.rh_empregados e
                    WHERE e.codigo_empresa = f.codigo_empresa
                      AND e.codigo_empregado = f.codigo_empregado
                      AND e.situacao = 'Trabalhando'
                      AND e.tipo_empregado IN ('Empregado', 'Estagiário'))
       AND f.ferias_fim >= current_date;

    RETURN jsonb_build_object(
        'empresa',    COALESCE(v_empresa, 'null'::jsonb),
        'empregados', v_empregados,
        'jornadas',   v_jornadas,
        'ferias',     v_ferias);
END;
$$;

COMMENT ON FUNCTION public.montador_dados_empresa(text) IS
    'Dados minimos (empresa, empregados ativos sem dados pessoais, jornadas, ferias futuras) para o Montador de Escala no portal do cliente. Exige acesso a empresa.';

REVOKE ALL ON FUNCTION public.montador_dados_empresa(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.montador_dados_empresa(text) TO authenticated;
