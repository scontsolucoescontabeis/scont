# Design: Conversor de Folha de Ponto

**Data:** 2026-06-18
**Ferramenta destino:** Controle de Frequência (`Projeto RH/index.html`)
**Arquivos novos:** `Projeto RH/conversor.html`, `Projeto RH/conversor.js`

---

## Problema

O Controle de Frequência aceita importação via Excel em formato específico (uma aba por empregado, colunas fixas). As folhas de ponto recebidas pelos operadores chegam em formatos variados — planilhas com colunas diferentes, PDFs digitais, PDFs escaneados, imagens e fotos — e precisam ser manualmente transcritas para o formato correto. A ferramenta elimina esse trabalho manual automatizando a extração e a conversão.

---

## Escopo V1

Uma execução = um documento = um empregado = um arquivo `.xlsx` para download. Para múltiplos empregados, o operador roda a ferramenta uma vez por documento e usa o modo "Acrescentar" do Controle de Frequência para acumular as folhas.

---

## Arquitetura

### Arquivos

| Arquivo | Papel |
|---|---|
| `Projeto RH/conversor.html` | Interface da ferramenta (wizard 4 etapas) |
| `Projeto RH/conversor.js` | Lógica de extração, mapeamento e exportação |

### Integração com o projeto existente

- Novo item na sidebar do `Projeto RH/index.html`: `📄 Conversor de Folha`
- Reutiliza `styles.css`, `supabase-config.js`, `portal-auth-guard.js` (mesma autenticação do módulo RH)
- SheetJS (`xlsx.full.min.js`) já carregado no projeto — mantido para leitura de Excel e geração do output

### Dependências novas (CDN, sem instalação)

| Biblioteca | Versão sugerida | Uso |
|---|---|---|
| PDF.js | 4.x | Extração de texto de PDFs digitais; renderização de páginas como canvas |
| Tesseract.js | 5.x | OCR client-side para imagens e PDFs escaneados |

---

## Fluxo UX — Wizard em 4 Etapas

### Etapa 1 — Configuração

- Campo **Empresa**: autocomplete buscando `rh_empresas` no Supabase (mesmo padrão do `index.html`)
- Campo **Competência**: formato `MM/AAAA`
- Ao selecionar a empresa, pré-carrega lista de empregados (`rh_empregados`) para uso na Etapa 4
- Botão "Próximo" habilitado somente quando empresa e competência estão válidos

### Etapa 2 — Upload

- Área drag-and-drop aceitando: `.xlsx`, `.xls`, `.csv`, `.pdf`, `.png`, `.jpg`, `.jpeg`
- Ao soltar/selecionar o arquivo, detecção automática do tipo e início da extração
- Exibe barra de progresso durante OCR (Tesseract.js pode levar alguns segundos)

### Etapa 3 — Revisão da Tabela Extraída

- Exibe os dados extraídos como **tabela HTML editável** (cada célula é um `<input>`)
- O usuário corrige o que o OCR errou, remove linhas inválidas e ajusta horários
- Representa o "markdown intermediário" — mesma lógica do `pdf_ferias.py`, mas renderizado como tabela interativa
- Botão "Voltar" permite trocar o arquivo; botão "Próximo" avança para mapeamento

### Etapa 4 — Mapeamento de Colunas + Empregado

**Mapeamento de colunas:**

Seletor para cada campo-destino, pré-preenchido com sugestão automática (fuzzy match):

| Campo destino | Variações reconhecidas automaticamente |
|---|---|
| Data | "data", "dt", "dia" |
| Entrada 1 | "entrada", "entrada1", "e1", "in1", "batida 1" |
| Saída 1 | "saída", "saida", "s1", "out1" |
| Entrada 2 | "entrada 2", "entrada2", "e2", "in2" |
| Saída 2 | "saída 2", "saida2", "s2", "out2" |
| Entrada 3 | "entrada 3", "entrada3", "e3" (visível só com 3º turno ativo) |
| Saída 3 | "saída 3", "saida3", "s3" (visível só com 3º turno ativo) |

Colunas não mapeadas são ignoradas. Toggle "3º turno" exibe/oculta os campos de Entrada 3 / Saída 3.

**Atribuição de empregado:**

- Campo de busca por **nome** (autocomplete da lista carregada na Etapa 1)
- Após selecionar: exibe `{codigo} — {nome}` como confirmação
- Código preenchido automaticamente pelo Supabase; editável manualmente se necessário
- Código **não é obrigatório** — muitos documentos não trazem essa informação
- Se sem código: aba do Excel gerado usa só o nome; exibe aviso de que o Controle de Frequência pode não reconhecer o empregado na importação automática

**Validações:**

- Mapeamento da coluna **Data** é obrigatório — sem ela o Excel não pode ser gerado
- Mapeamento de pelo menos **Entrada 1 + Saída 1** é obrigatório
- Datas no formato `DD/MM/AAAA` e dentro da competência selecionada
- Horários no formato `HH:MM`
- Células inválidas destacadas em vermelho
- Empregado é obrigatório (pelo menos o nome)
- Botão "Gerar Excel" habilitado somente quando validações passam

---

## Lógica de Extração

### Detecção por tipo de arquivo

| Tipo | Biblioteca | Estratégia |
|---|---|---|
| `.xlsx` / `.xls` / `.csv` | SheetJS | Lê diretamente; colunas detectadas pelo cabeçalho da planilha |
| `.pdf` (digital) | PDF.js | Extrai texto; se resultado < 50 chars/página → trata como escaneado |
| `.pdf` (escaneado) | PDF.js + Tesseract.js | Renderiza cada página como canvas → OCR |
| `.png` / `.jpg` / `.jpeg` | Tesseract.js | OCR direto |

### Excel / CSV

SheetJS retorna array de linhas. A ferramenta procura o cabeçalho linha a linha (primeiras 5 linhas) e aplica fuzzy match para identificar cada coluna. Linhas sem data válida são ignoradas.

### PDF digital

PDF.js extrai texto concatenado por página. A ferramenta aplica regex para detectar padrões `HH:MM` (horários) e `DD/MM/AAAA` (datas) e agrupa por linha, reconstruindo a tabela a partir da posição do texto.

### Imagem / PDF escaneado

Tesseract.js com modelo `por` (português). O resultado bruto é segmentado por linhas e apresentado na Etapa 3 para revisão. Para documentos manuscritos, o OCR tenta extrair mas a revisão manual será necessária — a tabela editável é o mecanismo de correção.

### Output da extração (invariante)

Independente da fonte, o resultado desta etapa é sempre um array de objetos:
```js
[{ colA: '01/06/2026', colB: '08:00', colC: '12:00', colD: '13:00', colE: '17:00' }, ...]
```
com nomes de coluna genéricos (A, B, C...) mapeados para os campos-destino na Etapa 4.

---

## Formato de Saída (Excel)

Arquivo `.xlsx` com uma aba nomeada `{codigo} {nome}` (ou só `{nome}` se sem código).

Colunas:

| Col | Campo | Tipo |
|---|---|---|
| A | Data | Texto `DD/MM/AAAA` |
| B | Dia da Semana | Texto `Seg`, `Ter`, etc. (calculado pela ferramenta) |
| C | Entrada 1 | Texto `HH:MM` |
| D | Saída 1 | Texto `HH:MM` |
| E | Entrada 2 | Texto `HH:MM` |
| F | Saída 2 | Texto `HH:MM` |
| G | Entrada 3 | Texto `HH:MM` (apenas se 3º turno ativo) |
| H | Saída 3 | Texto `HH:MM` (apenas se 3º turno ativo) |

Células de data e hora forçadas como texto (`{ t: 's' }`) — mesma técnica do `gerarModeloExcel` em `script.js` para evitar auto-conversão do Excel.

Nome do arquivo gerado: `FolhaPonto_{codigo}_{nome}_{MM}-{AAAA}.xlsx`

---

## O que está fora do escopo V1

- Conversão de múltiplos empregados em uma única execução
- Detecção automática de DSR / feriados (o operador configura esses campos no Controle de Frequência após importar)
- Persistência dos dados no Supabase (a ferramenta é puramente client-side — extrai, converte e baixa)
- Suporte a documentos com mais de 5 páginas via OCR (Tesseract.js é lento para volumes grandes)
