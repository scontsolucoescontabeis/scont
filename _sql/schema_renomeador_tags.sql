-- ============================================================
-- Renomeador — tags de renomeação como dados (rh_renomeador_tags)
-- Leitura: qualquer usuário autenticado (portal web e app desktop).
-- Escrita: somente administradores (public.is_admin()).
-- O código do Renomeador tem um conjunto embutido de fallback, então a
-- ferramenta continua funcionando antes/sem este SQL — mas as tags novas
-- ({CNPJ}, {DD}, {COMPETENCIA_GERACAO}, {MM-1}, {AAAA-1}) só passam a ser
-- gerenciáveis depois de rodar este script.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rh_renomeador_tags (
    nome           TEXT PRIMARY KEY,                 -- sem chaves: 'CNPJ', 'MM-1'
    descricao      TEXT NOT NULL DEFAULT '',
    regex_de       TEXT,                             -- regex inserida no padrão DE (NULL = não vale no DE)
    grupo_de       TEXT,                             -- grupo nomeado usado por empresa_chave
    empresa_chave  TEXT CHECK (empresa_chave IN ('codigo_empresa', 'cnpj')),
    tipo_para      TEXT NOT NULL DEFAULT 'nenhum'
                   CHECK (tipo_para IN ('nenhum', 'captura', 'empresa_campo', 'mapeamento', 'competencia')),
    config_para    JSONB NOT NULL DEFAULT '{}'::jsonb,
    ativo          BOOLEAN NOT NULL DEFAULT TRUE,
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rh_renomeador_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_renomeador_tags_select" ON public.rh_renomeador_tags;
CREATE POLICY "rh_renomeador_tags_select" ON public.rh_renomeador_tags
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "rh_renomeador_tags_admin_write" ON public.rh_renomeador_tags;
CREATE POLICY "rh_renomeador_tags_admin_write" ON public.rh_renomeador_tags
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Tags iniciais (não sobrescreve se já existirem)
INSERT INTO public.rh_renomeador_tags (nome, descricao, regex_de, grupo_de, empresa_chave, tipo_para, config_para) VALUES
 ('CODIGO_EMPRESA', 'Extrai o código (DE) ou insere o código (PARA).', '(?<codigo>\d+)', 'codigo', 'codigo_empresa', 'empresa_campo', '{"campo":"codigo_empresa"}'),
 ('NOME_EMPRESA', 'Insere o nome da empresa (apenas no PARA).', NULL, NULL, NULL, 'empresa_campo', '{"campo":"nome_empresa"}'),
 ('NOME_ARQUIVO', 'Extrai o nome original (DE).', '(?<nome>.+?)', 'nome', NULL, 'captura', '{"grupo":"nome"}'),
 ('NOME_DOCUMENTO', 'Insere o nome mapeado (apenas no PARA). Requer cadastro no passo 2.', NULL, NULL, NULL, 'mapeamento', '{"grupo":"nome"}'),
 ('MM', 'Mês da competência (2 dígitos).', '(?<mes>\d{2})', 'mes', NULL, 'competencia', '{"campo":"mes","deslocamento":0}'),
 ('AAAA', 'Ano da competência (4 dígitos).', '(?<ano>\d{4})', 'ano', NULL, 'competencia', '{"campo":"ano","deslocamento":0}'),
 ('DD', 'Dia (2 dígitos). No DE extrai o dia do nome; no PARA insere o dia extraído.', '(?<dia>\d{2})', 'dia', NULL, 'captura', '{"grupo":"dia"}'),
 ('CNPJ', 'Extrai o CNPJ (DE), com ou sem máscara, e identifica a empresa por ele. No PARA insere o CNPJ cadastrado.', '(?<cnpj>\d{2}\.?\d{3}\.?\d{3}[\/_-]?\d{4}[-_]?\d{2})', 'cnpj', 'cnpj', 'empresa_campo', '{"campo":"cnpj"}'),
 ('COMPETENCIA_GERACAO', 'Competência de geração do arquivo (DE), formato MMAAAA (aceita - _ . entre mês e ano).', '(?<gerMes>\d{2})[-_.]?(?<gerAno>\d{4})', NULL, NULL, 'nenhum', '{}'),
 ('MM-1', 'Mês anterior (apenas no PARA). Parte da competência de geração, se houver no DE; senão da competência informada.', NULL, NULL, NULL, 'competencia', '{"campo":"mes","deslocamento":-1,"grupo_mes":"gerMes","grupo_ano":"gerAno"}'),
 ('AAAA-1', 'Ano do mês anterior (apenas no PARA). Em janeiro, é o ano anterior.', NULL, NULL, NULL, 'competencia', '{"campo":"ano","deslocamento":-1,"grupo_mes":"gerMes","grupo_ano":"gerAno"}'),
 ('IGNORAR', 'Ignora uma parte do texto original (apenas no DE).', '.*?', NULL, NULL, 'nenhum', '{}')
ON CONFLICT (nome) DO NOTHING;
