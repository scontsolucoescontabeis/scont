# Aviso de Férias — Design

## Contexto e objetivo

Nova ferramenta dentro do módulo **Fechamento Folha** (`Projeto Fechamento Folha`) para processar o PDF "Aviso de Férias" emitido pelo sistema de folha do cliente (modelo de referência: `Aviso Prévio de Férias.pdf`, na raiz do projeto — usado só como amostra do layout esperado, não é um asset consumido em runtime).

O PDF de entrada é uma sequência de páginas no padrão:
1. **Aviso de Férias** (obrigatória) — título, cidade/data de emissão, "Sr./Sra.: NOME", C.T.P.S. (opcional — pode faltar), Período Aquisitivo, Período de Gozo, Retorno ao trabalho, texto legal, linha de assinatura com nome da empresa (esquerda) e nome do empregado (direita).
2. **Solicitação de Abono de Férias** (opcional — nem todo empregado tem) — campos rotulados `Empresa:`, `Cadastro: N - NOME`, `CNPJ:`, `CPF:`, texto legal, mesma linha de assinatura.

Cada empregado pertence a uma empresa (identificada no PDF só por **nome + CNPJ**, sem código). O objetivo é separar os avisos por empregado, agrupá-los por empresa, e permitir gerar **um PDF por empresa** (todos os empregados daquela empresa, na ordem original) com o nome de arquivo:

```
{CODIGO_EMPRESA}_AVISO DE FERIAS_{intervalo}.pdf
```

onde `{intervalo}` é um texto livre informado pelo usuário no upload (ex.: `03/08 a 07/09/2026`, `AGO-2026`).

Os PDFs gerados devem seguir a identidade visual da SCONT: cabeçalho e rodapé com a marca/paleta do portal sobre as páginas originais, mantendo o texto legal exatamente como veio (decisão do usuário: opção "cabeçalho/rodapé sobre as páginas originais", não reconstrução do documento).

Não há necessidade de tabela nova no Supabase — é um utilitário client-side, sem persistência. A única leitura ao banco é `rh_empresas` (`codigo_empresa, nome_empresa, cnpj`), já usada por `controle.js`/`quadrante.js`.

## Fluxo (wizard de 3 passos, mesmo padrão visual de `ferias.html`)

**Passo 1 — Upload**
- Dropzone de PDF (reaproveita padrão visual `.upload-area` de `ferias.html`).
- Campo de texto livre obrigatório "Intervalo" — vai literalmente para o nome de todos os arquivos gerados neste lote. Sanitizado apenas para remover caracteres inválidos em nome de arquivo Windows (`\ / : * ? " < > |`), mantendo espaços e acentos.
- Botão "Processar" avança ao Passo 2.

**Passo 2 — Revisão de empresas**
- Parser (ver seção seguinte) roda no upload e monta a lista de empregados com: nome, empresa (nome extraído), CNPJ (se encontrado), páginas do PDF original (1 ou 2), páginas totais do lote.
- Agrupamento por CNPJ (chave primária) — quando um empregado não tem página de Abono (logo sem CNPJ explícito), tenta casar pelo nome da empresa extraído da linha de assinatura do Aviso; se não achar, cai num grupo "não identificado" por nome bruto.
- Para cada grupo: busca em `rh_empresas` por CNPJ (dígitos normalizados). Se casar, mostra `codigo_empresa` já preenchido (editável). Se não casar, mostra um `<select>` com todas as empresas de `rh_empresas` (ordenadas por nome) para escolha manual — obrigatório.
- Tabela mostra: nome da empresa (como veio no PDF), CNPJ, código resolvido, nº de empregados, nº de páginas.
- Alerta visual se a soma de páginas dos grupos não bater com o total de páginas do PDF (indício de erro de parsing) — não bloqueia, é só aviso.
- Botão "Gerar PDFs" fica desabilitado até todo grupo ter um `codigo_empresa` resolvido.

**Passo 3 — Geração e download**
- Para cada empresa: gera o PDF (ver seção de geração) e lista um cartão com nome do arquivo final, nº de páginas, botão "Baixar".
- Botão "Baixar todos (.zip)" agrupando todos os PDFs gerados (JSZip, já usado em `Projeto RH/script.js` — mesmo CDN `cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`).

## Parsing do PDF (pdf.js)

Segue a técnica já usada em `parsearPDF` (`ferias.html`): para cada página, extrai itens de texto com posição (x, y), agrupa em linhas por proximidade vertical (tolerância ~6pt) e ordena por x dentro da linha — isso reconstrói a ordem visual correta mesmo quando o content stream do PDF não segue a ordem de leitura (caso observado na amostra: nome da empresa e nome do empregado saem concatenados fora de ordem no texto bruto).

Por página, classifica pelo título da primeira linha:
- `/AVISO\s+DE\s+F[EÉ]RIAS/i` → página tipo **aviso**.
- `/SOLICITA[ÇC][AÃ]O\s+DE\s+ABONO/i` → página tipo **abono**.
- Qualquer outra → ignorada (log de aviso, não deveria ocorrer no modelo).

**Campos extraídos da página "aviso":**
- Nome do empregado: linha `Sr\.:|Sra\.:` seguida do nome.
- C.T.P.S. (opcional): linha `C\.T\.P\.S\.`.
- Período Aquisitivo / Período de Gozo / Retorno ao trabalho: linhas rotuladas (regex sobre `.....:` seguido de datas).
- Nome da empresa: linha de assinatura (duas colunas — empresa à esquerda, empregado repetido à direita); usa o item mais à esquerda dessa linha, com heurística "termina em LTDA/EPP/ME/S.A./EIRELI etc. ou está seguido de grande espaço até a 2ª coluna".

**Campos extraídos da página "abono":** valores após os rótulos `Empresa:`, `Cadastro:` (formato `N - NOME`), `CNPJ:` (regex `\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}`), `CPF:` (regex `\d{3}\.\d{3}\.\d{3}-\d{2}`).

**Pareamento em registros de empregado:** percorre as páginas em ordem; toda página "aviso" abre um novo registro; se a página seguinte for "abono" e o nome do empregado bater (comparação normalizada — maiúsculas, sem acento, espaços colapsados), anexa como página 2 do mesmo registro; caso contrário, o registro fica só com 1 página e a próxima página "aviso" abre o próximo registro. Isso tolera empregados sem abono.

## Resolução de empresa → código

1. Carrega `rh_empresas` inteira (`codigo_empresa, nome_empresa, cnpj`) uma vez, no início do Passo 2.
2. Constrói um `Map` de CNPJ normalizado (só dígitos) → registro.
3. Para cada grupo detectado no PDF: se tem CNPJ e bate no Map → resolvido automaticamente. Senão → pendente, exige escolha manual no `<select>` da tela de revisão.
4. Depois de resolvido, os registros de empregado são reagrupados pelo `codigo_empresa` final (dois grupos brutos diferentes — ex. nome com pequena variação — nunca deveriam cair no mesmo código; se cair, apenas concatena as listas de empregados, sem erro).

## Geração dos PDFs (pdf-lib)

Adiciona `pdf-lib` via CDN (`cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js`) — biblioteca nova no projeto, necessária porque `jsPDF` (já usado em `ferias.html`) só desenha conteúdo novo do zero e não consegue importar páginas de um PDF existente; `pdf-lib` sim.

Para cada empresa resolvida:
1. Carrega o PDF original (`PDFDocument.load`) uma única vez (cache) e usa `pdfDoc.embedPage(...)` para embutir cada página original pertencente a essa empresa como um objeto reutilizável.
2. Cria um novo `PDFDocument`; para cada página original a incluir, adiciona uma página em tamanho A4 padrão (595.28 x 841.89 pt) e desenha:
   - Uma faixa de **cabeçalho** (topo, ~50pt de altura, cor `--secondary #2C3E50`): tenta embutir o logo SCONT (mesma URL usada no sidebar, `fetch` + `embedPng`, com `try/catch` — se falhar por CORS/rede, cai para texto). Título "SCONT" em branco/negrito à esquerda; à direita, "{codigo_empresa} · {nome_empresa}" e "Aviso de Férias".
   - A página original embutida (`drawPage`), escalada (~0.91x) e centralizada no espaço entre cabeçalho e rodapé — garante zero sobreposição com o conteúdo/assinatura original, independente da variação de tamanho do nome da empresa (que pode quebrar em 2 linhas na área de assinatura).
   - Uma faixa de **rodapé** (base, ~24pt, cor `--primary #8B3A3A`): "SCONT · Fechamento de Folha · Intervalo: {intervalo}" à esquerda, "Página X de Y" à direita.
3. Serializa (`newDoc.save()`), gera nome de arquivo `{codigo}_AVISO DE FERIAS_{intervalo}.pdf` e disponibiliza para download (Blob + link, mesmo padrão de download já usado nas outras telas do módulo).

## Integração ao portal

- Novos arquivos `aviso-ferias.html` + `aviso-ferias.js` na raiz de `Projeto Fechamento Folha`, seguindo o mesmo esqueleto de sidebar/auth guard/paleta de `ferias.html`.
- Adiciona item "Aviso de Férias" na seção "Ferramentas" do sidebar e do grid de `index.html` (ícone sugerido `📨`), ao lado de Fluxo de Fechamento / Programação de Férias / Controle de Fechamento.

## Fora de escopo (YAGNI)

- Geração de PDF individual por empregado (usuário confirmou: só por empresa).
- Persistência em banco do lote processado/gerado.
- Edição manual dos campos extraídos por empregado na tela de revisão (só a resolução de empresa é editável).
