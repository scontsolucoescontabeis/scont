# Grade Mensal — novo fluxo de status com rastreamento de tempo

Data: 2026-08-02
Módulo: Diário Contábil (Central do Departamento Contábil)

## Contexto

A grade mensal (JAN–DEZ por empresa, `diario.js`/`contabil_diario_status_mensal`)
tinha um ciclo fixo de 3 estados no clique: `sem_documentacao` (cinza) →
`pendencias` (laranja) → `concluido` (verde) → `sem_documentacao`. Pedido do
usuário: substituir por uma máquina de estados com ramificação, exigir
motivo ao abrir uma pendência, e apresentar — no momento em que a equipe
Scont valida o fechamento do mês — o tempo total do fechamento, o tempo
perdido em pendência e o tempo efetivamente trabalhado.

## Máquina de estados

```
(sem linha)  --clique-->  em_andamento (amarelo)
em_andamento --popover: "Marcar Pendência" (+ motivo obrigatório)-->  pendencia (vermelho)
em_andamento --popover: "Marcar Concluído"-->  concluido (verde)
pendencia    --clique (resolve, sem nota)-->  em_andamento
concluido    --clique + confirmação (reabrir, só se fechamento != aprovado)-->  em_andamento
```

`concluido` continua sem disparar automaticamente o envio para validação —
o botão separado "📤 Encerrar mês contábil" (fluxo já existente de
`contabil_diario_fechamentos`) permanece um passo manual à parte.

## Dados e cálculo de tempo

Nenhuma tabela nova. Cada transição já grava uma linha em
`contabil_diario_auditoria` (campo, valor_anterior, valor_novo,
created_at) — isso já é suficiente para derivar os tempos. Adições:

- `contabil_diario_auditoria.observacao` (nullable): motivo digitado ao
  abrir uma pendência (permite reconstruir o motivo de cada episódio).
- `contabil_diario_status_mensal.motivo_pendencia` (nullable): espelha o
  motivo da pendência *atual*, só para exibir tooltip na célula sem
  precisar consultar o histórico.
- `contabil_diario_status_mensal.status` CHECK passa a aceitar
  `em_andamento`/`pendencia`/`concluido` (valores antigos migrados:
  `pendencias`→`pendencia`; `sem_documentacao` nunca era persistido).

`calcularTemposFechamento(eventos)` (pura, `contabil-diario-util.js`):
recebe os eventos de auditoria de um `codigo_empresa/ano/mes` e retorna
`{ inicio, fim, totalMs, pendenciaMs, efetivoMs }`, ou `null` se o mês
ainda não chegou a "Concluído". `fim` é a última transição para
Concluído — o fim da atividade contábil em si, não a aprovação da Scont
(que pode acontecer dias depois por motivo administrativo, à parte).
`efetivoMs = totalMs - pendenciaMs`.

## Onde é exibido

- Modal "Fechamento do Mês" (`diario.js`): nova seção "Tempos do
  Fechamento" acima da Linha do Tempo, sempre que
  `calcularTemposFechamento` não for `null`.
- Tela Validações (`diario-validacoes.js`), tabela "Pendentes para você"
  do validador: nova coluna "Tempo total".

## Fora de escopo

- Sem tabela dedicada de episódios de pendência (derivado da auditoria).
- Sem alteração no fluxo de encerramento/aprovação/rejeição já existente.
- Reabertura de um mês `concluido` é sempre manual (clique + confirmação),
  não é automática ao rejeitar um fechamento.

## SQL pendente

`_sql/schema_contabil_diario_grade_tempos.sql` — roda depois de
`schema_contabil_diario.sql` e `schema_contabil_diario_auditoria.sql`
(que também seguem pendentes, ver memória do módulo).
