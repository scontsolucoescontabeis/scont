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

    -- Elegiveis calculados uma so vez (chaves: codigo_empresa + codigo_empregado) e
    -- reaproveitados pelas tres leituras. Producao grava o estagiario como
    -- 'Est' || 'a' agudo || 'giario' (grafia legada); aceitamos tambem as grafias
    -- corretas. 'Contribuinte' (socios) fica de fora. Somente campos necessarios:
    -- nada de CPF, salario ou endereco.
    WITH elegiveis AS (
        SELECT e.codigo_empresa, e.codigo_empregado, e.nome_empregado,
               e.desc_cargo, e.desc_funcao, e.tipo_empregado,
               e.sexo, e.data_nascimento
          FROM public.rh_empregados e
         WHERE e.codigo_empresa = p_codigo
           AND btrim(e.situacao) = 'Trabalhando'
           AND btrim(e.tipo_empregado) IN ('Empregado', 'Est' || chr(225) || 'giario',
                                           'Estagi' || chr(225) || 'rio', 'Estagiario')
    )
    SELECT
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'codigo_empregado', x.codigo_empregado,
                    'nome_empregado',   x.nome_empregado,
                    'cargo',            COALESCE(NULLIF(x.desc_cargo, ''), NULLIF(x.desc_funcao, '')),
                    'tipo_empregado',   x.tipo_empregado,
                    -- sexo normalizado ('F'/'M'/null); o texto bruto nao sai daqui
                    'sexo',             CASE upper(left(btrim(x.sexo), 1))
                                            WHEN 'F' THEN 'F'
                                            WHEN 'M' THEN 'M'
                                            ELSE NULL END,
                    -- derivado no banco; a data de nascimento NUNCA e devolvida.
                    -- data_nascimento nula (desconhecida) e tratada como adulto (false).
                    'menor_de_idade',   COALESCE(x.data_nascimento > current_date - interval '18 years', false))
                ORDER BY x.nome_empregado, x.codigo_empregado), '[]'::jsonb)
           FROM elegiveis x),
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'codigo_empregado', j.codigo_empregado,
                    'dia_semana',       j.dia_semana,
                    'entrada',          j.entrada,
                    'intervalo_inicio', j.intervalo_inicio,
                    'intervalo_fim',    j.intervalo_fim,
                    'saida',            j.saida)
                ORDER BY j.codigo_empregado, j.dia_semana), '[]'::jsonb)
           FROM public.rh_jornada_trabalho j
          WHERE j.codigo_empresa = p_codigo
            AND EXISTS (SELECT 1 FROM elegiveis x
                         WHERE x.codigo_empresa = j.codigo_empresa
                           AND x.codigo_empregado = j.codigo_empregado)),
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'codigo_empregado', f.codigo_empregado,
                    'ferias_inicio',    f.ferias_inicio,
                    'ferias_fim',       f.ferias_fim)
                ORDER BY f.codigo_empregado, f.ferias_inicio), '[]'::jsonb)
           FROM public.rh_ferias_calculadas f
          WHERE f.codigo_empresa = p_codigo
            AND f.ferias_fim >= current_date
            AND EXISTS (SELECT 1 FROM elegiveis x
                         WHERE x.codigo_empresa = f.codigo_empresa
                           AND x.codigo_empregado = f.codigo_empregado))
      INTO v_empregados, v_jornadas, v_ferias;

    RETURN jsonb_build_object(
        'empresa',    COALESCE(v_empresa, 'null'::jsonb),
        'empregados', v_empregados,
        'jornadas',   v_jornadas,
        'ferias',     v_ferias);
END;
$$;

COMMENT ON FUNCTION public.montador_dados_empresa(text) IS
    'Dados minimos (empresa, empregados ativos sem dados pessoais (so sexo e menor_de_idade derivados), jornadas, ferias futuras) para o Montador de Escala no portal do cliente. Exige acesso a empresa.';

REVOKE ALL ON FUNCTION public.montador_dados_empresa(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.montador_dados_empresa(text) TO authenticated;
