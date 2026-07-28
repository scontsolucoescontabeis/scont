# Notificação por e-mail ao chegar novo formulário (Gerenciador de Formulários)

## Objetivo

Quando um dos 3 formulários públicos for enviado com sucesso, disparar automaticamente um
e-mail interno avisando a equipe responsável, sem exigir login/sessão do preenchedor.

## Mapeamento tipo → destinatário

| Formulário                              | `tipo_formulario` | Destinatário                  |
|------------------------------------------|--------------------|--------------------------------|
| `formulario_empregado.html`              | `empregado`        | `pessoal@contatodf.com.br`     |
| `formulario_registro.html`                | `registro`          | `contato@scontdf.com.br`        |
| `formulario_alteracao.html`               | `alteracao`         | `contato@scontdf.com.br`        |

## Arquitetura

Reaproveitar a Edge Function já existente `supabase/functions/enviar-email/index.ts`
(sem nenhuma alteração nela). Ela só exige o header `Authorization` presente — a chave
`anon` do `supabase-config.js` (já carregada nos 3 formulários) é suficiente, não
precisa de sessão autenticada.

Usar o template **padrão** da function (sem passar `params.tipo`), preenchendo
`params.mensagem` com um HTML simples de resumo. Não passar `params.empresa`
(esse campo dispara a frase fixa "Preparamos uma apresentação personalizada...",
que não faz sentido para uma notificação interna).

Não há trigger de banco/webhook — a chamada é feita direto do navegador, do lado
do cliente, logo após o insert principal ter sucesso em cada formulário
(mesmo padrão já usado em outras telas do portal, ex. aprovação de acesso).

### Novo arquivo compartilhado: `notificar-formulario.js`

Incluído nos 3 HTMLs via `<script src="notificar-formulario.js"></script>`
(mesma pasta, ao lado de `supabase-config.js`).

Expõe `window.notificarNovoFormulario(tipo, dados)`:

- Resolve destinatário/assunto pelo `tipo`.
- Monta o HTML do resumo a partir de `dados` (ver seção "Conteúdo do e-mail").
- Faz `fetch` para `${SUPABASE_URL}/functions/v1/enviar-email` com
  `Authorization: Bearer ${SUPABASE_KEY}` e `apikey: ${SUPABASE_KEY}`.
- **Best-effort**: todo o corpo roda em `try/catch` interno; nunca lança erro
  para quem chamou. Falha de envio é só um `console.warn`, nunca bloqueia ou
  atrasa a exibição do modal de sucesso do formulário (o dado já está salvo,
  que é o que importa).

### Pontos de chamada

Chamar `await window.notificarNovoFormulario(tipo, dados)` logo antes do
`showModal()` de sucesso, em cada formulário:

- `formulario_empregado.html` — antes de `window.showModal()` (~linha 1597), após
  o insert em `empregados` e uploads de documentos.
- `formulario_registro.html` — antes de `showModal()` (~linha 945), após o insert
  em `formularios` e sócios.
- `formulario_alteracao.html` — antes de `showModal();  // Sucesso` (~linha 1276).

## Conteúdo do e-mail (resumo + principais campos)

Assunto e campos variam por tipo:

**Empregado** — assunto `📋 Novo Formulário de Empregado — {nomeCompleto} ({nomeEmpresa})`
- Nome completo, CPF, Empresa, Cargo, Data de Admissão, E-mail, Telefone/Celular
- Data/hora de preenchimento

**Registro de Empresa** — assunto `🏢 Novo Formulário de Registro de Empresa — {nomeEmpresa}`
- Nome da Empresa, Nome Fantasia, Porte, Capital Social, E-mail Comercial,
  Telefone Comercial, Nº de sócios informados
- Data/hora de preenchimento

**Alteração de Empresa** — assunto `📝 Novo Formulário de Alteração de Empresa — {nomeEmpresa}`
- Empresa
- Lista do que foi solicitado alterar (nome, fantasia, capital, endereço,
  atividades, quadro societário) — só os itens marcados como "sim", com o
  novo valor quando preenchido
- Data/hora de preenchimento

Sem link de acesso ao Gerenciador no corpo do e-mail (não há URL pública
confirmada para o painel administrativo).

## Erros / edge cases

- Se `notificarNovoFormulario` falhar (Brevo/SMTP não configurado, rede etc.),
  o formulário continua seu fluxo normalmente — só loga aviso no console.
- Se `dados` vier com campos vazios/nulos, a linha correspondente é omitida
  do e-mail (não mostra "Cargo: -").

## Fora de escopo

- Alterações na Edge Function `enviar-email` (reaproveitada como está).
- Trigger de banco de dados / Database Webhook.
- Link direto para o registro no Gerenciador de Formulários.
