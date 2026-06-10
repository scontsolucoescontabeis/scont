# Design: Filtro de Empregados + Modo Manual Folgas — Benefícios VA/VT

**Data:** 2026-06-10  
**Status:** Aprovado

## Escopo

Dois ajustes independentes na ferramenta Benefícios VA/VT (`Projeto Beneficios/`):

1. Tela Lançamentos — seleção múltipla de empregados via painel de checkboxes
2. Tela Escalas — modo manual inverte lógica: marcar folgas em vez de dias trabalhados

---

## Ajuste 1: Filtro de empregados (Lançamentos)

### Problema atual
O `<select id="lancEmpregados">` oferece apenas "Todos os empregados". Não é possível gerar o TXT para um subconjunto de empregados.

### Solução

**HTML (`index.html`):** substituir o `<select>` por um painel expansível:

```
[ 👥 Filtrar empregados ▼ ]   ← botão toggle
┌─────────────────────────────┐
│ ☑ Todos os empregados        │
│ ─────────────────────────── │
│ ☑ 001 — Ana Silva            │
│ ☑ 002 — Carlos Souza         │
│ ☐ 003 — João Lima            │  ← desmarcado
└─────────────────────────────┘
```

- Checkbox "Todos" no topo: marcar = seleciona todos; desmarcar = desmarca todos; estado indeterminado quando seleção parcial
- Lista scrollável (max-height ~180px)
- Botão mostra contagem: "👥 Todos" ou "👥 3 selecionados"
- Painel fecha ao clicar fora

**Estado (`script.js`):**
- Adicionar `S.lancamento.filtroEmps: Set<string>` — vazio = todos
- `buildGrade()` usa `empregadosFiltrados()` = `S.empregados` filtrado pelo Set (ou todos se Set vazio)
- `renderGrade()`, `salvarLancamento()`, `gerarTxt()` operam sobre `S.lancamento.linhas` (já filtradas)

**Comportamento:**
- Ao trocar empresa: filtro é resetado (todos selecionados)
- `tryLoadLancamento()` carrega todas as linhas; após carregar, filtra a exibição pelo filtro atual
- Ao desmarcar empregados e salvar: `linhas_json` no Supabase contém apenas os empregados selecionados

---

## Ajuste 2: Modo manual — marcar folgas (Escalas)

### Problema atual
`S.escalas.diasManuais` guarda os dias **trabalhados**. O usuário precisa clicar em cada dia de trabalho. Para eschedules padrão com poucos faltosos, é mais intuitivo marcar só as folgas.

### Solução

**Estado (`script.js`):**
- Renomear `S.escalas.diasManuais` → `S.escalas.diasFolga` (`Set<string>` de datas YYYY-MM-DD)
- Semântica: dias **não trabalhados** explicitamente marcados pelo usuário

**Cálculo (`calcManual`):**
```
trabalhados = todos os dias do mês − diasFolga − feriados marcados
```
Todos os dias (incluindo fins de semana) começam como "trabalhado"; usuário marca as exceções.

**Visual (`renderCalendario` modo manual):**
- Dia não em `diasFolga` e não feriado → classe `work` (verde) + cursor pointer
- Dia em `diasFolga` → classe padrão (branco/cinza) + cursor pointer
- Feriado → classe `holiday` (vermelho), não clicável

**HTML (`index.html`):**
- Label do card: "🖱️ Marque as folgas" (era "Selecione os dias manualmente")
- Hint text: "Clique nos dias para marcar como folga" (era "marcar como trabalhado")
- Legenda calendário: "🟢 Trabalhado · ⬜ Folga marcada · 🔴 Feriado descontado"

**Limpeza de estado:**
- Ao trocar empresa ou mês de referência: `diasFolga` é limpo (reset)

---

## Arquivos Alterados

| Arquivo | Mudanças |
|---|---|
| `Projeto Beneficios/index.html` | Substituir `<select lancEmpregados>` por painel checkbox; atualizar labels modo manual |
| `Projeto Beneficios/script.js` | `filtroEmps` no state; `empregadosFiltrados()`; painel checkbox listeners; renomear `diasManuais→diasFolga`; inverter `calcManual`; inverter visual manual |
| `Projeto Beneficios/styles.css` | Estilos do painel de filtro (`.filtro-painel`, `.filtro-btn`, checkboxes) |

## O que NÃO muda

- Lógica dos modos "Dias da Semana" e "Revezamento"
- Schema do Supabase — nenhuma alteração de banco
- Salvar/carregar lançamentos (`linhas_json`) — apenas o conteúdo filtrado é salvo
