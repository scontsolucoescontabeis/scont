# Recibos de VT/VA na tela "Gerar Benefícios"

Data: 2026-07-21
Arquivos afetados: `index.html`, `script.js`

## Contexto

A tela "Gerar Benefícios (VT/VA)" (`beneficiosScreen`) já gera uma prévia editável por empregado (`state._beneficiosLinhas`) e exporta um `.xlsx` (`exportarBeneficiosExcel`). Este design adiciona um botão "🧾 Gerar Recibo" ao lado de "📥 Gerar Excel" que gera, a partir da mesma prévia (já editada pelo operador), os recibos de entrega de Vale Alimentação e Vale Transporte por empregado, em 2 vias cada (empresa/empregado), usando o padrão de impressão já existente no projeto (`admin.js` → `gerarRelatorioEmpregadosPDF`: monta HTML completo, abre em nova janela, `window.print()` automático no load — sem biblioteca nova).

## Agrupamento (confirmado com o usuário)

Um PDF/impressão separada **por empresa e por tipo de benefício**: se 3 empresas estão na prévia e todas têm VA e VT elegíveis, são geradas até 6 janelas de impressão (Empresa A-VA, Empresa A-VT, Empresa B-VA, ...). Dentro de cada janela, um recibo (2 vias) por empregado elegível daquela empresa, na mesma ordem já usada na prévia, com quebra de página entre empregados.

## Elegibilidade

Por linha da prévia (`state._beneficiosLinhas`, já com os ajustes manuais do operador — mesmos valores usados no Excel):

- `diasPagar = max(0, diasTrabalhar - diasDescontar)`
- Recibo de VA gerado só se `diasPagar * vaDiario > 0`.
- Recibo de VT gerado só se `diasPagar * vtDiario > 0`.

Isso é avaliado independentemente por tipo — um empregado pode ter só VA, só VT, ambos, ou nenhum (nesse caso não entra em nenhuma janela). Se nenhuma linha de nenhuma empresa for elegível para nenhum tipo, mostra aviso "Nenhum recibo gerado".

## Templates

Dois modelos fornecidos pelo usuário (HTML/CSS idênticos entre si, exceto texto do título, texto "vales alimentação"/"vales transporte" e a ausência do bloco `.footer` no modelo de VA). CSS compartilhado entre os dois (classe `.gm-recibo-va`), carregado uma vez por janela de impressão (não duplicado por recibo). Cada recibo = 2 `.via-block` (1ª via Empresa, 2ª via Empregado) com uma "linha de corte" entre eles, replicando exatamente o layout dos modelos fornecidos.

Correção aplicada em relação ao HTML colado pelo usuário: os placeholders `{{excel.DIAS A PAGAR}}` e a tag `<span style="font-size: 13px;">` na caixa de composição do benefício (VA) estavam quebrados/malformados (chave `{` solta antes do `<span>`, braces desencontradas) — tratado como artefato de edição, não como parte do design. A implementação gera o texto da composição do benefício limpo, mesmo resultado visual pretendido, sem HTML quebrado.

Período de utilização (`"para minha utilização no período de X a Y"`): sempre o mês de pagamento (competência + 1 mês — mesma regra já usada em `_atualizarLabelMesPagamentoBeneficios`/`exportarBeneficiosExcel`), do dia 01 ao último dia daquele mês. Não é mais um texto fixo como no HTML colado (que tinha "01/08/2026 a 31/08/2026" fixo).

## Valor por extenso

Novo conversor número→extenso em português (moeda), do zero, em `script.js`:

- `_extensoGrupo(n)`: 0-999 → texto (regras de centena/dezena/unidade, caso especial "cem").
- `_extensoInteiro(n)`: suporta milhares (`"mil"`, `"dois mil"`, etc.) compondo com `_extensoGrupo`.
- `_valorPorExtenso(valor)`: separa reais e centavos, aplica singular/plural ("um real" vs "dois reais", "um centavo" vs "dois centavos"), junta com "e" quando os dois existem. Cobre os valores de VT/VA diário e mensal usados nos recibos.

## Novas funções em `script.js`

- `_fmtMoedaRecibo(v)`: `v.toFixed(2).replace('.', ',')`.
- `_reciboViaHTML(dados)`: monta um `.via-block` (1 via) a partir de `{ nomeEmpresa, cnpj, nomeEmpregado, cargo, viaTag, tituloBeneficio, pluralDesc, periodoTexto, diasPagar, diarioValor, mensalValor, footerTexto }`.
- `_reciboSheetHTML(tipo, linha, periodoTexto)`: monta as 2 vias + linha de corte para um empregado e um tipo (`'va'`|`'vt'`), lendo os campos de `linha` (`state._beneficiosLinhas`).
- `_abrirJanelaRecibos(tituloJanela, sheetsHtml)`: monta o HTML completo (head com CSS único + fonte, body com os recibos agrupados num `<div id="reciboBatch">`, regra de `page-break-after` entre recibos no CSS de impressão), abre `window.open`, escreve, `window.print()` no load — mesmo padrão de `admin.js`. Se popup bloqueado, `mostrarMensagem('Aviso', ...)` (mesmo texto/estilo do aviso já usado em `admin.js` para o mesmo caso).
- `gerarRecibosBeneficios()`: função chamada pelo botão. Valida que há prévia gerada (`state._beneficiosLinhas`), agrupa as linhas por `codigo_empresa`, calcula elegibilidade de VA/VT por linha, e chama `_abrirJanelaRecibos` uma vez por (empresa, tipo) com pelo menos 1 linha elegível.

## Fora de escopo

- Nenhuma mudança em `exportarBeneficiosExcel` ou na prévia editável.
- Nenhuma persistência dos recibos gerados (é impressão pontual, mesmo espírito do Excel).
- Nenhuma biblioteca nova (PDF gerado via diálogo de impressão do navegador, mesmo padrão de `admin.js`).
