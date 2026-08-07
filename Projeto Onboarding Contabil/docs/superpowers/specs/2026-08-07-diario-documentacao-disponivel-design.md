# Selo "Documentação Disponível" na Grade Mensal (Diário Contábil)

## Contexto

Na grade mensal do Diário Contábil (`diario.js:renderGradeMensal`), cada mês
começa em `nao_iniciado` (sem linha em `contabil_diario_status_mensal` — é o
default de `statusDoMes`) até alguém clicar na célula e chamar `iniciarMes`.
Hoje não existe nenhum sinal de que a documentação do cliente já chegou e o
Prestador de Serviço pode começar a lançar aquele mês — ele só descobre
perguntando ou tentando.

## O que muda

Um pequeno selo (ícone 📄) no canto superior esquerdo das células
"Não Iniciado" da grade, sinalizando que a documentação do mês está
disponível.

1. **Quem marca:** só equipe Scont (`_isAdmin || _isScontTeam`, mesma
   condição já usada em `_podeEditarMapeamento`). Prestador de Serviço nunca
   marca/desmarca.
2. **Onde aparece:**
   - Para Scont/Admin: o selo aparece em **todas** as células
     "Não Iniciado", em dois estados visuais — apagado/contorno (não
     marcado, classe `.doc-nao-marcado`) ou colorido (marcado, classe
     `.doc-disponivel`). Clique alterna entre os dois estados
     (`alternarDocumentacaoDisponivel`), com `stopPropagation` para não
     disparar o clique da célula (que hoje chama `iniciarMes`).
   - Para quem não é Scont/Admin: o selo só é desenhado quando
     `disponivel === true` (classe `.doc-disponivel`, sem handler de
     clique) — nada aparece quando não está marcado, mantendo a tela
     limpa para a maioria dos usuários.
3. **Desaparece sozinho ao iniciar:** o selo só é desenhado quando
   `status === 'nao_iniciado'`. Assim que o mês vira `em_andamento`
   (`iniciarMes`), a célula troca de classe e o selo para de aparecer na
   tela. O registro em `contabil_diario_documentacao` **não é apagado**
   nem alterado por essa transição — só some da UI porque perdeu a função.
4. **Tooltip** (`title` da célula, mesmo padrão do `titulo` já montado em
   `renderGradeMensal`): quando marcado, acrescenta
   " — Documentação disponível"; sem mudança quando não marcado.

## Modelo de dados

Nova tabela `contabil_diario_documentacao`, independente de
`contabil_diario_status_mensal` (que só tem linha quando o mês sai de
"Não Iniciado" — misturar os dois exigiria mexer nessa lógica implícita e
na CHECK constraint de status):

```sql
create table contabil_diario_documentacao (
  id uuid primary key default gen_random_uuid(),
  codigo_empresa text not null,
  ano int not null,
  mes int not null,
  disponivel boolean not null default false,
  marcado_por_nome text,
  marcado_por_email text,
  marcado_em timestamptz not null default now(),
  unique (codigo_empresa, ano, mes)
);
alter table contabil_diario_documentacao enable row level security;
create policy "authenticated_all" on contabil_diario_documentacao
  for all to authenticated using (true) with check (true);
```

Mesma convenção RLS `authenticated` do resto do módulo (client-side gating
para quem pode escrever, igual ao Mapeamento Estratégico) — arquivo
`_sql/schema_contabil_diario_documentacao.sql`, **10º SQL pendente do
módulo**, pendente de execução manual (registrar em
`project_central_departamento_contabil` depois de rodar/aplicar).

## Carregamento e estado em memória

`carregarDadosDiario()` busca `contabil_diario_documentacao` em paralelo
com as demais tabelas (mesmo padrão do fetch de `contabil_diario_status_mensal`
já existente) e monta `documentacaoPorEmpresa = { codigo_empresa: { 'ano-mes':
true|false } }`. Helper `documentacaoDisponivelDoMes(codigoEmpresa, ano, mes)`
espelha `statusDoMes`/`motivoPendenciaDoMes` (default `false` quando não há
linha). Exposto em `window.__diarioContext` só se algum outro arquivo do
módulo vier a precisar (não é o caso agora — fica de fora até haver uso real,
YAGNI).

## Toggle e auditoria

`alternarDocumentacaoDisponivel(codigoEmpresa, ano, mes)`:
- Bloqueado se `!(_isAdmin || _isScontTeam)` (defesa em profundidade — a UI já
  não desenha o clique pra quem não pode).
- `upsert` em `contabil_diario_documentacao` com `disponivel` invertido,
  `marcado_por_nome`/`marcado_por_email` (de `window.__contabilAuth`) e
  `marcado_em = now()`.
- Em caso de erro, `mostrarToast('Erro ao atualizar a documentação disponível.', 'erro')`
  e não atualiza o estado local (mesmo padrão de `transicionarStatusMes`).
- Em caso de sucesso, atualiza `documentacaoPorEmpresa` em memória e chama
  `registrarAuditoria(codigoEmpresa, campo, valorAnterior, valorNovo, null)`
  com `campo = "Documentação Disponível — MES/ANO"` e valores "Sim"/"Não" —
  mesma função já usada pelas transições de status, então o evento aparece
  automaticamente na tela de Histórico (`diario-historico.js`) sem mudança
  lá.
- Re-renderiza a grade (`renderGradeMensal()`), mesmo padrão de
  `transicionarStatusMes`.

## CSS

Nova classe `.btn-icone-doc`, mesmas dimensões/posicionamento de
`.btn-icone-fechamento` só espelhado (`top:-6px; left:-6px` em vez de
`right:-6px`), para não colidir visualmente caso um dia as duas aparecessem
juntas (hoje não colidem: fechamento só em `concluido`, documentação só em
`nao_iniciado`):
- `.doc-disponivel` — fundo colorido (reaproveita `var(--brand)`), ícone
  branco.
- `.doc-nao-marcado` — fundo transparente, borda tracejada/opacity baixa
  (só existe para Scont/Admin; nunca renderizado para quem não pode marcar).

## Fora de escopo

- Sem e-mail/notificação — só o selo visual, pedido explícito do usuário.
- Sem mudança em Relatórios ou Validações.
- Sem forma de "desfazer" a passagem de `nao_iniciado` → `em_andamento`
  ligada a isso — o fluxo de iniciar o mês continua exatamente como hoje.
