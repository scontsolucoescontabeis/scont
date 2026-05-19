# Design: Fechamento Folha — Config + Rascunho Quadrante

**Data:** 2026-05-19  
**Escopo:** Dois ajustes no módulo Fechamento Folha de Pagamento

---

## 1. Tela de Configurações — corrigir tabela referenciada

### Problema
A tela de Configurações em `Projeto Fechamento Folha/index.html` consulta e grava na tabela `fechamento_rubrica_associacoes`, que não é a tabela canônica do módulo. A tabela correta — definida em `schema_fechamento.sql` — é `fechamento_rubricas_config`.

### Schema de `fechamento_rubricas_config`
| Coluna | Tipo | Obrigatório | Default |
|---|---|---|---|
| id | UUID | sim (PK) | gen_random_uuid() |
| codigo_empresa | TEXT | sim | — |
| coluna_planilha | TEXT | sim | — |
| codigo_rubrica | TEXT | sim | — |
| tipo_processo | TEXT | sim | `'01'` |
| tipo_valor | TEXT | sim | `'monetario'` |
| descricao | TEXT | não | — |
| ativo | BOOLEAN | sim | TRUE |
| data_criacao | TIMESTAMPTZ | sim | NOW() |

Constraint de unicidade: `(codigo_empresa, coluna_planilha)`

### Mudanças no formulário de adição
Substituir os 3 campos atuais (Empresa, Descrição da Rubrica, Código da Rubrica) pelos campos corretos:
- **Empresa** — select (já existente, mantém)
- **Coluna da Planilha** — text input (nome exato do cabeçalho no Excel)
- **Código da Rubrica** — text input
- **Tipo de Processo** — text input pequeno (default `01`)
- **Tipo de Valor** — select: `monetario` | `minutos` | `dias` | `booleano`
- **Descrição** — text input (opcional)
- **Ativo** — checkbox (default marcado)

Upsert usa `onConflict: 'codigo_empresa,coluna_planilha'`.

### Mudanças na tabela de listagem
Colunas: Empresa · Coluna Planilha · Cód. Rubrica · Tipo Processo · Tipo Valor · Descrição · Ativo · Ações  
Ações: botão Excluir (já existente) + toggle Ativo (novo).

---

## 2. Rascunho com Auto-save — `formulario_quadrante.html`

### Objetivo
Permitir que o usuário salve o preenchimento parcial e retome de onde parou, mesmo trocando de dispositivo (desde que autenticado).

### Estratégia de persistência: Supabase primário + localStorage fallback
1. Auto-save dispara a cada **3 segundos** após qualquer alteração.
2. Tenta gravar no Supabase (`quadrante_folha_rascunho`).
3. Se bem-sucedido → grava também no localStorage (cache offline) e exibe `☁ Salvo às HH:MM`.
4. Se Supabase falhar → grava apenas no localStorage com flag `_offline: true` e exibe `💾 Salvo localmente HH:MM`.

### Tabela `quadrante_folha_rascunho` (nova — precisa ser criada no Supabase)
```sql
CREATE TABLE IF NOT EXISTS public.quadrante_folha_rascunho (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_codigo TEXT NOT NULL,
    competencia    TEXT NOT NULL,
    tipo_folha     TEXT NOT NULL,
    dados          JSONB NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT quadrante_rascunho_unique UNIQUE (empresa_codigo, competencia, tipo_folha)
);
ALTER TABLE public.quadrante_folha_rascunho ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rascunho: autenticado" ON public.quadrante_folha_rascunho
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
```

### Carregamento na inicialização
Ordem de prioridade no `DOMContentLoaded`:
1. Busca no Supabase (`quadrante_folha_rascunho` para empresa `453`).
2. Lê localStorage.
3. Compara `updated_at` / `savedAt` — usa o mais recente.
4. Se encontrou rascunho: exibe toast "Rascunho de DD/MM/AAAA HH:MM encontrado. Continuar?" com botões Sim / Não.
5. Se Sim: carrega dados do rascunho.
6. Se Não: usa `EMPLOYEES_DEFAULT` e `CONVENIOS_DEF`.

### Indicador visual (legSave)
- `☁ Salvo às 14:32` — Supabase OK
- `💾 Salvo localmente 14:32` — apenas localStorage
- `⏳ Salvando…` — durante o save

### Timer
`scheduleAutoSave()`: de `setTimeout(salvarLocal, 1800)` → `setTimeout(salvarLocal, 3000)`

### Sem regressões
- Botão "💾 Salvar rascunho" continua funcionando (chama `salvarLocal()` manualmente).
- Fluxo "📤 Enviar para Fechamento" permanece inalterado (continua gravando em `quadrante_folha_envios` e `quadrante_folha_rascunho`).

---

## Arquivos afetados
| Arquivo | Mudança |
|---|---|
| `Projeto Fechamento Folha/index.html` | Substituir toda a lógica da tela Config para usar `fechamento_rubricas_config` |
| `Projeto Fechamento Folha/formulario_quadrante.html` | Ajustar auto-save (3s), salvarLocal com Supabase, carregarLocal com prioridade Supabase |
| `Projeto Fechamento Folha/schema_fechamento.sql` | Adicionar SQL de criação da tabela `quadrante_folha_rascunho` |
