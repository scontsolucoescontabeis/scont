# Design: Quadrante — Relatório Líquido (Etiquetas Bancárias)

**Data:** 2026-07-01
**Escopo:** Novo Step no `quadrante.html` para gerar o "Relatório Líquido" (relação de lançamentos bancários), replicando o modelo `Quadrante Etiquetas - Relatório Líquido.docx` com a identidade visual do Portal SCONT.

---

## 1. Contexto e arquivos de referência

- `Quadrante Etiquetas - Relatório Líquido.docx` — modelo visual do relatório final. Estrutura:
  - Cabeçalho: nome da empresa ("QUADRANTE ETIQUETAS INDÚSTRIA E COMÉRC[IO]"), C.N.P.J./CEI, Inscrição, Período de/a, Endereço completo.
  - Corpo: uma tabela por banco. Cada tabela tem cabeçalho de colunas (Código | Funcionário | CPF | Agência / Conta /Tipo Conta | Valor Líquido), uma linha "Banco: NOME DO BANCO", as linhas dos empregados daquele banco, e uma linha "Total:" com o somatório do Valor Líquido do grupo.
  - A coluna "Valor Líquido" está em branco no modelo — é a coluna que este relatório precisa preencher.
- `Relação de Líquidos - Informações Bancárias_quadrante.xls` — planilha de entrada, formato .xls binário (BIFF/OLE), com 2 abas:
  - **"Informações bancárias"** (85 linhas, 8 colunas): `Código, Nome do Empregado, Cargo, C.Custo, CPF, Banco, Agência, Nº Conta`. Contém linhas duplicadas por empregado (mesmo conteúdo repetido) — precisam de dedupe. **Não existe coluna de Tipo de Conta** (Corrente/Salário) nesta planilha, apesar do modelo DOCX exibi-la.
  - **"Líquido"** (40 linhas, 4 colunas): `Código, Nome do empregado, CPF, Valor`. Um valor líquido por empregado, referente à competência do mês corrente.
  - O campo `Banco` é um código numérico (ex.: `341`, `33`), correspondente à tabela FEBRABAN (341 = Itaú, 033 = Santander), não ao nome do banco.
- Empresa: Quadrante Etiquetas, código interno `453` (mesma convenção usada em `schema_fechamento.sql` e `quadrante.js`).

## 2. Fluxo do usuário

Novo **Step 6** no wizard de `quadrante.html`, acessado por um botão "🏷️ Etiquetas Bancárias" adicionado ao Step 3 (ao lado do botão existente "📅 Programação de Férias").

### Step 6a — Upload
- Área de upload (.xls/.xlsx) reaproveitando SheetJS (já carregado na página).
- Localiza as abas por nome com correspondência flexível (case/acento-insensitive): aceita variações como "Informações bancárias", "Informacoes Bancarias", "Líquido", "Liquido".
- Se uma das duas abas não for encontrada, exibe erro e interrompe.

### Step 6b — Processamento e persistência
1. Parseia a aba "Informações bancárias" em objetos `{ codigo_empregado, cpf, nome, cargo, centro_custo, banco_codigo, agencia, conta }`.
2. Deduplica por `codigo_empregado` (mantém a última ocorrência da planilha).
3. Busca no Supabase os registros já existentes de `fechamento_dados_bancarios` para `codigo_empresa = '453'`.
4. Faz upsert mesclando: para cada empregado da planilha, se já existir registro no banco, preserva o `tipo_conta` atual (nunca sobrescrito pela importação); se não existir, cria com `tipo_conta = 'C.Corrente'` (default).
5. Parseia a aba "Líquido" em objetos `{ codigo_empregado, cpf, nome, valor }`.
6. Recarrega o dataset bancário completo da empresa a partir do Supabase (pós-upsert) — isto garante que o relatório sempre usa a versão mais recente persistida, mesmo que uma importação futura traga só a aba "Líquido".
7. Casa cada linha de "Líquido" com o registro bancário correspondente por `codigo_empregado`; se não encontrar por código, tenta por CPF (dígitos normalizados) como fallback.

### Step 6c — Revisão (tela editável antes do PDF)
- Tabela agrupada por banco (nome resolvido via mapa FEBRABAN estático — ver seção 3), com subtotal por grupo e total geral.
- Cada linha tem um `<select>` de Tipo de Conta (`C.Corrente` / `C.Salário` / `Poupança`), pré-selecionado com o valor persistido. Alterar o select salva imediatamente (`update` pontual) na tabela `fechamento_dados_bancarios`.
- Empregados da aba "Líquido" sem registro bancário correspondente aparecem destacados em uma seção "⚠ Sem dados bancários", com um mini-formulário inline (Banco/Agência/Conta/Tipo) para completar e persistir na hora. Enquanto houver pendências nessa seção, o botão de gerar PDF fica desabilitado com uma dica explicando o motivo.
- Botão "← Voltar" retorna ao Step 3.

### Step 6d — Geração do PDF
- Botão "📄 Gerar PDF" habilitado somente quando não há pendências de dados bancários.
- Usa jsPDF + AutoTable (mesma dependência já usada em `ferias.html`), no padrão visual do Portal SCONT (ver seção 4).

## 3. Modelo de dados

### Nova tabela `fechamento_dados_bancarios`

```sql
CREATE TABLE IF NOT EXISTS public.fechamento_dados_bancarios (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa   TEXT NOT NULL,
    codigo_empregado TEXT NOT NULL,
    cpf              TEXT,
    nome_empregado   TEXT,
    cargo            TEXT,
    centro_custo     TEXT,
    banco_codigo     TEXT,
    agencia          TEXT,
    conta            TEXT,
    tipo_conta       TEXT NOT NULL DEFAULT 'C.Corrente',
    atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fechamento_dados_bancarios_unique UNIQUE (codigo_empresa, codigo_empregado)
);

CREATE INDEX IF NOT EXISTS idx_fech_dados_bancarios_empresa
    ON public.fechamento_dados_bancarios (codigo_empresa);

ALTER TABLE public.fechamento_dados_bancarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fechamento_dados_bancarios: leitura autenticado"
    ON public.fechamento_dados_bancarios FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "fechamento_dados_bancarios: escrita autenticado"
    ON public.fechamento_dados_bancarios FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
```

A aba "Líquido" **não é persistida** — é dado do mês corrente, usado apenas em memória para montar o relatório e o PDF.

### Mapa de bancos (constante JS, `quadrante.js`)

```js
const BANCOS_FEBRABAN = {
    '001': 'BANCO DO BRASIL', '033': 'BANCO SANTANDER', '077': 'BANCO INTER',
    '104': 'CAIXA ECONÔMICA FEDERAL', '208': 'BANCO BTG PACTUAL', '212': 'BANCO ORIGINAL',
    '237': 'BANCO BRADESCO', '260': 'NU PAGAMENTOS (NUBANK)', '318': 'BANCO BMG',
    '336': 'BANCO C6', '341': 'BANCO ITAÚ', '399': 'HSBC', '422': 'BANCO SAFRA',
    '623': 'BANCO PAN', '655': 'BANCO VOTORANTIM', '748': 'SICREDI', '756': 'SICOOB',
};
function nomeBanco(codigo) {
    const c = String(codigo).replace(/\D/g, '').padStart(3, '0');
    return BANCOS_FEBRABAN[c] || ('BANCO ' + c);
}
```

## 4. Geração do PDF

Segue o padrão já usado em `gerarPDF()` de `ferias.html` (jsPDF + AutoTable, paleta SCONT via `hexToRgb`), adaptado para o layout do modelo DOCX:

- Formato A4 retrato (a tabela do modelo tem 5 colunas estreitas, cabe em retrato).
- Barra de cabeçalho colorida (paleta SCONT) com:
  - Nome da empresa: `QUADRANTE ETIQUETAS INDÚSTRIA E COMÉRCIO` (constante fixa, igual ao DOCX).
  - CNPJ: `24.862.830/0001-96`, Inscrição: `140866668111` (constantes fixas).
  - Endereço: `Rua Soldado Antônio Aparecido, Nº 296 - GALPAO, Parque Novo, São Paulo` (constante fixa).
  - Título "Relação de Lançamentos Bancários".
  - Período: `01/MM/AAAA a DD/MM/AAAA`, derivado do campo `competencia` (formato `MM/AAAA`) já preenchido no wizard — dia final calculado via `new Date(ano, mes, 0).getDate()`.
- Corpo: uma `autoTable` por grupo de banco, cada uma com:
  - Cabeçalho de colunas: Código | Funcionário | CPF | Agência / Conta / Tipo Conta | Valor Líquido.
  - Linha de destaque "Banco: NOME DO BANCO" (célula colspan, fundo na cor secundária).
  - Linhas dos empregados, com Valor Líquido formatado `R$ 1.234,56` (mesma função `toLocaleString('pt-BR', {minimumFractionDigits:2})` já usada em `quadrante.js`).
  - Linha "Total:" em negrito com o somatório do grupo.
- Nome do arquivo: `Relacao_Bancaria_Quadrante_MM-AAAA.pdf`.

## 5. Casos de borda

| Caso | Tratamento |
|---|---|
| Linha duplicada na aba bancária | Dedupe mantendo a última ocorrência por `codigo_empregado` |
| Empregado sem nenhum cadastro bancário | Bloqueia geração do PDF até completar ou o usuário optar por excluí-lo do relatório do mês (checkbox "excluir deste relatório", não afeta persistência) |
| Código do banco não mapeado em `BANCOS_FEBRABAN` | Exibe `"BANCO <código>"` como fallback, sem bloquear |
| Aba não encontrada na planilha (nome divergente) | Erro amigável antes de processar, sem gravar nada no Supabase |
| Competência (Step 1) não preenchida ao chegar no Step 6 | Bloqueia acesso ao Step 6 com aviso "Preencha a Competência no Step 1" |

## 6. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `Projeto Fechamento Folha/quadrante.html` | Novo Step 6 (upload, revisão, geração de PDF); botão de acesso no Step 3 |
| `Projeto Fechamento Folha/quadrante.js` | Parsing das 2 abas, upsert/merge em `fechamento_dados_bancarios`, matching Líquido↔Bancário, mapa `BANCOS_FEBRABAN`, `gerarPDFLiquido()` |
| `Projeto Fechamento Folha/schema_fechamento.sql` | Adicionar SQL de criação da tabela `fechamento_dados_bancarios` |
