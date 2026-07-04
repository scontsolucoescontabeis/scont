# Design: Banner de Observações na Tela Inicial (imediato ao selecionar empresa)

**Data:** 2026-07-04
**Arquivos principais:** `script.js`

---

## Problema

O banner de observações da empresa já aparece nas telas de lançamento e de resultados, mas fica propositalmente oculto na tela inicial de seleção (`selectionScreen`) — decisão tomada numa iteração anterior. O usuário agora pediu o contrário: quando ele seleciona a empresa no campo de busca (ainda na tela inicial, antes de clicar "Continuar"), a observação já deve aparecer ali mesmo.

Hoje isso não funciona por dois motivos:
1. `mostrarTela()` força `display: none` no banner especificamente quando `telaId === 'selectionScreen'`.
2. Mesmo removendo essa exceção, `selecionarEmpresa()` (chamada ao escolher a empresa no campo de busca) só atualiza `obsBanner.dataset.temObservacao` — quem decide o `style.display` real é `mostrarTela()`, que só roda numa troca de tela. Selecionar uma empresa no campo de busca não troca de tela (isso só acontece ao clicar "Continuar").

---

## Solução

### 1. Extrair a visibilidade do banner para uma função própria, sem depender da tela ativa

```js
function atualizarBannerObservacoes() {
    const obsBanner = document.getElementById('empresaObservacoesBanner');
    if (obsBanner) {
        obsBanner.style.display = obsBanner.dataset.temObservacao === '1' ? 'flex' : 'none';
    }
}
```

Passa a ser a única fonte de verdade sobre a visibilidade — não depende mais de qual tela está ativa.

### 2. Chamar essa função nos dois pontos que já mexem no `dataset.temObservacao`

- Dentro de `mostrarTela()`, substituindo o bloco atual que calcula `obsBanner.style.display` diretamente com a checagem de `telaId`.
- No final de `selecionarEmpresa()`, logo depois de `obsBanner.dataset.temObservacao = observacoes ? '1' : '0';` — momento em que a empresa é escolhida no campo de busca, ainda na tela inicial.

Resultado: o banner aparece nas três telas (inicial, lançamento, resultados), e já surge no instante em que a empresa é selecionada na tela inicial, sem esperar a troca para a tela de lançamento.

---

## O que NÃO muda

- Conteúdo/estilo visual do banner.
- Cadastro da observação no modal de Configuração de Rubricas.
- Comportamento do restante de `mostrarTela()` (`pageHeader`, `pageHeaderSub`).

---

## Arquivos Impactados

- `script.js`:
  - Nova função `atualizarBannerObservacoes()`.
  - `mostrarTela()` — usa a nova função em vez do cálculo inline.
  - `selecionarEmpresa()` — chama a nova função após atualizar o `dataset`.
