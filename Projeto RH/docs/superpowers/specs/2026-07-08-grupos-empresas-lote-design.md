# Design: Grupos de Empresas — Modelos, Processamento e TXT em Lote

**Data:** 2026-07-08
**Status:** Aprovado
**Arquivos principais:** `Projeto RH/index.html`, `Projeto RH/script.js`, `Projeto RH/schema_rh.sql`

---

## Contexto

O Controle de Frequência hoje opera estritamente empresa por empresa: a tela inicial exige selecionar uma única empresa, a tela de edição carrega os empregados dela e o processamento (`processarFolhaComSalvamento`) calcula e salva apenas para `state.empresaSelecionada`. A única operação que já suporta múltiplas empresas de uma vez é a exportação de TXT em lote (`exportTxtModal`), via seleção ad-hoc de checkboxes por competência.

Este design introduz o conceito de **grupo de empresas** — um conjunto nomeado e persistido — e estende três operações para trabalhar sobre o grupo inteiro de uma vez: baixar modelos Excel, processar folhas (a partir de arquivos já preenchidos) e exportar TXT.

Este design depende da spec [`2026-07-08-config-empresa-extra100-turnos-naocompensar-design.md`](2026-07-08-config-empresa-extra100-turnos-naocompensar-design.md) (já implementada): o processamento em lote lê a configuração por empresa (jornada, regra de hora extra 100%, 3 turnos) diretamente do Supabase, sem depender de nenhuma tela de edição manual visitada previamente.

---

## Escopo confirmado com o usuário

- **Grupo:** conjunto salvo e nomeado no Supabase (não é seleção ad-hoc a cada operação).
- **Processamento em lote:** upload de múltiplos arquivos Excel já preenchidos (um por empresa, gerados a partir do modelo do próprio sistema) — não é edição manual sequencial tela a tela.
- **Modelos em lote:** entregues como um único `.zip` (nova dependência: JSZip via CDN).
- **Flags de dia (Folga/Falta/Atestado/Compensação/DSR):** **fora do escopo do upload em lote.** O modelo Excel não ganha colunas novas. Dias sem Entrada/Saída ficam como "Sem Registro" (sem impacto nos totais); se o operador precisar marcar folga/falta/atestado para alguma empresa do grupo, abre aquela empresa individualmente pela tela normal e ajusta antes de gerar o TXT final.
- **Pós-processamento em lote:** resumo por empresa com status (sucesso/erro/sem arquivo); empresas com erro não são salvas, as demais são.
- **Navegação:** tela nova, própria, no menu lateral ("Grupos de Empresas").

---

## Banco de Dados

Duas tabelas novas:

```sql
-- ============================================================
-- TABELA: rh_grupos_empresas
--    Grupos nomeados de empresas para operações em lote.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_grupos_empresas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_grupo  TEXT NOT NULL UNIQUE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_grupos_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_grupos_empresas: leitura autenticado"
    ON public.rh_grupos_empresas FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_grupos_empresas: escrita autenticado"
    ON public.rh_grupos_empresas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- TABELA: rh_grupos_empresas_itens
--    Empresas pertencentes a cada grupo.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_grupos_empresas_itens (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id       UUID NOT NULL REFERENCES public.rh_grupos_empresas(id) ON DELETE CASCADE,
    codigo_empresa TEXT NOT NULL,
    CONSTRAINT rh_grupo_item_uniq UNIQUE (grupo_id, codigo_empresa)
);

CREATE INDEX IF NOT EXISTS idx_rh_grupo_itens_grupo ON public.rh_grupos_empresas_itens (grupo_id);

ALTER TABLE public.rh_grupos_empresas_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_grupos_empresas_itens: leitura autenticado"
    ON public.rh_grupos_empresas_itens FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_grupos_empresas_itens: escrita autenticado"
    ON public.rh_grupos_empresas_itens FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
```

---

## Nova dependência: JSZip

Adicionar ao `index.html`, junto aos demais scripts de biblioteca (mesmo padrão do `xlsx.full.min.js`, carregado via CDN):

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
```

---

## Navegação

Novo item na sidebar: **"👥 Grupos de Empresas"**, seguindo o mesmo padrão dos demais itens (`sidebar-item`, `onclick="mostrarTela('gruposScreen')"`).

### Tela `gruposScreen`

Layout em duas colunas:

```
┌─ GRUPOS ──────────────┐  ┌─ DETALHE DO GRUPO ─────────────────────────┐
│ [+ Novo Grupo]        │  │ Nome: [_____________________]  [💾 Salvar] │
│ ─────────────────     │  │                                            │
│ ● Grupo Shopping X (4)│  │ Empresas do grupo:                        │
│ ○ Grupo Centro (7)    │  │  [busca empresa... ▼]                     │
│ ○ Grupo Filiais SP (3)│  │  ┌────────────────────────────────────┐   │
│                        │  │  │ 001 - Empresa A            [remover]│   │
│                        │  │  │ 002 - Empresa B            [remover]│   │
│                        │  │  └────────────────────────────────────┘   │
│                        │  │  [🗑 Excluir Grupo]                       │
│                        │  ├────────────────────────────────────────────┤
│                        │  │ AÇÕES EM LOTE                              │
│                        │  │ Competência: [MM/AAAA]                     │
│                        │  │ [📥 Baixar Modelos (.zip)]                 │
│                        │  │ [📤 Processar em Lote]                     │
│                        │  │ [📄 Exportar TXT do Grupo]                 │
└────────────────────────┘  └────────────────────────────────────────────┘
```

- Lista de grupos carregada via `SELECT id, nome_grupo FROM rh_grupos_empresas` + contagem de itens.
- Busca de empresa para adicionar ao grupo reaproveita o mesmo padrão de autocomplete já usado em `filtrarEmpresasConfig` (lista de `state.empresas`, filtra por nome/código).
- **Salvar grupo:** upsert do `nome_grupo`; para os itens, estratégia simples de "delete + insert" no `rh_grupos_empresas_itens` do grupo (evita diff manual de adições/remoções).
- **Excluir Grupo:** confirmação, depois `DELETE FROM rh_grupos_empresas WHERE id = ...` (itens caem em cascata via FK).
- As "Ações em Lote" só ficam habilitadas com um grupo já salvo (tem `id`) e pelo menos uma empresa associada.

---

## Ação 1: Baixar Modelos (.zip)

Função `baixarModelosGrupo()`:

1. Valida competência (`validarCompetencia`).
2. Para cada empresa do grupo (loop sequencial):
   - Busca empregados: `rh_empregados` filtrando `codigo_empresa`. Se vazio, pula a empresa e registra aviso ("Empresa X sem empregados cadastrados").
   - Busca config da empresa via `_buscarConfigRubricas(codigoEmpresa)` para ler `terceiro_turno`.
   - Monta o workbook exatamente como `gerarModeloExcel` já faz hoje (mesmo cabeçalho, mesmas colunas condicionais ao 3º turno, mesma formatação de coluna Data), mas em vez de `XLSX.writeFile(wb, nome)`, gera o binário com `XLSX.write(wb, { type: 'array', bookType: 'xlsx' })` e adiciona ao JSZip: `zip.file('Modelo_FolhaPonto_{codEmp}_{mm}-{aaaa}.xlsx', binario)`.
3. Ao final do loop: `zip.generateAsync({ type: 'blob' })` e aciona o download único `Modelos_{nome_grupo}_{mm}-{aaaa}.zip` (via link temporário, mesmo padrão de download já usado no projeto).
4. Se houver avisos (empresas puladas), mostra mensagem final listando quais.

---

## Ação 2: Exportar TXT do Grupo

Função `abrirExportacaoTxtGrupo()`:

Reaproveita o modal e a lógica **já existentes** (`exportTxtModal`, `_construirConteudoTXTExportacao`, `_toggleNaoCompensar`) sem duplicar código de geração de TXT:

1. Abre `exportTxtModal` (mesma função `abrirModalExportacaoTXT`, adaptada para aceitar uma lista pré-definida de empresas).
2. Em vez de o operador clicar em "Buscar" e marcar checkboxes manualmente, a lista de empresas do modal (`renderizarListaEmpresasExportacao`) já vem pré-marcada com as empresas do grupo (filtradas pelas que têm dados salvos na competência informada, igual à validação que já existe hoje).
3. Todo o restante do fluxo (pré-preenchimento de rubricas/não-compensar, pré-visualização, geração do TXT) permanece idêntico ao modal de exportação atual.

---

## Ação 3: Processar em Lote

### UI

Campo de competência (reaproveita `state.competencia` da tela do grupo) + `<input type="file" id="loteArquivos" multiple accept=".xlsx">` + botão "📤 Processar em Lote".

### Validação por arquivo (antes de processar)

Para cada arquivo selecionado, extrair `codEmp`, `mm`, `aaaa` do nome via regex:

```js
const m = file.name.match(/^Modelo_FolhaPonto_(.+)_(\d{2})-(\d{4})\.xlsx$/i);
```

Erros que impedem o processamento **daquele arquivo específico** (os demais continuam):
- Nome fora do padrão → "Nome de arquivo inválido".
- `mm/aaaa` diferente da competência informada → "Competência do arquivo não confere".
- `codEmp` não pertence ao grupo selecionado → "Empresa não pertence ao grupo".
- Mais de um arquivo para o mesmo `codEmp` → "Arquivo duplicado para esta empresa" (mantém o primeiro, rejeita os demais).

### Processamento por empresa (arquivos válidos)

Função `processarLoteGrupo()`, sequencial por empresa:

1. **Snapshot do `state`** antes do loop: salvar `jornada`, `jornadaSexta`, `jornadaSextaAtiva`, `jornadaSabado`, `jornadaSabadoAtiva`, `sabadoSempreExtra`, `ruleExtra100Optional`, `terceiroTurno`, `folhas`, `competencia`, `empresaSelecionada` — restaurados ao final (sucesso ou erro), para não deixar resíduo na tela de edição manual normal.
2. Define `state.competencia` = competência informada no grupo (usada por `gerarDiasDoMes`).
3. Para cada empresa/arquivo válido:
   - Busca empregados: `rh_empregados` (`codigo_empresa = codEmp`). Se vazio → erro "Empresa sem empregados cadastrados", pula.
   - Busca config da empresa (`_buscarConfigRubricas`) e aplica em `state`: `jornada = cfg['jornada_diaria']?.cod || '08:00'`, `jornadaSextaAtiva`, `jornadaSexta`, `jornadaSabadoAtiva`, `jornadaSabado`, `sabadoSempreExtra`, `ruleExtra100Optional = cfg['rule_extra_100_opcional']?.cod === '1'`, `terceiroTurno = cfg['terceiro_turno']?.cod === '1'` — mesmos fallbacks já usados em `selecionarEmpresa`/`_preencherCamposConfigRubricas`.
   - Lê o workbook (`XLSX.read`) e monta `state.folhas` do zero para essa empresa (array local, não usa o `state.folhas` da sessão do operador): para cada aba, mapeia `sheetName.split(' ')[0]` ao empregado (mesma lógica de `importarExcel`), monta `{ empregadoId, nome, dados: gerarDiasDoMes(state.competencia), dsrDias: [], flagsFolga: {} }` e preenche `entrada1/saida1/entrada2/saida2` (e `entrada3/saida3` se `state.terceiroTurno`) a partir das linhas da planilha, com o mesmo `normalizeHora`.
   - Abas cuja primeira palavra do nome não corresponde a nenhum `codigo_empregado` da empresa são ignoradas e contam como aviso ("aba X sem correspondência"), sem interromper o restante da empresa.
   - Se nenhuma aba correspondeu a um empregado → erro "Nenhum empregado correspondente encontrado no arquivo", pula a empresa (nada salvo para ela).
   - Roda `calcularFolha(folha)` para cada folha montada (função reaproveitada sem alterações).
   - Monta `dadosParaSalvar` e faz `upsert` em `rh_saves` — mesmo formato de campos que `processarFolhaComSalvamento` já grava hoje (`empresa_codigo`, `nome_trabalhador`, `competencia`, `jornada`, `jornada_sexta*`, `jornada_sabado*`, `sabado_sempre_extra`, `rule_extra_100_opcional`, `dados_json`, `feriados_json`, `dsr_dias`, `flags_folga`, `responsavel_alteracao`, `status: 'finalizado'`, `criado_por`, `atualizado_por`, `nome_usuario`).
   - Registra resultado: ✅ sucesso (N empregados processados, com lista de avisos de abas ignoradas, se houver) ou ⚠️ erro (mensagem).
4. Empresas do grupo sem nenhum arquivo correspondente entram no resumo como "⬜ Sem arquivo enviado" (informativo, não bloqueia as demais).
5. **Restaura o snapshot do `state`** salvo no passo 1.

### Tela de resumo

Após o loop, exibe uma tabela (reaproveitando o componente de mensagem/modal já usado no projeto para feedback, `mostrarMensagem` ou um modal dedicado simples):

| Empresa | Status | Detalhe |
|---|---|---|
| 001 - Empresa A | ✅ Processada | 12 empregados |
| 002 - Empresa B | ⚠️ Erro | Nenhum empregado correspondente encontrado |
| 003 - Empresa C | ⬜ Sem arquivo enviado | — |

Empresas com erro **não são salvas**; as processadas com sucesso já estão em `rh_saves` e disponíveis para a Ação 2 (Exportar TXT do Grupo) imediatamente.

---

## O que NÃO muda

- `calcularFolha`, `gerarDiasDoMes`, `normalizeHora`, `_construirConteudoTXTExportacao`, `_toggleNaoCompensar` — reaproveitados sem alteração de assinatura ou comportamento.
- O fluxo single-empresa existente (tela inicial → edição manual → processar → gerar TXT individual) continua funcionando exatamente como hoje; nada nele é removido ou substituído.
- O modal de exportação de TXT em lote (`exportTxtModal`) continua funcionando no modo ad-hoc (sem grupo) para quem preferir selecionar empresas manualmente.
- Flags de dia (folga/falta/atestado/compensação/DSR) continuam sendo definidos exclusivamente pela tela de edição manual, empresa por empresa.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `index.html` | Script JSZip via CDN; novo item de sidebar; tela `gruposScreen` (lista de grupos, detalhe, ações em lote); modal de resumo do processamento em lote |
| `script.js` | CRUD de grupos (`carregarGrupos`, `salvarGrupo`, `excluirGrupo`, `adicionarEmpresaAoGrupo`/`removerEmpresaDoGrupo`), `baixarModelosGrupo`, `abrirExportacaoTxtGrupo`, `processarLoteGrupo` + parsing/validação de arquivos |
| `schema_rh.sql` | Novas tabelas `rh_grupos_empresas` e `rh_grupos_empresas_itens` + RLS |

---

## Pontos de atenção para a fase de plano de implementação

- `abrirModalExportacaoTXT` precisa aceitar uma lista de empresas pré-definida (parâmetro opcional) em vez de depender exclusivamente do fluxo "buscar por competência" com checkboxes manuais — checar o impacto mínimo nessa função existente antes de alterá-la.
- Testar manualmente o processamento em lote com pelo menos: uma empresa com todos os dados corretos, uma empresa com uma aba sem correspondência, uma empresa sem nenhum arquivo enviado, e um arquivo com nome fora do padrão — para validar que o resumo reflete cada caso corretamente e que o `state` da sessão volta ao normal depois.
