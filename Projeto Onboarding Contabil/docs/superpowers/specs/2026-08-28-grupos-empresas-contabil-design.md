# Grupos de Empresas no Departamento Contábil

Data: 2026-08-28

## Objetivo

Trazer os "Grupos de Empresas" (hoje só no Controle de Frequência do Projeto RH)
para a tela de Configurações do Departamento Contábil, como uma subtela que
reflete a **mesma tabela** do RH. Criar/editar grupos deve funcionar nos dois
lugares. No módulo contábil, cada grupo tem um checkbox que define se ele é
usado como filtro nas ferramentas do Departamento Contábil.

## Contexto

- RH e Departamento Contábil usam o **mesmo projeto Supabase**
  (`supabase-config.js`). As tabelas `rh_grupos_empresas` e
  `rh_grupos_empresas_itens` já têm RLS `authenticated` para leitura/escrita.
- Colunas de `rh_grupos_empresas`: `id`, `nome_grupo` (UNIQUE), `observacoes`,
  `email_responsavel`, `criado_em`.
- `rh_grupos_empresas_itens`: `id`, `grupo_id` (FK CASCADE), `codigo_empresa`,
  UNIQUE (grupo_id, codigo_empresa).
- RH (`Projeto RH/script.js` ~2494-2735): lista à esquerda + editor à direita
  (nome, e-mail responsável, empresas com busca/add/remove, observações,
  salvar/excluir) + ações em lote **específicas do RH** (baixar modelos,
  processar lote, exportar TXT).
- Configurações contábil (`configuracoes.js`): página única com blocos
  `mapa-secao`. Sem abas.
- Consumidores (`mapeamento.js`, `diario.js`, `diario-relatorios.js`,
  `onboarding.js`): carregam `rh_empresas` + `contabil_empresas_config`,
  filtram para ativas + `possui_contabil` (+ restrição por responsável), e
  têm um objeto de filtro com `<select>`/busca e um predicado `.filter()`.
- SQL dos contábil fica em `Projeto Portal Scont/_sql/`, rodado manualmente.

## Decisões

1. **Layout na Configurações:** nova seção `mapa-secao` "Grupos de Empresas"
   após "Empresas com Contábil" (mantém padrão de página única).
2. **Edição:** paridade total com o RH (criar, renomear, add/remove empresas,
   observações, e-mail responsável, excluir). **Sem** as ações em lote do RH.
3. **Flag "usar no contábil":** opt-in. Nova tabela `contabil_grupos_config`;
   ausência de linha = `false`.
4. **Consumo do flag:** filtro "Grupo de Empresas" em Mapeamento Estratégico,
   Relatórios do Diário, Visão Geral do Diário e Onboarding.
5. **Combinação com `possui_contabil`:** interseção — o filtro de grupo só
   restringe ainda mais o conjunto já exibido.

## Componentes

### 1. Tabela `contabil_grupos_config`

`_sql/schema_contabil_grupos_config.sql` (molde de `schema_contabil_empresas_config.sql`):

```sql
CREATE TABLE IF NOT EXISTS public.contabil_grupos_config (
    grupo_id      UUID PRIMARY KEY REFERENCES public.rh_grupos_empresas(id) ON DELETE CASCADE,
    usar_contabil BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- RLS `authenticated` leitura/escrita.
- Trigger `updated_at` automático.
- `ON DELETE CASCADE`: excluir o grupo (em qualquer tela) limpa a config.

### 2. Módulo `contabil-grupos.js` (novo)

Na pasta do projeto contábil. IIFE que expõe `window.ContabilGrupos`. Estado
em cache no módulo.

- `carregar(supabaseClient)` — `Promise.all` de `rh_grupos_empresas`
  (id, nome_grupo, observacoes, email_responsavel), `rh_grupos_empresas_itens`
  (grupo_id, codigo_empresa) e `contabil_grupos_config` (grupo_id, usar_contabil).
  Monta e cacheia `_grupos = [{ id, nome_grupo, observacoes, email_responsavel,
  empresas:Set<codigo>, usarContabil }]` ordenado por `nome_grupo`.
- `todos()` — cópia de `_grupos`.
- `contabil()` — `_grupos.filter(g => g.usarContabil)`.
- `codigosDoGrupo(id)` — `Set` de `codigo_empresa` (vazio se não achar).
- `filtrarPorGrupo(lista, codigosSet, getCodigo)` — helper **puro**: se
  `codigosSet` falsy retorna `lista` (mesma referência); senão filtra por
  `codigosSet.has(getCodigo(item))`. Exportado via `module.exports` p/ teste.
- `filtrarLista(lista, grupoId, getCodigo)` — wrapper browser: resolve o Set
  do grupo por id e delega ao helper puro.
- `montarGrupos(gruposRows, itensRows, configRows)` — helper **puro** que
  monta a estrutura acima; exportado para teste.
- `opcoesSelectContabil(selecionadoId)` — string de `<option>`s (opção
  `(todos os grupos)` + `contabil()`), pronta para um `<select>` de filtro.
- CRUD (espelha o RH):
  - `salvarGrupo({ id, nome_grupo, observacoes, email_responsavel, empresas })`
    — update/insert em `rh_grupos_empresas`; `delete` itens do grupo; `insert`
    dos novos itens; recarrega cache. Retorna `{ id, error }`.
  - `excluirGrupo(id)` — `delete` em `rh_grupos_empresas` (CASCADE cuida do
    resto); recarrega cache.
  - `definirUsarContabil(grupoId, valor)` — `upsert` em `contabil_grupos_config`
    (`{ grupo_id, usar_contabil, updated_at }`, onConflict `grupo_id`); atualiza
    cache.

Dupla exportação: `if (typeof module !== 'undefined' && module.exports)` para
os helpers puros; `window.ContabilGrupos` no browser.

### 3. Configurações contábil — seção "Grupos de Empresas"

`configuracoes.js` / `configuracoes.html`:

- `configuracoes.html`: incluir `<script src="contabil-grupos.js"></script>`
  antes de `configuracoes.js`.
- `carregarDados()`: acrescentar `ContabilGrupos.carregar(supabaseClient)` ao
  `Promise.all` e carregar também **todas** as `rh_empresas` ativas (sem o
  filtro `possui_contabil`) numa variável `todasEmpresasAtivas`, usada só no
  picker de empresas do grupo.
- `renderTela()`: novo bloco `mapa-secao` "Grupos de Empresas":
  - Cabeçalho com botão "➕ Novo Grupo".
  - Coluna esquerda: `#listaGruposConfig` — itens clicáveis (nome +
    `(qtd empresas)`), destaque no selecionado.
  - Coluna direita: `#grupoDetalheConfig` — editor:
    - Nome do grupo (`#grpNomeConfig`)
    - `<label><input type="checkbox" id="grpUsarContabil"> Utilizar este grupo
      no Departamento Contábil</label>` — `change` grava na hora via
      `definirUsarContabil` (só habilitado depois do grupo existir/ser salvo).
    - E-mail(is) do responsável (`#grpEmailRespConfig`)
    - Empresas do grupo: input de busca + `#grpResultadosConfig` (lista simples,
      não-absoluta) + `#grpEmpresasListConfig` (adicionadas, com "remover").
      Picker sobre `todasEmpresasAtivas`.
    - Observações (`#grpObsConfig`, textarea)
    - Botões "💾 Salvar Grupo" / "🗑 Excluir Grupo"
  - Estado local: `grupoConfigAtual = { id, nome_grupo, observacoes,
    email_responsavel, usarContabil, empresas:[{codigo_empresa, nome_empresa}] }`.
  - Toasts via `mostrarToast` já existente.
- Comportamento de salvar: valida nome não-vazio; após salvar, recarrega a
  lista e re-seleciona o grupo. Excluir pede `confirm()`.

### 4. Filtro "Grupo de Empresas" nos consumidores

Regra comum: `<select>` com opção `(todos os grupos)` + `ContabilGrupos.contabil()`
(value = `grupo.id`, texto = `nome_grupo`). Quando um grupo é escolhido,
interseção com o conjunto já filtrado, via `ContabilGrupos.filtrarPorGrupo`
(ou `codigosDoGrupo(...).has(codigo)` inline no predicado existente).

| Arquivo | Estado | UI | Predicado |
|---|---|---|---|
| `mapeamento.js` | `filtro.grupo = ''` | `<select id="filtroGrupo">` em `.mapa-filtros` de `renderDashboard` | linha em `empresasFiltradas()` |
| `diario.js` | `dashboardFiltroGrupo` (var) | `<select id="filtroDashGrupo">` nos filtros de `renderDashboardDiario`; incluir grupos em `__diarioContext` (`gruposContabil`) | linha em `empresasFiltradasDashboard()`; "Limpar filtros" reseta |
| `diario-relatorios.js` | lido em `lerFiltros()` como `filtros.grupo` | `<select id="filtroGrupoRelatorio">` em `renderFiltros` (usa `ctx.gruposContabil`) | linha em `aplicarFiltros()`; entra em `resumoFiltrosTexto()` (nome do grupo) |
| `onboarding.js` | `filtroGrupoOnboarding` (var) | `<select id="filtroGrupoOnboarding">` ao lado de `#buscaOnboarding` | filtra `onboardings` por `codigosDoGrupo(id).has(o.codigo_empresa)` em `renderListaOnboardings()` |

Cada `*.html` (`mapeamento.html`, `diario.html`, `onboarding.html`) ganha
`<script src="contabil-grupos.js"></script>` antes do script principal.
Cada `carregarDados`/`carregarDadosDiario`/`carregarDados` chama
`ContabilGrupos.carregar(supabaseClient)` no `Promise.all` ou logo após.

Se `ContabilGrupos.contabil()` estiver vazio, o `<select>` mostra só
`(todos os grupos)` — sem erro, filtro inerte.

### 5. Testes

- `test-contabil-grupos.js` (Node, padrão dos `test-*.js`):
  - `montarGrupos`: junta rows corretamente; `usarContabil` false quando não há
    linha em config; true quando `usar_contabil = true`; empresas viram `Set`.
  - `filtrarPorGrupo`: `grupoId` falsy → lista intacta; com grupo → só os
    itens cujo código está no grupo; `getCodigo` customizável.
- Verificação manual no navegador: Configurações (criar grupo, marcar checkbox,
  add/remove empresa, excluir), e o filtro nas 4 telas.

## Riscos / assunções

- Excluir grupo pela tela contábil apaga o grupo para o RH (mesma tabela).
  Mantido — é o comportamento de "ambos os locais"; `confirm()` como no RH.
- Sem realtime: cada tela lê os grupos no load.
- `nome_grupo` é UNIQUE global: colisão de nome entre "grupos do RH" e novos
  grupos criados no contábil retorna erro do banco, tratado com toast.
- O picker de empresas do grupo no contábil usa todas as ativas; um grupo pode
  conter empresas sem contábil — elas aparecem no editor mas são naturalmente
  descartadas pela interseção nos filtros dos consumidores.
