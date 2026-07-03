# Banner de Observações Persistente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o banner de observações da empresa continuar visível na tela de resultados (após processar os lançamentos), não só na tela de lançamento — permanecendo oculto apenas na tela inicial de seleção.

**Architecture:** Move o banner para fora das três telas (`selectionScreen`, `mainScreen`, `resultsScreen`) e centraliza a decisão de mostrar/ocultar em `mostrarTela()`, o único ponto do código que já controla qual tela está ativa. `selecionarEmpresa()` passa a apenas guardar a informação ("há observação? qual o texto?") em um `data-*` attribute, sem decidir visibilidade.

**Tech Stack:** JavaScript vanilla, HTML inline. Sem build step, sem framework de testes.

## Global Constraints

- O banner deve ficar oculto exclusivamente na tela `selectionScreen`.
- Nas telas `mainScreen` e `resultsScreen`, o banner aparece sempre que a empresa selecionada tiver observação cadastrada (texto não vazio).
- Nenhuma mudança no conteúdo/estilo visual do banner, nem no cadastro da observação no modal de Configuração de Rubricas.
- **IMPORTANTE:** os números de linha citados abaixo refletem o estado do arquivo no momento em que este plano foi escrito. Use sempre o bloco de código exato (`old_string`) para localizar o trecho a editar.

---

## Arquivos Impactados

- Modify: `Projeto RH/index.html`
  - Mover `<div id="empresaObservacoesBanner">` (~linha 129-135, dentro de `mainScreen`) para fora das três telas, como irmão delas.
- Modify: `Projeto RH/script.js`
  - `selecionarEmpresa()` (~linha 128-172): trocar `obsBanner.style.display = ...` por um `data-tem-observacao` attribute.
  - `mostrarTela()` (~linha 2298-2315): calcular a visibilidade do banner a cada troca de tela.

---

## Task 1: Banner persistente entre telas

**Files:**
- Modify: `Projeto RH/index.html`
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Mover o banner para fora das três telas**

Em `index.html`, localizar (o banner hoje logo no início de `mainScreen`):
```html
        <!-- TELA PRINCIPAL (Preenchimento) -->
        <div id="mainScreen" style="display: none;">

            <!-- Observações da empresa -->
            <div id="empresaObservacoesBanner" style="display: none; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; gap: 10px; align-items: flex-start;">
                <span style="font-size: 16px; line-height: 1;">📝</span>
                <span id="empresaObservacoesTexto" style="font-size: 13px; white-space: pre-wrap; line-height: 1.5;"></span>
            </div>

            <!-- Sistema de Abas (Empregados) -->
```
Substituir por (o banner sai de dentro de `mainScreen` e passa a ficar logo antes dela, como elemento irmão das três telas):
```html
        <!-- Observações da empresa (fixo entre as telas, exceto na inicial) -->
        <div id="empresaObservacoesBanner" style="display: none; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; gap: 10px; align-items: flex-start;">
            <span style="font-size: 16px; line-height: 1;">📝</span>
            <span id="empresaObservacoesTexto" style="font-size: 13px; white-space: pre-wrap; line-height: 1.5;"></span>
        </div>

        <!-- TELA PRINCIPAL (Preenchimento) -->
        <div id="mainScreen" style="display: none;">

            <!-- Sistema de Abas (Empregados) -->
```

Confirme que o banner ficou **dentro** de `<div class="container">` (que envolve as três telas) mas **fora** de qualquer uma das três — ou seja, deve aparecer antes do comentário `<!-- TELA DE SELEÇÃO -->` ou entre `<!-- TELA DE SELEÇÃO -->` e `<!-- TELA PRINCIPAL -->`. O bloco acima já posiciona corretamente (logo antes de `mainScreen`, que vem depois de `selectionScreen` no arquivo).

- [ ] **Step 2: `selecionarEmpresa` passa a guardar em `data-*`, sem decidir visibilidade**

Em `script.js`, localizar (~linha 167-171):
```js
    const observacoes = cfg?.['observacoes']?.cod?.trim() || '';
    if (obsBanner && obsTexto) {
        obsTexto.textContent = observacoes;
        obsBanner.style.display = observacoes ? 'flex' : 'none';
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
}
```

- [ ] **Step 3: `mostrarTela` calcula a visibilidade do banner**

Localizar (~linha 2298-2315):
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
}
```
Substituir por:
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

- [ ] **Step 4: Verificação manual**

No navegador: cadastrar uma observação para uma empresa (modal de Configuração de Rubricas). Selecionar essa empresa e continuar — confirmar que o banner aparece em `mainScreen`. Processar/salvar a folha (indo para `resultsScreen`) — confirmar que o banner **continua visível**, com o mesmo texto. Clicar em "Voltar para Edição" (volta para `mainScreen`) — banner continua visível. Se houver alguma ação que retorne à tela de seleção inicial, confirmar que o banner desaparece nela. Selecionar uma empresa sem observação cadastrada e confirmar que o banner não aparece em nenhuma tela.

- [ ] **Step 5: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js"
git commit -m "feat: manter banner de observações visível também na tela de resultados"
```

---

## Task 2: Verificação manual final (checklist de regressão)

Sem framework de testes automatizados neste projeto, feche o trabalho com uma rodada manual:

- [ ] **Step 1:** A tela inicial de seleção (`selectionScreen`) nunca mostra o banner, mesmo depois de escolher uma empresa com observação no campo de busca (antes de clicar "Continuar").
- [ ] **Step 2:** O restante do layout de `mainScreen` e `resultsScreen` (abas de empregados, seção de Configurações, cabeçalho de resultados) não foi afetado pela remoção do banner de dentro de `mainScreen`.
- [ ] **Step 3:** Trocar de empresa (nova seleção) atualiza corretamente o texto do banner e seu `data-tem-observacao`, refletindo a nova empresa em qualquer tela subsequente.

Nenhum commit necessário neste task — é só verificação.
