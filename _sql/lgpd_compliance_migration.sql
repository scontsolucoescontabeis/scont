-- ================================================================
-- MIGRAÇÃO LGPD — Portal Scont
-- Lei 13.709/2018 — Adequação das RLS e permissões
-- Data de geração: 2026-05-12
-- Execute no SQL Editor do Supabase (projeto principal)
-- ================================================================
-- Artigos aplicados:
--   Art. 6º   Princípios (finalidade, necessidade, segurança)
--   Art. 7º   Bases legais para tratamento
--   Art. 11   Dados pessoais sensíveis (raça, saúde, biometria)
--   Art. 14   Proteção de dados de crianças e adolescentes
--   Art. 18   Direitos do titular (exclusão, portabilidade)
--   Art. 46   Medidas técnicas e administrativas de segurança
--   Art. 50   Boas práticas e governança
-- ================================================================


-- ================================================================
-- SEÇÃO 1 — SCHEMA PRINCIPAL (schema.sql)
-- ================================================================
-- Art. 18, VI: titular tem direito de solicitar exclusão dos dados
-- tratados com base em consentimento, ou enquanto a solicitação
-- ainda não foi processada.
-- CORREÇÃO: política que permite ao titular apagar o próprio
-- cadastro enquanto status = 'pendente'.

DROP POLICY IF EXISTS "solicitacoes: titular apaga própria pendente"
    ON public.solicitacoes_acesso;

CREATE POLICY "solicitacoes: titular apaga própria pendente"
    ON public.solicitacoes_acesso FOR DELETE
    USING (
        email = auth.email()
        AND status = 'pendente'
    );


-- ================================================================
-- SEÇÃO 2 — MÓDULO LICENÇAS (schema_licencas.sql)
-- ================================================================

-- ----------------------------------------------------------------
-- 2.1 fn_exportar_dados_empresa — Art. 18, V (portabilidade)
-- PROBLEMA: qualquer usuário autenticado podia chamar a função
--           para exportar dados completos de QUALQUER empresa,
--           independente de ser o titular ou ter autorização.
-- CORREÇÃO: restrito exclusivamente a administradores.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_exportar_dados_empresa(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: autenticação necessária';
    END IF;
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION
            'Acesso negado: apenas administradores podem exportar dados '
            '(Art. 18, V — Lei 13.709/2018)';
    END IF;

    RETURN jsonb_build_object(
        'exportado_em',  NOW(),
        'exportado_por', auth.email(),
        'base_legal',    'Art. 18, V — Lei 13.709/2018 (LGPD)',
        'empresa', (
            SELECT to_jsonb(e) FROM public.empresas e WHERE e.id = p_empresa_id
        ),
        'licencas', (
            SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
              FROM public.licencas l WHERE l.empresa_id = p_empresa_id
        ),
        'alvaras', (
            SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
              FROM public.alvaras a WHERE a.empresa_id = p_empresa_id
        ),
        'processos', (
            SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
              FROM public.processos p WHERE p.empresa_id = p_empresa_id
        ),
        'andamentos', (
            SELECT COALESCE(jsonb_agg(to_jsonb(ap)), '[]'::jsonb)
              FROM public.andamento_processos ap
             WHERE ap.processo_id IN (
                 SELECT id FROM public.processos WHERE empresa_id = p_empresa_id
             )
        )
    );
END;
$$;

-- ----------------------------------------------------------------
-- 2.2 DELETE restrito a administradores — Art. 46
-- PROBLEMA: qualquer usuário autenticado podia acionar o trigger
--           de soft-delete em qualquer registro de cliente.
-- CORREÇÃO: somente admin pode disparar DELETE (que o trigger
--           converte em soft-delete). Demais usuários continuam
--           podendo fazer UPDATE nos campos de dados.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "empresas_delete" ON public.empresas;
CREATE POLICY "empresas_delete" ON public.empresas
    FOR DELETE TO authenticated
    USING (public.is_admin() AND ativo = TRUE AND deletado_em IS NULL);

DROP POLICY IF EXISTS "licencas_delete" ON public.licencas;
CREATE POLICY "licencas_delete" ON public.licencas
    FOR DELETE TO authenticated
    USING (public.is_admin() AND ativo = TRUE AND deletado_em IS NULL);

DROP POLICY IF EXISTS "alvaras_delete" ON public.alvaras;
CREATE POLICY "alvaras_delete" ON public.alvaras
    FOR DELETE TO authenticated
    USING (public.is_admin() AND ativo = TRUE AND deletado_em IS NULL);

DROP POLICY IF EXISTS "processos_delete" ON public.processos;
CREATE POLICY "processos_delete" ON public.processos
    FOR DELETE TO authenticated
    USING (public.is_admin() AND ativo = TRUE AND deletado_em IS NULL);


-- ================================================================
-- SEÇÃO 3 — MÓDULO RH (schema_rh.sql)
-- ================================================================
-- Dados de folha de ponto são dados pessoais trabalhistas —
-- tratamento protegido pelo Art. 7º, II (obrigação legal) e Art. 46.
--
-- PROBLEMA: qualquer usuário autenticado podia ler, alterar e
--           apagar registros de ponto de QUALQUER funcionário
--           de QUALQUER empresa.
-- CORREÇÃO:
--   SELECT  → mantido aberto (ferramenta interna entre colegas)
--   INSERT  → mantido aberto
--   UPDATE  → somente o criador do registro (usuario_id) ou admin
--   DELETE  → somente admin

DROP POLICY IF EXISTS "rh_saves: leitura autenticado" ON public.rh_saves;
DROP POLICY IF EXISTS "rh_saves: escrita autenticado" ON public.rh_saves;

CREATE POLICY "rh_saves: leitura autenticado"
    ON public.rh_saves FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "rh_saves: insert autenticado"
    ON public.rh_saves FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "rh_saves: update proprio ou admin"
    ON public.rh_saves FOR UPDATE TO authenticated
    USING  (usuario_id = auth.uid() OR public.is_admin())
    WITH CHECK (TRUE);

CREATE POLICY "rh_saves: delete admin"
    ON public.rh_saves FOR DELETE TO authenticated
    USING (public.is_admin());

-- Regras de renomeação e mapeamento são configurações de sistema —
-- DELETE acidental comprometeria todo o módulo Renomeador.
DROP POLICY IF EXISTS "rh_regras: escrita autenticado" ON public.rh_regras_renomeacao;

CREATE POLICY "rh_regras: insert autenticado"
    ON public.rh_regras_renomeacao FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "rh_regras: update autenticado"
    ON public.rh_regras_renomeacao FOR UPDATE TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "rh_regras: delete admin"
    ON public.rh_regras_renomeacao FOR DELETE TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "rh_mapeamento: escrita autenticado" ON public.rh_mapeamento_nomes;

CREATE POLICY "rh_mapeamento: insert autenticado"
    ON public.rh_mapeamento_nomes FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "rh_mapeamento: update autenticado"
    ON public.rh_mapeamento_nomes FOR UPDATE TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "rh_mapeamento: delete admin"
    ON public.rh_mapeamento_nomes FOR DELETE TO authenticated
    USING (public.is_admin());


-- ================================================================
-- SEÇÃO 4 — MÓDULO FORMULÁRIOS (schema_formularios.sql)
-- ================================================================

-- ----------------------------------------------------------------
-- 4.1 Consentimento obrigatório para dados de empregados
-- Art. 7º, I + Art. 11, I: dados sensíveis (raça, dados bancários,
-- informações de saúde implícitas no PIS/PASEP) exigem consentimento
-- específico do titular antes de qualquer coleta.
-- PROBLEMA: anon podia inserir ficha completa de empregado
--           sem que consentimento_lgpd fosse TRUE.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "empregados: anon insert" ON public.empregados;
CREATE POLICY "empregados: anon insert"
    ON public.empregados FOR INSERT TO anon
    WITH CHECK (consentimento_lgpd = TRUE);

-- ----------------------------------------------------------------
-- 4.2 Dados de dependentes — Art. 14 (menores de idade)
-- LGPD exige consentimento específico do responsável legal para
-- tratamento de dados de crianças e adolescentes.
-- ----------------------------------------------------------------
ALTER TABLE public.dependentes
    ADD COLUMN IF NOT EXISTS consentimento_responsavel
        BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.dependentes.consentimento_responsavel IS
    'Art. 14 LGPD: consentimento do responsável legal para tratamento '
    'de dados pessoais do dependente (obrigatório para menores de idade)';

-- ----------------------------------------------------------------
-- 4.3 DELETE físico restrito a admin — Art. 46
-- O fluxo normal usa UPDATE de status = ''excluido'';
-- DELETE físico deve ser exceção controlada (Art. 18, VI).
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "formularios: staff delete"  ON public.formularios;
DROP POLICY IF EXISTS "formularios: anon delete"   ON public.formularios;
CREATE POLICY "formularios: staff delete"
    ON public.formularios FOR DELETE TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "socios: staff delete"       ON public.socios;
DROP POLICY IF EXISTS "socios: anon delete"        ON public.socios;
CREATE POLICY "socios: staff delete"
    ON public.socios FOR DELETE TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "empregados: staff delete"   ON public.empregados;
DROP POLICY IF EXISTS "empregados: anon delete"    ON public.empregados;
CREATE POLICY "empregados: staff delete"
    ON public.empregados FOR DELETE TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "dependentes: staff delete"  ON public.dependentes;
DROP POLICY IF EXISTS "dependentes: anon delete"   ON public.dependentes;
CREATE POLICY "dependentes: staff delete"
    ON public.dependentes FOR DELETE TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "arquivos: staff delete"     ON public.arquivos;
DROP POLICY IF EXISTS "arquivos: anon delete"      ON public.arquivos;
CREATE POLICY "arquivos: staff delete"
    ON public.arquivos FOR DELETE TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------
-- 4.4 Conflito de políticas de Storage — Art. 46
-- PROBLEMA: schema_formularios.sql criou a política
--   "storage documentos: leitura authenticated" com USING(TRUE),
--   que sobrescreve (em OR) a política granular do schema.sql
--   ("documentos: leitura autorizada") que verifica sub-permissões
--   por pasta. Qualquer autenticado passava a ler qualquer documento.
-- CORREÇÃO: remover a política ampla; manter apenas a granular.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "storage documentos: leitura authenticated" ON storage.objects;

-- A política "documentos: leitura autorizada" do schema.sql
-- (que verifica has_gerenciador_permission por subfolder)
-- permanece ativa e é a única para SELECT de autenticados.


-- ================================================================
-- SEÇÃO 5 — MALA DIRETA (schema-mala-direta.sql)
-- ================================================================

-- ----------------------------------------------------------------
-- 5.1 anon SELECT em mala_direta_envios — Art. 6º (necessidade)
-- PROBLEMA: USING(TRUE) expunha TODOS os envios a usuários
--           anônimos, incluindo rascunhos, destinatários e
--           mensagens de campanhas ainda não disparadas.
-- CORREÇÃO: anon só lê envios efetivamente disparados.
--           O token de 32 chars permanece como "senha" do link.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "md_envios_anon_select" ON public.mala_direta_envios;
CREATE POLICY "md_envios_anon_select"
    ON public.mala_direta_envios FOR SELECT TO anon
    USING (status_envio = 'enviado');

-- ----------------------------------------------------------------
-- 5.2 Contatos — DELETE restrito a admin — Art. 46
-- PROBLEMA: qualquer autenticado podia apagar contatos do catálogo,
--           comprometendo o histórico de consentimento/opt-out.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "md_contatos_auth_all" ON public.mala_direta_contatos;

CREATE POLICY "md_contatos_select"
    ON public.mala_direta_contatos FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "md_contatos_insert"
    ON public.mala_direta_contatos FOR INSERT TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "md_contatos_update"
    ON public.mala_direta_contatos FOR UPDATE TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "md_contatos_delete"
    ON public.mala_direta_contatos FOR DELETE TO authenticated
    USING (public.is_admin());


-- ================================================================
-- SEÇÃO 6 — CONFIGURAÇÕES DE CERTIFICADOS
-- ================================================================
-- Art. 46: configurações globais do sistema devem ser alteradas
-- apenas por quem tem responsabilidade administrativa.
-- PROBLEMA: qualquer usuário autenticado inseria e atualizava
--           configurações (pageSize e futuras chaves).

DROP POLICY IF EXISTS "cert_cfg: autenticado grava"    ON public.configuracoes_certificados;
DROP POLICY IF EXISTS "cert_cfg: autenticado atualiza" ON public.configuracoes_certificados;

CREATE POLICY "cert_cfg: admin grava"
    ON public.configuracoes_certificados FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "cert_cfg: admin atualiza"
    ON public.configuracoes_certificados FOR UPDATE
    USING    (public.is_admin())
    WITH CHECK (public.is_admin());

-- Leitura continua aberta para authenticated (necessária para carregar pageSize no app)


-- ================================================================
-- SEÇÃO 7 — CONFIGURAÇÕES SCONT (configuracoes_scont.sql)
-- ================================================================
-- PROBLEMA: política usava inline EXISTS em vez de is_admin() e
--           não tinha WITH CHECK (permitia qualquer admin forçar
--           um valor inconsistente via INSERT direto).

DROP POLICY IF EXISTS "admins_somente" ON public.configuracoes_scont;
CREATE POLICY "admins_somente" ON public.configuracoes_scont
    FOR ALL
    USING    (public.is_admin())
    WITH CHECK (public.is_admin());

COMMENT ON TABLE public.configuracoes_scont IS
    'Configurações operacionais — ATENÇÃO (Art. 46 LGPD): as chaves '
    'smtp_senha e resend_api_key armazenam credenciais em texto claro. '
    'Migrar para Supabase Vault (Settings → Vault) ou variáveis de '
    'ambiente da Edge Function assim que possível.';


-- ================================================================
-- SEÇÃO 8 — APRESENTAÇÕES (apresentacoes.sql)
-- ================================================================
-- Art. 7º + Art. 37: operações de tratamento devem registrar a base
-- legal e a rastreabilidade de criação/atualização.

ALTER TABLE public.apresentacoes
    ADD COLUMN IF NOT EXISTS base_legal TEXT NOT NULL DEFAULT 'execucao_contrato'
        CHECK (base_legal IN (
            'consentimento',
            'execucao_contrato',
            'obrigacao_legal',
            'interesse_legitimo',
            'protecao_vida',
            'tutela_saude',
            'interesse_publico',
            'exercicio_direito'
        )),
    ADD COLUMN IF NOT EXISTS criado_por     TEXT,
    ADD COLUMN IF NOT EXISTS atualizado_em  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS atualizado_por TEXT;

COMMENT ON TABLE public.apresentacoes IS
    'Apresentações personalizadas para clientes — contém dados pessoais '
    '(Art. 5º, I LGPD). Base legal padrão: execução de contrato (Art. 7º, V).';

COMMENT ON COLUMN public.apresentacoes.base_legal IS
    'Art. 7º LGPD: hipótese que autoriza o tratamento dos dados desta apresentação';


-- ================================================================
-- SEÇÃO 9 — fn_alertas_sistema: filtrar certificados inativos
-- ================================================================
-- Certificados com ativo = FALSE representam clientes encerrados.
-- Incluí-los nos alertas gera ruído operacional e pode expor dados
-- desnecessariamente (Art. 6º, III — princípio da necessidade).

DROP FUNCTION IF EXISTS public.fn_alertas_sistema();

CREATE FUNCTION public.fn_alertas_sistema()
RETURNS TABLE (
    categoria  TEXT,
    ferramenta TEXT,
    severidade TEXT,
    titulo     TEXT,
    descricao  TEXT,
    data_ref   TIMESTAMPTZ,
    link       TEXT,
    detalhes   JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$

-- FORMULÁRIOS pendentes
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
        'capital_social',           f.capital_social,
        'metragem',                 f.metragem,
        'iptu',                     f.iptu,
        'cnae_principal',           f.cnae_principal,
        'atividades_secundarias',   f.atividades_secundarias,
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

-- ADMISSÕES pendentes
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
        'cpf',           e.cpf,
        'email',         e.email,
        'celular',       e.celular,
        'telefone',      e.telefone,
        'cargo',         e.cargo,
        'departamento',  e.departamento,
        'nome_empresa',  e.nome_empresa,
        'cnpj_empresa',  e.cnpj_empresa,
        'data_admissao', e.data_admissao,
        'status',        e.status
    )                                    AS detalhes
FROM public.empregados e
WHERE e.status = 'recebido'

UNION ALL

-- EVENTOS RECENTES (últimas 48 h)
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
        'evento',         h.campo,
        'valor_anterior', h.valor_anterior,
        'valor_novo',     h.valor_novo,
        'editado_por',    h.editado_por,
        'registro_id',    h.registro_id::TEXT,
        'tabela',         h.tabela
    )                                    AS detalhes
FROM public.historico_edicoes h
WHERE h.editado_em > NOW() - INTERVAL '48 hours'
  AND h.campo IN ('EVENTO_EDICAO', 'EVENTO_EXCLUSAO')

UNION ALL

-- CERTIFICADOS DIGITAIS (excluir inativos — COALESCE para registros anteriores à coluna)
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
        'tipo_id',                 c.tipo_id,
        'cpf_cnpj',                c.cpf_cnpj,
        'data_emissao',            c.data_emissao,
        'data_vencimento',         c.data_vencimento,
        'situacao',                c.situacao,
        'data_renovacao_agendada', c.data_renovacao_agendada,
        'responsavel_nome',        c.responsavel_nome,
        'responsavel_email',       c.responsavel_email,
        'responsavel_telefone',    c.responsavel_telefone,
        'informacoes_adicionais',  c.informacoes_adicionais,
        'observacao_risco',        c.observacao_risco
    )                                    AS detalhes
FROM public.certificados c
WHERE c.deleted_at IS NULL
  AND COALESCE(c.ativo, TRUE) = TRUE     -- exclui certificados/clientes inativos
  AND c.situacao <> 'Renovado'
  AND c.data_vencimento IS NOT NULL
  AND c.data_vencimento <= NOW() + INTERVAL '30 days'

UNION ALL

-- LICENÇAS vencendo em 30 dias
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

-- ALVARÁS vencendo em 30 dias
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

-- PORTAL — solicitações de acesso pendentes
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


-- ================================================================
-- SEÇÃO 10 — COMMENTS DE GOVERNANÇA (Art. 37 + Art. 50)
-- Documentação das tabelas com dados pessoais e bases legais.
-- ================================================================

COMMENT ON TABLE public.solicitacoes_acesso IS
    'Dados pessoais de solicitantes de acesso ao portal. '
    'Base legal: execução de contrato (Art. 7º, V LGPD). '
    'Retenção: enquanto durar o vínculo contratual.';

COMMENT ON TABLE public.usuarios IS
    'Espelho de auth.users — dados de acesso e perfil. '
    'Base legal: execução de contrato (Art. 7º, V LGPD).';

COMMENT ON TABLE public.mala_direta_contatos IS
    'Dados pessoais de destinatários de campanhas (nome, e-mail, telefone). '
    'Base legal: consentimento ou legítimo interesse (Art. 7º, I e IX LGPD). '
    'Direito de exclusão: titular pode solicitar remoção ao DPO.';

COMMENT ON TABLE public.empregados IS
    'Dados pessoais e SENSÍVEIS de empregados (Art. 11 LGPD): '
    'raça (campo raca), dados bancários, dados familiares. '
    'Base legal: obrigação legal / contrato de trabalho (Art. 7º, II e V). '
    'Consentimento LGPD obrigatório antes do INSERT.';

COMMENT ON TABLE public.dependentes IS
    'Dados pessoais de dependentes — pode conter dados de menores. '
    'Art. 14 LGPD: exige consentimento específico do responsável legal. '
    'Campo consentimento_responsavel deve ser TRUE antes do INSERT.';

COMMENT ON TABLE public.socios IS
    'Dados pessoais de sócios (CPF, endereço, estado civil). '
    'Base legal: obrigação legal / execução de contrato (Art. 7º, II e V LGPD).';

COMMENT ON TABLE public.mala_direta_envios IS
    'Registro de disparos de campanhas — contém snapshot de dados pessoais '
    'no momento do envio (nome, e-mail, telefone, mensagem personalizada). '
    'Base legal: legítimo interesse ou consentimento (Art. 7º, I e IX LGPD).';


-- ================================================================
-- VERIFICAÇÃO — execute após a migração para confirmar as políticas
-- ================================================================
-- SELECT tablename, policyname, roles, cmd, qual
--   FROM pg_policies
--  WHERE schemaname = 'public'
--  ORDER BY tablename, cmd;
--
-- SELECT tablename, rowsecurity
--   FROM pg_tables
--  WHERE schemaname = 'public';
-- ================================================================


-- ================================================================
-- AVISOS DE SEGURANÇA — Art. 46 LGPD
-- Ações manuais recomendadas (não executáveis via SQL)
-- ================================================================
--
-- ⚠️  CREDENCIAIS EM PLAINTEXT (Risco Alto)
--     configuracoes_scont.smtp_senha e configuracoes_scont.resend_api_key
--     estão armazenadas como texto simples. Qualquer usuário com acesso
--     ao service_role (painel Supabase) pode lê-las.
--     → Migrar para: Supabase → Settings → Vault (secrets gerenciados)
--       ou variáveis de ambiente da Edge Function enviar-email.
--
-- ⚠️  SENHA DE CERTIFICADO EM BASE64 (Risco Alto)
--     certificados.senha_hash usa btoa() — base64 é REVERSÍVEL,
--     não é criptografia. Qualquer admin com SELECT na tabela
--     recupera a senha original com atob().
--     → Opção A: remover o campo (sistema apenas como rastreador de prazos)
--     → Opção B: usar pgcrypto com chave gerenciada:
--         UPDATE public.certificados
--            SET senha_hash = encode(
--                encrypt(senha_hash::bytea, 'chave-secreta'::bytea, 'aes'),
--                'base64'
--            );
--       (migração destrutiva — requer janela de manutenção)
--
-- ================================================================
