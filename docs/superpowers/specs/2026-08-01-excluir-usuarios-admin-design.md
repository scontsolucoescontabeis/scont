# Excluir usuários no Painel Administrativo

## Contexto

O Painel Administrativo (`admin-dashboard.html`, aba **Usuários**) lista os usuários
aprovados do portal (linhas de `solicitacoes_acesso` com `status='aprovado'`), mas só
oferece "✎ Editar Acesso". Não existe forma de excluir um usuário.

Modelo de dados relevante:

```
auth.users (Supabase Auth)
   └──► usuarios            id = auth.users.id, is_admin   [ON DELETE CASCADE]
solicitacoes_acesso         cadastro + aprovação, id próprio, email UNIQUE
   └──► usuario_ferramentas [ON DELETE CASCADE via usuario_id]
```

`login.html` autentica primeiro no Supabase Auth e só libera acesso se existir uma
linha correspondente em `usuarios`/`solicitacoes_acesso` — ou seja, remover essas
linhas já bloqueia o login mesmo sem apagar a conta do Supabase Auth.

Risco identificado: várias tabelas do CRM referenciam `usuarios(id)` sem
`ON DELETE CASCADE` (`conversas.agente_id`, `mensagens.agente_id`,
`tarefas.criado_por`/`atribuido_a`, `anotacoes_internas.agente_id`). Excluir a conta
de Auth de um usuário com histórico no CRM falha com violação de FK.

## Decisões

- Exclusão remove os registros do portal **e** tenta apagar a conta do Supabase Auth
  (não é só "revogar").
- Admin não pode excluir a própria conta (bloqueado no client e na function).
- Se a exclusão da conta de Auth falhar por FK (histórico no CRM), a operação não é
  cancelada: o acesso ao portal já foi revogado e o admin recebe aviso claro de que a
  conta de login continua existindo por causa de vínculos no CRM.

## Solução

### 1. Edge Function `supabase/functions/excluir-usuario/index.ts`

Mesmo padrão de `supabase/functions/enviar-email` (Deno, CORS `*`).

**Entrada:** `POST { email: string }`, header `Authorization: Bearer <access_token>` do admin logado.

**Passos:**
1. `OPTIONS` → resposta CORS vazia.
2. Exige header `Authorization`.
3. Cria client com a `anon key` + o header recebido, chama `auth.getUser()` para
   validar a sessão do chamador (não confia apenas na presença do header).
4. Cria client com `service role key` (`adminDb`) e confere
   `usuarios.is_admin = true` para o `id` do chamador. Se não for admin → erro 403.
5. Se `caller.email` (case-insensitive) === `email` recebido → erro
   "Você não pode excluir sua própria conta.".
6. `adminDb.from('solicitacoes_acesso').delete().eq('email', email)` — cascade
   automático apaga `usuario_ferramentas`. Isso já revoga o acesso ao portal.
7. Busca `usuarios` por `email` para achar o `id` (= auth user id).
   - Se não encontrado: retorna sucesso com `authDeleted: false`,
     `message: 'Acesso removido. Nenhuma conta de login encontrada para este e-mail.'`.
8. Tenta `adminDb.auth.admin.deleteUser(id)` (cascade apaga a linha em `usuarios`).
   - Sucesso → `authDeleted: true`.
   - Falha (ex.: violação de FK do CRM) → captura o erro, **não propaga**,
     retorna `authDeleted: false` com mensagem explicando que o acesso foi revogado
     mas a conta de login permanece por ter vínculos em outras ferramentas (CRM).

**Saída:** `{ ok: true, accessRevoked: true, authDeleted: boolean, message: string }`
ou `{ ok: false, error: string }` (erro 400/403 antes de qualquer exclusão).

### 2. Front-end (`admin-dashboard.html`)

Na aba **Usuários** (`renderUsuarios()`), ao lado do botão "✎ Editar Acesso", novo
botão "🗑️ Excluir" que chama `excluirUsuario(u)`:

1. Se `u.email` (case-insensitive) === e-mail do admin logado (`sessionStorage.adminAuth`)
   → `alert()` e para (defesa em profundidade, o bloqueio real é na function).
2. `confirm()` com aviso explícito: ação irreversível, remove acesso ao portal e
   tenta apagar a conta de login.
3. `fetch` para `${SUPABASE_URL}/functions/v1/excluir-usuario` com
   `Authorization: Bearer <session.access_token>` e `apikey: SUPABASE_KEY`,
   body `{ email: u.email }`.
4. Em sucesso: `alert(json.message)`, recarrega `loadSolicitacoes()`,
   `loadUsuarios()` e `loadAcessos()` (o usuário some das três listas).
5. Em erro: `alert('Erro ao excluir usuário: ' + err.message)`.

### Deploy

`supabase functions deploy excluir-usuario` no projeto `dsdqwigopzrdmxtmhsez`
(mesmo projeto onde `enviar-email` já está publicada). `SUPABASE_URL`,
`SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pela
plataforma Supabase em toda Edge Function — não é preciso configurar segredo novo.

## Fora de escopo

- Botão de exclusão nas abas Solicitações/Acessos/CRM (ficam como estão hoje).
- Limpeza retroativa de registros órfãos do CRM referenciando usuários já excluídos
  antes desta mudança.
- Bloqueio de exclusão do último admin restante (perguntado ao usuário, ele optou por
  não incluir essa proteção).
