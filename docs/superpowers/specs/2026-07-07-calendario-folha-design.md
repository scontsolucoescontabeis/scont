# Calendário da Folha de Pagamento — Design

**Data:** 07/07/2026
**Ferramenta:** `Projeto Calendario Folha/` (nova ferramenta do Portal SCONT)

## Objetivo

Ferramenta de cronograma e controle das atividades da folha de pagamento para o
departamento pessoal do escritório, que processa a folha de **diversas empresas
clientes**. Centraliza prazos legais, rotinas internas, alertas e observações em
um calendário multi-empresa, com acompanhamento de status por atividade.

## Decisões de arquitetura

- **Mesmo padrão das demais ferramentas:** HTML/CSS/JS vanilla + Supabase,
  autenticação via `portal-auth-guard.js` (`init(1)`), paleta do `shared.css`
  (bordô `#8B3A3A` → azul `#2C3E50`), registro no catálogo `ferramentas`.
- **Reuso de dados existentes:**
  - `rh_empresas` — lista de empresas (não cria cadastro paralelo);
  - `rh_feriados` — feriados globais, usados no cálculo de dia útil.
- **Novas tabelas** (RLS: leitura/escrita para `authenticated`, como nos módulos RH/Fechamento):
  - `cal_folha_templates` — cronograma recorrente (modelos de atividade);
  - `cal_folha_eventos` — eventos concretos do calendário.

## Modelo do cronograma recorrente (diferencial "grandes RHs")

Cada modelo define **regra de data** em vez de data fixa:

| Campo | Valores | Uso |
|---|---|---|
| `regra` | `dia_fixo`, `dia_util` (n-ésimo), `ultimo_dia_util` | ex.: pagamento no 5º dia útil |
| `mes_offset` | 0 = mesmo mês, 1 = mês seguinte à competência | ex.: FGTS dia 20 do mês seguinte |
| `mes_especifico` | null = todo mês; 1–12 | ex.: 13º só em nov/dez |
| `ajuste` | `antecipa`, `posterga`, `mantem` | quando cai em fim de semana/feriado |
| `codigo_empresa` | null = todas as empresas | modelos globais são expandidos por empresa |

**Geração de competência:** botão "⚡ Gerar competência" cria os eventos do mês
escolhido — um por empresa — com data calculada e ajustada por dias úteis.
Idempotente: eventos já gerados são pulados (deduplicação no cliente + índice
único parcial `(template_id, codigo_empresa, competencia)` no banco), preservando
status/observações já lançados.

**Seed:** recebimento de variáveis (dia 25), fechamento (último dia útil),
pagamento de salários (5º dia útil do mês seguinte), eSocial S-1299 (dia 15),
FGTS Digital e DCTFWeb (dia 20 do mês seguinte), 13º 1ª/2ª parcela (30/11 e 20/12).

## Eventos

- Campos: empresa (ou geral), título, descrição/observações, tipo (fechamento,
  pagamento, obrigação, envio, férias, 13º, alerta, observação, outro),
  prioridade (crítico/urgente/atenção/info — mesma escala da Central de Alertas),
  data, competência, status (pendente → em andamento → concluído), responsável,
  origem (manual/cronograma).
- Conclusão registra **quem** e **quando** (`concluido_por`, `concluido_em`).
- "Atrasado" é derivado: data < hoje e não concluído (observações não contam).

## Interface

- **Stats:** para hoje, atrasados (todas as datas), próximos 7 dias, concluídos no mês —
  chips clicáveis que aplicam filtro rápido.
- **Faixa de alertas** com pendências vencidas, clicáveis.
- **3 visões:** Mês (grade com pills coloridas por tipo, feriados e hoje marcados),
  Agenda (lista cronológica com cards e check rápido de status) e
  Empresas (quadro por empresa com barra de progresso do fechamento).
- **Filtros:** empresa, tipo, status (incl. atrasado).
- **Extras:** exportação `.ics` (Outlook/Google Agenda), toques rápidos de status
  (pendente → andamento → concluído) direto no card, modal por dia.

## Fora de escopo (por ora)

Notificações push/e-mail (a Central de Alertas pode consumir `cal_folha_eventos`
futuramente), recorrência semanal, anexos por evento e permissão por empresa.
