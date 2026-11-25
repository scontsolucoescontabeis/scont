# Portal do Cliente — Parte 1: Acesso e bloqueio por empresa

Data: 2026-11-25 · Status: aguardando aprovação

## Visão geral do projeto (contexto)

Portal para as **empresas clientes da SCONT**: o cliente vê as informações da própria
empresa, faz solicitações à SCONT e acompanha demandas. É administrado pelo mesmo
administrador do portal SCONT. A primeira ferramenta disponível é o Montador de Escala 5x2.

Ordem acordada das partes (cada uma terá o próprio design):

1. **Acesso e bloqueio por empresa** (este documento) — base de todas as outras.
2. Visão da empresa (cadastro, equipe e dados vindos das tabelas).
3. Montador de Escala dentro do portal (pré-preenchido, escalas salvas no banco).
4. Solicitações e acompanhamento de demandas.

## Intenção

O cliente pede acesso a uma empresa; o administrador confere se a pessoa é sócia ou
trabalhadora da empresa e decide liberar ou não. Depois de liberado, o cliente só enxerga
dados da(s) empresa(s) a que foi vinculado — garantido **no banco**, não só na tela.

## Objetivos

- Pedido de acesso pelo cliente, com aprovação manual do administrador.
- Vínculo usuário ↔ empresa(s) e revogação com efeito imediato.
- Isolação real por empresa: o cliente A nunca lê dados da empresa B, nem chamando a API
  do Supabase diretamente.
- Nenhum usuário cliente consegue ler ou escrever nas tabelas atuais do portal SCONT.

## Não objetivos

- Telas de visão da empresa, Montador e solicitações (partes 2 a 4).
- Perfis de permissão diferentes entre usuários da mesma empresa (todos iguais por ora).
- Coleta de CPF no pedido (decisão do responsável: não é necessário).
- Alterar o fluxo de acesso da equipe SCONT ou dos Prestadores de Serviço.

## Anti-objetivos (falha mesmo que "funcione")

- Qualquer vazamento de dado entre empresas, ou de dado interno da SCONT para o cliente.
- Quebrar uma ferramenta atual da equipe ao endurecer o banco.
- Cliente conseguir se auto-aprovar.

## Contexto encontrado no código

- Login e cadastro atuais: `login.html`, com `solicitacoes_acesso` (nome, email, empresa
  em texto, cargo, telefone, status `pendente`) e tabela `usuarios` (`is_admin`, `role`).
  Aprovação feita em `admin-dashboard.html`.
- Empresas: `rh_empresas` (código, CNPJ). Pessoas: `rh_socios` (`codigo_empresa`,
  `nome_socio`, `cpf`) e `rh_empregados`.
- Vínculo existente de Prestador a empresas: `contabil_empresas_responsaveis`.
- Função `public.is_admin()` já existe e é usada em políticas.
- **Risco central:** a maioria das tabelas tem política `TO authenticated USING (true)`.
  Um usuário cliente, por estar autenticado, passaria nelas. Além disso, o cadastro do
  Supabase Auth é acessível pela API, então hoje qualquer pessoa que se cadastre já é
  `authenticated`; o desenho não pode depender de "listar quem é cliente" (lista de
  bloqueio), e sim de "listar quem é equipe" (lista de permissão).

## Abordagens consideradas

- **A. Portal separado, mesmo banco, bloqueio por empresa — ESCOLHIDA.** Pasta e login
  próprios; tabela de vínculos; política restritiva nas tabelas atuais; leitura do cliente
  só por tabelas/funções novas filtradas pela empresa.
- B. Reaproveitar `portal.html` com perfil cliente: mistura interfaces, não reduz o
  trabalho de bloqueio no banco.
- C. Projeto Supabase separado: isolamento forte, mas exige sincronizar dados entre bancos
  (já são 3 projetos) e duplica manutenção.

## Design

### Fluxo do cliente

1. Página `Projeto Portal Cliente/login.html` (entrada própria).
2. "Não tenho acesso": formulário com **nome, e-mail, senha, empresa (busca por nome ou
   CNPJ em `rh_empresas`), cargo, telefone**. Cria o usuário no Supabase Auth e uma linha
   de pedido com status `pendente`.
3. Enquanto pendente: tela "Pedido enviado, a SCONT vai analisar". Sem acesso a nada.
4. Aprovado: entra; com mais de uma empresa vinculada, escolhe qual abrir.
5. Esqueci a senha: reaproveita `redefinir-senha.html`.

### Fluxo do administrador

Nova aba "Acessos de clientes" no `admin-dashboard.html`: lista pedidos pendentes,
com empresa pedida e sinal de apoio — nome parecido encontrado em `rh_socios` ou
`rh_empregados` da empresa (comparação por nome normalizado, sem CPF). Ações: **Liberar**,
**Recusar** (com motivo), **Revogar** (nos já liberados) e vincular a empresas adicionais.

### Dados (SQL novo, em `_sql/`)

- `cliente_usuarios` — perfil do usuário cliente: `id` = `auth.users.id`, nome, email,
  cargo, telefone, `created_at`.
- `cliente_acessos` — vínculos: `usuario_id`, `codigo_empresa`, `status`
  (`pendente | aprovado | recusado | revogado`), `motivo`, `decidido_por`, `decidido_em`.
  Único por (`usuario_id`, `codigo_empresa`).
- Funções `SECURITY DEFINER` com `search_path` fixo:
  - `eh_equipe()` — usuário da equipe SCONT/Prestador (definição abaixo);
  - `empresas_do_cliente()` — códigos de empresa com vínculo `aprovado` do usuário atual;
  - `buscar_empresas_publico(texto)` — só nome e código, sem CNPJ completo nem outros
    campos, para o formulário de pedido.

### Isolação no banco

1. **Política restritiva** em todas as tabelas atuais do schema `public`:
   `AS RESTRICTIVE FOR ALL TO authenticated USING (public.eh_equipe()) WITH CHECK (public.eh_equipe())`.
   Políticas restritivas se combinam com as permissivas existentes por AND, então nenhuma
   política antiga é reescrita. Quem não é equipe (cliente ou qualquer cadastro avulso)
   fica barrado.
2. Tabelas/funções novas do portal do cliente **não** recebem essa política; têm suas
   próprias, filtradas por `codigo_empresa IN (SELECT empresas_do_cliente())`.
3. O cliente só escreve o próprio pedido (`status = 'pendente'`, `usuario_id = auth.uid()`);
   nunca altera `status` — só o administrador (`is_admin()`).
4. Edge Functions com service role e formulários públicos `TO anon` não são afetados.

### Rollout seguro

O bloqueio muda o comportamento de todas as ferramentas atuais, então:
(a) criar `eh_equipe()` e um script que lista quem ela barraria hoje, para conferir contra
a lista real de usuários; (b) aplicar a política restritiva em uma transação com script de
reversão pronto; (c) testar login e uso de cada ferramenta principal como Admin, SCONT e
Prestador antes de considerar concluído.

### Testes

- SQL: usuário cliente A não lê nem escreve em nenhuma tabela atual; não lê vínculos de B;
  não consegue mudar o próprio `status`; revogado perde acesso na próxima requisição.
- Teste de integração com 2 empresas e 2 clientes de dados fictícios.
- Regressão manual: equipe e Prestador continuam usando as ferramentas normalmente.

## Decisões minhas (para conferir)

- Vários usuários por empresa e um usuário com várias empresas, com seletor.
- Login por e-mail e senha no Supabase Auth, com confirmação de e-mail.
- Verificação de apoio por nome, não por CPF.
- Pasta nova `Projeto Portal Cliente/`, sem framework (HTML + JS puro como o restante do
  portal), publicada junto com os demais `Projeto *`.

## Deixado para o construtor

- **Definição exata de `eh_equipe()`:** o portal busca `usuarios` por e-mail e
  `solicitacoes_acesso` por id, com status aprovado; confirmar no banco real qual
  combinação cobre Admin, SCONT e Prestador sem barrar ninguém legítimo.
- Lista final de tabelas a receber a política restritiva (varrer `pg_tables`; não
  esquecer tabelas novas criadas depois — incluir verificação no checklist de SQL).
- Textos de e-mail de confirmação e de aprovação/recusa.
- Visual da página, seguindo a paleta do portal.
