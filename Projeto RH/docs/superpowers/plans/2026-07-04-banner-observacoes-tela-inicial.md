# Banner de Observações na Tela Inicial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o banner de observações da empresa aparecer também na tela inicial de seleção, imediatamente ao escolher a empresa no campo de busca — não só depois de trocar de tela.

**Architecture:** Extrai a visibilidade do banner (hoje calculada só dentro de `mostrarTela()`, com uma exceção para `selectionScreen`) para uma função própria `atualizarBannerObservacoes()`, sem depender de qual tela está ativa. Chama essa função tanto em `mostrarTela()` quanto em `selecionarEmpresa()` (que já roda no momento exato da seleção da empresa, ainda na tela inicial).

**Tech Stack:** JavaScript vanilla. Sem build step, sem framework de testes.

## Global Constraints

- O banner passa a aparecer nas três telas (inicial, lançamento, resultados) sempre que houver observação cadastrada — não há mais exceção por tela.
- Deve aparecer imediatamente ao selecionar a empresa no campo de busca da tela inicial, sem esperar a troca para a tela de lançamento.
- Nenhuma mudança no conteúdo/estilo visual do banner, no cadastro da observação, ou no restante do comportamento de `mostrarTela()` (`pageHeader`, `pageHeaderSub`).
- **IMPORTANTE:** os números de linha citados abaixo refletem o estado do arquivo no momento em que este plano foi escrito. Use sempre o bloco de código exato (`old_string`) para localizar o trecho a editar.

---

## Arquivos Impactados

- Modify: `Projeto RH/script.js`
  - Nova função `atualizarBannerObservacoes()` (perto de `mostrarTela`)
  - `mostrarTela()` (~linha 2348-2372): usa a nova função em vez do cálculo inline com exceção de tela
  - `selecionarEmpresa()` (~linha 128-172): chama a nova função após atualizar `dataset.temObservacao`

---

## Task 1: Banner visível em todas as telas, imediato ao selecionar empresa

**Files:**
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Criar `atualizarBannerObservacoes()` e usá-la em `mostrarTela`**

Localizar (~linha 2348-2372):
```js
function mostrarTela(telaId) {
    document.getElementById('selectionScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById(telaId).style.display = 'block';

    const pageHeader = document.getElementById('pageHeader');
    if (pageHeader) pageHeader.style.display = telaId === 'selectionScreen' ? 'none' : 'block';

    const sub = document.getElementById('pageHeaderSub');
    if (sub) {
        if (telaId !== 'selectionScreen' && state.empresaSelecionada) {
            sub.textContent = `🏢 ${state.empresaSelecionada.codigo_empresa} — ${state.empresaSelecionada.nome_empresa}  ·  📅 ${state.competencia}`;
        } else {
            sub.textContent = 'Selecione a competência e empresa para começar';
        }
    }

    const obsBanner = document.getElementById('empresaObservacoesBanner');
    if (obsBanner) {
        obsBanner.style.display = (telaId !== 'selectionScreen' && obsBanner.dataset.temObservacao === '1')
            ? 'flex'
            : 'none';
    }
}
```
Substituir por:
```js
function atualizarBannerObservacoes() {
    const obsBanner = document.getElementById('empresaObservacoesBanner');
    if (obsBanner) {
        obsBanner.style.display = obsBanner.dataset.temObservacao === '1' ? 'flex' : 'none';
    }
}

function mostrarTela(telaId) {
    document.getElementById('selectionScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById(telaId).style.display = 'block';

    const pageHeader = document.getElementById('pageHeader');
    if (pageHeader) pageHeader.style.display = telaId === 'selectionScreen' ? 'none' : 'block';

    const sub = document.getElementById('pageHeaderSub');
    if (sub) {
        if (telaId !== 'selectionScreen' && state.empresaSelecionada) {
            sub.textContent = `🏢 ${state.empresaSelecionada.codigo_empresa} — ${state.empresaSelecionada.nome_empresa}  ·  📅 ${state.competencia}`;
        } else {
            sub.textContent = 'Selecione a competência e empresa para começar';
        }
    }

    atualizarBannerObservacoes();
}
```

Note que a checagem `telaId !== 'selectionScreen'` foi removida do cálculo do banner — a exceção some completamente. As linhas de `pageHeader`/`pageHeaderSub` continuam com sua própria lógica por tela, inalteradas.

- [ ] **Step 2: Chamar a nova função em `selecionarEmpresa`**

Localizar (~linha 167-172):
```js
    const observacoes = cfg?.['observacoes']?.cod?.trim() || '';
    if (obsBanner && obsTexto) {
        obsTexto.textContent = observacoes;
        obsBanner.dataset.temObservacao = observacoes ? '1' : '0';
    }
}
```
Substituir por:
```js
    const observacoes = cfg?.['observacoes']?.cod?.trim() || '';
    if (obsBanner && obsTexto) {
        obsTexto.textContent = observacoes;
        obsBanner.dataset.temObservacao = observacoes ? '1' : '0';
    }
    atualizarBannerObservacoes();
}
```

- [ ] **Step 3: Verificação manual**

No navegador: na tela inicial, buscar e selecionar uma empresa com observação cadastrada — confirmar que o banner aparece imediatamente ali, ainda na tela inicial, antes de clicar "Continuar". Clicar "Continuar" e confirmar que o banner continua visível na tela de lançamento. Processar a folha e confirmar que continua visível na tela de resultados. Voltar para a tela inicial (se houver alguma ação que volte) e selecionar uma empresa SEM observação — confirmar que o banner desaparece.

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: exibir banner de observações também na tela inicial de seleção"
```

---

## Task 2: Verificação manual final (checklist de regressão)

Sem framework de testes automatizados neste projeto, feche o trabalho com uma rodada manual:

- [ ] **Step 1:** `pageHeader` e `pageHeaderSub` continuam se comportando exatamente como antes (ocultos/com texto padrão na tela inicial, visíveis/com nome da empresa nas outras duas) — a extração do banner para sua própria função não interferiu nessa lógica, que continua dentro de `mostrarTela`.
- [ ] **Step 2:** Selecionar uma empresa, depois trocar para outra (ainda na tela inicial, sem clicar Continuar) atualiza corretamente o banner para a nova empresa a cada seleção.
- [ ] **Step 3:** Uma empresa sem observação cadastrada nunca mostra o banner em nenhuma das três telas.

Nenhum commit necessário neste task — é só verificação.
