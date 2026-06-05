# Design: Inserção de Tabelas no Editor de Modelos

**Data:** 2026-06-05  
**Status:** Aprovado

---

## Problema

O editor de templates não permite inserir tabelas, limitando a criação de documentos que precisam apresentar dados em grade (recibos, planilhas de controle, fichas).

---

## Solução

### Botão na Toolbar

Adicionar botão `⊞ Tabela` no final da toolbar do editor (após separador). Ao clicar, salva o range atual do cursor e abre o grid picker.

### Grid Picker

- Dropdown `div#tb-table-picker` com `position: fixed`, posicionado dinamicamente abaixo do botão
- Grid de **8 colunas × 6 linhas** de células (24×24 px, gap 2 px)
- Label acima: "Selecione o tamanho" → atualiza para "N × M" ao hover
- Hover ilumina células de (1,1) até (N,M) com `var(--primary)`
- Clique insere a tabela e fecha o picker
- Fecha ao clicar fora ou pressionar `Esc`

### Tabela Inserida

Estilos inline (preservados no PDF):

| Elemento | Estilo |
|---|---|
| `<table>` | `width:100%; border-collapse:collapse; margin:8px 0` |
| `<th>` (cabeçalho) | `background:#8B3A3A; color:white; padding:8px 10px; border:1px solid #6B2A2A` |
| `<td>` linha ímpar | `background:#fff; padding:8px 10px; border:1px solid #ddd` |
| `<td>` linha par | `background:#f8f9fa; padding:8px 10px; border:1px solid #ddd` |

Cada célula pré-preenchida com `&nbsp;` para ter altura visível. Cursor posicionado após a tabela após inserção.

---

## Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `styles.css` | Classes `.tb-table-picker`, `.tb-table-grid`, `.tb-table-cell`, `.tb-table-cell.hl`, `.tb-table-label` |
| `index.html` | Botão `⊞ Tabela` na toolbar + `div#tb-table-picker` antes de `</body>` |
| `app.js` | Funções `openTablePicker`, `closeTablePicker`, `highlightTableCells`, `insertTable` + listeners globais |
