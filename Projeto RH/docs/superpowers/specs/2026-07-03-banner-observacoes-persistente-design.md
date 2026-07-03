# Design: Banner de Observações Persistente entre Telas

**Data:** 2026-07-03
**Arquivos principais:** `index.html`, `script.js`

---

## Problema

O banner de observações da empresa (`#empresaObservacoesBanner`) está aninhado dentro da `<div id="mainScreen">`. Como `mostrarTela()` alterna a visibilidade das telas trocando `display: none`/`block` em cada `<div>` de tela, o banner desaparece assim que o usuário sai da tela de lançamento (`mainScreen`) para a tela de resultados (`resultsScreen`), mesmo que a empresa selecionada continue com observação cadastrada.

---

## Solução

### 1. Reposicionar o banner

Mover `<div id="empresaObservacoesBanner">` para fora das três telas (`selectionScreen`, `mainScreen`, `resultsScreen`), como elemento irmão delas dentro do mesmo container pai (`.container`), antes da primeira tela. Isso o torna independente de qual tela está visível.

### 2. Desacoplar "tem observação" de "está visível"

Hoje `selecionarEmpresa()` decide a visibilidade diretamente:
```js
obsBanner.style.display = observacoes ? 'flex' : 'none';
```

Isso muda para armazenar apenas a informação ("há observação e qual o texto"), sem decidir exibição:
```js
obsTexto.textContent = observacoes;
obsBanner.dataset.temObservacao = observacoes ? '1' : '0';
```

`selecionarEmpresa()` roda enquanto o usuário ainda está na tela de seleção (ao escolher uma empresa no autocomplete, antes de clicar "Continuar") — por isso não pode ser ela a decidir a visibilidade final; só quem sabe qual tela está ativa é `mostrarTela()`.

### 3. `mostrarTela()` passa a controlar a visibilidade do banner

Único ponto do código que já centraliza toda troca de tela. Ao trocar para qualquer tela, recalcula:
```js
const obsBanner = document.getElementById('empresaObservacoesBanner');
if (obsBanner) {
    obsBanner.style.display = (telaId !== 'selectionScreen' && obsBanner.dataset.temObservacao === '1')
        ? 'flex'
        : 'none';
}
```

Resultado: oculto na tela inicial de seleção; visível em `mainScreen` e `resultsScreen` sempre que a empresa selecionada tiver observação cadastrada — inclusive depois de processar os lançamentos.

---

## O que NÃO muda

- Conteúdo/estrutura interna do banner (ícone, texto, estilo visual).
- Cadastro da observação no modal de Configuração de Rubricas.
- O banner continua não podendo ser fechado manualmente (comportamento fixo já definido antes).

---

## Arquivos Impactados

- `index.html` — mover o `<div id="empresaObservacoesBanner">` para fora das três telas.
- `script.js` — `selecionarEmpresa()` (guardar em `dataset` em vez de `style.display`), `mostrarTela()` (calcular a visibilidade do banner a cada troca de tela).
