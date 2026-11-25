# Portal do Cliente — Parte 3: Montador de Escala 5x2 com dados da empresa

Data: 2026-11-25 · Status: aguardando aprovação

## Intenção

O Montador de Escala 5x2 (`Projeto Montador Escala 5x2`) passa a ser a primeira ferramenta do
Portal do Cliente. Ao abrir para uma empresa, a equipe e as jornadas já vêm do banco, com os
empregados listados **nominalmente**, e as férias entram na escala. A mesma base de código
atende a equipe SCONT (modo avulso, como hoje) e o portal (modo portal).

## Objetivos

- Abrir o Montador no portal com a empresa escolhida (cliente: só as suas; administrador: qualquer).
- Passo 1: nome da empresa vem de `rh_empresas`. **O usuário continua preenchendo:** setor,
  dias e horário de funcionamento, se funciona em feriados e a cobertura mínima por dia/horário.
- Passo 2: lista **nominal** dos empregados ativos, vinda de `rh_empregados`, com jornada vinda de
  `rh_jornada_trabalho` e férias vindas de `rh_ferias_calculadas`.
- Férias (opção A): quem está de férias numa data aparece como **ausência** naquele dia e não conta
  na cobertura; o sistema alerta se faltar gente.
- Tudo preenchido é editável (nada travado), exceto a identidade (nome e código do empregado).

## Não objetivos

- Salvar escalas no banco (segue em `localStorage`, por empresa; persistência no banco é outra parte).
- Feriados vindos de `rh_feriados` (mantém os feriados atuais do Montador).
- Editar cadastro do RH; adicionar pessoas fictícias ou vagas a contratar no Passo 2.
- Usar `rh_jornadas` / `jornada_id` (nenhum empregado tem `jornada_id` hoje).
- Mostrar CPF, salário, endereço ou qualquer dado pessoal além de nome, código, cargo/função e tipo.

## Anti-objetivos

- Vazamento de dados de outra empresa ou de dados pessoais sensíveis ao cliente.
- Misturar dados de duas empresas no mesmo navegador (estado salvo precisa ser por empresa).
- Alterar o comportamento do Montador no modo avulso (equipe SCONT).

## Dados reais encontrados (produção, 2026-11-25)

- `rh_empregados.situacao`: `Trabalhando` (993), `Demitido` (3.744), afastamentos (poucos).
  `tipo_empregado`: Empregado, Estagiário, Contribuinte. Com `Trabalhando` e Empregado/Estagiário:
  **726 empregados em 225 empresas**; maior equipe: 47. `desc_cargo` vem preenchido em quase todos.
- `rh_jornada_trabalho`: uma linha por empregado e dia da semana (`segunda`..`domingo`, minúsculas,
  sem acento: `terca`, `sabado`), com `entrada` e `saida` em texto `HH:mm`; `intervalo_inicio/fim`
  quase sempre vazios. 553 dos 726 têm jornada; 173 não têm.
- `rh_ferias_calculadas`: `ferias_inicio`, `ferias_fim` (date) por empregado; 23 de empregados em
  atividade com férias a partir de hoje.
- `rh_empresas`: `codigo_empresa`, `nome_empresa`, `uf`, `cidade`/`municipio`.

## Abordagens consideradas

- **A. Estender o Montador atual com um "modo portal" — ESCOLHIDA.** Mesma base e mesmo `app/`;
  o modo é ativado por `?empresa=<codigo>`. Sem duplicar código; a equipe SCONT continua usando
  o modo avulso.
- B. Copiar o Montador para dentro do Portal do Cliente: duas bases para manter, divergem em semanas.
- C. Reescrever o Montador no portal em JS puro: descarta motor, testes e interface já prontos.

## Design

### 1. Banco: uma função segura, sem acesso direto às tabelas

O cliente não lê `rh_*` (bloqueio da Parte 1). Nova função
`public.montador_dados_empresa(p_codigo text) RETURNS jsonb`, `SECURITY DEFINER`,
`SET search_path = public, pg_temp`, `GRANT EXECUTE` só a `authenticated`:

- Guarda: se `p_codigo` não estiver em `SELECT empresas_do_cliente()` (que já devolve tudo ao
  administrador) → `RAISE EXCEPTION ... USING ERRCODE = '42501'`.
- Devolve `{ empresa, empregados, jornadas, ferias }`:
  - `empresa`: `codigo_empresa`, `nome_empresa`, `uf`, `municipio`.
  - `empregados`: apenas `situacao = 'Trabalhando'` e `tipo_empregado IN ('Empregado','Estagiário')`;
    campos `codigo_empregado`, `nome_empregado`, `cargo` (`desc_cargo`, senão `desc_funcao`),
    `tipo_empregado`. **Nenhum outro campo.**
  - `jornadas`: linhas de `rh_jornada_trabalho` desses empregados
    (`codigo_empregado`, `dia_semana`, `entrada`, `intervalo_inicio`, `intervalo_fim`, `saida`).
  - `ferias`: `rh_ferias_calculadas` desses empregados com `ferias_fim >= current_date`
    (`codigo_empregado`, `ferias_inicio`, `ferias_fim`).
- SQL em `_sql/schema_montador_portal.sql`, idempotente; testes SQL locais (mesmo ambiente da Parte 1).

### 2. Montador: modo portal

- `src/portal/` (novo): cliente Supabase (`@supabase/supabase-js`, URL e chave de `supabase-config.js`
  carregado pelo `index.html`), leitura da sessão e chamada da função. A sessão do login do portal é
  reaproveitada (mesma origem). Sem sessão ou erro 42501 → mensagem e link de volta ao portal.
- `mapearDadosPortal(json) → { nomeEmpresa, funcoes }` (função pura, testada): agrupa empregados por
  `cargo` (vazio → "Sem cargo"), cria `PessoaEscala` por empregado e deriva a jornada (item 3).
- Estado salvo por empresa: chave de `localStorage` com o código (`...v1:<codigo>`) no modo portal;
  modo avulso mantém a chave atual. Dados do banco (equipe, jornadas, férias) são recarregados a cada
  abertura; edições do usuário em cada pessoa (carga, entrada/saída, intervalo, "não escalar") ficam
  salvas por `codigo_empregado` e são reaplicadas.
- Cabeçalho/menu no modo portal: "Portal do Cliente · <nome da empresa>"; "Voltar ao portal" aponta
  para `../../Projeto Portal Cliente/index.html`.

### 3. Modelo e Passo 2 nominal

- `Funcao` ganha `pessoas?: PessoaEscala[]`. `PessoaEscala`: `id` (= `codigo_empregado`), `nome`,
  `escalar: boolean` (padrão `true`), `horasSemanais?`, `entrada?`, `saida?`, `intervaloMin?`,
  `ferias: { inicio: string; fim: string }[]`.
- `Funcao.quantidade` passa a ser a contagem de pessoas com `escalar` quando há `pessoas` (os demais
  consumidores, como o quadro de contratações, seguem funcionando).
- `criarFuncionarios`: com `pessoas`, um `Funcionario` por pessoa escalável, com o nome real.
- Jornada por pessoa: horas semanais = soma, nos dias com linha em `rh_jornada_trabalho`, de
  (saída − entrada − intervalo), com intervalo = `intervalo_fim − intervalo_inicio` se existir, senão
  o intervalo legal automático; `entrada`/`saida` fixas só se forem **iguais em todos os dias com
  linha**. Sem linhas: 44 h/semana e horário livre (o gerador escolhe). `jornadaDaFuncao` passa a
  aceitar a sobreposição por pessoa.
- UI (`StepEquipe`, modo portal): tabela nominal por cargo (nome, "Escalar", horas semanais, entrada,
  saída, intervalo, férias como etiquetas de período); empregados sem jornada no banco aparecem
  marcados "jornada padrão — confira". O formulário atual de função/quantidade permanece no modo avulso.

### 4. Férias na escala (opção A)

- `gerarEscala` recebe, por funcionário, os dias de férias dentro da janela e:
  - marca essas células como `ausencia` (tipo já existente);
  - não conta a pessoa na presença desses dias ao escolher repousos e rodízio de domingos;
  - semana inteira de férias não recebe repouso.
- Validação (`conformidade.ts`): já ignora semanas com ausência; a cobertura mínima já conta só
  `trabalho`, logo falta de gente por férias gera alerta de cobertura. Acrescentar a mensagem do alerta
  citando "férias" quando a falta ocorrer em dia com ausência.
- Janela: a da escala (data de início e semanas já existentes no Passo 4).

### 5. Portal do cliente

- Card "Montador de Escala 5x2" na home deixa de ser "em breve" e abre
  `../Projeto Montador Escala 5x2/app/index.html?empresa=<codigo>` (mesma aba).
- O administrador entra por qualquer empresa (já implementado na Parte 1/PR #13).

### Testes

- SQL: cliente A lê só a empresa A; cliente da B não lê A; pendente/recusado/revogado negados;
  administrador lê qualquer empresa; equipe não-admin sem vínculo negada; anon negado; resposta não
  contém CPF/salário/endereço; só `Trabalhando` e Empregado/Estagiário; férias passadas não vêm.
- Montador (vitest): `mapearDadosPortal` (agrupamento, cargo vazio, jornada com/sem linhas, entrada/saída
  uniformes vs. variáveis, intervalo, dia sem acento); `criarFuncionarios` com pessoas; gerador com férias
  (ausência nas datas, sem repouso em semana de férias, cobertura alerta); estado por empresa não vaza.
- Verificação manual no navegador (roteiro) ao fim; aplicação do SQL em produção só com autorização.

## Decisões minhas (para conferir)

- Equipe = `Trabalhando` + (Empregado, Estagiário); "Contribuinte" fora.
- Agrupar por `desc_cargo` (fallback `desc_funcao`).
- Pré-preenchimento editável; identidade (nome/código) não editável.
- Feriados e persistência no banco ficam para outras partes.
- Chave de armazenamento por empresa para evitar mistura.

## Deixado para o construtor

- Formato exato do JSON e nomes dos campos TypeScript, desde que respeitem este documento.
- Como o `supabase-config.js` é carregado e o build (`vite`) empacota `@supabase/supabase-js`
  mantendo o bundle clássico (`iife`, sem `type="module"`).
- Layout da tabela nominal (virtualização desnecessária: máx. 47 pessoas por empresa hoje).
- Textos das mensagens de erro e do alerta de cobertura por férias.
