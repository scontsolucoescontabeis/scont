# Controle de Alterações Contratuais — Design

**Data:** 2026-08-28
**Ferramenta:** `Projeto Contratual/` (nova ferramenta do Portal Scont)

## Objetivo

Ferramenta interna da SCONT que recebe **dois contratos sociais de um mesmo
cliente** (versão anterior e versão nova, PDF ou Word) e gera um **documento de
controle de alterações** para enviar ao cliente junto com o contrato registrado.

- Lê os dois arquivos (PDF com camada de texto, ou `.docx`).
- Isola a **CONSOLIDAÇÃO CONTRATUAL** de cada um e compara **cláusula a cláusula**.
- Classifica cada cláusula como **Alterada**, **Nova** ou **Suprimida**.
- Extrai dados de capa (razão social, CNPJ, nº da alteração, data, sócios).
- Gera um PDF de controle com redação anterior × atual lado a lado.

### Não faz
- Não substitui análise jurídica.
- Não valida se a alteração está correta ou completa.
- Não faz OCR (v1). PDF só-imagem é rejeitado com mensagem clara.

## Decisões (validadas com o usuário)

| Tema | Decisão |
|---|---|
| Motor | 100% no navegador. Sem backend, sem edge function, sem IA. |
| Alvo da comparação | Texto da CONSOLIDAÇÃO CONTRATUAL da versão anterior × da nova. |
| Persistência | Nenhuma. Upload → comparação → PDF. Nada é salvo. |
| Vínculo com empresas | Autônoma. Todos os dados saem do texto do PDF. |
| Formatos | PDF digital (pdf.js) + `.docx` (mammoth.js). Sem OCR. |
| Redação das mudanças | Redação anterior × atual lado a lado, com diff palavra a palavra destacado. Sem frase descritiva gerada. |
| Identidade visual da saída | Só texto + paleta do portal. Sem logo/timbre. |

## Arquitetura

App de página única. Módulos JS "puros" (sem DOM, sem rede) testáveis em Node,
seguindo o padrão de `Projeto Fechamento Folha/aviso-ferias-parser.js`
(export duplo: global no browser + `module.exports`).

```
Projeto Contratual/
  index.html          layout, dropzones, tabela de revisão, view de impressão
  styles.css          @import '../shared.css' + estilos locais
  js/
    extract.js        [browser] pdf.js / mammoth → texto normalizado. Único módulo com dependências externas.
    parser.js         [puro] texto → { capa, clausulas[] }
    matcher.js        [puro] (clausulasAnt, clausulasNova) → linhas classificadas
    differ.js         [puro] diff palavra a palavra → segmentos {tipo, texto}
    report.js         [puro] linhas + capa → HTML da view de impressão
    app.js            [browser] orquestra extract→parser→matcher→differ→report + UI
  tests/
    test-parser.js
    test-matcher.js
    test-differ.js
```

Libs via cdnjs (padrão do portal):
- `pdf.js` 3.11.174 (já usado no portal)
- `mammoth` 1.9.0
- `diff` (jsdiff): **não usado** — `differ.js` implementa diff próprio (LCS de
  palavras) para não depender de pacote instalável nos testes Node.

Auth: `<script src="../portal-auth-guard.js">` + `PortalAuthGuard.init(1)`.
Registro no portal: `_sql/add_ferramenta_contratual.sql` (INSERT em
`public.ferramentas`) + liberação pelo Painel Administrativo.

## Módulos

### extract.js  `[browser]`
- `extrairTexto(file) -> Promise<{ texto, origem, aviso? }>`
  - `.pdf`: `pdfjsLib.getDocument` → por página `getTextContent()` →
    `reconstruirLinhas(items)` (agrupa por Y com limiar, ordena por X — mesma
    heurística do aviso-ferias-parser). Junta páginas com `\n`.
    - Se todas as páginas vierem sem itens de texto → lança
      `ErroSemTextoSelecionavel` (mensagem: documento escaneado, v1 não faz OCR).
  - `.docx`: `mammoth.extractRawText({ arrayBuffer })` → `value`.
  - Normaliza: `\r\n`→`\n`, colapsa espaços, remove o **rodapé de certificação
    da JUCE** que repete em toda página (linhas casando
    `/Junta Comercial.*Distrito Federal/i`, `/Certifico registro sob o n[ºo]/i`,
    `/Esta c[óo]pia foi autenticada/i`, `/p[áa]g\.\s*\d+\/\d+/i`).
- `GlobalWorkerOptions.workerSrc` apontando para o worker do mesmo CDN/versão.

### parser.js  `[puro]`
`analisarContrato(texto) -> { capa, clausulas, avisos }`

**Isolar a consolidação** — `extrairBlocoConsolidacao(texto)`:
- Acha a **última** ocorrência de uma linha que seja só
  `/^C\s?O\s?N\s?S\s?O\s?L\s?I\s?D\s?A[ÇC][ÃA]O\s+C\s?O\s?N\s?T\s?R\s?A\s?T\s?U\s?A\s?L$/i`
  (tolera o espaçamento "C O N S O L I D A Ç Ã O" da 3ª via).
- Fim do bloco: primeira ocorrência, após o início, de
  `/^Bras[ií]lia\/[A-Z]{2},/im`, ou `/^_{5,}$/m`, ou
  `/TERMO DE AUTENTICA[ÇC][ÃA]O/i`, ou `/ASSINATURA ELETR[ÔO]NICA/i`.
- Se não achar o cabeçalho de consolidação → `avisos.push('layout')` e usa o
  texto inteiro (fallback).

**Segmentar cláusulas** — `segmentarClausulas(bloco)`:
- Regex de cabeçalho:
  `/^\s*(?:(PRIMEIRA|SEGUNDA|TERCEIRA|QUARTA|QUINTA|SEXTA|S[ÉE]TIMA|OITAVA|NONA|D[ÉE]CIMA(?:\s+(?:PRIMEIRA|SEGUNDA|...|NONA))?|VIG[ÉE]SIMA(?:\s+\w+)?)\s+CL[ÁA]USULA|CL[ÁA]USULA\s+(PRIMEIRA|...))\s*[–\-—:.]?\s*(.*)$/im`
- Cada cabeçalho abre uma cláusula. Corpo = texto até o próximo cabeçalho.
- `ordinal` = número derivado do extenso (1..20). `titulo` = resto da linha
  (pode ser `''`). `corpo` = texto do corpo (inclui `Parágrafo …`/`§ …`).
- Retorna `[{ ordinal, titulo, corpo, textoCompleto }]`.

**Normalização de título** — `normalizarTitulo(titulo)`:
- upper, remove acentos, colapsa espaço, remove pontuação nas pontas.
- dicionário de sinônimos → chave canônica:
  `FORUM`→`FORO`; `ENDERECO`→`SEDE`; `ENDERECO (TRANSFERENCIA DE UF)`→`SEDE`;
  `NOME EMPRESARIAL`→`NOME EMPRESARIAL`; `DENOMINACAO`→`NOME EMPRESARIAL`.
- retorna `''` quando título vazio.

**Capa** — `extrairCapa(texto)`:
- `razaoSocial`: `/gira sob o nome empresarial\s+(.+?)\s+e\s+nome\s+fantasia/i`
  → fallback: linha logo após `/\d+ª\s+ALTERA[ÇC][ÃA]O CONTRATUAL DA SOCIEDADE/i`.
- `nomeFantasia`: `/nome\s+fantasia\s+(.+?)[.\n]/i`.
- `cnpj`: `/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/`.
- `numeroAlteracao`: extenso/algarismo do título
  `/(\d+)\s*[ªº]?\s*ALTERA[ÇC][ÃA]O CONTRATUAL/i`.
- `dataAto`: última ocorrência de
  `/Bras[ií]lia\/[A-Z]{2},\s*(\d{1,2}) de (\w+) de (\d{4})/i`
  → fallback `/COM EFEITOS DO REGISTRO EM:? (\d{2}\/\d{2}\/\d{4})/i`
  → fallback `/Certifico registro sob o n[ºo] \d+ em (\d{2}\/\d{2}\/\d{4})/i`.
- `socios`: no preâmbulo (antes de `mediante as seguintes altera`), pares
  `NOME (maiúsculas, ≥2 palavras)` + `CPF n?[ºo]?\s*([\d.\-]{11,14})`.
- Todos os campos são **best-effort** e ficam **editáveis na UI**.

### matcher.js  `[puro]`
`comparar(clausulasAnt, clausulasNova) -> { linhas, resumo }`

1. Índice por `normalizarTitulo`. Match exato 1-para-1 (consumindo os dois lados).
2. Sobras: para cada cláusula nova não casada, procura na antiga não casada o
   melhor par por **coeficiente de Dice** sobre bigramas de palavras do corpo
   normalizado; casa se `dice >= 0.6`.
3. Classificação de cada par `(a, b)`:
   - `corpoNormalizado(a) === corpoNormalizado(b)` → `'igual'`
   - senão → `'alterada'`
4. Nova sem par → `'nova'`. Antiga sem par → `'suprimida'`.
5. `corpoNormalizado`: lower, sem acento, colapsa espaço/pontuação — só para
   decidir igualdade; o diff usa o texto original.
6. `linha = { chave, titulo, classificacao, corpoAnt, corpoNova, ordinalAnt, ordinalNova }`
7. `resumo = { alteradas, novas, suprimidas, iguais }`
8. Ordenação das linhas: pela `ordinalNova` (novas/alteradas/iguais), depois as
   `suprimidas` pela `ordinalAnt`, ao final.

### differ.js  `[puro]`
- `tokenizar(texto)` → palavras + espaços preservados como tokens.
- `diffPalavras(a, b)` → LCS clássico sobre tokens → `[{ tipo: 'igual'|'add'|'del', texto }]`.
- `segmentosParaLado(diff, lado)` → para `lado='ant'` remove `add`, para
  `lado='nova'` remove `del`. Usado para renderizar cada coluna.

### report.js  `[puro]`
`montarRelatorio({ capa, linhas, dataEmissao }) -> string (HTML)`
- Cabeçalho: `razaoSocial` · `CNPJ` · `Nº{numeroAlteracao} Alteração Contratual`
  · `Data do ato: {dataAto}`.
- Uma seção por linha com classificação ∈ {alterada, nova, suprimida}
  (ignora `igual` e as marcadas "ignorar" na UI):
  - Título da cláusula + selo de classificação.
  - Duas colunas: **Redação anterior** / **Redação atual**, com
    `<ins>`/`<del>` do diff. Para `nova`, coluna anterior = "—". Para
    `suprimida`, coluna atual = "—".
  - Campo de observação, se preenchido na UI.
- Rodapé: `SCONT Soluções Contábeis — Documento de controle de alterações —
  emitido em {dataEmissao}` + aviso fixo
  *"Documento de conferência. Não substitui análise jurídica."*
- `escapeHtml` em todo texto vindo dos contratos.

### app.js  `[browser]`
Orquestra e cuida da UI. Sem lógica de parsing.
- 2 dropzones (`Versão anterior`, `Versão nova`), aceitam `.pdf`/`.docx`.
- Ao ter os dois: `extrairTexto` → `analisarContrato` em cada um.
- **Auto-detecção de ordem**: se `numeroAlteracao(nova) < numeroAlteracao(ant)`,
  mostra aviso "parece invertido" + botão trocar.
- `comparar(...)` → renderiza:
  - Painel "Dados da capa" (inputs editáveis, pré-preenchidos da versão nova).
  - Tabela de revisão: `Cláusula | Classificação | Redação anterior | Redação atual`.
    - Selo colorido (alterada=âmbar, nova=verde, suprimida=vermelho, igual=cinza).
    - `<select>` por linha: Alterada / Nova / Suprimida / Igual / **Ignorar**.
    - Diff renderizado nas duas colunas.
  - Accordion "N cláusulas sem alteração" (as `igual`, recolhidas).
- Alertas:
  - CNPJ divergente entre os dois arquivos → `alert-warning`, permite seguir.
  - `avisos` do parser (layout não reconhecido) → `alert-warning`.
- Botão "Gerar PDF de controle": monta `montarRelatorio`, injeta numa
  `<div id="printRoot">`, `window.print()` (usuário escolhe "Salvar como PDF").
  `@media print` esconde tudo exceto `#printRoot`.

## Tratamento de erros / bordas

| Situação | Comportamento |
|---|---|
| PDF sem camada de texto | `alert-danger`: "documento escaneado; a v1 não faz OCR". |
| `.docx` com imagens | Imagens ignoradas (mammoth extrai só texto). |
| Não achou "CONSOLIDAÇÃO CONTRATUAL" | Fallback: compara o texto inteiro; `alert-warning` "layout não reconhecido". |
| Não achou cabeçalhos de cláusula | 1 "cláusula" única com o texto todo; diff mesmo assim. |
| CNPJ divergente | `alert-warning`, permite continuar. |
| Arquivo não .pdf/.docx | Rejeita no input. |

## Testes (Node, `node tests/test-*.js`)

Fixtures: os 3 PDFs reais em `Projeto Contratual/` são convertidos para texto
via um helper único nos testes (usa `pdfjs-dist` se disponível; senão, os
testes de parser/matcher usam **amostras de texto fixas** embutidas extraídas
desses PDFs, para não depender de instalar pacote).

- **parser**
  - `extrairBlocoConsolidacao` pega o último bloco e corta nas assinaturas.
  - `segmentarClausulas`: 1ª via → 15 cláusulas; 2ª → 15; 3ª → 15.
  - `normalizarTitulo`: `FÓRUM`↔`FORO`, título vazio → `''`.
  - `extrairCapa`: CNPJ `48.639.533/0001-44`; nº = 1/2/3; data do ato; 2 sócios
    (Patrícia + Alisson) com CPF.
- **matcher**
  - 1ª→2ª: `SEDE` alterada, `DISSOLUCAO DA SOCIEDADE` alterada,
    `EXERCICIO SOCIAL...` alterada; demais `igual`.
  - 2ª→3ª: `NOME EMPRESARIAL` alterada (nome fantasia), `PRO-LABORE` alterada,
    `FORO` alterada, `ADMINISTRACAO DA SOCIEDADE` alterada; `FILIAIS...` alterada;
    nenhuma `suprimida`; renumeração (Pró-labore 11ª↔12ª) não gera falso
    "nova/suprimida".
  - cláusula só na nova → `nova`; só na antiga → `suprimida`.
- **differ**
  - `diffPalavras('a b c', 'a x c')` → `[igual 'a ', del 'b', add 'x', igual ' c']`
    (formato exato conforme implementação).
  - `segmentosParaLado` remove o lado certo.

## Fora de escopo (v2+)
- OCR de PDF escaneado.
- Histórico/persistência em Supabase.
- Vínculo com `rh_empresas` (logo no cabeçalho, dados cadastrais).
- Resumo em linguagem natural de cada mudança (exigiria IA).
- Comparar as "cláusulas de alteração" declaradas além da consolidação.
