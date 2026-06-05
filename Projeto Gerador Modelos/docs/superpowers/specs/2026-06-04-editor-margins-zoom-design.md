# Design: Correção de Margens e Botão de Zoom no Editor de Modelos

**Data:** 2026-06-04  
**Status:** Aprovado

---

## Problema

A tela de edição de modelos (`#modal-modelo`) possui um editor rico (`contenteditable`) com `padding: 12px 14px`. O PDF gerado usa `padding: 16px 18px` no corpo e `padding: 12px 18px` no cabeçalho. Essa diferença faz com que o recuo visual do texto no editor não corresponda ao output real, causando surpresas ao gerar o documento.

Adicionalmente, quando um template contém tabelas ou conteúdo com largura fixa, o editor gera scroll horizontal sem forma de ajustá-lo.

---

## Solução

### 1. Correção de Margens

**Arquivo:** `styles.css`  
**Classe:** `.editor-content`  
**Mudança:** `padding: 12px 14px` → `padding: 16px 18px`

Alinha o padding interno do editor com o padding do corpo do PDF (`padding: 16px 18px` em `exportarPDF()`), garantindo fidelidade visual entre edição e output.

### 2. Botão "Ajustar Zoom"

**Arquivo:** `index.html` — toolbar do editor (`div.editor-toolbar`)  
Adicionar após o separador final (após `✕ Fmt`):

```html
<div class="tb-sep"></div>
<button type="button" class="tb-btn" id="tb-fit-zoom" onclick="toggleFitZoom()" title="Ajustar zoom para caber na janela">⛶ Ajustar</button>
```

**Arquivo:** `app.js`  
Adicionar função `toggleFitZoom()`:

```js
function toggleFitZoom() {
  const editor = document.getElementById('modelo-template');
  const btn = document.getElementById('tb-fit-zoom');
  if (editor.style.zoom && editor.style.zoom !== '1') {
    editor.style.zoom = '';
    btn.textContent = '⛶ Ajustar';
    return;
  }
  const factor = editor.clientWidth / editor.scrollWidth;
  if (factor >= 1) {
    toast('Conteúdo já cabe na janela.', '');
    return;
  }
  editor.style.zoom = factor;
  btn.textContent = '⛶ 100%';
}
```

**Comportamento:**
- Clique 1: se há overflow horizontal, aplica `zoom = clientWidth / scrollWidth`, botão vira "⛶ 100%"
- Clique 2 (ou se não há overflow): reseta zoom para 100%, botão volta a "⛶ Ajustar"
- Se não há overflow na primeira tentativa: exibe toast informativo, não altera estado

---

## Escopo

- Apenas `styles.css`, `index.html` e `app.js` do Projeto Gerador Modelos
- Sem mudanças no HTML do modal, lógica de salvar/carregar, ou fluxo do wizard
- Sem novos arquivos

---

## Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `styles.css` | `.editor-content` padding: `12px 14px` → `16px 18px` |
| `index.html` | Adiciona separador + botão `#tb-fit-zoom` na toolbar |
| `app.js` | Adiciona função `toggleFitZoom()` |
