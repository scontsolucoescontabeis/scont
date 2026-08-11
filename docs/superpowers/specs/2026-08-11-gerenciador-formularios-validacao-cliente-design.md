# Validação do preenchimento pelo cliente (Gerenciador de Formulários)

## Objetivo

Acrescentar dois status ao fluxo de edição de formulários (Registro de Empresa,
Alteração de Empresa, Admissão de Empregado) que permitem à Scont pedir que o
próprio cliente confirme os dados preenchidos, por e-mail, sem precisar de
login no Portal:

- **Aguardando Validação do Cliente** — dispara e-mail ao cliente com links
  "Validar" e "Solicitar Correção".
- **Pendência de Preenchimento/Documentação** — status de chegada quando o
  cliente pede correção (via link) ou quando a equipe marca manualmente,
  sempre com uma observação de que pendência é essa.

## Fora de escopo

- Alterar o fluxo de PDF já existente em `saveChanges()`.
- Qualquer mudança no formulário público de preenchimento inicial
  (`formulario_registro.html`, `formulario_alteracao.html`,
  `formulario_empregado.html`).
- Novo sistema de permissões granulares — a tela de Configurações usa o
  mesmo `auth.isAdmin` já usado no restante do Gerenciador.

## Modelo de dados

### `formularios` e `empregados` (mesmas 4 colunas novas nas duas tabelas)

```sql
status                    -- CHECK ampliado: + 'aguardando_validacao_cliente',
                           --                 + 'pendencia_preenchimento_documentacao'
rh_empresa_id UUID REFERENCES rh_empresas(id)  -- vínculo persistente p/ reuso
email_validacao_cliente TEXT   -- snapshot do e-mail usado no pedido
token_validacao UUID           -- token de uso único do link público (NULL = sem link ativo)
```

`observacoes` já existe nas duas tabelas hoje (usada pelo modal de edição) —
reaproveitada como campo da pendência, sem coluna nova.

### Nova tabela `formularios_config_email`

```sql
tipo_formulario TEXT PRIMARY KEY CHECK (tipo_formulario IN ('registro','alteracao','empregado')),
email            TEXT,
updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Seed com as 3 linhas (`registro`, `alteracao`, `empregado`), `email` vazio.
RLS: `SELECT`/`UPDATE` só para `authenticated` (mesmo padrão das outras
tabelas do projeto); sem acesso a `anon`.

### RLS — sem mudanças em `formularios`/`empregados`

`anon` continua sem qualquer INSERT/UPDATE direto nessas tabelas. A escrita
do token (criação do pedido) é feita pelo staff autenticado, usando a policy
`staff update` que já existe. O *consumo* do link (validar/rejeitar) é feito
por uma Edge Function com `service_role`, nunca por `anon` direto — mantém o
mesmo princípio de LGPD já aplicado no restante do schema.

## Fluxo 1 — Staff marca "Aguardando Validação do Cliente"

No modal de edição (`app.js` → `createEditForm` / `saveChanges`), option nova
no `<select id="editStatus">`. Ao selecionar esse valor, `createEditForm`
injeta um bloco condicional abaixo do seletor de status (mostrado/escondido
via `onchange` do select, função `atualizarCamposValidacaoCliente()`):

- **`tipo === 'registro'`** (empresa nova, sem cadastro em `rh_empresas`):
  campo de e-mail obrigatório (`id="editEmailValidacaoCliente"`), pré-
  preenchido com `form.email_comercial`, editável.

- **`tipo === 'alteracao'` ou `'empregado'`**: campo de busca de empresa
  (`id="editBuscaEmpresa"`, com dropdown de resultados abaixo, debounce
  300 ms, `ilike` em `rh_empresas.nome_empresa`, limite 8). Ao clicar num
  resultado, preenche campos ocultos `editRhEmpresaId` e mostra
  `email_responsavel` da empresa escolhida num campo read-only
  (`id="editEmailValidacaoCliente"`, com um botão "trocar e-mail" que o torna
  editável, para o caso de precisar de um endereço diferente do cadastro).
  Se `email_responsavel` estiver vazio, mostra aviso em vermelho "Cadastre o
  e-mail do responsável em RH → Empresas antes de enviar" e mantém o campo
  vazio/editável.
  Se `form.rh_empresa_id` já estiver preenchido (pedido anterior), pula a
  busca e carrega direto o nome/e-mail da empresa vinculada, com a mesma
  opção de trocar.

Validação no `saveChanges()` antes de gravar: se `newStatus ===
'aguardando_validacao_cliente'` e mudou em relação a `form.status`, o campo de
e-mail final tem que estar preenchido e ter formato de e-mail válido —
senão `showError(...)` e aborta o save (sem tocar o banco).

Se passou na validação:
1. Gera `token = crypto.randomUUID()`.
2. Inclui em `updateData`: `token_validacao`, `email_validacao_cliente`,
   `rh_empresa_id` (quando aplicável).
3. Depois do `update` no banco ter sucesso (mesmo ponto onde hoje dispara
   `gerarEEnviarPDFAlterado`), chama (best-effort, não bloqueia o save)
   `window.enviarSolicitacaoValidacaoCliente(tipo, formId, nomeExibicao,
   emailCliente, token)`, nova função em `notificar-formulario.js`.

`nomeExibicao`: `form.nome_empresa` para `registro`/`alteracao`;
`form.nome_completo` (ou o valor recém-digitado no campo
`editNomeCompleto`, se existir) para `empregado`.

## Fluxo 2 — E-mail ao cliente + páginas públicas

### `notificar-formulario.js` → `enviarSolicitacaoValidacaoCliente(...)`

Monta as URLs:
```
linkValidar  = <baseDir>validar-formulario.html?id=<id>&tipo=<tipo>&token=<token>
linkRejeitar = <baseDir>rejeitar-formulario.html?id=<id>&tipo=<tipo>&token=<token>
```
`baseDir` = diretório da página atual (`window.location.origin +
window.location.pathname` até a última `/`), para funcionar em qualquer
caminho de deploy sem URL fixa.

Chama `enviar-email` com `params.tipo = 'solicitacao_validacao_formulario'`
e `{ tipoFormularioLabel, nomeExibicao, linkValidar, linkRejeitar }`.
`destinatario` = `emailCliente`. Mesmo padrão best-effort (try/catch,
`console.warn`, nunca lança) das demais funções do arquivo.

### `validar-formulario.html` (nova, pública, raiz do projeto, sem
`portal-auth-guard`)

Lê `id`, `tipo`, `token` da query string. Ao carregar, `fetch` em
`processar-validacao-formulario` com `{ id, tipo, token, acao: 'validar' }`.
Mostra:
- Sucesso: "✅ Formulário de {tipoFormularioLabel} — {nomeExibicao} validado
  com sucesso!" + texto explicando que a Scont foi avisada.
- Erro (link já usado / status não é mais "aguardando validação" / token não
  bate): "Este link não é mais válido. Se ainda precisar validar ou corrigir
  informações, entre em contato com a Scont."

### `rejeitar-formulario.html` (nova, pública, mesma pasta)

Lê `id`, `tipo`, `token`. Mostra um formulário com
`<textarea id="motivo">` ("Descreva o que precisa ser corrigido ou
complementado") + botão "Enviar". Ao enviar, `fetch` em
`processar-validacao-formulario` com `{ id, tipo, token, acao: 'rejeitar',
motivo }`. Mostra confirmação "Pendência registrada. Nossa equipe vai entrar
em contato." ou o mesmo erro de link inválido do fluxo de validação, se
aplicável (reaproveita a mesma checagem/mensagem).

Ambas as páginas seguem o visual público já usado em `leitor.html` (cores
`--primary-color: #8B3A3A`, cartão central, sem sidebar), sem
`portal-auth-guard.js` — são acessadas por quem não tem conta no Portal.

## Fluxo 3 — Edge Function `processar-validacao-formulario` (nova)

`supabase/functions/processar-validacao-formulario/index.ts`, mesmo formato
de `enviar-email` (CORS, checagem de `Authorization` presente, sem exigir
sessão válida — as páginas públicas chamam com a `anon key` do
`supabase-config.js`).

```
POST body: { id: uuid, tipo: 'registro'|'alteracao'|'empregado',
              token: uuid, acao: 'validar'|'rejeitar', motivo?: string }
```

1. `tabela = tipo === 'empregado' ? 'empregados' : 'formularios'`.
2. Client com `service_role`. Busca a linha por `id`.
3. Se não existir, ou `status !== 'aguardando_validacao_cliente'`, ou
   `token_validacao !== token` (incluindo token nulo) → `{ ok:false, error:
   'link_invalido' }`, HTTP 400.
4. **`validar`**: `UPDATE ... SET status='validado', token_validacao=NULL`.
   Busca o e-mail de destino em `formularios_config_email` pelo `tipo`
   (`SELECT email WHERE tipo_formulario = tipo`). Se cadastrado, chama
   `enviar-email` (server-to-server, mesma function, com a
   `SUPABASE_SERVICE_ROLE_KEY` como Bearer — a function só exige o header
   presente) com `params.tipo = 'formulario_validado_cliente'`. Se o e-mail
   não estiver cadastrado, pula o envio (não é erro — só não há para quem
   mandar) e loga aviso.
5. **`rejeitar`**: exige `motivo` não vazio (senão `{ ok:false, error:
   'motivo_obrigatorio' }`). `UPDATE ... SET
   status='pendencia_preenchimento_documentacao', observacoes = motivo,
   token_validacao=NULL`. Mesmo lookup em `formularios_config_email` e envio
   com `params.tipo = 'formulario_pendencia_cliente'`.
6. Resposta de sucesso: `{ ok:true, tipoFormularioLabel, nomeExibicao,
   acao }` — `nomeExibicao` = `nome_empresa` (formularios) ou
   `nome_completo` (empregados) da linha atualizada.

`tipoFormularioLabel`: `registro` → "Registro de Empresa", `alteracao` →
"Alteração de Empresa", `empregado` → "Admissão de Empregado".

## Fluxo 4 — Novos templates em `enviar-email/index.ts`

Três blocos novos em `montarHtml()`, mesmo estilo dos existentes
(`_cabecalho`/`_rodape`, tabela de botão vermelho/bordô):

- **`solicitacao_validacao_formulario`** (para o cliente): explica que a
  Scont preencheu/atualizou o {tipoFormularioLabel} de {nomeExibicao} e pede
  para o cliente conferir. Dois botões lado a lado (ou empilhados,
  mobile-safe): "✅ Confirmar Dados" (`linkValidar`, verde/borda verde) e
  "✏️ Solicitar Correção" (`linkRejeitar`, borda cinza).

- **`formulario_validado_cliente`** (para a Scont): "✅ Cliente validou —
  {tipoFormularioLabel} — {nomeExibicao}. O status já foi atualizado para
  Validado no Gerenciador de Formulários."

- **`formulario_pendencia_cliente`** (para a Scont): "⚠️ Cliente reportou
  pendência — {tipoFormularioLabel} — {nomeExibicao}", com o `motivo` em
  destaque (mesmo bloco visual `background:#FFF1F2` já usado nos templates
  de rejeição existentes).

Assuntos:
- Cliente: `📋 Validação necessária — {tipoFormularioLabel} — {nomeExibicao}`
- Scont (validado): `✅ Cliente validou — {tipoFormularioLabel} — {nomeExibicao}`
- Scont (pendência): `⚠️ Pendência reportada pelo cliente — {tipoFormularioLabel} — {nomeExibicao}`

## Fluxo 5 — Status manual "Pendência de Preenchimento/Documentação"

Quando o staff seleciona esse status diretamente no modal (sem passar pelo
link do cliente): `createEditForm` já renderiza sempre o textarea
`#editObservacoes` (existente); ao escolher esse status, o campo ganha uma
borda de destaque e o placeholder muda para "Descreva a pendência de
preenchimento/documentação (obrigatório)". `saveChanges()` valida: se
`newStatus === 'pendencia_preenchimento_documentacao'` e
`observacoes.trim() === ''`, `showError(...)` e aborta o save. Esse caminho
**não** dispara e-mail — só o `rejeitar-formulario.html` (fluxo do cliente)
notifica a Scont.

## Fluxo 6 — Tela de Configurações (nova)

`configuracoes.html` + `configuracoes.js`, mesma estrutura de sidebar/topbar
do restante do projeto (`app-container`, `sidebar`, `main-content`,
`styles.css` existente). Gate de acesso: reaproveita
`window.PortalAuthGuard.init(1)` já usado em `index.html`; se
`!auth.isAdmin`, redireciona para `index.html` (mesmo padrão de
"Configurações restrita a admin" já visto em outras ferramentas do portal).

Conteúdo: 3 linhas fixas (Registro de Empresas / Alteração de Empresas /
Admissão de Empregados), cada uma com um `<input type="email">` + botão
Salvar, lendo/gravando em `formularios_config_email`. Toast de
sucesso/erro (reaproveita `showSuccess`/`showError` de `utils.js`).

Link novo na sidebar de `index.html`, `detalhes.html` e `historico.html`
(`⚙️ Configurações`, visível só quando `auth.isAdmin`).

## Badges de status (UI)

`index.html`: novas opções no `#statusFilter`. `styles.css`: novas classes
`.status-aguardando_validacao_cliente` (âmbar, ex. `background:#FFF3E0;
color:#E65100`) e `.status-pendencia_preenchimento_documentacao` (vermelho
claro, ex. `background:#FBE9E7; color:#BF360C`) — cores distintas de
`status-recebido`/`status-rejeitado` já usadas.

## Erros / edge cases

- Link clicado duas vezes (ou depois que o staff já mudou o status por
  fora): segunda tentativa cai no branch de erro `link_invalido` da Edge
  Function — a página pública mostra mensagem de link expirado, sem tocar o
  banco de novo.
- `formularios_config_email` sem e-mail cadastrado para o tipo: a Edge
  Function não falha o `validar`/`rejeitar` (o status já mudou, que é o que
  importa) — só não manda o aviso interno, e loga aviso no console da
  function.
- Falha ao enviar o e-mail ao cliente (Fluxo 1): best-effort — o status já
  foi salvo no banco; só loga aviso, não desfaz a mudança de status nem
  bloqueia o modal.
- Empresa não encontrada na busca (Fluxo 1, alteração/admissão): staff digita
  o e-mail manualmente no mesmo campo (ele fica editável sempre que não há
  empresa selecionada, reaproveitando o caminho de "trocar e-mail").
