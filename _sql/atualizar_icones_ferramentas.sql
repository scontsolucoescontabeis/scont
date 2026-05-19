-- ============================================================
-- SCONT – Atualização de ícones das ferramentas
-- Execute no SQL Editor do Supabase (projeto principal)
-- ============================================================

-- Folha de Ponto → relógio com presença
UPDATE public.ferramentas SET icone = '🗓️'
WHERE nome = 'Folha de Ponto';

-- Lançamentos de Folha → lista com cifrão
UPDATE public.ferramentas SET icone = '💸'
WHERE nome = 'Lançamentos de Folha';

-- Renomeador de Arquivos → pasta com lápis
UPDATE public.ferramentas SET icone = '🗂️'
WHERE nome = 'Renomeador de Arquivos';

-- Admin – Módulo RH → pessoas / equipe
UPDATE public.ferramentas SET icone = '👥'
WHERE nome = 'Admin – Módulo RH';

-- Gerenciador de Formulários → fichário
UPDATE public.ferramentas SET icone = '🗃️'
WHERE nome = 'Gerenciador de Formulários';

-- Formulário de Registro de Empresa → prédio comercial
UPDATE public.ferramentas SET icone = '🏢'
WHERE nome = 'Formulário de Registro de Empresa';

-- Formulário de Alteração de Empresa → lápis / edição
UPDATE public.ferramentas SET icone = '✏️'
WHERE nome = 'Formulário de Alteração de Empresa';

-- Formulário de Admissão de Empregado → crachá
UPDATE public.ferramentas SET icone = '🪪'
WHERE nome = 'Formulário de Admissão de Empregado';

-- Certificado Digital → medalha / selo
UPDATE public.ferramentas SET icone = '🏅'
WHERE nome = 'Certificado Digital';

-- Portal de Boas-Vindas → aperto de mão
UPDATE public.ferramentas SET icone = '🤝'
WHERE nome = 'Portal de Boas-Vindas';

-- Simulador de Folha de Pagamento → gráfico financeiro
UPDATE public.ferramentas SET icone = '💹'
WHERE nome = 'Simulador de Folha de Pagamento';

-- Mala Direta → envelope com seta
UPDATE public.ferramentas SET icone = '📧'
WHERE nome = 'Mala Direta';

-- Central de Alertas → sirene
UPDATE public.ferramentas SET icone = '🚨'
WHERE nome = 'Central de Alertas';

-- Gerador de Modelos → documento com marcadores
UPDATE public.ferramentas SET icone = '📑'
WHERE nome = 'Gerador de Modelos';

-- Fechamento Folha de Pagamento → inserir se não existir
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
VALUES (
    'Fechamento Folha de Pagamento',
    'Processamento e fechamento da folha de pagamento por empresa com geração de TXT',
    '💼',
    './Projeto Fechamento Folha/index.html',
    TRUE,
    15
)
ON CONFLICT DO NOTHING;

-- Atualizar ícone do Fechamento Folha (mesmo que já exista com ícone antigo)
UPDATE public.ferramentas SET icone = '💼'
WHERE nome = 'Fechamento Folha de Pagamento';
