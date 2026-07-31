# Relatório Líquido de Benefícios (PDF) na tela "Gerar Benefícios"

Data: 2026-07-31
Arquivos afetados: `index.html`, `script.js`

## Contexto

A tela "Gerar Benefícios (VT/VA)" já gera, ao clicar em "🧾 Gerar Recibo" (`gerarRecibosBeneficios` → `_gerarPdfsRecibosBeneficios`), 1 PDF por (empresa, tipo de benefício elegível — VA ou VT), com os recibos individuais de entrega (2 vias por empregado). Este design adiciona, no mesmo fluxo, mais 1 PDF por empresa: o **Relatório Líquido de Benefícios**, um relatório tabular com o detalhamento do cálculo e o somatório dos benefícios por empregado, mais o somatório da empresa.

## Trigger

Integrado ao fluxo existente de `_gerarPdfsRecibosBeneficios`, não é um botão novo. Para cada empresa com ao menos 1 empregado selecionado na prévia (`grupo.linhas` do `Map porEmpresa` já montado nessa função), gera 1 PDF de Relatório Líquido, além dos PDFs de recibo VA/VT já existentes (que continuam sendo gerados só quando há elegibilidade). O gate de pendência de Ajuda de Custo ITC (empresa 350, `_verificarPendenciaAjudaCustoITC`) já existente no fluxo continua valendo para tudo — recibos e relatório líquido são gerados juntos, depois do gate.

## Inclusão de empregados

Todos os empregados **selecionados na prévia** daquela empresa (`grupo.linhas`), sem filtro de elegibilidade — mesmo critério do Excel (`exportarBeneficiosExcel`). Um empregado com VT e VA zerados aparece no relatório com os valores 0,00 (linha de auditoria do cálculo, não só de pagamento).

## Layout

Uma linha por empregado, colunas: Código, Nome, Cargo, Dias Trabalhar, Descontar, A Pagar, VT Diário, VA Diário, VT Mensal, VA Mensal, Total (VT Mensal + VA Mensal). Linha final em destaque "Total Geral" somando VT Mensal, VA Mensal e Total de todos os empregados da empresa.

## Identidade visual

Mesmo padrão já usado no Fechamento Folha (`quadrante.js` → `gerarPDFLiquido`, relatório de líquidos bancários) para relatórios tabulares com a identidade do portal: `jsPDF` + plugin `jspdf-autotable`, barra de cabeçalho preenchida com `doc.setFillColor(139, 58, 58)` (`--primary` do portal, `#8B3A3A`), texto branco, fonte `helvetica`. Cabeçalho da tabela (`headStyles`) também com `fillColor: [139, 58, 58]`, texto branco, negrito. Linhas alternadas com `fillColor: [249, 250, 251]` (mesmo cinza claro usado no relatório de líquidos bancários).

Bloco de cabeçalho da página (dentro da barra bordô): nome da empresa (negrito), CNPJ, "Relatório Líquido de Benefícios" (título, alinhado à direita, mesmo padrão do relatório bancário), período de pagamento (mesmo texto `periodoTexto` já calculado em `_gerarPdfsRecibosBeneficios` — dia 01 ao último dia do mês de pagamento) e "Gerado em DD/MM/AAAA".

## Nova dependência

`jspdf-autotable` (CDN, mesma versão usada no Fechamento Folha) adicionado ao `<head>` de `index.html` do Projeto RH, junto aos scripts de `html2canvas`/`jspdf` já carregados para os recibos. Não precisa de `html2canvas` para este relatório — é montado direto via `jsPDF`/`autoTable`, sem captura de HTML.

## Novas funções em `script.js`

- `_relatorioLiquidoBeneficiosPDF(grupo, comp, periodoTexto)`: recebe `{ codigoEmpresa, nomeEmpresa, linhas }` (mesmo formato do `Map porEmpresa` de `_gerarPdfsRecibosBeneficios`, já com CNPJ em cada linha via `linha.cnpj`), monta o cabeçalho bordô, monta a tabela via `autoTable` (head + body + linha de total), e salva `${codigoEmpresa}_Relatorio_Liquido_Beneficios_${nomeEmpresaArquivo}_${mesFmt}${ano}.pdf` (mesma normalização de nome de arquivo já usada para os recibos).
- `_gerarPdfsRecibosBeneficios` passa a, para cada empresa em `porEmpresa` (antes ou depois do loop de grupos de recibo — ordem não importa, downloads são sequenciais), chamar `_relatorioLiquidoBeneficiosPDF` uma vez.
- Mensagem de "Aguarde" (`Gerando N PDF(s)...`) passa a contar também os relatórios líquidos no total exibido.

## Fora de escopo

- Nenhuma persistência do relatório (mesmo espírito do Excel/recibos — geração pontual).
- Nenhuma mudança no Excel, nos recibos individuais ou nos Lançamentos na Folha.
- Nenhuma mudança na regra de elegibilidade dos recibos de VA/VT já existente.
