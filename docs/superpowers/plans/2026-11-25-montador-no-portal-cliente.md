# Montador de Escala 5x2 no Portal do Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Montador de Escala 5x2 abre no Portal do Cliente para a empresa escolhida, com nome da empresa, equipe nominal, jornadas e férias vindos do banco, e as férias entram na escala como ausência.

**Architecture:** Uma função `SECURITY DEFINER` no banco entrega só os dados autorizados por `empresas_do_cliente()`. O Montador existente ganha um "modo portal" (`?empresa=<codigo>`): cliente Supabase com a sessão do portal, função pura que mapeia o JSON em `Funcao.pessoas`, motor que aceita jornada e férias por pessoa, estado salvo por empresa. Modo avulso fica intacto.

**Tech Stack:** PostgreSQL/Supabase (RPC), React 18 + TypeScript + Vite + zustand + vitest (`Projeto Montador Escala 5x2`), `@supabase/supabase-js`, bundle clássico `iife`.

**Spec:** `docs/superpowers/specs/2026-11-25-montador-no-portal-cliente-design.md`

## Global Constraints

- Equipe = `rh_empregados.situacao = 'Trabalhando'` e `tipo_empregado IN ('Empregado','Estagiário')`.
- A função do banco **não devolve** CPF, salário, endereço nem outro campo além dos listados no spec.
- Autorização só no banco: `p_codigo` precisa estar em `SELECT empresas_do_cliente()`, senão `ERRCODE '42501'`.
- Funções `SECURITY DEFINER` com `SET search_path = public, pg_temp`; `GRANT EXECUTE` só a `authenticated`.
- SQL idempotente em `_sql/`; testes SQL em Postgres local descartável (`_sql/tests/local/run.sh`). **Nada é aplicado em produção pelas tarefas.**
- Modo avulso do Montador (sem `?empresa=`) não pode mudar de comportamento: todos os testes vitest atuais continuam passando.
- Estado salvo no navegador é por empresa no modo portal (chave com o código); o modo avulso mantém `scont.montador-escala-5x2.v1`.
- Textos de interface em português. Jornada semanal sem linhas no banco: 44 h e horário livre.
- Feriados e persistência de escalas no banco ficam fora (usa-se `FERIADOS_PADRAO`).
- Commits: `feat(montador-portal): ...`, terminados com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Cliente A chama a função com o código da empresa B: erro 42501, nenhum dado (Task 1).
- Empresa sem nenhum empregado `Trabalhando`: devolve lista vazia, não erro; o Montador mostra "nenhum empregado ativo" (Tasks 1 e 5).
- Dia da semana sem acento e minúsculo (`terca`, `sabado`) e horas em texto `HH:mm`; entrada ou saída vazias (Task 2).
- Empregado sem linhas de jornada: 44 h, horário livre, marcado "jornada padrão" (Task 2).
- Jornada de 6 dias (seg–sáb) com 44 h: o motor já limita a 42 h e 5 dias; a derivação não pode produzir mais de 7 dias nem horas negativas (Task 2).
- Férias que começam antes da janela da escala ou terminam depois; semana inteira de férias; férias no domingo do rodízio (Task 4).
- Cargo vazio ou repetido com caixa diferente ("Vendedor" x "VENDEDOR"): um grupo só (Task 2).
- Duas empresas abertas no mesmo navegador: dados salvos não se misturam (Task 5).
- Sessão expirada ou ausente no modo portal: mensagem e link de volta, sem tela em branco (Task 5).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `_sql/schema_montador_portal.sql` | Função `montador_dados_empresa(p_codigo)` |
| `_sql/tests/montador_portal.test.sql` | Testes SQL da função |
| `_sql/tests/local/02_fixtures_rh_montador.sql` | Tabelas `rh_empregados`, `rh_jornada_trabalho`, `rh_ferias_calculadas` no ambiente local |
| `Projeto Montador Escala 5x2/src/types.ts` | `PessoaEscala`, `Funcao.pessoas` |
| `.../src/portal/mapear.ts` (+ `.test.ts`) | Função pura JSON do banco → `{ nomeEmpresa, funcoes }` |
| `.../src/engine/jornada.ts`, `gerador.ts` | Jornada por pessoa; férias → `ausencia` |
| `.../src/engine/conformidade.ts` | Mensagem do alerta de cobertura citando férias |
| `.../src/portal/modo.ts` (+ `.test.ts`) | Detecta o modo, chave de armazenamento por empresa, mescla estado salvo |
| `.../src/portal/supabase.ts` | Cliente, sessão e chamada da função |
| `.../src/services/storage.ts`, `store/useStore.ts` | Armazenamento por empresa; carga do portal |
| `.../src/components/StepEquipe.tsx`, `App.tsx`, `index.html` | Passo 2 nominal; cabeçalho do portal; script do `supabase-config.js` |
| `Projeto Portal Cliente/index.html`, `js/cliente.js` | Card do Montador abre o app |

---

### Task 1: Função do banco e testes SQL

**Files:**
- Create: `_sql/schema_montador_portal.sql`, `_sql/tests/montador_portal.test.sql`, `_sql/tests/local/02_fixtures_rh_montador.sql`
- Modify: `_sql/tests/local/run.sh` (carregar o fixture e rodar o teste)

**Interfaces:**
- Consumes: `public.empresas_do_cliente() RETURNS SETOF text` (já existe; admin recebe todas).
- Produces: `public.montador_dados_empresa(p_codigo text) RETURNS jsonb` com a forma
  `{ "empresa": {codigo_empresa, nome_empresa, uf, municipio}, "empregados": [{codigo_empregado, nome_empregado, cargo, tipo_empregado}], "jornadas": [{codigo_empregado, dia_semana, entrada, intervalo_inicio, intervalo_fim, saida}], "ferias": [{codigo_empregado, ferias_inicio, ferias_fim}] }`. `empregados` e `jornadas` ordenados por nome/dia; `ferias` só com `ferias_fim >= current_date`. Empresa inexistente → `empresa: null`.

- [ ] **Step 1: Escrever o fixture** `02_fixtures_rh_montador.sql`: tabelas `rh_empregados(codigo_empresa, codigo_empregado, nome_empregado, desc_cargo, desc_funcao, situacao, tipo_empregado, cpf, salario, endereco)`, `rh_jornada_trabalho(codigo_empresa, codigo_empregado, dia_semana, entrada, intervalo_inicio, intervalo_fim, saida)`, `rh_ferias_calculadas(codigo_empresa, codigo_empregado, ferias_inicio, ferias_fim)` com RLS ligada e política permissiva `authenticated USING (true)` (como a produção; a política restritiva da Parte 1 deve barrar clientes). Se `rh_empresas` do stub não tiver `uf`/`municipio`, acrescentar as colunas.
- [ ] **Step 2: Escrever o teste** `montador_portal.test.sql` (transação com `ROLLBACK`, usuários simulados por `set_config('request.jwt.claims', …)` + `SET LOCAL ROLE authenticated`), com os nomes de asserção: `cliente_le_so_a_propria`, `cliente_outra_empresa_42501`, `pendente_negado`, `admin_le_qualquer`, `equipe_sem_vinculo_negada`, `anon_nao_executa`, `sem_dados_pessoais` (as chaves de cada empregado são exatamente `codigo_empregado, nome_empregado, cargo, tipo_empregado`), `so_trabalhando_empregado_estagiario` (demitido e "Contribuinte" ficam fora), `cargo_cai_para_funcao`, `ferias_passadas_fora`, `empresa_sem_empregados_lista_vazia`.
- [ ] **Step 3: Rodar e ver falhar.** Run: `bash _sql/tests/local/run.sh` (container `portal-cliente-pg` em `postgres:16-alpine`, porta 54329). Expected: erro de função inexistente.
- [ ] **Step 4: Implementar** `schema_montador_portal.sql` (`CREATE OR REPLACE`, `LANGUAGE plpgsql STABLE SECURITY DEFINER`, guarda por `empresas_do_cliente()` com `RAISE EXCEPTION 'Sem acesso a esta empresa' USING ERRCODE='42501'`, `REVOKE ... FROM PUBLIC, anon`, `GRANT ... TO authenticated`).
- [ ] **Step 5: Rodar e ver passar.** Run: `bash _sql/tests/local/run.sh`. Expected: `OK: testes de isolacao passaram`.
- [ ] **Step 6: Commit** `feat(montador-portal): função segura de dados da empresa`.

---

### Task 2: Tipos e mapeamento puro (banco → equipe nominal)

**Files:**
- Modify: `Projeto Montador Escala 5x2/src/types.ts`
- Create: `.../src/portal/mapear.ts`, `.../src/portal/mapear.test.ts`

**Interfaces:**
- Produces em `types.ts`:
  `interface PessoaEscala { id: string; nome: string; escalar: boolean; jornadaPadrao: boolean; horasSemanais?: number; entrada?: string; saida?: string; intervaloMin?: number; ferias: { inicio: string; fim: string }[] }` e `Funcao.pessoas?: PessoaEscala[]`.
- Produces em `mapear.ts`:
  `interface DadosPortal { empresa: {codigo_empresa: string; nome_empresa: string} | null; empregados: {...}[]; jornadas: {...}[]; ferias: {...}[] }` (formato da Task 1) e
  `function mapearDadosPortal(d: DadosPortal): { nomeEmpresa: string; funcoes: Funcao[] }`.

- [ ] **Step 1: Escrever os testes** em `mapear.test.ts` (vitest), com estas asserções e os valores do spec:
  - `agrupa por cargo ignorando caixa e acento`: "Vendedor" e "VENDEDOR " → uma `Funcao`; cargo `null`/vazio → função "Sem cargo".
  - `quantidade = pessoas com escalar`: `Funcao.quantidade === pessoas.filter(p => p.escalar).length`; `id` da função estável (`cargo-<slug>`), `jornadaContratual` coerente com as horas mais comuns do grupo, `horasSemanaisAtuais` = mediana das horas das pessoas.
  - `jornada com linhas`: seg–sex 08:00–17:00 sem intervalo → `horasSemanais = 40` (9 h − 1 h de intervalo legal automático por dia), `entrada='08:00'`, `saida='17:00'`, `jornadaPadrao=false`.
  - `intervalo informado`: `intervalo_inicio='12:00'`, `intervalo_fim='13:30'` → `intervaloMin = 90`, horas líquidas descontam 90 min.
  - `entrada/saída variam entre os dias` → `entrada`/`saida` indefinidas (horário livre), horas continuam somadas.
  - `sem linhas` → `horasSemanais = 44`, `jornadaPadrao = true`, sem entrada/saída.
  - `dias sem acento` (`terca`, `sabado`) reconhecidos; dia desconhecido ignorado; `entrada` ou `saida` vazias → o dia é ignorado; saída ≤ entrada vira virada de dia (+24 h) e fica limitada a 16 h.
  - `férias` do empregado viram `ferias[]` ordenadas por `inicio`.
  - `empresa null` → `nomeEmpresa = ''`; `empregados` vazio → `funcoes = []`.
- [ ] **Step 2: Rodar e ver falhar.** Run (em `Projeto Montador Escala 5x2/`): `npx vitest run src/portal/mapear.test.ts`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** `types.ts` e `mapear.ts`. Intervalo automático = `intervaloParaBruto` de `engine/jornada.ts` (reutilizar, não copiar). Funções auxiliares permanecem em `mapear.ts`.
- [ ] **Step 4: Rodar e ver passar.** Run: `npx vitest run` (suíte inteira). Expected: tudo passando, saída limpa.
- [ ] **Step 5: Commit** `feat(montador-portal): tipos de pessoa e mapeamento dos dados do banco`.

---

### Task 3: Motor com jornada por pessoa

**Files:**
- Modify: `.../src/engine/jornada.ts`, `.../src/engine/gerador.ts`
- Test: `.../src/engine/pessoas.test.ts` (novo)

**Interfaces:**
- Consumes: `PessoaEscala`, `Funcao.pessoas` (Task 2).
- Produces:
  - `criarFuncionarios(funcoes: Funcao[]): Funcionario[]` — com `pessoas`, um `Funcionario` por pessoa com `escalar`, `id = \`${fn.id}-${pessoa.id}\``, `nome = pessoa.nome`; sem `pessoas`, comportamento atual idêntico.
  - `jornadaDaPessoa(f: Funcao, p: PessoaEscala | undefined, tetoSemanalH?: number): JornadaPessoa` — aplica as sobreposições da pessoa (`horasSemanais`, `entrada`, `saida`, `intervaloMin`) sobre `jornadaDaFuncao`.
  - `gerarEscala` usa a jornada da pessoa para cada `Funcionario` (hoje usa `jornadas.get(f.funcaoId)`); `StepCobertura` continua usando `jornadaDaFuncao`.

- [ ] **Step 1: Escrever os testes** em `pessoas.test.ts`: (a) `sem pessoas, mesmo resultado de hoje` (função com `quantidade: 3` gera os mesmos ids/nomes de antes); (b) `um funcionário por pessoa escalável, com nome real` e `pessoa com escalar=false não aparece nem na escala nem na contagem`; (c) `duas pessoas da mesma função com cargas diferentes (44 h e 30 h) recebem horários brutos diferentes`; (d) `pessoa com entrada e saída fixas respeita o horário`; (e) `intervaloMin da pessoa prevalece`; (f) `propostas geradas com pessoas passam sem alerta vermelho de jornada` usando `validarEscala` como em `gerador.test.ts`.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run src/engine/pessoas.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar** as três mudanças acima, sem alterar assinaturas existentes além de acrescentar `jornadaDaPessoa`.
- [ ] **Step 4: Rodar a suíte inteira.** Run: `npx vitest run && npx tsc --noEmit && npx eslint src`. Expected: tudo verde.
- [ ] **Step 5: Commit** `feat(montador-portal): jornada e nome por pessoa no motor`.

---

### Task 4: Férias na escala (ausência)

**Files:**
- Modify: `.../src/engine/gerador.ts`, `.../src/engine/conformidade.ts`
- Test: `.../src/engine/ferias.test.ts` (novo)

**Interfaces:**
- Consumes: `PessoaEscala.ferias` (Task 2); `criarFuncionarios` com pessoas (Task 3).
- Produces: `gerarEscala` marca como `{ tipo: 'ausencia' }` os dias da janela que caem em férias da pessoa; a pessoa de férias não entra na presença desses dias (cálculo de repousos e do rodízio de domingos); semana inteira de férias não recebe repouso; o alerta de cobertura (`regraId === 'cobertura'`) passa a mencionar "férias de <nome>" quando houver ausência por férias no dia do alerta.

- [ ] **Step 1: Escrever os testes** em `ferias.test.ts`, janela `inicio: '2026-12-20'`, 5 semanas: `marca ausência nas datas de férias` (período 2026-12-28..2027-01-06 → células 8 a 17 são `ausencia`); `férias começam antes da janela` (marca desde o dia 0); `férias terminam depois da janela` (marca até o último dia); `férias fora da janela não mudam nada`; `semana inteira de férias não gera dsr nem folga`; `pessoa de férias não é escalada no domingo do rodízio` e outro empregado cobre o domingo; `cobertura insuficiente por férias gera alerta de cobertura citando férias` (equipe de 2 com mínimo 2, uma de férias); `sem férias, resultado idêntico ao de antes` (compara com escala gerada sem `ferias`).
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run src/engine/ferias.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar** em `gerarEscala`: conjunto de índices de dia ausentes por funcionário; descontar de `presentes`/`presentesFn`; excluir ausentes da seleção do rodízio e de `domSeguidos`/`diasSeguidos` (ausência zera a sequência, como folga); célula `ausencia` tem prioridade sobre `folga`/`dsr`/`feriado`. Em `conformidade.ts`, acrescentar a menção a férias à mensagem do alerta de cobertura sem alterar `regraId` nem severidade.
- [ ] **Step 4: Rodar a suíte inteira.** Run: `npx vitest run && npx tsc --noEmit && npx eslint src`. Expected: tudo verde (os testes antigos de gerador/conformidade inalterados).
- [ ] **Step 5: Commit** `feat(montador-portal): férias entram na escala como ausência`.

---

### Task 5: Modo portal (sessão, dados e estado por empresa)

**Files:**
- Create: `.../src/portal/modo.ts`, `.../src/portal/modo.test.ts`, `.../src/portal/supabase.ts`
- Modify: `.../package.json` (`@supabase/supabase-js`), `.../index.html` (script `../../supabase-config.js`, antes do bundle), `.../src/services/storage.ts`, `.../src/store/useStore.ts`, `.../src/App.tsx`, `.../vite.config.ts` (somente se o bundle `iife` exigir)

**Interfaces:**
- Consumes: `mapearDadosPortal` (Task 2), `montador_dados_empresa` (Task 1), `SUPABASE_URL`/`SUPABASE_KEY` globais do `supabase-config.js`.
- Produces em `modo.ts` (puro, testado):
  - `empresaDoPortal(search: string): string | null` — lê `?empresa=` (vazio → `null`).
  - `chaveArmazenamento(codigo: string | null): string` — `scont.montador-escala-5x2.v1` sem código; `scont.montador-escala-5x2.v1:<codigo>` com código.
  - `mesclarEstadoSalvo(base: Funcao[], salvas: Funcao[] | undefined): Funcao[]` — reaplica por `pessoa.id` as edições do usuário (`escalar`, `horasSemanais`, `entrada`, `saida`, `intervaloMin`) sobre a lista vinda do banco; pessoas que saíram do banco desaparecem; novas entram com os dados do banco.
- Produces em `supabase.ts`: `carregarDadosPortal(codigo: string): Promise<DadosPortal>` — usa `createClient(SUPABASE_URL, SUPABASE_KEY)` (sessão persistida do portal), erro de sessão → `Error('Sessão expirada')`, erro `42501` → `Error('Sem acesso a esta empresa')`.
- `storage.ts`: `carregar`/`salvar`/`limpar` passam a usar `chaveArmazenamento(empresaDoPortal(location.search))`.
- `useStore`: ação `carregarDoPortal(codigo)` que carrega, mapeia, mescla com o estado salvo, preenche `empresa.nome` e `funcoes`, e deixa os demais campos do Passo 1 e a cobertura como o usuário já tinha (ou os padrões na 1ª vez); estado `portal: { codigo, carregando, erro } | null`.
- `App.tsx`: no modo portal, mostra "Portal do Cliente · <empresa>", link "Voltar ao portal" para `../../Projeto Portal Cliente/index.html`, esconde "Voltar ao Portal" da equipe, e mostra estado de carregando/erro com link de volta; sem empregados ativos mostra "Nenhum empregado ativo encontrado para esta empresa".

- [ ] **Step 1: Escrever os testes** em `modo.test.ts`: `empresaDoPortal('?empresa=123') === '123'`; `''` e `'?x=1'` → `null`; valor com espaços é aparado; `chaveArmazenamento(null)` e `chaveArmazenamento('123')` exatos; `chaves de duas empresas diferem`; `mesclarEstadoSalvo` reaplica edições por `pessoa.id`, descarta pessoas ausentes do banco, mantém novas, e não altera `nome`/`id` vindos do banco.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run src/portal/modo.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar** `modo.ts`, `supabase.ts`, ajustes de storage/store/App/index.html; `npm i @supabase/supabase-js` (versão exata no `package-lock.json`).
- [ ] **Step 4: Rodar tudo e gerar o build.** Run: `npx vitest run && npm run build`. Expected: testes verdes; build sem erro; `app/index.html` sem `type="module"` (bundle clássico) e com o script do `supabase-config.js`.
- [ ] **Step 5: Commit** `feat(montador-portal): modo portal com sessão, dados do banco e estado por empresa`.

---

### Task 6: Passo 2 nominal (interface)

**Files:**
- Modify: `.../src/components/StepEquipe.tsx`, `.../src/components/StepCobertura.tsx` (apenas a exibição de jornada quando há `pessoas`)
- Create: `.../src/components/EquipeNominal.tsx`, `.../src/components/EquipeNominal.test.tsx` só se já houver infraestrutura de teste de componente (senão, testar a lógica pura extraída para `.../src/portal/equipe.ts` + `.test.ts`)

**Interfaces:**
- Consumes: `Funcao.pessoas`, `PessoaEscala` (Task 2), `useStore.portal` (Task 5).
- Produces: no modo portal, `StepEquipe` renderiza `<EquipeNominal />`: por cargo, uma tabela com **Nome**, **Escalar** (checkbox), **Horas/semana**, **Entrada**, **Saída**, **Intervalo (min)**, **Férias** (períodos como etiquetas `dd/mm–dd/mm`). Edições gravam em `funcoes[].pessoas[]` limpando `escala` e `propostas` (como `StepEquipe` já faz). Pessoas com `jornadaPadrao` mostram "jornada padrão — confira". Nome e código não editáveis. Sem botões de adicionar/remover função. O modo avulso mantém o formulário atual.
- Lógica pura em `equipe.ts`: `atualizarPessoa(funcoes: Funcao[], funcaoId: string, pessoaId: string, p: Partial<PessoaEscala>): Funcao[]` (recalcula `quantidade`), `resumoFerias(ferias: {inicio: string; fim: string}[]): string[]`.

- [ ] **Step 1: Escrever os testes** (lógica pura): `atualizarPessoa` altera só a pessoa certa, recalcula `quantidade` ao desmarcar `escalar`, não toca outras funções; `resumoFerias` formata `2026-12-28..2027-01-06` como `28/12–06/01` e devolve `[]` sem férias.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run src/portal/equipe.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar** `equipe.ts`, `EquipeNominal.tsx` e a escolha de modo em `StepEquipe.tsx`; em `StepCobertura.tsx`, com `pessoas`, a linha de jornada de cada função mostra a jornada mais comum entre as pessoas escaláveis.
- [ ] **Step 4: Rodar tudo.** Run: `npx vitest run && npx tsc --noEmit && npx eslint src && npm run build`. Expected: tudo verde.
- [ ] **Step 5: Roteiro manual** (documentar no relatório, marcar "pendente — requer ambiente real"): abrir `app/index.html?empresa=<codigo>` com sessão de cliente; conferir nome da empresa, lista nominal, jornadas, etiquetas de férias; editar uma pessoa, recarregar e ver a edição mantida; abrir outra empresa e ver dados separados.
- [ ] **Step 6: Commit** `feat(montador-portal): passo 2 com equipe nominal`.

---

### Task 7: Card do portal, build e documentação

**Files:**
- Modify: `Projeto Portal Cliente/index.html`, `Projeto Portal Cliente/js/cliente.js`, `Projeto Portal Cliente/js/estado.test.js` (teste estático do link), `Projeto Montador Escala 5x2/README.md`
- Build: `Projeto Montador Escala 5x2/app/` (regenerado)

**Interfaces:**
- Consumes: modo portal do Montador (Task 5).
- Produces: o card "Montador de Escala 5x2" da home vira link `../Projeto Montador Escala 5x2/app/index.html?empresa=<codigo>` (o código da empresa selecionada, codificado com `encodeURIComponent`); texto "em breve" removido.

- [ ] **Step 1: Escrever o teste estático** em `estado.test.js`: `cliente.js` monta o link do Montador com `encodeURIComponent(codigo)` e `index.html` não contém mais "em breve".
- [ ] **Step 2: Rodar e ver falhar.** Run: `node --test "Projeto Portal Cliente/js/estado.test.js"`. Expected: FAIL.
- [ ] **Step 3: Implementar** o card (elemento `<a>` com `id="cardMontador"`, `href` definido em `abrirHome`), atualizar o README do Montador (modo portal, `?empresa=`, dados do banco, SQL pendente de aplicar) e rodar `npm run build` no Montador.
- [ ] **Step 4: Verificação final.** Run: `node --test "Projeto Portal Cliente/js/estado.test.js" assets/nome-apoio.test.js assets/admin-clientes.test.js` e, em `Projeto Montador Escala 5x2/`, `npx vitest run && npx tsc --noEmit && npx eslint src`. Expected: tudo verde.
- [ ] **Step 5: Commit** `feat(montador-portal): card do Montador no portal do cliente e build`.
