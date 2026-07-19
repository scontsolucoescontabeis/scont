# Design: Conversor de Folha de Ponto (formato Sólides)

**Data:** 2026-07-19
**Ferramenta destino:** Controle de Frequência (`Projeto RH/index.html`)
**Arquivos novos:** `Projeto RH/conversor.html`, `Projeto RH/conversor.js`
**Contexto:** Reativação da ferramenta removida no commit `2d55774` ("remove ferramenta Conversor de Folha"), agora com parser dedicado ao formato de PDF recebido de outra plataforma (sistema **Sólides**), em vez do pipeline genérico (Excel/PDF/imagem + OCR) da V1 original (specs de 2026-06-18).

---

## Problema

Os controles de frequência recebidos de uma plataforma terceira (Sólides) chegam em PDF, com um layout fixo, um colaborador por página, contendo as batidas do mês ("PONTOS") e ocorrências (Abono, Atestado, Falta, Feriado). Hoje essa transcrição para o formato de importação do Controle de Frequência é manual. A ferramenta elimina esse trabalho automatizando a extração desse PDF específico.

---

## Escopo V2

- Um upload = um PDF do Sólides = **todos os colaboradores contidos nele** (uma página por colaborador) processados de uma vez.
- Parser dedicado ao layout do Sólides (PDF.js, texto digital). **Sem** suporte a Excel/CSV genérico, imagem ou OCR — se surgir outro formato, entra sob demanda depois.
- Saída: um único `.xlsx` com uma aba por colaborador (mesmo formato que `importarExcel`/`gerarModeloExcel` já esperam) + uma aba consolidada de ocorrências (informativa).

---

## Arquitetura

### Arquivos

| Arquivo | Papel |
|---|---|
| `Projeto RH/conversor.html` | Interface (wizard 5 etapas) |
| `Projeto RH/conversor.js` | Parser do PDF, matching de colaboradores, tabela de revisão, geração do Excel |

### Integração com o projeto existente

- Novo item na sidebar do `Projeto RH/index.html`, mesma posição/estilo do link removido anteriormente.
- Reutiliza `styles.css`, `supabase-config.js`, `portal-auth-guard.js` (mesma autenticação do módulo RH — `PortalAuthGuard.init(1)`).
- SheetJS (`xlsx.full.min.js`) para gerar o `.xlsx` de saída.
- PDF.js (CDN) para extrair texto do PDF — única dependência nova. **Sem Tesseract.js** (não há OCR neste escopo).

---

## Fluxo UX — Wizard em 5 Etapas

### Etapa 1 — Configuração

- Campo **Empresa**: autocomplete em `rh_empresas` (mesmo padrão do `index.html`); ao selecionar, carrega `rh_empregados` da empresa para uso no matching da Etapa 3.
- Campo **Competência**: `MM/AAAA`, editável; será **pré-preenchido automaticamente** assim que o PDF for lido na Etapa 2 (a partir do período do cabeçalho, ex. `01/06/2026 a 30/06/2026` → `06/2026`), mas o operador pode ajustar antes de prosseguir.
- Botão "Próximo" habilitado com empresa selecionada (competência pode ser confirmada depois do upload, mas o campo já existe aqui para permitir digitação manual caso o PDF não traga o período).

### Etapa 2 — Upload

- Dropzone aceitando **somente `.pdf`**.
- Ao soltar/selecionar: extrai texto via PDF.js, valida que é um export do Sólides (presença de marcadores `DADOS DO COLABORADOR`, `PONTOS`, `TRABALHADAS` no texto). Se não reconhecer o formato, mostra erro e não avança.
- Se reconhecido: extrai competência do cabeçalho (se `competencia` da Etapa 1 estiver vazia, preenche automaticamente) e roda o parser (ver seção "Lógica de Extração").
- Barra de progresso durante leitura das páginas.

### Etapa 3 — Revisão de Colaboradores

- Tabela com uma linha por colaborador encontrado no PDF: **Nome extraído**, **CPF extraído** (exibição apenas — `rh_empregados` não tem CPF), **Sugestão de vínculo** (melhor match fuzzy por nome contra a lista de empregados da empresa carregada na Etapa 1) e um `<select>` para confirmar/corrigir/ignorar (opção "Não importar este colaborador").
- Colaboradores sem sugestão de match ficam com o select em branco, destacados, exigindo escolha manual antes de avançar (ou marcação explícita de "ignorar").
- Botão "Próximo" habilitado quando todos os colaboradores tiverem uma decisão (vínculo ou ignorar).

### Etapa 4 — Revisão dos Dados

- Navegação por abas internas (uma por colaborador confirmado).
- Tabela editável (mesmo padrão de célula-como-`<input>` da V1): Data, Dia da Semana (calculado), Entrada 1, Saída 1, Entrada 2, Saída 2 (+ Entrada 3/Saída 3 se qualquer dia de qualquer colaborador tiver um 3º período real detectado — mesma convenção do `gerarModeloExcel`/toggle "3º turno") e coluna **Ocorrência** (texto livre, editável).
- Serve como mecanismo de correção manual para casos em que o parser não reconstrua perfeitamente um texto de ocorrência (ex. textos longos que quebram em duas linhas no PDF).

### Etapa 5 — Geração do Excel

- Botão "Gerar Excel" monta o workbook e baixa.
- Mensagem de sucesso lembrando que a aba "Ocorrências" é só informativa e que os flags (Falta/Atestado/etc.) devem ser marcados manualmente no Controle de Frequência após importar as batidas.

---

## Lógica de Extração

### Leitura do PDF

PDF.js (`getTextContent` por página). Para cada página:
1. Agrupa itens de texto por posição Y (arredondada) e ordena por X dentro de cada linha — reconstrói as linhas visuais da página (mesma técnica usada no `parsearTextoPDF` da V1).
2. Junta todas as linhas da página em um texto único (`textoPagina`) para permitir que o parser de dias trabalhe por âncora de data (ver abaixo), robusto a quebras de linha dentro de uma célula.

### Detecção de formato válido

Se o texto concatenado de todas as páginas não contiver `DADOS DO COLABORADOR`, `PONTOS` e `TRABALHADAS`, aborta com erro: "Arquivo não reconhecido como Folha de Ponto do Sólides."

### Cabeçalho do colaborador (por página)

Localiza o bloco após `DADOS DO COLABORADOR` e extrai via regex:
- **Nome**: entre `Nome:` e o próximo rótulo (`CPF:`)
- **CPF**: dígitos após `CPF:`
- **Admissão**: data após `Admissão:`
- **Função**: texto após `Função:` até o próximo rótulo/fim de linha
- **Código**: texto após `Código:` (frequentemente vazio no PDF de origem)

Também extrai o período da folha do cabeçalho da página: `(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})` → competência = mês/ano da data final.

### Seção "PONTOS" (batidas do mês)

1. Localiza o texto entre o cabeçalho da tabela (linha com `DIA / MÊS` / `PONTOS` / `TRABALHADAS`) e o fim da seção (linha `Total:` ou rodapé `Reconheço a exatidão`).
2. Usa como âncoras de início de dia o padrão `(\d{2}\/\d{2})\s+(segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|s[aá]bado|domingo)` (case-insensitive) e corta o texto em blocos, um por dia, do início de uma âncora até o início da próxima.
3. Para cada bloco (dia):
   - Se o conteúdo após data+dia-da-semana for só `-` (trim) → dia sem expediente, sem batidas, sem ocorrência.
   - Caso contrário, divide o restante do bloco por `|`:
     - **0 pipes**: bloco é um status de dia inteiro (ex. `ABONO 09:00 09:00`, `FALTA NAO JUSTIFICADA 09:00 -9:00`, `FERIADO 09:00 09:00`, `FALTA - FERIADO: Corpus Christi 09:00 -9:00`). A **Ocorrência** é o texto antes do primeiro número (regex de palavras-chave: `ABONO`, `ATESTADO MÉDICO`, `ATESTADO DE COMPARECIMENTO`, `FALTA NÃO JUSTIFICADA`, `FALTA\s*-\s*FERIADO:?\s*[^0-9|]*`, `FERIADO`). Sem batidas.
     - **N pipes (N≥1)**: os N segmentos antes do último `|` são períodos de trabalho; o segmento após o último `|` contém os totais (Trabalhadas/Abono/Previstas/Saldo) e é descartado para fins de batida.
       - Cada segmento-período com 2 horários (`HH:MM ... HH:MM`, ignorando o marcador `(m)` de edição manual) vira um par Entrada/Saída, na ordem em que os períodos aparecem (1º segmento → Entrada 1/Saída 1, 2º → Entrada 2/Saída 2, 3º → Entrada 3/Saída 3 se existir).
       - Um segmento-período sem horários mas com uma palavra-chave de status (ex. `ABONO` substituindo um período, como em `(m)08:00 12:00 | ABONO | 04:00 05:00 09:00`) não gera Entrada/Saída para aquele período e contribui para a **Ocorrência** do dia (concatenada com `+` se já houver outra).

### Saída invariante do parser (por colaborador)

```js
{
  nome: 'DANIELA DAS GRAÇAS NASARIO',
  cpf: '88492745134',
  admissao: '25/02/2026',
  funcao: 'OPERADOR DE CAIXA',
  codigo: '',
  dias: [
    { data: '01/06/2026', diaSemana: 'Seg', entrada1: '07:40', saida1: '12:11', entrada2: '13:08', saida2: '18:13', entrada3: '', saida3: '', ocorrencia: '' },
    { data: '04/06/2026', diaSemana: 'Qui', entrada1: '', saida1: '', entrada2: '', saida2: '', entrada3: '', saida3: '', ocorrencia: 'ABONO' },
    ...
  ]
}
```

Todos os dias do mês da competência são preenchidos (usando a mesma `gerarDiasDoMes` do `script.js`, reimplementada localmente), com os campos acima vazios quando o PDF não tiver dado para aquele dia (não deve acontecer em uso normal, mas evita abas com meses incompletos).

---

## Matching de Colaborador (Etapa 3)

- Normaliza nomes (minúsculas, sem acento, sem espaços duplicados) e compara o nome extraído do PDF com `nome_empregado` de cada `rh_empregados` da empresa selecionada.
- Sugestão = melhor match por inclusão de substring normalizada (mesma heurística simples usada no restante do projeto); se nenhum candidato tiver correspondência razoável, sugestão fica vazia.
- Operador confirma/corrige via `<select>` com todos os empregados da empresa + opção "Não importar este colaborador".

---

## Formato de Saída (Excel)

Arquivo `.xlsx` com:

**Uma aba por colaborador confirmado**, nomeada `{codigo_empregado} {nome_empregado}` (ou só `{nome_empregado}` se sem código) — igual ao padrão de `gerarModeloExcel`/`importarExcel`:

| Col | Campo |
|---|---|
| A | Data (texto `DD/MM/AAAA`, forçado `{t:'s'}`) |
| B | Dia da Semana (`Seg`, `Ter`, etc.) |
| C | Entrada 1 |
| D | Saída 1 |
| E | Entrada 2 |
| F | Saída 2 |
| G, H | Entrada 3, Saída 3 — **somente** se algum dia de algum colaborador do arquivo tiver um 3º período real |

**Uma aba final "Ocorrências"** (sempre por último no workbook), consolidando todos os colaboradores:

| Col | Campo |
|---|---|
| A | Código |
| B | Empregado |
| C | Data |
| D | Dia da Semana |
| E | Ocorrência |

Só contém linhas onde `ocorrencia` não é vazio. Esta aba é **puramente informativa**: o `importarExcel` do Controle de Frequência não a reconhece como aba de colaborador (vai gerar um aviso do tipo `Aba "Ocorrências": código "Ocorrências" não encontrado` ao importar — aviso inofensivo, esperado, que pode ser ignorado). Os flags correspondentes (Falta/Atestado Médico/Atestado de Comparecimento/etc.) continuam sendo marcados manualmente pelo operador na tela do Controle de Frequência, usando essa aba como referência.

Nome do arquivo gerado: `FolhaPonto_{codigoEmpresa}_{MM}-{AAAA}.xlsx`.

---

## O que está fora do escopo

- Excel/CSV genérico, imagens, PDF escaneado, OCR (Tesseract.js) — tudo removido do escopo V1; não reativado aqui.
- Detecção automática de DSR / feriados no Controle de Frequência (o operador continua configurando isso na própria ferramenta).
- Aplicação automática dos flags de Falta/Atestado/Abono no `importarExcel` — permanece manual, apenas com a informação disponível na aba "Ocorrências".
- Persistência dos dados extraídos no Supabase — ferramenta client-side, extrai/converte/baixa.
- Suporte a PDFs de outras plataformas além do Sólides (layout diferente do modelo fornecido).
