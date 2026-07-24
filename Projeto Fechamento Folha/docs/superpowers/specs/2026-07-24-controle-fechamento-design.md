# Controle de Fechamento da Folha — Design

**Data:** 2026-07-24
**Status:** Aprovado

## Contexto e objetivo

As ferramentas de fechamento de folha (Quadrante, Track & Field, Anankê, ...) já estão em produção. Falta uma ferramenta que controle o **processo** de fechamento durante sua execução mensal: quais empresas têm folha, em que fase cada uma está, quem é o responsável, e o status geral (não iniciada / em execução / fechada).

Este módulo é **novo e separado** do `fluxo.html` existente (que é genérico, local-storage, sem conceito de empresa/responsável — permanece intocado).

## Fora de escopo (v1)

- Histórico de competências passadas (dado fica salvo no banco, mas sem tela de navegação por mês).
- Notificações/alertas de prazo.
- Permissão restrita por responsável (qualquer usuário autenticado pode atualizar status de qualquer empresa).
- Delegação por fase (delegação é só por empresa/ciclo, um responsável para o processo todo).

## Reaproveitamento de dados existentes

- **Empresas:** `public.rh_empresas` (`codigo_empresa`, `nome_empresa`) — cadastro-mestre já usado por RH/Benefícios/Escala. Uma empresa só aparece no Dashboard deste módulo depois de ter ao menos uma fase configurada (sem flag extra).
- **Usuários/equipe:** `public.usuarios` (`id`, `nome`, `email`, `is_admin`) do projeto Portal Supabase — usada para o dropdown de responsável e para checar `is_admin` (acesso à tela de Configuração).

## Modelo de dados (Supabase — projeto Portal, `SUPABASE_URL`/`SUPABASE_KEY`)

```sql
fechamento_fases_catalogo        -- catálogo global sugerido (as 10 fases padrão), só apoio de UI
  id              UUID PK
  nome            TEXT
  ordem_padrao    INT
  ativo           BOOLEAN

fechamento_config_empresa_fase   -- fluxo de fases de CADA empresa (editado na tela de Configuração)
  id              UUID PK
  codigo_empresa  TEXT
  nome_fase       TEXT
  ordem           INT
  ativo           BOOLEAN

fechamento_ciclo                 -- 1 linha por empresa x competência (criado ao "Iniciar fechamento")
  id              UUID PK
  codigo_empresa  TEXT
  competencia     TEXT            -- formato 'MM/AAAA'
  responsavel_id  UUID NULL       -- -> usuarios.id
  iniciado_em     TIMESTAMPTZ
  concluido_em    TIMESTAMPTZ NULL
  UNIQUE (codigo_empresa, competencia)

fechamento_ciclo_fase            -- fases do ciclo, geradas a partir da config no momento do "Iniciar"
  id              UUID PK
  ciclo_id        UUID -> fechamento_ciclo
  nome_fase       TEXT
  ordem           INT
  status          TEXT CHECK IN ('pendente','andamento','concluida') DEFAULT 'pendente'
  atualizado_em   TIMESTAMPTZ
```

RLS em todas as tabelas novas: `TO authenticated USING (TRUE) WITH CHECK (TRUE)` — mesmo padrão já usado em `fechamento_rubricas_config`, `quadrante_folha_rascunho`, etc.

### Catálogo padrão (seed inicial de `fechamento_fases_catalogo`)

1. Apuração da Frequência
2. Lançamento na Domínio
3. Geração da Prévia
4. Validação Cliente
5. Fechamento eSocial e Relatórios
6. Guia FGTS
7. Guia Previdenciária
8. Onvio - Gestta
9. Servidor
10. Geração dos Benefícios - VA e VT

### Cálculo de status (não é coluna gravada, é derivado)

- Sem `fechamento_ciclo` para a competência atual → **"Não iniciada"** (dashboard mostra botão "Iniciar fechamento").
- Ciclo existe, alguma fase não concluída → **"Em execução"**.
- Ciclo existe, todas as fases concluídas → **"Fechada"** (grava `concluido_em` automaticamente na transição).

## Telas

### Dashboard — `controle.html` (padrão)

Tabela com uma linha por empresa configurada:

| Empresa | Competência aberta | Status (badge) | Responsável (dropdown) | Progresso (x/y fases) | Ação |

- Empresa sem ciclo aberto: botão "Iniciar fechamento de MM/AAAA" (competência = mês corrente).
- Clique na linha expande e lista as fases em ordem, cada uma com seletor de 3 estados (Pendente / Em andamento / Concluída).
- Dropdown de responsável escreve direto em `fechamento_ciclo.responsavel_id` (só existe quando há ciclo aberto).

### Configuração — `controle.html?tela=config` (só admin)

- Bloqueada por `usuarios.is_admin` (guarda na tela + link escondido no sidebar para não-admin).
- Por empresa: checkboxes das fases do catálogo, reordenação com setas ↑/↓ (mesmo padrão de `fluxo.html`), e campo "+ nova fase" (texto livre — vale só para aquela empresa, não é adicionado ao catálogo global).
- Salvar substitui as linhas de `fechamento_config_empresa_fase` daquela empresa.

## Integração no portal

- Novo item no sidebar/grid de `Projeto Fechamento Folha/index.html`: "Controle de Fechamento", seguindo o mesmo padrão visual (paleta, cards) das demais ferramentas.
- Autenticação via `portal-auth-guard.js` (`PortalAuthGuard.init(1, { returnAfterLogin: true })`), igual às outras telas do módulo.

## Erros e casos de borda

- Tentar iniciar um ciclo para uma competência que já existe → bloqueado pela `UNIQUE (codigo_empresa, competencia)` + checagem na UI antes de tentar o insert.
- Empresa sem nenhuma fase configurada não aparece no Dashboard (evita linha vazia sem ação possível).
- Falha ao buscar `rh_empresas`/`usuarios` → banner de erro inline, mesmo padrão das outras telas do projeto.

## Ação manual pendente

O SQL (`schema_controle_fechamento.sql`) precisa ser executado manualmente pelo usuário no SQL Editor do Supabase (projeto Portal) — mesma limitação já registrada para `schema_rubricas_replicar_453_para_457.sql`: só há anon key disponível, sem sessão autenticada via RLS para rodar DDL.
