# SLA de Atendimento — Design Spec

**Data:** 2026-06-07  
**Status:** Aprovado  

---

## Contexto

O CRM Messenger não possui controle de tempo de resposta. Conversas abertas podem ficar sem atendimento por tempo indeterminado, sem nenhum aviso visível. O objetivo é implementar SLAs configuráveis por departamento que alertem agentes e admins quando o tempo de atendimento inicial está se aproximando do limite.

---

## Definição de SLA

**O relógio começa** quando a conversa é criada (`aberto_em`).

**O relógio para** quando ocorrer o primeiro dos dois:
- Agente clica em "Assumir" (status muda para `EM_ATENDIMENTO`)
- Agente envia qualquer mensagem na conversa

**SLA ativo** apenas para conversas com `status = 'ABERTA'` sem nenhuma mensagem de `origem = 'AGENTE'`.

---

## Modelo de Dados

### Nova tabela `sla_config` (migração `010_sla_config.sql`)

```sql
CREATE TABLE sla_config (
  departamento          departamento_enum PRIMARY KEY,
  tempo_maximo_min      INT NOT NULL DEFAULT 30,
  threshold_aviso_min   INT NOT NULL DEFAULT 10, -- minutos restantes → aviso amarelo
  threshold_critico_min INT NOT NULL DEFAULT 5,  -- minutos restantes → crítico vermelho
  ativo                 BOOLEAN NOT NULL DEFAULT true,
  atualizado_em         TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: leitura para usuários autenticados, escrita apenas admin
ALTER TABLE sla_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_config_read" ON sla_config FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sla_config_write" ON sla_config FOR ALL USING (
  EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Dados iniciais (defaults conservadores)
INSERT INTO sla_config (departamento, tempo_maximo_min, threshold_aviso_min, threshold_critico_min) VALUES
  ('PESSOAL',        30, 10, 5),
  ('CONTABIL',       30, 10, 5),
  ('ADMINISTRATIVO', 30, 10, 5),
  ('TRIBUTARIO',     30, 10, 5);
```

**Nenhuma coluna nova em `conversas`.** O cálculo é feito no frontend.

---

## Arquitetura Frontend

### Fluxo de dados

```
CRMPage carrega sla_config (buscarSLAConfig)
              ↓
useConversas → conversas[]   (já filtrado por dept via RLS para agentes)
                    ↓
              useSLA(conversas, slaConfig) → conversasComSLA[]
                    ↓                                ↓
             ConversaList                       PainelSLA
            (badge nos cards)          (painel agrupado por dept)
```

### Hook `useSLA` — `src/hooks/useSLA.js`

- Recebe `conversas[]` (já filtrado pelo RLS do `useConversas`) e `slaConfig` (carregada em `CRMPage` via `buscarSLAConfig()`)
- Roda `setInterval` a cada **30s** recalculando status de cada conversa
- Lógica por conversa:
  - Se `status !== 'ABERTA'` ou existe mensagem com `origem === 'AGENTE'` → `sla_status: 'OK'` (SLA parado)
  - `tempoRestante = tempoMaximo - (Date.now() - new Date(aberto_em))`
  - `tempoRestante <= 0` → `'VENCIDO'`
  - `tempoRestante <= threshold_critico_min * 60000` → `'CRITICO'`
  - `tempoRestante <= threshold_aviso_min * 60000` → `'AVISO'`
  - Caso contrário → `'OK'`
- Retorna `conversasComSLA[]` com campos extras: `sla_status`, `sla_tempo_restante_ms`
- A filtragem de visibilidade (agente vê só seu dept, admin vê tudo) é responsabilidade do RLS do Supabase, transparente para este hook

### Serviço — `src/services/crm.service.js` (adições)

```js
buscarSLAConfig()           // SELECT * FROM sla_config ORDER BY departamento
salvarSLAConfig(rows)       // UPSERT sla_config (array de departamentos)
```

---

## Componentes de UI

### 1. Badge SLA em `ConversaCard.jsx`

Exibido no canto superior direito do card, apenas quando `sla_status !== 'OK'`:

| Estado   | Cor de fundo | Comportamento |
|----------|-------------|---------------|
| AVISO    | `#f59e0b`   | Estático      |
| CRITICO  | `#ef4444`   | Pisca (CSS animation) |
| VENCIDO  | `#6b7280`   | Texto "VENCIDO", estático |

Formato do timer: `MM:SS` usando `font-variant-numeric: tabular-nums` para evitar saltos de layout.

### 2. Painel SLA — `src/components/PainelSLA/PainelSLA.jsx`

- Renderizado acima do `PainelDireito` na coluna direita
- Visível apenas quando há conversas com `sla_status !== 'OK'`
- Agrupa por departamento, dentro de cada grupo ordena: CRITICO primeiro, depois AVISO, depois VENCIDO
- Cada item mostra: nome do contato, telefone, protocolo, timer rodando
- Badge de contagem total no cabeçalho ("SLA — ATENÇÃO · 2")

### 3. Página de config admin — `src/pages/SLAConfigPage.jsx`

- Rota: `/crm/sla` (visível apenas para `role === 'ADMIN'`)
- Tabela com uma linha por departamento, colunas:
  - Departamento (com cor)
  - Tempo máximo (input numérico, minutos)
  - Threshold aviso — minutos restantes (input numérico)
  - Threshold crítico — minutos restantes (input numérico)
  - Toggle ativo/inativo
- Validação inline: `threshold_critico < threshold_aviso < tempo_maximo`
- Botão único "Salvar configurações" — faz upsert de todas as linhas

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/010_sla_config.sql` | Tabela, RLS e dados iniciais |
| `src/hooks/useSLA.js` | Hook com timer e cálculo de status |
| `src/components/PainelSLA/PainelSLA.jsx` | Painel lateral agrupado por dept |
| `src/pages/SLAConfigPage.jsx` | Tela admin de configuração |

## Arquivos a Modificar

| Arquivo | O que muda |
|---------|-----------|
| `src/pages/CRMPage.jsx` | Integra `useSLA`, passa `conversasComSLA` para `ConversaList` e `PainelSLA` |
| `src/components/ConversaList/ConversaCard.jsx` | Adiciona badge SLA com timer |
| `src/components/PainelDireito/PainelDireito.jsx` | Encapsula com `PainelSLA` acima |
| `src/App.jsx` | Adiciona rota `/crm/sla` e link "SLA" no menu admin |
| `src/services/crm.service.js` | Adiciona `buscarSLAConfig` e `salvarSLAConfig` |

---

## Verificação (como testar)

1. **Migração**: rodar `010_sla_config.sql` no SQL Editor do Supabase; confirmar que `sla_config` tem 4 linhas
2. **Config admin**: acessar `/crm/sla`, alterar threshold de um departamento, salvar; recarregar e confirmar persistência
3. **Badge no card**: abrir uma conversa com status ABERTA há mais tempo que o threshold aviso; confirmar que aparece badge amarelo com timer
4. **Badge crítico**: aguardar ou ajustar thresholds para segundos; confirmar badge vermelho piscando
5. **Painel lateral**: confirmar que aparece agrupado por departamento e ordenado CRITICO → AVISO → VENCIDO
6. **SLA para**: assumir uma conversa com SLA ativo; confirmar que badge some e conversa sai do painel
7. **Visibilidade**: logar como agente de um departamento; confirmar que só vê SLA do próprio departamento
8. **Admin vê tudo**: logar como admin; confirmar que vê alertas de todos os departamentos no painel
