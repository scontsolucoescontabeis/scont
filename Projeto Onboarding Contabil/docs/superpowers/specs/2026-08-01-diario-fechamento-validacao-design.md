# Diário Contábil — Fluxo de Encerramento/Validação de Fechamento Mensal — Design

## Contexto

Um responsável (usuário "Prestador de Serviço", atribuído via
`contabil_empresas_responsaveis` na tela de Configurações) presta a
contabilidade de uma ou mais empresas e vai atualizando o Diário Contábil.
Ao terminar a contabilidade de um mês, ele precisa **encerrar** esse mês e
notificar a equipe Scont, que **aprova** ou **rejeita** (com justificativa)
o fechamento. Se rejeitado, o mês volta para aberto e o ciclo se repete até
a aprovação. Este documento cobre: o modelo de dados do fluxo, as
permissões, as mudanças na grade mensal existente, uma tela nova
("Validações") que mostra o andamento para os dois lados, alerta por e-mail
para a equipe Scont, e a restrição de acesso à tela de Configurações.

Este fluxo é independente da grade de 3 estados já existente (Sem
Documentação / Pendências / Concluído, `contabil_diario_status_mensal`) —
essa grade continua existindo sem mudanças de comportamento; o fluxo de
encerramento só pode começar quando o mês já está em "Concluído".

## 1. Modelo de dados

### 1.1 `contabil_diario_fechamentos` (novo, append-only)

Um evento por linha — nunca é editado ou apagado (mesmo padrão de
`contabil_diario_auditoria`).

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `codigo_empresa` | text NOT NULL | |
| `ano` | int NOT NULL | |
| `mes` | int NOT NULL (1–12) | |
| `tipo_evento` | text NOT NULL CHECK IN (`enviado`,`aprovado`,`rejeitado`) | |
| `mensagem` | text | obrigatório quando `tipo_evento='rejeitado'`; opcional nos demais |
| `usuario_id` | uuid | FK lógica → `solicitacoes_acesso.id`, mesmo padrão de `contabil_empresas_responsaveis` |
| `usuario_nome` | text | |
| `usuario_email` | text | |
| `created_at` | timestamptz default `now()` | |

Índice em `(codigo_empresa, ano, mes, created_at)`. RLS `TO authenticated
USING (true)` — mesma convenção do restante do módulo.

**Status de fechamento é derivado, nunca armazenado como coluna própria.**
Para um `(codigo_empresa, ano, mes)`, pego o evento de `created_at` mais
recente:

- Nenhum evento, ou o mais recente é `rejeitado` → **Aberto**
- Mais recente é `enviado` → **Aguardando validação**
- Mais recente é `aprovado` → **Aprovado** (mês travado, ver §3)

### 1.2 `contabil_config_geral` (novo, singleton)

Linha única de configurações do módulo (separado de `configuracoes_scont`,
que é a configuração global de *como* o portal envia e-mail — este é só o
destinatário deste alerta específico).

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | smallint PK default 1, CHECK (`id = 1`) | garante linha única |
| `email_alerta_validacao` | text | um ou mais e-mails separados por vírgula |

RLS `TO authenticated USING (true)`. Se a linha não existir ainda, a tela de
Configurações trata como "sem e-mail configurado" (não manda alerta) até o
usuário preencher e salvar (upsert `id=1`).

## 2. Permissões (client-side, mesma convenção do resto do módulo)

Resolvidas uma vez por `_resolverEscopoUsuario()` (portado do padrão já
usado em `Projeto RH/admin.js`), usando `sessionStorage.userAuth`
(`isAdmin`, `userData.empresa`, `userId`):

- **Encerrar mês** (criar evento `enviado`): usuário está em
  `contabil_empresas_responsaveis` para aquela empresa, OU `isAdmin=true`.
- **Aprovar/Rejeitar** (criar evento `aprovado`/`rejeitado`):
  `userData.empresa` trim/lower = `scont soluções contábeis`, OU
  `isAdmin=true`.
- **Seletor geral de empresas do Diário** (`diario.js`): usuários
  "Prestador de Serviço" (não admin) só veem as empresas atribuídas a eles
  em `contabil_empresas_responsaveis` — mesmo filtro já aplicado em
  `Projeto RH/admin.html`. Só o Diário Contábil muda; Onboarding e
  Mapeamento continuam sem filtro.
- **Tela de Configurações**: escondida/bloqueada para "Prestador de
  Serviço" (ver §6).

Enforcement é só client-side (igual ao resto do portal) — não é segurança
real contra alguém inspecionando a API diretamente.

## 3. Grade mensal — ícone de encerramento

Quando uma célula está em "Concluído", um ícone pequeno aparece no canto
(clique nele não interfere no clique da célula, que continua ciclando
Sem Documentação → Pendências → Concluído). O ícone reflete o status
derivado do mês:

- **Aberto**: ícone de envio, visível/habilitado só para quem pode
  encerrar (§2). Clique abre modal "Fechamento — MM/AAAA — Empresa" com
  botão "Encerrar mês contábil" (mais campo opcional de observação) →
  cria evento `enviado` → dispara e-mail (§5).
- **Aguardando validação**: ícone de relógio. Para quem pode
  aprovar/rejeitar, o modal mostra os botões "Aprovar" / "Rejeitar"
  (rejeitar exige motivo, textarea obrigatória). Para o prestador que
  enviou, o modal é só leitura ("Aguardando validação da equipe Scont
  desde .../enviado por ...").
- **Aprovado**: ícone de check verde. Célula fica travada (não cicla mais
  ao clicar) — reabrir um mês aprovado fica fora de escopo por ora.

O modal sempre mostra a timeline completa de eventos daquele
`(empresa, ano, mes)` (mais recente primeiro), com rótulo adaptado ao
papel de quem está vendo (ver §4).

## 4. Tela nova "Validações"

4º botão no sidebar do Diário (ao lado de Visão Geral / Relatórios /
Histórico), com um contador (badge numérico) de itens pendentes para o
usuário logado, recalculado a cada carregamento da página (sem
realtime/e-mail de novo aqui — só o alerta de e-mail do §5).

**Seção "Pendentes para você"**:
- Equipe Scont/admin: lista de todos os `(empresa, ano, mes)` com status
  Aguardando validação, com empresa, mês/ano, enviado por, enviado em, e
  ações inline Aprovar/Rejeitar.
- Prestador de Serviço: lista dos seus (só empresas atribuídas) itens
  rejeitados mais recentemente que qualquer aprovação — mostra o motivo e
  um botão para reenviar (mesma ação de "Encerrar", sem precisar voltar à
  grade).

**Seção "Linha do tempo"**: histórico cronológico (mais recente primeiro,
limite ~200) de todos os eventos no escopo do usuário (Scont/admin vê
tudo; Prestador só suas empresas atribuídas). Rótulo de cada evento é
adaptado à perspectiva de quem lê:

| Evento | Equipe Scont vê | Prestador vê (quando é o autor) |
|---|---|---|
| `enviado` | "📥 Recebido: solicitação de validação — MM/AAAA — Empresa X — enviado por Fulano" | "📤 Enviado para validação da equipe Scont — MM/AAAA — Empresa X" |
| `aprovado` | "✅ Fechamento aprovado — MM/AAAA — Empresa X" | "✅ Seu fechamento de MM/AAAA (Empresa X) foi aprovado" |
| `rejeitado` | "❌ Fechamento rejeitado — MM/AAAA — Empresa X — motivo: ..." | "❌ Seu fechamento de MM/AAAA (Empresa X) foi rejeitado — motivo: ..." |

## 5. Alerta por e-mail (reaproveitando `supabase/functions/enviar-email`)

Cada evento `enviado` (primeiro envio ou reenvio após rejeição) dispara
uma chamada best-effort para a Edge Function já existente
`enviar-email` (mesmo padrão de chamada do `admin-dashboard.html`: sessão
via `supabaseClient.auth.getSession()`, `Authorization: Bearer
<access_token>`, header `apikey`). Se o e-mail falhar, o evento de
fechamento **já foi salvo** — a falha só aparece como aviso na tela, não
desfaz o encerramento.

- Destinatário(s): `contabil_config_geral.email_alerta_validacao`
  (suporta múltiplos e-mails separados por vírgula — a função já aceita
  um único `destinatario`; se houver mais de um, disparar uma chamada por
  endereço).
- Novo `tipo: 'validacao_fechamento'` em `montarHtml()` (index.ts), junto
  dos templates `aprovacao`/`rejeicao`/apresentação já existentes — corpo:
  "O prestador `<nome>` encerrou a contabilidade de `MM/AAAA` da empresa
  `<empresa>` e enviou para validação.", com botão/link para o portal.
  Params enviados: `{ tipo: 'validacao_fechamento', empresa, mes_ano,
  enviado_por, portal_url }`.
- Assunto: `🔔 Fechamento aguardando validação — <Empresa> — MM/AAAA`.

## 6. Tela de Configurações escondida para Prestador de Serviço

- `index.html` (hub): o card "⚙️ Configurações" é removido do DOM quando
  `userData.empresa` (trim/lower) = `prestador de serviço` e
  `isAdmin` for falso.
- `configuracoes.js`: mesma checagem em `iniciar()` — se o usuário for
  Prestador de Serviço (não admin), redireciona para `index.html` (não
  chega a carregar dados). Mesma convenção de enforcement client-side já
  usada no resto do módulo — não é um bloqueio de RLS.
- A nova seção de e-mail de alerta (§1.2) é editada dentro da mesma tela
  de Configurações, portanto também fica fora do alcance de Prestadores de
  Serviço.

## Fora de escopo

- Reabrir um mês já aprovado.
- Notificação por e-mail para o prestador em caso de rejeição (só aparece
  na tela "Validações" — pedido explícito foi só alertar a equipe Scont
  por e-mail).
- Chat livre entre as partes — só o motivo de rejeição e um comentário
  opcional no envio/aprovação.
- Realtime/push — tudo é recalculado ao carregar a página (grade,
  contador do sidebar, tela de Validações).

## SQLs pendentes (a rodar manualmente, mesma convenção do resto do módulo)

1. `_sql/schema_contabil_diario_fechamentos.sql` — cria
   `contabil_diario_fechamentos` (§1.1).
2. `_sql/schema_contabil_config_geral.sql` — cria `contabil_config_geral`
   (§1.2).

## Arquivos afetados (implementação)

- `diario.js` — escopo por responsável no seletor de empresas; ícone de
  encerramento + modal na grade mensal; contador do sidebar.
- `diario.html` — botão novo "Validações" no sidebar.
- Novo `diario-validacoes.js` (+ referência em `diario.html`) — tela de
  Validações (pendentes + linha do tempo).
- `configuracoes.js` / `configuracoes.html` — campo de e-mail de alerta;
  bloqueio de acesso para Prestador de Serviço.
- `index.html` (hub) — esconder card Configurações para Prestador de
  Serviço.
- `supabase/functions/enviar-email/index.ts` — novo template
  `validacao_fechamento`.
