-- ============================================================
-- SCONT - PORTAL DE APLICAÇÕES
-- Schema Supabase completo
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================


-- ============================================================
-- 1. TABELA: usuarios
--    Espelho do auth.users com dados extras e flag is_admin
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: cria linha em usuarios automaticamente ao criar usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.usuarios (id, nome, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 1b. FUNÇÃO AUXILIAR: is_admin()
--     SECURITY DEFINER = executa como dono da função, sem RLS,
--     evitando recursão infinita nas policies de usuarios.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE(
        (SELECT is_admin FROM public.usuarios WHERE id = auth.uid()),
        FALSE
    );
$$;


-- ============================================================
-- 2. TABELA: solicitacoes_acesso
--    Registro de pedidos de acesso ao portal (pendente / aprovado / rejeitado)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.solicitacoes_acesso (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                TEXT NOT NULL,
    email               TEXT NOT NULL,
    empresa             TEXT,
    cargo               TEXT,
    telefone            TEXT,
    status              TEXT NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    motivo_rejeicao     TEXT,
    data_solicitacao    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_avaliacao      TIMESTAMPTZ,
    avaliado_por        TEXT,       -- e-mail do admin que avaliou

    CONSTRAINT solicitacoes_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_status  ON public.solicitacoes_acesso (status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_email   ON public.solicitacoes_acesso (email);


-- ============================================================
-- 3. TABELA: ferramentas
--    Catálogo de ferramentas/aplicações disponíveis no portal
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ferramentas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL,
    descricao   TEXT,
    icone       TEXT,                   -- emoji ou URL de ícone
    url_base    TEXT,                   -- URL que será aberta ao clicar
    ativa       BOOLEAN NOT NULL DEFAULT TRUE,
    ordem       INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ferramentas_ativa ON public.ferramentas (ativa);
CREATE INDEX IF NOT EXISTS idx_ferramentas_ordem ON public.ferramentas (ordem);


-- ============================================================
-- 4. TABELA: usuario_ferramentas
--    Relação N:N — quais ferramentas cada usuário pode acessar
--    usuario_id aponta para solicitacoes_acesso.id
--    (o ID que fica salvo no sessionStorage do frontend)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuario_ferramentas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID NOT NULL REFERENCES public.solicitacoes_acesso(id) ON DELETE CASCADE,
    ferramenta_id   UUID NOT NULL REFERENCES public.ferramentas(id) ON DELETE CASCADE,
    data_acesso     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT usuario_ferramenta_unique UNIQUE (usuario_id, ferramenta_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_ferramentas_usuario    ON public.usuario_ferramentas (usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_ferramentas_ferramenta ON public.usuario_ferramentas (ferramenta_id);


-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
--    Controle de acesso a nível de linha no banco
-- ============================================================

-- 5.1 usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios: leitura própria" ON public.usuarios;
CREATE POLICY "usuarios: leitura própria"
    ON public.usuarios FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "usuarios: admin lê todos" ON public.usuarios;
CREATE POLICY "usuarios: admin lê todos"
    ON public.usuarios FOR SELECT
    USING (
        public.is_admin()
    );

DROP POLICY IF EXISTS "usuarios: admin atualiza" ON public.usuarios;
CREATE POLICY "usuarios: admin atualiza"
    ON public.usuarios FOR UPDATE
    USING (
        public.is_admin()
    );


-- 5.2 solicitacoes_acesso
ALTER TABLE public.solicitacoes_acesso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solicitacoes: inserir cadastro" ON public.solicitacoes_acesso;
CREATE POLICY "solicitacoes: inserir cadastro"
    ON public.solicitacoes_acesso FOR INSERT
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "solicitacoes: leitura própria" ON public.solicitacoes_acesso;
CREATE POLICY "solicitacoes: leitura própria"
    ON public.solicitacoes_acesso FOR SELECT
    USING (email = auth.email());

DROP POLICY IF EXISTS "solicitacoes: admin lê tudo" ON public.solicitacoes_acesso;
CREATE POLICY "solicitacoes: admin lê tudo"
    ON public.solicitacoes_acesso FOR SELECT
    USING (
        public.is_admin()
    );

DROP POLICY IF EXISTS "solicitacoes: admin atualiza" ON public.solicitacoes_acesso;
CREATE POLICY "solicitacoes: admin atualiza"
    ON public.solicitacoes_acesso FOR UPDATE
    USING (
        public.is_admin()
    );

DROP POLICY IF EXISTS "solicitacoes: admin deleta" ON public.solicitacoes_acesso;
CREATE POLICY "solicitacoes: admin deleta"
    ON public.solicitacoes_acesso FOR DELETE
    USING (
        public.is_admin()
    );


-- 5.3 ferramentas
ALTER TABLE public.ferramentas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ferramentas: autenticado lê ativas" ON public.ferramentas;
CREATE POLICY "ferramentas: autenticado lê ativas"
    ON public.ferramentas FOR SELECT
    USING (auth.role() = 'authenticated' AND ativa = TRUE);

DROP POLICY IF EXISTS "ferramentas: admin gerencia" ON public.ferramentas;
CREATE POLICY "ferramentas: admin gerencia"
    ON public.ferramentas FOR ALL
    USING (
        public.is_admin()
    );


-- 5.4 usuario_ferramentas
ALTER TABLE public.usuario_ferramentas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uf: leitura própria" ON public.usuario_ferramentas;
CREATE POLICY "uf: leitura própria"
    ON public.usuario_ferramentas FOR SELECT
    USING (
        usuario_id IN (
            SELECT id FROM public.solicitacoes_acesso
            WHERE email = auth.email()
        )
    );

DROP POLICY IF EXISTS "uf: admin gerencia" ON public.usuario_ferramentas;
CREATE POLICY "uf: admin gerencia"
    ON public.usuario_ferramentas FOR ALL
    USING (
        public.is_admin()
    );


-- ============================================================
-- 6. DADOS INICIAIS
--    Crie o primeiro admin manualmente depois de criar a conta
--    no Supabase Auth. Substitua o e-mail abaixo.
-- ============================================================

-- Passo 1: crie o usuário pelo painel Auth do Supabase (ou via signup)
-- Passo 2: execute este UPDATE com o e-mail do admin:
--
-- UPDATE public.usuarios
-- SET is_admin = TRUE
-- WHERE email = 'admin@scontdf.com.br';


-- ============================================================
-- 7. FERRAMENTAS DE EXEMPLO
--    Remova ou adapte conforme necessário
-- ============================================================
-- Módulo RH
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem) VALUES
    ('Folha de Ponto',
     'Lançamento e controle de horas trabalhadas por competência',
     '🕐', './Projeto RH/index.html', TRUE, 10),

    ('Lançamentos de Folha',
     'Lançamento em lote de eventos na folha de pagamento',
     '📋', './Projeto RH/lancamentos.html', TRUE, 20),

    ('Renomeador de Arquivos',
     'Renomeação automática e organização de arquivos de folha',
     '📂', './Projeto RH/renomeador.html', TRUE, 30),

    ('Admin – Módulo RH',
     'Gerenciamento de empresas, empregados, rubricas e regras do módulo RH',
     '⚙️', './Projeto RH/admin.html', TRUE, 40),

    ('Gerenciador de Formulários',
     'Visualização e gestão de formulários de registro e alteração de empresa',
     '📊', './Projeto Gerenciador Formularios/index.html', TRUE, 50),

    ('Formulário de Registro de Empresa',
     'Preenchimento do formulário de abertura de nova empresa',
     '🏢', './Projeto Gerenciador Formularios/formulario_registro.HTML', TRUE, 60),

    ('Formulário de Alteração de Empresa',
     'Preenchimento do formulário de alteração de dados empresariais',
     '📝', './Projeto Gerenciador Formularios/formulario_alteracao.html', TRUE, 70),

    ('Formulário de Admissão de Empregado',
     'Ficha de admissão de novo empregado',
     '👤', './Projeto Gerenciador Formularios/formulario_empregado.html', TRUE, 80),

    ('Certificado Digital',
     'Gestão e emissão de certificados digitais',
     '🔐', './Projeto Certificado Digital/index.html', TRUE, 90),

    ('Portal de Boas-Vindas',
     'Envio de mensagens e materiais de boas-vindas a novos clientes',
     '👋', './Projeto Boas Vindas/index.html', TRUE, 100),

    ('Simulador de Folha de Pagamento',
     'Simulação e comparação de cenários de folha de pagamento por regime tributário',
     '🧮', './Projeto Simulador Folha/index.html', TRUE, 110)

ON CONFLICT DO NOTHING;


-- ============================================================
-- 8. REALTIME
--    Habilitar Realtime nas tabelas que o portal.html observa.
--    O portal usa subscribeFerramentas() para atualizar o grid
--    automaticamente quando admin concede/revoga acesso ou
--    cria/edita/remove uma ferramenta.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'usuario_ferramentas'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.usuario_ferramentas;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'ferramentas'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ferramentas;
    END IF;
END $$;


-- ============================================================
-- RESUMO DAS TABELAS
-- ============================================================
--
--  auth.users              (gerenciado pelo Supabase Auth)
--       │
--       ├──► usuarios         id = auth.users.id, is_admin
--       │
--       └──► solicitacoes_acesso   cadastro + aprovação (status)
--                 │
--                 └──► usuario_ferramentas ◄──── ferramentas
--
-- Fluxo:
--   1. Usuário se cadastra → linha em solicitacoes_acesso (status='pendente')
--   2. Admin aprova → status='aprovado' + linhas em usuario_ferramentas
--   3. Usuário faz login → portal busca usuario_ferramentas pelo id da solicitação
--   4. Portal exibe só as ferramentas autorizadas
--
-- ============================================================
