-- ============================================================
-- fn_alertas_sistema() — versão final completa
-- Retorna detalhes JSONB por categoria para cards ricos no mobile.
--
-- Módulos: Formulários · Admissões · Certificados · Licenças · Portal
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- DROP obrigatório: tipo de retorno mudou (coluna detalhes JSONB)
DROP FUNCTION IF EXISTS public.fn_alertas_sistema();

CREATE FUNCTION public.fn_alertas_sistema()
RETURNS TABLE (
    categoria   TEXT,
    ferramenta  TEXT,
    severidade  TEXT,
    titulo      TEXT,
    descricao   TEXT,
    data_ref    TIMESTAMPTZ,
    link        TEXT,
    detalhes    JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$

-- ── FORMULÁRIOS pendentes (escalada por idade) ──────────────────────────
SELECT
    'formularios'                        AS categoria,
    'Gerenciador de Formulários'         AS ferramenta,
    CASE
        WHEN (CURRENT_DATE - f.created_at::date) > 5 THEN 'critico'
        WHEN (CURRENT_DATE - f.created_at::date) > 2 THEN 'urgente'
        ELSE 'info'
    END                                  AS severidade,
    COALESCE(f.nome_empresa, 'Formulário sem nome') AS titulo,
    CASE
        WHEN (CURRENT_DATE - f.created_at::date) > 5
            THEN 'Pendente há ' || (CURRENT_DATE - f.created_at::date)::TEXT || ' dias — requer ação imediata'
        WHEN (CURRENT_DATE - f.created_at::date) > 2
            THEN 'Pendente há ' || (CURRENT_DATE - f.created_at::date)::TEXT || ' dias — aguardando validação'
        ELSE 'Formulário recebido — aguardando validação'
    END                                  AS descricao,
    f.created_at                         AS data_ref,
    '../Projeto Gerenciador Formularios/index.html' AS link,
    jsonb_build_object(
        -- Campos comuns
        'tipo_formulario',          f.tipo_formulario,
        'status',                   f.status,
        'email_comercial',          f.email_comercial,
        'telefone_comercial',       f.telefone_comercial,
        'nome_fantasia',            f.nome_fantasia,
        'porte_empresa',            f.porte_empresa,
        'endereco',                 f.endereco,
        'cep',                      f.cep,
        'horario',                  f.horario,
        'forma_atuacao',            f.forma_atuacao,
        -- Campos exclusivos de registro
        'capital_social',           f.capital_social,
        'metragem',                 f.metragem,
        'iptu',                     f.iptu,
        'cnae_principal',           f.cnae_principal,
        'atividades_secundarias',   f.atividades_secundarias,
        -- Campos exclusivos de alteração
        'nome_opcao_1',             f.nome_opcao_1,
        'nome_opcao_2',             f.nome_opcao_2,
        'nome_opcao_3',             f.nome_opcao_3,
        'novo_nome_fantasia',       f.novo_nome_fantasia,
        'novo_capital',             f.novo_capital,
        'novo_endereco',            f.novo_endereco,
        'cep_novo',                 f.cep_novo,
        'iptu_novo',                f.iptu_novo,
        'horario_novo',             f.horario_novo,
        'email_comercial_novo',     f.email_comercial_novo,
        'telefone_comercial_novo',  f.telefone_comercial_novo,
        'atividade_principal_nova', f.atividade_principal_nova,
        'alterar_nome',             f.alterar_nome,
        'alterar_fantasia',         f.alterar_fantasia,
        'alterar_capital',          f.alterar_capital,
        'alterar_dados',            f.alterar_dados,
        'alterar_atividades',       f.alterar_atividades
    )                                    AS detalhes
FROM public.formularios f
WHERE f.status = 'recebido'

UNION ALL

-- ── ADMISSÕES pendentes (escalada por idade) ─────────────────────────────
SELECT
    'admissoes'                          AS categoria,
    'Gerenciador de Formulários'         AS ferramenta,
    CASE
        WHEN (CURRENT_DATE - e.created_at::date) > 5 THEN 'critico'
        WHEN (CURRENT_DATE - e.created_at::date) > 2 THEN 'urgente'
        ELSE 'info'
    END                                  AS severidade,
    COALESCE(e.nome_completo, 'Empregado sem nome') AS titulo,
    CASE
        WHEN (CURRENT_DATE - e.created_at::date) > 5
            THEN 'Admissão pendente há ' || (CURRENT_DATE - e.created_at::date)::TEXT || ' dias — requer ação imediata'
        WHEN (CURRENT_DATE - e.created_at::date) > 2
            THEN 'Admissão pendente há ' || (CURRENT_DATE - e.created_at::date)::TEXT || ' dias — aguardando validação'
        ELSE 'Admissão recebida — aguardando validação'
    END                                  AS descricao,
    e.created_at                         AS data_ref,
    '../Projeto Gerenciador Formularios/index.html' AS link,
    jsonb_build_object(
        'cpf',              e.cpf,
        'email',            e.email,
        'celular',          e.celular,
        'telefone',         e.telefone,
        'cargo',            e.cargo,
        'departamento',     e.departamento,
        'nome_empresa',     e.nome_empresa,
        'cnpj_empresa',     e.cnpj_empresa,
        'data_admissao',    e.data_admissao,
        'status',           e.status
    )                                    AS detalhes
FROM public.empregados e
WHERE e.status = 'recebido'

UNION ALL

-- ── EVENTOS RECENTES: edições e exclusões (últimas 48 h) ─────────────────
SELECT
    'formularios'                        AS categoria,
    'Gerenciador de Formulários'         AS ferramenta,
    CASE h.campo
        WHEN 'EVENTO_EXCLUSAO' THEN 'urgente'
        ELSE 'info'
    END                                  AS severidade,
    CASE h.campo
        WHEN 'EVENTO_EXCLUSAO' THEN 'Formulário excluído'
        ELSE 'Formulário editado'
    END                                  AS titulo,
    COALESCE(h.editado_por, 'Sistema')
        || CASE h.campo
             WHEN 'EVENTO_EXCLUSAO'
               THEN ' excluiu — status anterior: ' || COALESCE(h.valor_anterior, 'N/A')
             ELSE
               ' editou — ' || COALESCE(h.valor_anterior, 'N/A') || ' → ' || COALESCE(h.valor_novo, 'N/A')
           END                           AS descricao,
    h.editado_em                         AS data_ref,
    '../Projeto Gerenciador Formularios/historico.html' AS link,
    jsonb_build_object(
        'evento',          h.campo,
        'valor_anterior',  h.valor_anterior,
        'valor_novo',      h.valor_novo,
        'editado_por',     h.editado_por,
        'registro_id',     h.registro_id::TEXT,
        'tabela',          h.tabela
    )                                    AS detalhes
FROM public.historico_edicoes h
WHERE h.editado_em > NOW() - INTERVAL '48 hours'
  AND h.campo IN ('EVENTO_EDICAO', 'EVENTO_EXCLUSAO')

UNION ALL

-- ── CERTIFICADOS DIGITAIS vencendo nos próximos 30 dias ──────────────────
SELECT
    'certificados'                       AS categoria,
    'Certificados Digitais'              AS ferramenta,
    CASE
        WHEN c.data_vencimento < NOW()                       THEN 'critico'
        WHEN c.data_vencimento < NOW() + INTERVAL '7 days'  THEN 'critico'
        WHEN c.data_vencimento < NOW() + INTERVAL '15 days' THEN 'urgente'
        ELSE 'atencao'
    END                                  AS severidade,
    COALESCE(c.empresa_id, 'Empresa não informada') || ' — ' || COALESCE(c.tipo_id, '') AS titulo,
    CASE
        WHEN c.data_vencimento < NOW()
            THEN 'Vencido há '
                 || ABS(EXTRACT(DAY FROM NOW() - c.data_vencimento)::INT)::TEXT || ' dia(s) • '
                 || COALESCE(c.cpf_cnpj, '')
                 || CASE WHEN c.responsavel_nome IS NOT NULL THEN ' | ' || c.responsavel_nome ELSE '' END
        ELSE
            'Vence em '
            || EXTRACT(DAY FROM c.data_vencimento - NOW())::INT::TEXT || ' dia(s) • '
            || COALESCE(c.cpf_cnpj, '')
            || CASE WHEN c.responsavel_nome IS NOT NULL THEN ' | ' || c.responsavel_nome ELSE '' END
    END                                  AS descricao,
    c.data_vencimento                    AS data_ref,
    '../Projeto Certificado Digital/index.html' AS link,
    jsonb_build_object(
        'tipo_id',                  c.tipo_id,
        'cpf_cnpj',                 c.cpf_cnpj,
        'data_emissao',             c.data_emissao,
        'data_vencimento',          c.data_vencimento,
        'situacao',                 c.situacao,
        'data_renovacao_agendada',  c.data_renovacao_agendada,
        'responsavel_nome',         c.responsavel_nome,
        'responsavel_email',        c.responsavel_email,
        'responsavel_telefone',     c.responsavel_telefone,
        'informacoes_adicionais',   c.informacoes_adicionais,
        'observacao_risco',         c.observacao_risco
    )                                    AS detalhes
FROM public.certificados c
WHERE c.deleted_at IS NULL
  AND c.situacao <> 'Renovado'
  AND c.data_vencimento IS NOT NULL
  AND c.data_vencimento <= NOW() + INTERVAL '30 days'

UNION ALL

-- ── LICENÇAS vencendo nos próximos 30 dias ───────────────────────────────
SELECT
    'licencas'                           AS categoria,
    'Licenças — Licença'                 AS ferramenta,
    CASE
        WHEN l.data_validade < CURRENT_DATE       THEN 'critico'
        WHEN l.data_validade <= CURRENT_DATE + 7  THEN 'critico'
        WHEN l.data_validade <= CURRENT_DATE + 14 THEN 'urgente'
        ELSE 'atencao'
    END                                  AS severidade,
    COALESCE(l.tipo, 'Licença') || ' · ' || COALESCE(l.estabelecimento, '') AS titulo,
    CASE
        WHEN l.data_validade < CURRENT_DATE
            THEN 'Vencida há ' || (CURRENT_DATE - l.data_validade)::TEXT || ' dia(s) • Nº '
                 || COALESCE(l.numero, 'N/A')
                 || CASE WHEN l.orgao_emissor IS NOT NULL THEN ' | ' || l.orgao_emissor ELSE '' END
        ELSE
            'Vence em ' || (l.data_validade - CURRENT_DATE)::TEXT || ' dia(s) • Nº '
            || COALESCE(l.numero, 'N/A')
            || CASE WHEN l.orgao_emissor IS NOT NULL THEN ' | ' || l.orgao_emissor ELSE '' END
    END                                  AS descricao,
    l.data_validade::TIMESTAMPTZ         AS data_ref,
    '../Projeto Licenças/index.html'     AS link,
    jsonb_build_object(
        'id',             l.id::TEXT,
        'tipo_documento', 'licencas',
        'numero',         l.numero,
        'orgao_emissor',  l.orgao_emissor,
        'data_emissao',   l.data_emissao,
        'data_validade',  l.data_validade,
        'responsavel',    l.responsavel,
        'empresa_id',     l.empresa_id::TEXT
    )                                    AS detalhes
FROM public.licencas l
WHERE l.ativo = TRUE
  AND l.deletado_em IS NULL
  AND l.data_validade IS NOT NULL
  AND l.data_validade <= CURRENT_DATE + 30

UNION ALL

-- ── ALVARÁS vencendo nos próximos 30 dias ────────────────────────────────
SELECT
    'licencas'                           AS categoria,
    'Licenças — Alvará'                  AS ferramenta,
    CASE
        WHEN a.data_validade < CURRENT_DATE       THEN 'critico'
        WHEN a.data_validade <= CURRENT_DATE + 7  THEN 'critico'
        WHEN a.data_validade <= CURRENT_DATE + 14 THEN 'urgente'
        ELSE 'atencao'
    END                                  AS severidade,
    COALESCE(a.tipo, 'Alvará') || ' · ' || COALESCE(a.estabelecimento, '') AS titulo,
    CASE
        WHEN a.data_validade < CURRENT_DATE
            THEN 'Vencido há ' || (CURRENT_DATE - a.data_validade)::TEXT || ' dia(s) • Nº '
                 || COALESCE(a.numero, 'N/A')
                 || CASE WHEN a.orgao_emissor IS NOT NULL THEN ' | ' || a.orgao_emissor ELSE '' END
        ELSE
            'Vence em ' || (a.data_validade - CURRENT_DATE)::TEXT || ' dia(s) • Nº '
            || COALESCE(a.numero, 'N/A')
            || CASE WHEN a.orgao_emissor IS NOT NULL THEN ' | ' || a.orgao_emissor ELSE '' END
    END                                  AS descricao,
    a.data_validade::TIMESTAMPTZ         AS data_ref,
    '../Projeto Licenças/index.html'     AS link,
    jsonb_build_object(
        'id',             a.id::TEXT,
        'tipo_documento', 'alvaras',
        'numero',         a.numero,
        'orgao_emissor',  a.orgao_emissor,
        'data_emissao',   a.data_emissao,
        'data_validade',  a.data_validade,
        'responsavel',    a.responsavel,
        'empresa_id',     a.empresa_id::TEXT
    )                                    AS detalhes
FROM public.alvaras a
WHERE a.ativo = TRUE
  AND a.deletado_em IS NULL
  AND a.data_validade IS NOT NULL
  AND a.data_validade <= CURRENT_DATE + 30

UNION ALL

-- ── PORTAL — solicitações de acesso pendentes ────────────────────────────
SELECT
    'portal'                             AS categoria,
    'Administração do Portal'            AS ferramenta,
    'urgente'                            AS severidade,
    'Solicitação de acesso: ' || COALESCE(s.nome, 'Usuário') AS titulo,
    COALESCE(s.empresa, '') || CASE WHEN s.cargo IS NOT NULL THEN ' — ' || s.cargo ELSE '' END AS descricao,
    s.data_solicitacao                   AS data_ref,
    '../admin-dashboard.html'            AS link,
    jsonb_build_object(
        'nome',             s.nome,
        'email',            s.email,
        'empresa',          s.empresa,
        'cargo',            s.cargo,
        'telefone',         s.telefone,
        'data_solicitacao', s.data_solicitacao
    )                                    AS detalhes
FROM public.solicitacoes_acesso s
WHERE s.status = 'pendente';
$$;

GRANT EXECUTE ON FUNCTION public.fn_alertas_sistema() TO authenticated;
