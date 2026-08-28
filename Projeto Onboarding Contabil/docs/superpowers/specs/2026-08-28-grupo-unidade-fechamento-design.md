# Grupo de Empresas como unidade única de fechamento (módulo contábil)

Data: 2026-08-28

## Objetivo

No Departamento Contábil, um **Grupo de Empresas marcado "Utilizar no Departamento
Contábil"** deixa de ser um filtro e passa a ser tratado como **uma única unidade**:
uma linha só na Visão Geral, um Mapeamento único, uma grade mensal, um encerramento
com **um balancete consolidado**, aprovação/rejeição do grupo inteiro. As empresas
membro não aparecem mais individualmente no módulo.

## Decisões (confirmadas com o usuário)

1. Encerramento **único por grupo** — um balancete consolidado, aprova/rejeita tudo.
2. **Absorção total** — empresas membro somem como itens individuais no módulo.
   Lançamentos, grade, documentação, balancete e Mapeamento passam a ser do grupo.
3. Mapeamento Estratégico: o grupo tem **um registro próprio**.
4. Um grupo com 5 empresas mas só 3 com `possui_contabil` → **as 5** entram no grupo
   (marcar o grupo pra contábil traz todas; `possui_contabil` é ignorado para membros).
5. **Sem migração** — histórico por empresa permanece; a virada vale daqui pra frente.
   A página do grupo mostra também os lançamentos antigos das empresas membro.
6. Onboarding **não muda** (é cadastro de empresa nova).
7. Uma empresa não pode estar em dois grupos marcados pra contábil (validado na tela
   de Configurações).

## Abordagem: "unidade contábil" com chave virtual (sem migração de banco)

As tabelas `contabil_diario_*` e `contabil_mapeamento` guardam `codigo_empresa TEXT`
**sem foreign key** para `rh_empresas`. Aproveitamos isso:

- Uma **unidade contábil** é ou uma empresa avulsa (chave = seu `codigo_empresa`),
  ou um grupo contábil (chave = `grupo-<uuid>`, nome = `nome_grupo`).
- Todas as tabelas do módulo passam a guardar essa chave na coluna `codigo_empresa`
  que já existe. **Zero coluna nova, zero tabela nova.** (`contabil_grupos_config`,
  já criada, basta.)
- Um helper compartilhado monta a lista "empresas avulsas + grupos" e as telas
  iteram sobre ela em vez de `rh_empresas` cru.

### `contabil-grupos.js` — novas funções

Puras (Node-testáveis, via `module.exports`):

- `ehChaveGrupo(codigo)` → `true` se `codigo` começa com `grupo-`.
- `idDoGrupoNaChave(codigo)` → o uuid, ou `null`.
- `montarUnidades(empresasComContabil, todasAtivas, gruposContabil)` →
  - remove de `empresasComContabil` toda empresa que seja membro de algum grupo de
    `gruposContabil`;
  - adiciona uma entrada sintética por grupo:
    `{ codigo_empresa: 'grupo-'+id, nome_empresa: nome_grupo, status_situacao: 'ativa',
       is_grupo: true, grupo_id: id, membros_codigos: [...], membros_nomes: 'A, B, C' }`
    (só membros presentes em `todasAtivas`);
  - devolve ordenado por `nome_empresa` (localeCompare pt-BR).

Browser (`window.ContabilGrupos`):

- `montarUnidades(empresasComContabil, todasAtivas)` — wrapper que usa `contabil()`.
- `expandirResponsaveis(set, unidadesGrupo)` — dado o `Set` de `codigo_empresa` de
  `contabil_empresas_responsaveis` do usuário, para cada grupo cujo membro (ou a
  própria chave) esteja no set, adiciona a chave `grupo-<id>` **e** todos os códigos
  membro. Assim `podeEncerrar`, escopo de Validações e Histórico funcionam tanto para
  as linhas novas (chave do grupo) quanto para as antigas (por empresa).

## Mudanças por arquivo

### `diario.js`
- `carregarDadosDiario`: carregar `ContabilGrupos` antes; separar `todasAtivas` de
  `comContabil`; `empresas = ContabilGrupos.montarUnidades(comContabil, todasAtivas)`;
  expandir `_meusResponsaveisSet`; só então aplicar o filtro do Prestador.
- Remover o filtro "Grupo de Empresas" da Visão Geral (`filtroDashGrupo`,
  `dashboardFiltroGrupo`, predicado, handler, "limpar filtros").
- Busca (combobox + `filtroDashBusca`) passa a casar também `membros_nomes`.
- Linhas da Visão Geral / combobox: grupo aparece como `👥 <nome>` (sem o código cru).
- `renderPaginaEmpresa`: cabeçalho do grupo lista as empresas membro (só leitura).
- `carregarListaLancamentos`: para grupo, `.in('codigo_empresa', [chave, ...membros])`
  (mostra o histórico antigo); o INSERT de novo lançamento usa a chave do grupo.
- QSA (`btnConsultarQSA`, `btnVerQSA`): escondidos para grupo (QSA é por CNPJ).
- Balancete: `caminhoBalancete` usa a chave — `grupo-<uuid>` é seguro em path. Sem mudança.
- Notificações: `enviarAlertaValidacao` e `enviarNotificacaoPrestador` — se a chave for
  de grupo, somam o `email_responsavel` do grupo (`rh_grupos_empresas`) aos destinatários.

### `mapeamento.js`
- `carregarDados`: mesmo transform de unidades.
- Remover o filtro "Grupo de Empresas" (`filtro.grupo`, select, predicado, handler).
- Linhas do dashboard e seletor: grupo como `👥 <nome>`.
- `selecionarEmpresa` já faz `upsert {codigo_empresa}` — cria o Mapeamento do grupo
  automaticamente. Sem mudança.

### `diario-relatorios.js`
- Remover o filtro "Grupo de Empresas" (`filtros.grupo`, select, predicado,
  `resumoFiltrosTexto`).
- Coluna "Empresa": para grupo, `nome_grupo` + lista curta de membros.
- `buscarInfoLancamentos`: para chave de grupo, também conta lançamentos dos membros.

### `diario-historico.js` / `diario-validacoes.js`
- Sem mudança de código — funcionam via `ctx.empresas` (com as entradas de grupo) e
  `_meusResponsaveisSet` expandido. `meusResponsaveisCodigos` no contexto passa a
  incluir chaves de grupo + códigos membro.

### `configuracoes.js`
- `carregarDados` / tela "Empresas com Contábil": listar empresas avulsas + **uma
  linha por grupo**. Linha de grupo: badge "👥 Grupo" no lugar do toggle Sim/Não;
  responsável(is) atribuídos à chave do grupo (mesma tabela `contabil_empresas_responsaveis`).
- Tela "Grupos de Empresas": ao marcar "Utilizar no Departamento Contábil" (ou ao
  salvar um grupo já marcado), validar que nenhuma empresa do grupo está em outro
  grupo contábil — toast bloqueia e reverte.

### `test-contabil-grupos.js`
- Novos testes: `ehChaveGrupo`, `idDoGrupoNaChave`, `montarUnidades` (remove membros,
  adiciona entrada de grupo, ordena, ignora membro inativo, sem grupos = lista intacta).

## Riscos / assunções

- Balancete e QSA antigos das empresas membro continuam acessíveis só pelo histórico
  do grupo (lançamentos) ou por outros módulos; a navegação individual some do contábil.
- `contabil_diario_fechamentos` novos usam a chave do grupo; os antigos por empresa
  ficam órfãos da navegação mas contam no Histórico.
- Se o usuário desmarcar um grupo de "contábil", as unidades voltam a ser as empresas
  avulsas — os dados gravados na chave `grupo-<id>` ficam inertes (não somem).
