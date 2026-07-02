# Design: Quadrante — Programação de Férias redireciona para ferias.html

**Data:** 2026-07-02
**Escopo:** Elimina a duplicação entre o Step 4/5 do wizard do Quadrante (`quadrante.html`/`quadrante.js`) e a ferramenta standalone `ferias.html`, já disponível no sidebar do portal.

---

## 1. Contexto e problema

O wizard do Quadrante (`quadrante.html`) tem um Step 4 (upload) e Step 5 (relatório) para "Programação de Férias", implementados em `quadrante.js`. Essa implementação:
- Lê planilha **Excel** (.xlsx/.xls), detecta cabeçalho automaticamente.
- Ordena por uma coluna de data escolhida pelo usuário.
- Renderiza uma tabela simples com busca por texto.
- "Imprimir/Salvar PDF" chama apenas `window.print()` (sem geração real de PDF).

A ferramenta `ferias.html`, já linkada no sidebar do portal (inclusive na própria página `quadrante.html`), é uma implementação muito mais completa da mesma funcionalidade:
- Lê **PDF** (via pdf.js), extraindo automaticamente nome da empresa e CNPJ do conteúdo.
- Colunas configuráveis (visibilidade, ordem, renomeação).
- Múltiplos temas visuais e estilos de cabeçalho.
- Agrupamento de linhas por chave primária, com "continuações" para registros multi-linha.
- Ordenação por qualquer coluna (não só uma fixa).
- Exportação real em PDF via jsPDF + AutoTable, com largura de página dinâmica.
- É **genérica**: não é fixada em nenhuma empresa — a empresa é extraída do próprio PDF ou digitada manualmente.

Manter as duas implementações vivas significa duas fontes de verdade divergentes para o mesmo problema, uma delas (a do Quadrante) sensivelmente inferior. A decisão é eliminar a duplicata e apontar o wizard do Quadrante para a ferramenta já existente e superior.

## 2. Mudança de comportamento

Os botões "📅 Programação de Férias" do wizard do Quadrante (presentes no Step 2 e no Step 3) deixam de abrir um Step interno e passam a navegar diretamente para `ferias.html` (`window.location.href = 'ferias.html'`). O usuário sai do wizard do Quadrante e usa a ferramenta de férias como uma ferramenta independente — exatamente como já faz hoje quem clica em "Programação de Férias" no sidebar.

**Volta para o Quadrante:** não é necessário implementar nada novo — `ferias.html` já tem "Quadrante Etiquetas" no seu próprio sidebar (mesmo componente de navegação compartilhado por todas as ferramentas do portal), então o caminho de volta já existe.

Não há perda de dado nem de estado ao trocar de página: o wizard do Quadrante já persiste seu progresso via `quadrante_folha_rascunho`/`quadrante_folha_envios` (mecanismo existente, não relacionado a férias), então navegar para fora e depois voltar ao Quadrante não interrompe o fechamento de folha em andamento.

## 3. Remoções em `quadrante.html`

- Botão do Step 2 (`onclick="irStep4()"`) → `onclick="window.location.href='ferias.html'"`.
- Botão do Step 3 (`onclick="irStep4()"`) → `onclick="window.location.href='ferias.html'"`.
- Bloco `<div class="step-card" id="step4">` (upload de férias) — removido inteiramente.
- Bloco `<div class="step-card" id="step5">` (relatório de férias) — removido inteiramente.

## 4. Remoções em `quadrante.js`

Confirmado via grep que todo o código abaixo é self-contained (nenhuma outra função do arquivo depende dele):

- Estado: `feriasData`, `feriasHeaders`, `feriasSorted`, `arquivoFerias`.
- Funções: `irStep4()`, `onFeriasSelecionada()`, `detectarCabecalhoFerias()`, `processarFerias()`, `parseDataFerias()`, `formatarDataFerias()`, `renderizarFerias()`, `renderizarBodyFerias()`, `filtrarFerias()`, `imprimirFerias()`.
- Chamada `configurarUploadArea('uploadAreaFerias', 'inputFerias', 'filenameFerias', onFeriasSelecionada);` dentro do `DOMContentLoaded`.
- `mostrarStep(n)`: array de steps passa de `[1,2,3,4,5,6]` para `[1,2,3,6]`.

**Fora de escopo:** o Step 6 (Relatório Líquido, já implementado) não é renumerado — mantém seus IDs (`step6`, `irStep6()`, `labelCompetencia6` etc.) inalterados, mesmo que isso deixe uma lacuna visual no número do step-badge (pula de 3 para 6). Renumerar arriscaria regressão em uma feature recém-entregue sem nenhum ganho funcional — puro custo cosmético aceito conscientemente.

## 5. `ferias.html`

Nenhuma mudança. Já é funcional, genérico e standalone.

## 6. Casos de borda

| Caso | Tratamento |
|---|---|
| Usuário no meio do preenchimento do Step 1/2/3 do Quadrante clica em "Programação de Férias" | Navega normalmente para `ferias.html`; o progresso do fechamento de folha já está salvo via rascunho existente (mecanismo não alterado por este spec) |
| Alguém acessa a URL antiga esperando os Steps 4/5 (ex: link salvo, bookmark) | Não aplicável — não há deep-link direto para steps individuais neste wizard (a navegação sempre parte da tela inicial do `quadrante.html`) |

## 7. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `Projeto Fechamento Folha/quadrante.html` | Troca os 2 botões de férias para navegação direta; remove os blocos Step 4 e Step 5 |
| `Projeto Fechamento Folha/quadrante.js` | Remove estado e funções de férias listados na seção 4; ajusta `mostrarStep` |
