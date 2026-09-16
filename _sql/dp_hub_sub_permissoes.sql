-- ============================================================================
-- Sub-permissões individuais para as ferramentas dentro do hub
-- "Departamento Pessoal" — inclusive a tela de Configurações.
--
-- Mesmo mecanismo genérico já usado por outras ferramentas do portal
-- (ferramentas.sub_permissoes / usuario_ferramentas.permissoes — ver
-- _sql/certificados_ver_senhas.sql). A tela de aprovação/edição de acesso
-- em admin-dashboard.html já lê sub_permissoes automaticamente e renderiza
-- um checkbox por chave — nenhuma mudança de UI é necessária lá.
--
-- Array vazio em usuario_ferramentas.permissoes continua significando
-- "acesso total" (compatibilidade retroativa): quem já tem o hub concedido
-- sem sub-permissões marcadas continua enxergando todas as ferramentas,
-- exatamente como hoje.
--
-- Idempotente: pode ser rodado mais de uma vez sem duplicar chaves.
-- ============================================================================

UPDATE public.ferramentas
SET sub_permissoes = '[
    {"key":"frequencia",     "label":"Controle de Frequência - Ponto"},
    {"key":"lancamentos",    "label":"Lançamentos de Folha"},
    {"key":"simulador",      "label":"Simulador de Folha de Pagamento"},
    {"key":"fechamento",     "label":"Fechamento Folha de Pagamento"},
    {"key":"validacao",      "label":"Validação de Fechamento de Folha"},
    {"key":"calendario",     "label":"Calendário da Folha"},
    {"key":"fluxos",         "label":"Fluxos Operacionais"},
    {"key":"configuracoes",  "label":"Configurações"}
]'::jsonb
WHERE nome = 'Departamento Pessoal';
