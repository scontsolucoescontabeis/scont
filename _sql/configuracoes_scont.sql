-- ============================================================
-- TABELA: configuracoes_scont
-- Armazena configurações globais de email e WhatsApp da SCONT
-- Execute este script no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.configuracoes_scont (
    chave          TEXT PRIMARY KEY,
    valor          TEXT,
    descricao      TEXT,
    atualizado_em  TIMESTAMPTZ DEFAULT now(),
    atualizado_por TEXT
);

-- Row Level Security
ALTER TABLE public.configuracoes_scont ENABLE ROW LEVEL SECURITY;

-- Somente administradores podem ler e modificar
CREATE POLICY "admins_somente" ON public.configuracoes_scont
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Dados iniciais
INSERT INTO public.configuracoes_scont (chave, valor, descricao) VALUES
    -- Geral
    ('email_remetente',  '',                         'Endereço de e-mail remetente'),
    ('nome_remetente',   'Scont Soluções Contábeis', 'Nome exibido como remetente'),
    -- Seleção de provedor
    ('email_provedor',   'resend',                   'Provedor de e-mail ativo: "resend" ou "smtp"'),
    -- Resend
    ('resend_api_key',   '',                         'API Key do Resend (resend.com → API Keys)'),
    -- SMTP (Outlook, Gmail, etc.)
    ('smtp_host',        'smtp-mail.outlook.com',    'Servidor SMTP. Outlook: smtp-mail.outlook.com | Gmail: smtp.gmail.com'),
    ('smtp_porta',       '587',                      'Porta SMTP. STARTTLS: 587 | SSL: 465'),
    ('smtp_usuario',     '',                         'Usuário/e-mail para autenticação SMTP'),
    ('smtp_senha',       '',                         'Senha ou App Password do SMTP'),
    ('smtp_seguranca',   'STARTTLS',                 'Segurança: "STARTTLS" (porta 587) ou "SSL" (porta 465)'),
    -- WhatsApp
    ('whatsapp_numero',  '',                         'Número WhatsApp SCONT com DDI, sem + ou espaços (ex: 5561999999999)')
ON CONFLICT (chave) DO NOTHING;

-- ── Se a tabela já existia (sem os campos SMTP), execute apenas o bloco abaixo:
-- INSERT INTO public.configuracoes_scont (chave, valor, descricao) VALUES
--     ('email_provedor', 'resend', 'Provedor de e-mail ativo: "resend" ou "smtp"'),
--     ('smtp_host',      'smtp-mail.outlook.com', 'Servidor SMTP'),
--     ('smtp_porta',     '587', 'Porta SMTP'),
--     ('smtp_usuario',   '', 'Usuário/e-mail SMTP'),
--     ('smtp_senha',     '', 'Senha SMTP'),
--     ('smtp_seguranca', 'STARTTLS', 'Segurança SMTP')
-- ON CONFLICT (chave) DO NOTHING;
