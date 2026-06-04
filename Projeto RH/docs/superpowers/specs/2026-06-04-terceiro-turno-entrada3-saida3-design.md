# Design: Suporte a ENTRADA3 / SAIDA3 (Terceiro Turno)

**Data:** 2026-06-04  
**Arquivo:** `Projeto RH/script.js`  
**Status:** Aprovado

---

## Contexto

Algumas empresas registram três turnos de trabalho por dia (ex: ENTRADA1/SAIDA1, ENTRADA2/SAIDA2, ENTRADA3/SAIDA3). A ferramenta de folha de ponto atualmente suporta apenas dois turnos. Este design estende o suporte para um terceiro turno de forma opt-in, sem alterar o comportamento padrão.

---

## Decisão de design

A funcionalidade é **desativada por padrão**. O usuário ativa via checkbox na tela de edição, persisted em `localStorage` (`rh_terceiro_turno`). Quando ativo, os campos `entrada3`/`saida3` participam de todos os cálculos e fluxos de importação/exportação.

---

## Mudanças no `script.js`

### 1. Estado global — nova flag

```js
state.terceiroTurno = false; // lido do localStorage na inicialização
```

Inicialização no `DOMContentLoaded`:
```js
state.terceiroTurno = localStorage.getItem('rh_terceiro_turno') === 'true';
```

### 2. `gerarDiasDoMes` — sempre inicializa os campos

Adiciona `entrada3: '', saida3: ''` a cada dia gerado. Custo zero quando a flag está desativada — os campos ficam vazios e são ignorados.

### 3. Checkbox na UI (`renderizarConteudoAba` ou header da tela de edição)

Posicionado junto ao checkbox `ruleExtra100Optional` existente:

```html
<input type="checkbox" id="terceiroTurno" onchange="alternarTerceiroTurno(this.checked)">
<label for="terceiroTurno">Empresa com 3 turnos (Entrada 3 / Saída 3)</label>
```

```js
function alternarTerceiroTurno(checked) {
    state.terceiroTurno = checked;
    localStorage.setItem('rh_terceiro_turno', checked);
    renderizarConteudoAba();
}
```

### 4. `renderizarConteudoAba` — colunas condicionais

- Cabeçalho da tabela: adiciona `<th>Entrada 3</th><th>Saída 3</th>` apenas se `state.terceiroTurno`
- Linhas da tabela: adiciona inputs para `entrada3`/`saida3` com o mesmo padrão dos outros campos, apenas se `state.terceiroTurno`
- O check `temEntrada` para o select de Folga/Falta passa a incluir `dia.entrada3`

### 5. `limparLinha` — limpa os três turnos

Adiciona `entrada3` e `saida3` sempre (eles existem no modelo de dados).

### 6. `calcularHorasTrabalhadas` — soma condicional do 3º turno

```js
const minTrabalhados =
    calcularHorasTrabalhadas(dia.entrada1, dia.saida1) +
    calcularHorasTrabalhadas(dia.entrada2, dia.saida2) +
    (state.terceiroTurno ? calcularHorasTrabalhadas(dia.entrada3, dia.saida3) : 0);
```

Aplica-se em `calcularFolha` e em `_construirConteudoTXTExportacao`.

### 7. `calcularHorasNoturnas` — aceita e3/s3

Assinatura estendida: `calcularHorasNoturnas(e1, s1, e2, s2, e3, s3)`.  
Internamente soma o intervalo noturno do 3º par quando `e3`/`s3` forem fornecidos.  
Todos os chamadores passam `dia.entrada3, dia.saida3` quando `state.terceiroTurno`.

### 8. `importarExcel` — lê colunas 6 e 7 condicionalmente

```js
if (state.terceiroTurno) {
    state.folhas[folhaIdx].dados[diaIdx].entrada3 = normalizeHora(row[6]);
    state.folhas[folhaIdx].dados[diaIdx].saida3   = normalizeHora(row[7]);
}
```

### 9. `gerarModeloExcel` — adiciona colunas quando flag ativa

Header passa de `['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2']` para incluir `'Entrada 3', 'Saída 3'` quando `state.terceiroTurno`.

### 10. `renderizarTabelasDiarias` + `exportarParaExcel` — marcacoes

```js
const marcacoes = [dia.entrada1, dia.saida1, dia.entrada2, dia.saida2,
    dia.entrada3, dia.saida3].filter(v => v).join(' - ') || '-';
```

Funciona corretamente mesmo quando entrada3/saida3 estão vazios.

---

## O que NÃO muda

- Comportamento padrão quando flag desativada: idêntico ao atual
- Dados salvos no Supabase (`dados_json`): o modelo serializa o objeto completo, então `entrada3`/`saida3` são preservados automaticamente em saves e recargas
- Estrutura do banco: nenhuma migration necessária

---

## Pontos de atenção

- A flag é global (localStorage), não por empresa. Isso é intencional — o usuário alterna conforme a empresa que está processando.
- Saves gerados com 3 turnos ativos são recarregados corretamente mesmo com a flag desativada (os campos ficam no JSON mas são ignorados nos cálculos).
