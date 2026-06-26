# Design — SOUL TELECOM · Fechamento Folha

**Data:** 2026-06-26  
**Empresa:** SOUL TELECOMUNICAÇÕES EIRELI · CNPJ 33.492.462/0001-22 · Código `114`  
**Escopo:** Adicionar a empresa SOUL TELECOM à ferramenta de fechamento de folha, seguindo o padrão da Ananke (Opção B — sem módulo de férias).

---

## 1. Contexto e decisões

A ferramenta de fechamento de folha já suporta Quadrante Etiquetas, Track & Field e Anankê. Cada empresa tem seu par `empresa.html` + `empresa.js`. A lógica é idêntica entre elas: upload de planilha Excel → relatório de rubricas → geração de TXT no formato do sistema de folha SCONT. A diferença entre empresas está na estrutura da planilha de entrada e nos offsets de coluna/linha.

A Ananke foi usada como referência. A SOUL TELECOM **não terá** módulo de férias (steps 4 e 5) nem formulário de preenchimento manual — somente o fluxo via planilha.

---

## 2. Estrutura da planilha SOUL (confirmada)

Arquivo modelo: `Lançamento Folha SOUL EIRELLE.xls`  
Aba: `Planilha de Apontamento`

| Linha | Conteúdo |
|-------|----------|
| 1 | Razão Social + "PROVENTOS" (cabeçalho mesclado de seção) |
| 2 | CNPJ + **nomes das rubricas** (cols 2–15) |
| 3 | Competência (serial de data) |
| 4 | "Código" / "Nome dos Empregados" (rótulos de coluna) |
| 5+ | Dados dos empregados |
| Última | "TOTAL: N Colaboradores" (terminador) |

**Constantes de coluna (0-based):**

| Constante | Valor | Descrição |
|-----------|-------|-----------|
| `CODIGO_EMPRESA` | `'114'` | Código no Supabase |
| `LINHA_CABECALHO` | `2` | Linha com nomes de rubrica |
| `LINHA_DADOS_INI` | `5` | Primeira linha de dados |
| `COL_NOME` | `1` | Nome do empregado (col B) |
| `COL_REG` | `0` | Código do empregado (col A, pode ser vazio) |
| `COL_RUBRICAS_START` | `2` | Primeira coluna de rubrica (col C) |

Sem `COL_CARGO` (a planilha SOUL não tem coluna de cargo).  
Sem `LINHA_SUB_CABECALHO` (não há sub-cabeçalho de percentual).

**Rubricas presentes:**  
BONIFICAÇÃO, ANUÊNIO, PERICULOSIDADE, COND. AUTO, HORAS EXTRAS 50%, HORAS EXTRAS 100%, AD. NOTURNO 50%, AD. NOTURNO 100%, AJUDA DE CUSTO, DESC. VALE TRANSPORTE, DESCONTO AD. SALARIAL, HORAS FALTAS, DESC. PLANO DE SAÚDE, DESC. V.A

**Tipos de valor esperados:**  
- Booleano: BONIFICAÇÃO, ANUÊNIO, PERICULOSIDADE, COND. AUTO (valor "sim"/"SIM")  
- Minutos: HORAS EXTRAS 50%, HORAS EXTRAS 100%, AD. NOTURNO 50%, AD. NOTURNO 100%, HORAS FALTAS (formato "XhYY")  
- Monetário: AJUDA DE CUSTO, DESC. VALE TRANSPORTE, DESCONTO AD. SALARIAL, DESC. PLANO DE SAÚDE, DESC. V.A  

A configuração de tipos fica em `fechamento_rubricas_config` no Supabase (idêntico à Ananke).

---

## 3. Diferenças de parsing em relação à Ananke

| Aspecto | Ananke | SOUL TELECOM |
|---------|--------|--------------|
| Seleção de aba | `SheetNames.find(s => s.includes('MATRIZ'))` | `SheetNames.find(s => s.includes('APONTAMENTO'))` |
| Linha de cabeçalho | 3 | **2** |
| Sub-cabeçalho (insalubridade) | Linha 4 — resolve 0.2/0.4 → "20%"/"40%" | **Não existe** |
| Início dos dados | 5 | 5 (igual) |
| Critério de parada | `parseInt(row[0]) <= 0` | `!row[COL_NOME]` ou `/^total/i.test(nome)` |
| Cargo | `row[COL_CARGO]` | **Não existe** — cargo = `''` |

---

## 4. Arquivos a criar

### `soul.js`
- Cópia de `ananke.js` com:
  - Constantes atualizadas (tabela acima)
  - Lógica de seleção de aba ajustada
  - Loop de dados com critério de parada por nome vazio / "TOTAL:"
  - Remoção de `resolverHeaderInsalubridade` e bloco de sub-cabeçalho
  - `cargo` sempre `''`
  - Nome do arquivo de download: `Fechamento_SOUL_${comp}.txt`
  - Remoção de steps 4 e 5 (férias): funções `onFeriasSelecionada`, `processarFerias`, `renderizarFerias`, `filtrarFerias`, `imprimirFerias`, `preCarregarColunas`, variáveis `feriasData/Headers/Sorted/arquivoFerias`
  - `irStep3` não oferece botão para Step 4

### `soul.html`
- Cópia de `ananke.html` com:
  - Título e branding: "SOUL TELECOM · 114"
  - Sidebar: sem link "Formulário SOUL" (não existe)
  - Sem steps 4 e 5 no HTML (sem `#step4`, `#step5`, `uploadAreaFerias`)
  - Botão "Programação de Férias" removido dos steps 2 e 3
  - Script aponta para `soul.js`

---

## 5. Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `index.html` | Novo card "SOUL TELECOM · 114" na empresa-grid (só botão Planilha) |
| `ananke.html` | Adicionar `<a href="soul.html">` na seção Empresas da sidebar |
| `trackfield.html` | Idem |
| `quadrante.html` | Idem |
| `fluxo.html` | Idem (se sidebar lista empresas) |
| `ferias.html` | Idem (se sidebar lista empresas) |
| `formulario_ananke.html` | Idem |
| `formulario_trackfield.html` | Idem |
| `formulario_quadrante.html` | Idem |

---

## 6. O que NÃO muda

- Tabelas Supabase (`fechamento_rubricas_config`, `fechamento_empregados_config`, `fechamento_rubricas_ignoradas`, `rh_empregados`, `quadrante_folha_envios`) — mesmas tabelas, filtradas por `codigo_empresa = '114'`
- Formato do TXT gerado
- Lógica de resolução de rubricas (exact → fuzzy → fallback)
- Cadastro inline de empregados e rubricas
- Tela de Configurações
- Painel de histórico de envios

---

## 7. Fora de escopo

- Formulário de preenchimento manual (não solicitado)
- Módulo de programação de férias (Opção B escolhida)
- Refatoração para parser genérico
