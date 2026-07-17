# Gerador de Modelos — opção "Ajustar para caber em 1 página"

## Contexto

`_abrirJanelaImpressao()` (app.js) monta cada documento com fonte fixa
(11px/1.7 de entrelinha) e margens fixas de página (`@page { margin: 12mm
15mm; size: A4 portrait; }`), sem nenhum mecanismo para lidar com
documentos cujo conteúdo estoura a altura de uma página A4 — o excedente
simplesmente vai para uma 2ª página física, o que é indesejado para
modelos pensados para caber numa folha só (ex.: recibos, termos curtos com
uma linha de assinatura sobrando na página 2).

## Requisito

O usuário deve poder marcar uma opção, no painel Exportar, para que cada
documento gerado seja encolhido o suficiente para caber em 1 página A4,
preservando a proporção do conteúdo. Documentos que já cabem não devem ser
alterados.

## Abordagem

### 1. Novo estado do wizard

```js
let wizardCaberUmaPagina = false;
```

Resetado (`= false`) junto com `wizardCabecalho` em `iniciarWizard()` e no
ponto onde o cabeçalho padrão do modelo é aplicado (~app.js linha 963).

### 2. UI — painel Exportar, card "Opções de Cabeçalho"

Novo checkbox abaixo dos 3 radios de cabeçalho existentes:

```html
<label style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:13px;color:var(--text)">
  <input type="checkbox" id="chk-caber-uma-pagina" onchange="wizardCaberUmaPagina = this.checked">
  Ajustar para caber em 1 página (encolhe o conteúdo se necessário)
</label>
```

Desmarcado por padrão — não muda o comportamento para quem não usa a
opção.

### 3. Marcação das páginas (`_montarPaginasPDF`)

Cada unidade impressa (um registro, ou um bloco de evento) passa a ser
envolvida em dois `div`s, tanto no branch `wizardEventoAtivo` quanto no
branch normal:

```html
<div class="pdf-fit-page" style="{pageBreak}">
  <div class="pdf-fit-inner">
    {header}{corpo}
  </div>
</div>
```

Isso é sempre adicionado (não é condicional ao checkbox) — sem CSS
associado, os `div`s extras não alteram o layout atual. `pageBreak`
continua no `div` externo, exatamente como hoje.

### 4. `_abrirJanelaImpressao(titulo, innerHtml, printDelayMs, caberUmaPagina)`

Novo 4º parâmetro (default `false`). Quando `true`:

- CSS adicional: `.pdf-fit-page { width: 180mm; } .pdf-fit-inner { transform-origin: top left; }`
  (180mm = largura A4 210mm − margens 15mm×2, a mesma já usada em `@page`).
- Script injetado, executado em `window.onload` **antes** do
  `setTimeout(window.print, printDelayMs)`:

```js
function _ajustarParaUmaPagina() {
  var pxPorMm = 96 / 25.4;
  var alturaDisponivel = 273 * pxPorMm; // A4 297mm - margens 12mm×2
  document.querySelectorAll('.pdf-fit-page').forEach(function (pagina) {
    var inner = pagina.querySelector('.pdf-fit-inner');
    var alturaNatural = inner.scrollHeight;
    var escala = Math.min(1, alturaDisponivel / alturaNatural);
    if (escala < 1) inner.style.transform = 'scale(' + escala + ')';
  });
}
```

`scale()` nunca amplia (escala máxima 1) e é calculada por página
individualmente — num lote com registros de tamanhos variados, só as
páginas que realmente estouram são encolhidas.

`width: 180mm` (unidade CSS absoluta, `96px = 1in` também fora de
`@media print`) garante que a medição em tela reflita a largura real de
impressão, então a altura natural medida corresponde à altura que sairia
impressa sem a escala.

### 5. `exportarPDF()`

Passa `wizardCaberUmaPagina` para cada chamada de `_abrirJanelaImpressao`:

```js
const ok = _abrirJanelaImpressao(titulo, innerHtml, 300 + idx * 700, wizardCaberUmaPagina);
```

## Fora do escopo

- Não mexe em `renderPreview()` (a prévia em tela do wizard) — o
  encolhimento só se aplica ao HTML gerado na janela de impressão.
- Não persiste a preferência por modelo (ex. um campo
  `caber_uma_pagina_padrao` em `gm_modelos`) — é uma opção por geração,
  como o checkbox de cabeçalho já funciona hoje via seleção manual (o
  `cabecalho_padrao` do modelo é só um valor inicial, não é o caso aqui
  pois o padrão é sempre desligado).
- Não tenta reduzir a largura também (`scale` uniforme já encolhe largura e
  altura juntas — pode sobrar margem em branco à direita quando a altura é
  o fator limitante; comportamento equivalente ao "encolher para caber" de
  ferramentas de impressão comuns).

## Edge cases

- Documento que já cabe (`alturaNatural <= alturaDisponivel`): `escala`
  calculada como `>= 1`, o `if (escala < 1)` não aplica `transform`, sem
  nenhuma mudança visual.
- Múltiplas empresas (várias janelas de impressão): cada janela recebe o
  mesmo valor de `caberUmaPagina` e calcula a escala independentemente por
  página, dentro da própria janela.
