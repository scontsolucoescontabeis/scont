# Alerta de "Pendência sanada" + toggle de eventos de e-mail (Diário Contábil)

## Contexto

O Diário Contábil já dispara e-mail em 4 eventos, todos via a Edge Function
`enviar-email` (`supabase/functions/enviar-email/index.ts`), montando o corpo
por `params.tipo` em `montarHtml()`:

1. `validacao_fechamento` — `enviarAlertaValidacao` (`diario.js:240`), quando
   o prestador encerra o mês e envia para validação. Destinatários: lista de
   `contabil_config_geral.email_alerta_validacao`.
2. `fechamento_aprovado` / `fechamento_rejeitado` — `enviarNotificacaoPrestador`
   (`diario.js:288`), quando a equipe Scont aprova/rejeita. Destinatário:
   resolvido no servidor a partir de `usuario_id` (quem enviou), via
   `solicitacoes_acesso`.
3. `pendencia_execucao` — `enviarAlertaPendencia` (`diario.js:603`), quando o
   prestador marca "🔴 Marcar Pendência" na grade. Mesma lista de
   destinatários do item 1.

`resolverPendencia` (`diario.js:645`) — clique numa célula em `pendencia`, que
volta o mês para `em_andamento` — hoje não notifica ninguém.

## O que muda

### 1. Novo alerta "Pendência sanada"

Nova função `enviarAlertaPendenciaResolvida(codigoEmpresa, ano, mes, auth)`
em `diario.js`, espelhando `enviarAlertaPendencia`: mesma fonte de
destinatários (`contabil_config_geral.email_alerta_validacao`), mesmo padrão
best-effort (fire-and-forget, `.catch()` só loga/toast, não bloqueia a UI).
Chamada a partir de `resolverPendencia`, depois que `transicionarStatusMes`
grava com sucesso.

Conteúdo: empresa, mês/ano, quem resolveu (`auth.userData?.nome ||
auth.email`). Novo template `tipo: 'pendencia_resolvida'` em `montarHtml()`,
mesmo layout dos templates existentes (mas em tom "resolvido" — ex. selo
verde em vez de vermelho). Assunto:
`🟢 Pendência sanada — <Empresa> — <Mês/Ano>`.

### 2. Toggle por tipo de evento (Configurações)

5 colunas booleanas novas em `contabil_config_geral` (singleton `id=1`),
todas `DEFAULT true` (não muda o comportamento de quem já usa o alerta):

- `notificar_validacao_fechamento`
- `notificar_fechamento_aprovado`
- `notificar_fechamento_rejeitado`
- `notificar_pendencia_execucao`
- `notificar_pendencia_resolvida`

Cada uma das 4 funções de envio existentes + a nova
`enviarAlertaPendenciaResolvida` passam a ler, na mesma query que já busca
`email_alerta_validacao`, a coluna booleana correspondente ao seu evento, e
abortam **silenciosamente** (sem toast — é escolha deliberada do
administrador, não uma falha) se o valor for `false`.

Escopo do toggle: **global**, não por empresa — uma linha de configuração
vale para todas as empresas (decisão explícita do usuário).

### 3. UI em Configurações

Dentro da seção já existente "Alertas por E-mail" (`configuracoes.js`,
`renderTela()`), abaixo do campo de e-mail: 5 checkboxes, um por evento,
rótulos em português:

- "Fechamento enviado para validação"
- "Fechamento aprovado"
- "Fechamento rejeitado"
- "Pendência de execução criada"
- "Pendência de execução sanada"

Cada checkbox salva **imediatamente** ao clicar (upsert direto em
`contabil_config_geral`), mesmo padrão dos toggles Sim/Não de "Empresas com
Contábil" na mesma tela (sem botão "Salvar" — já removido de lá por pedido
explícito anterior). Toast de confirmação/erro; erro reverte o estado visual
do checkbox.

### 4. Fora de escopo

- Templates `aprovacao`/`rejeicao` (aprovação de acesso ao portal) — fluxo
  separado, não faz parte do Diário Contábil.
- Templates `alerta_certificado_vencimento` /
  `certificado_renovado_alerta_resolvido` — módulo Certificado Digital,
  configuração própria, não tocado aqui.
- Toggle por empresa — decisão explícita do usuário de manter global.

## Arquivos afetados

- `_sql/schema_contabil_config_geral_toggle_eventos.sql` — novo, 5 colunas
  booleanas via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, idempotente.
  Roda depois de `schema_contabil_config_geral.sql` (já pendente).
- `Projeto Onboarding Contabil/diario.js` — nova função
  `enviarAlertaPendenciaResolvida` + chamada em `resolverPendencia`; gating
  por toggle nas 4 funções de envio existentes.
- `supabase/functions/enviar-email/index.ts` — novo template
  `pendencia_resolvida` em `montarHtml()`; requer novo deploy da function.
- `Projeto Onboarding Contabil/configuracoes.js` — novos checkboxes na seção
  "Alertas por E-mail", leitura/escrita das 5 colunas novas.

## SQL pendente

Novo: `_sql/schema_contabil_config_geral_toggle_eventos.sql` (mais um SQL
pendente de rodar manualmente no Supabase, mesma convenção do módulo — ver
memória `project_central_departamento_contabil`).
