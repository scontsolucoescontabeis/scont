# E-mail ao marcar "Documentação Disponível" (Diário Contábil)

## Contexto

O selo "Documentação Disponível" (spec
`docs/superpowers/specs/2026-08-07-diario-documentacao-disponivel-design.md`)
deixou explícito no "Fora de escopo": *"Sem e-mail/notificação — só o selo
visual, pedido explícito do usuário."* Agora o pedido é o oposto: quando a
equipe Scont marca a documentação de um mês como disponível
(`alternarDocumentacaoDisponivel` em `diario.js`), o Prestador de Serviço
responsável pela empresa deve ser avisado por e-mail — ele hoje só descobre
entrando na grade.

## O que muda

1. **Gatilho:** só ao **marcar** (`novo === true`) em
   `alternarDocumentacaoDisponivel` (`diario.js:623`). Desmarcar continua
   silencioso — sem e-mail de retificação.
2. **Destinatários:** todos os `usuario_id` cadastrados em
   `contabil_empresas_responsaveis` para aquele `codigo_empresa` — a mesma
   tabela que já resolve `_meusResponsaveisSet`/`podeEncerrar`. Se não houver
   nenhum responsável atribuído, `mostrarToast('Documentação marcada como
   disponível, mas nenhum responsável está atribuído a esta empresa
   (Configurações → Responsáveis).', 'erro')` e nada é enviado.
3. **Toggle em Configurações:** nova coluna
   `notificar_documentacao_disponivel BOOLEAN NOT NULL DEFAULT TRUE` em
   `contabil_config_geral`, com entrada em `EVENTOS_EMAIL`
   (`configuracoes.js:15`) — mais um checkbox em Configurações → Alertas por
   E-mail, mesmo padrão dos 5 eventos já existentes.
4. **Falha de envio:** com múltiplos destinatários possíveis, usa
   `Promise.all` (mesmo padrão de `enviarAlertaValidacao`); se algum falhar,
   `mostrarToast('Documentação marcada, mas houve falha ao notificar por
   e-mail um ou mais responsáveis.', 'erro')`.

## Implementação — `diario.js`

Nova função `enviarAlertaDocumentacaoDisponivel(codigoEmpresa, ano, mes,
auth)`, chamada (fire-and-forget, com `.catch(console.error)`, mesmo padrão
de `enviarAlertaPendencia`) só quando `novo === true` dentro de
`alternarDocumentacaoDisponivel`:

```js
if (novo) {
  enviarAlertaDocumentacaoDisponivel(codigoEmpresa, ano, mes, auth)
    .catch((e) => console.error('Erro ao enviar alerta de documentação disponível:', e));
}
```

A função:
1. Lê `contabil_config_geral.notificar_documentacao_disponivel`; se
   `=== false`, retorna sem fazer nada (desligado em Configurações).
2. Busca `contabil_empresas_responsaveis` filtrando `codigo_empresa`,
   pegando a lista de `usuario_id`. Vazio → toast de aviso (acima) e retorna.
3. Obtém a sessão (`supabaseClient.auth.getSession()`); sem sessão, retorna.
4. Monta `assunto = '📄 Documentação disponível — ${nomeEmp} — ${mesAno}'` e
   `params = { tipo: 'documentacao_disponivel', empresa: nomeEmp, mes_ano:
   mesAno, marcado_por: auth.userData?.nome || auth.email || 'Equipe Scont',
   portal_url: window.location.origin + window.location.pathname }`.
5. `Promise.all` dos `usuario_id`, cada um em
   `POST /functions/v1/enviar-email` com `{ usuarioId, assunto, params }`
   (e-mail resolvido no servidor via `solicitacoes_acesso`, mesmo mecanismo
   de `enviarNotificacaoPrestador`).
6. Se `resultados.some((r) => !r.ok)`, toast de falha parcial (acima).

## Implementação — `configuracoes.js`

Adiciona ao array `EVENTOS_EMAIL` (linha 15):

```js
{ coluna: 'notificar_documentacao_disponivel', label: 'Documentação disponível marcada' },
```

Nenhuma outra mudança — a tela já itera `EVENTOS_EMAIL` para renderizar
checkboxes e persistir em `contabil_config_geral`.

## Implementação — Edge Function `enviar-email`

Novo bloco em `montarHtml` (`supabase/functions/enviar-email/index.ts`),
inserido perto dos outros templates do Diário Contábil (`pendencia_execucao`,
`pendencia_resolvida`), mesmo estilo visual (`_cabecalho`/`_rodape`, botão
"Acessar o Diário Contábil"):

```ts
if (tipo === 'documentacao_disponivel') {
    const empresaNome = (params.empresa as string)     || '';
    const mesAno      = (params.mes_ano as string)     || '';
    const marcadoPor  = (params.marcado_por as string) || 'a equipe Scont';
    const portalUrl   = (params.portal_url as string)  || '';

    return _cabecalho(nomeRemetente) + `
      <h2 style="color:#4e1820;margin:0 0 8px;font-size:20px;">📄 Documentação disponível</h2>
      <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
        <strong>${marcadoPor}</strong> marcou a documentação de <strong>${mesAno}</strong>
        da empresa <strong>${empresaNome}</strong> como <strong style="color:#33aa23;">disponível</strong>.
        Você já pode iniciar o lançamento contábil do mês.
      </p>

      ${portalUrl ? `
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
        <a href="${portalUrl}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
          📔 Acessar o Diário Contábil
        </a>
      </td></tr></table>` : ''}
    ` + _rodape(nomeRemetente) + _fechamento();
}
```

## SQL

Extensão de `_sql/schema_contabil_config_geral_toggle_eventos.sql`
(adiciona uma linha `ADD COLUMN IF NOT EXISTS`, mesmo arquivo — não é uma
migração nova por ser aditiva e do mesmo tema):

```sql
ALTER TABLE public.contabil_config_geral
    ADD COLUMN IF NOT EXISTS notificar_documentacao_disponivel BOOLEAN NOT NULL DEFAULT TRUE;
```

Fica como mais um SQL pendente de execução manual, junto dos já pendentes do
módulo — incluindo `schema_contabil_diario_documentacao.sql`, do qual esta
funcionalidade depende (a tabela `contabil_diario_documentacao` precisa
existir para o selo/toggle funcionar em produção).

## Fora de escopo

- Desmarcar não dispara e-mail nenhum.
- Sem mudança em `diario-validacoes.js`, Relatórios ou Histórico — o evento
  de auditoria já registrado por `alternarDocumentacaoDisponivel` continua
  igual.
- Sem anexos no e-mail.
