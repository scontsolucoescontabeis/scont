# Design: Aviso de Descontos VA/VT ao Baixar TXT (Tela de Resultados)

**Data:** 2026-07-07
**Arquivo principal:** `script.js` — fluxo de `gerarTXTResultados` (tela de Resultados)

---

## Problema

Ao gerar o TXT de lançamentos na tela de Resultados, o operador não tem nenhum aviso de que empregados com faltas ou atestados médicos no período precisam ter VA (Vale Alimentação) e VT (Vale Transporte) descontados proporcionalmente. Essa informação existe implicitamente nos dados (`res.dias[].flagFalta` / `flagAtestado`), mas não é destacada para o usuário.

---

## Escopo

Aplica-se **somente** ao botão "📄 Baixar TXT" da tela de Resultados (`gerarTXTResultados`, modal `txtRubricasModal`). O fluxo de Exportação da tela inicial (`gerarArquivoTXT`) **não** é alterado.

---

## Regra de Contagem

Por empregado (`res` em `state.resultados`), somar dias do período em que:

- `dia.flagFalta === true` (falta integral), OU
- `dia.flagAtestado === true` (atestado médico integral)

**Não entram na contagem:**
- `flagAtestadoComparecimento` (atestado de comparecimento — isenção de meio expediente, não dia inteiro)
- `flagLiberacaoMeioExpediente` (mesma razão)
- `flagFolga`, `flagSemRegistro`, `flagCompensacao`

O resultado é `diasDesconto` (inteiro) por empregado. Empregados com `diasDesconto === 0` são omitidos da tabela.

---

## Fluxo

1. Usuário clica "📄 Baixar TXT" no modal de resultados → `gerarTXTResultados()`.
2. Antes de gerar o blob, calcular a lista `[{ nome, empregadoId, diasDesconto }]` para todos os empregados com `diasDesconto > 0`.
3. **Lista vazia:** gera e baixa o TXT normalmente (comportamento atual, sem nenhuma mudança perceptível).
4. **Lista não vazia:** abre um novo modal de confirmação (bloqueante) **antes** do download, exibindo:
   - Texto: "Devem ser feitos os descontos de VA e VT para os empregados abaixo:"
   - Tabela: colunas **Empregado** e **Dias a Descontar**, uma linha por empregado da lista.
   - Botão **Cancelar**: fecha o modal, não baixa nada, volta ao modal de rubricas.
   - Botão **Continuar e Baixar TXT**: fecha o modal e efetiva o download do TXT (mesmo comportamento do fluxo atual).

---

## Mudanças em `script.js`

### Nova função de cálculo

```js
function _calcularDiasDescontoVAVT(resultados) {
    return (resultados || [])
        .map(res => {
            const dias = (res.dias || []).filter(d => d.flagFalta || d.flagAtestado).length;
            return { nome: res.nome, empregadoId: res.empregadoId, dias };
        })
        .filter(item => item.dias > 0);
}
```

### Refactor de `gerarTXTResultados`

Extrair a lógica de geração/download atual (linhas 2870-2887) para uma função interna `_efetivarDownloadTXTResultados()`, sem nenhuma mudança de comportamento nela. `gerarTXTResultados()` passa a:

1. Calcular `_calcularDiasDescontoVAVT(state.resultados)`.
2. Se vazio → chamar `_efetivarDownloadTXTResultados()` diretamente.
3. Se não vazio → chamar `_abrirModalAvisoDescontos(lista)`, que guarda a lista e abre o novo modal; o botão "Continuar e Baixar TXT" desse modal chama `_efetivarDownloadTXTResultados()`.

Observação: `_construirConteudoTXTResultados(true)` (que persiste a config de rubricas no localStorage) já é chamado dentro da lógica de download atual — isso não muda, apenas passa a rodar depois da confirmação do aviso (ou imediatamente, se não houver aviso).

### Novo modal HTML (`index.html`)

Novo modal `avisoDescontosModal`, seguindo o padrão visual dos modais existentes (`.modal` / `.modal-content` / `.modal-header` / `.modal-body` / `.modal-footer`):

```html
<div class="modal" id="avisoDescontosModal">
    <div class="modal-content" style="max-width: 520px;">
        <div class="modal-header">
            <h3 style="color: var(--primary-color); margin: 0;">⚠️ Descontos de VA/VT</h3>
            <button type="button" class="modal-close" onclick="_fecharModalAvisoDescontos()">×</button>
        </div>
        <div class="modal-body">
            <p style="margin-bottom: 12px;">Devem ser feitos os descontos de VA e VT para os empregados abaixo:</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #f8f9fa; text-align: left;">
                        <th style="padding: 8px; border-bottom: 2px solid #dee2e6;">Empregado</th>
                        <th style="padding: 8px; border-bottom: 2px solid #dee2e6; text-align: center;">Dias a Descontar</th>
                    </tr>
                </thead>
                <tbody id="avisoDescontosTbody"></tbody>
            </table>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="_fecharModalAvisoDescontos()">Cancelar</button>
            <button type="button" class="btn btn-primary" onclick="_continuarDownloadAposAviso()">Continuar e Baixar TXT</button>
        </div>
    </div>
</div>
```

### Novas funções JS de suporte

```js
let _listaDescontoVAVTPendente = null;

function _abrirModalAvisoDescontos(lista) {
    _listaDescontoVAVTPendente = lista;
    const tbody = document.getElementById('avisoDescontosTbody');
    tbody.innerHTML = lista.map(item => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.nome}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.dias}</td>
        </tr>
    `).join('');
    document.getElementById('avisoDescontosModal').classList.add('active');
}

function _fecharModalAvisoDescontos() {
    document.getElementById('avisoDescontosModal').classList.remove('active');
    _listaDescontoVAVTPendente = null;
}

function _continuarDownloadAposAviso() {
    document.getElementById('avisoDescontosModal').classList.remove('active');
    _listaDescontoVAVTPendente = null;
    _efetivarDownloadTXTResultados();
}
```

---

## O que NÃO muda

- Lógica de cálculo de faltas/atestados em `calcularFolha` (já existente).
- Conteúdo e formato do arquivo TXT gerado.
- Fluxo de Exportação da tela inicial (`gerarArquivoTXT` / `exportTxtModal`).
- Comportamento quando não há faltas/atestados médicos no período (download direto, sem modal extra).

---

## Arquivos Impactados

- `Projeto RH/script.js` — nova função `_calcularDiasDescontoVAVT`, refactor de `gerarTXTResultados` em `_efetivarDownloadTXTResultados`, novas funções de modal.
- `Projeto RH/index.html` — novo modal `avisoDescontosModal`.
