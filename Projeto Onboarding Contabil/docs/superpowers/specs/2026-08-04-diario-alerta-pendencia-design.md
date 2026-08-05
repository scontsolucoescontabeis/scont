# Alerta por e-mail ao marcar Pendência de Execução (Diário Contábil)

## Contexto

Na grade mensal do Diário Contábil (`diario.js`), quando um mês está
`em_andamento` e o usuário clica "🔴 Marcar Pendência" no popover, informa um
motivo obrigatório e o mês muda para o estado `pendencia`
(`marcarPendencia`, `diario.js:596`). Hoje essa transição não notifica
ninguém.

Já existe um mecanismo análogo para outro evento da mesma tela: quando o mês
é encerrado e enviado para validação, `enviarAlertaValidacao` (`diario.js:240`)
dispara um e-mail para os endereços cadastrados em Configurações → Alertas
por E-mail (`contabil_config_geral.email_alerta_validacao`), via a Edge
Function `enviar-email`.

## O que muda

1. **Gatilho:** dentro de `marcarPendencia`, depois que
   `transicionarStatusMes` grava com sucesso, dispara
   `enviarAlertaPendencia(codigoEmpresa, ano, mes, motivo, auth)`
   (best-effort — `.catch()` só loga/mostra toast, não bloqueia o fluxo,
   mesmo padrão dos outros dois alertas já existentes na função).
2. **Destinatários:** reaproveita `contabil_config_geral.email_alerta_validacao`
   (mesma lista já usada para o alerta de validação — decisão do usuário,
   sem SQL novo).
3. **Conteúdo:** empresa, mês/ano, quem marcou a pendência
   (`auth.userData?.nome || auth.email`) e o motivo digitado no popover.
   Novo template `tipo: 'pendencia_execucao'` em `montarHtml()`
   (`supabase/functions/enviar-email/index.ts`), mesmo layout dos templates
   existentes (cabeçalho, corpo, botão "Acessar o Diário Contábil", rodapé).
   Assunto: `🔴 Pendência de execução — <Empresa> — <Mês/Ano>`.
4. **Fora de escopo:** `resolverPendencia` e as demais transições da grade
   continuam sem e-mail — não foi pedido.

## Arquivos afetados

- `Projeto Onboarding Contabil/diario.js` — nova função `enviarAlertaPendencia`
  + chamada em `marcarPendencia`.
- `supabase/functions/enviar-email/index.ts` — novo template
  `pendencia_execucao` em `montarHtml()`; requer novo deploy da function.

## Sem SQL novo

Reaproveita `contabil_config_geral.email_alerta_validacao`, já existente.
