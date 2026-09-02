# Design: Feriados nacionais e locais + tela de administração

**Data:** 2026-09-01
**Arquivos principais:** `feriados-calculo.js` (novo), `escala-calculo.js`, `folha-ponto-calculo.js`,
`admin.html` / `admin.js`, `Projeto RH/script.js` + `index.html`, `Projeto Calendario Folha/app.js` + `index.html`,
`schema_rh_feriados_v2.sql` (novo, pendente de execução manual).

---

## Problema

1. **Sem recorte por localidade.** `rh_feriados` só tem `data` + `descricao`. Não há como cadastrar um
   feriado estadual (ex.: 9 de Julho em SP) ou municipal (aniversário da cidade) que valha só para as
   empresas daquela UF/município.
2. **Feriados móveis ausentes.** Carnaval, Sexta-feira Santa, Quarta-feira de Cinzas e Corpus Christi
   têm data variável a cada ano; hoje dependem de alguém digitar `DD/MM/AAAA` manualmente e, na
   prática, ninguém digita — então esses dias entram como dia útil normal.
3. **Escala e Folha de Ponto ignoram feriados por completo.** O motor compartilhado
   `calcularResumoMes` (`escala-calculo.js`) não tem noção de feriado: um feriado que cai num dia
   escalado como trabalho continua com `tipo: 'trabalho'`.
   - **Gerar Escala** conta o feriado em "Dias a Trabalhar".
   - **Gerar Folha de Ponto** imprime o horário previsto do dia (linha não marcada como descanso).
   - **Gerar Benefícios** só não erra porque aplica um filtro `_isFeriadoNoDia` *depois* de
     `calcularResumoMes` — mas esse filtro só enxerga os 8 feriados fixos nacionais da tabela (sem
     móveis, sem locais) e só age quando a config `beneficios_excluir_feriados` está ligada.
4. **CRUD escondido.** Feriados só podem ser cadastrados por um modal dentro do Controle de
   Frequência. Não há tela de administração.

## Solução

### 1. Modelo de dados — estender `rh_feriados` (`schema_rh_feriados_v2.sql`)

Novas colunas (todas com default para não quebrar linhas existentes):

| coluna | tipo | observação |
|---|---|---|
| `data` | `text` **NULL** | passa a aceitar NULL (quando `regra_movel` preenchida) |
| `regra_movel` | `text` NULL | `sexta_santa` \| `carnaval_segunda` \| `carnaval_terca` \| `quarta_cinzas` \| `corpus_christi` |
| `abrangencia` | `text NOT NULL DEFAULT 'nacional'` | `nacional` \| `estadual` \| `municipal` |
| `uf` | `text` NULL | obrigatória (via CHECK) quando abrangência ≠ nacional |
| `municipio` | `text` NULL | obrigatória (via CHECK) quando abrangência = municipal |
| `tipo` | `text NOT NULL DEFAULT 'feriado'` | `feriado` \| `facultativo` |
| `ativo` | `boolean NOT NULL DEFAULT true` | liga/desliga sem excluir |

CHECKs:
- `(data IS NOT NULL) <> (regra_movel IS NOT NULL)` — exatamente um dos dois.
- `abrangencia = 'nacional' OR uf IS NOT NULL`.
- `abrangencia <> 'municipal' OR municipio IS NOT NULL`.
- `regra_movel IS NULL OR regra_movel IN (...5 valores...)`.
- `abrangencia IN ('nacional','estadual','municipal')`.
- `tipo IN ('feriado','facultativo')`.

**Seed idempotente** (só insere se `regra_movel` ainda não existe):
`sexta_santa` → "Sexta-feira Santa" (`feriado`); `carnaval_segunda` → "Carnaval (segunda-feira)"
(`facultativo`); `carnaval_terca` → "Carnaval (terça-feira)" (`facultativo`); `quarta_cinzas` →
"Quarta-feira de Cinzas" (`facultativo`); `corpus_christi` → "Corpus Christi" (`facultativo`).
Todos `abrangencia='nacional'`, `ativo=true`.
Linhas fixas existentes: `UPDATE ... SET abrangencia='nacional', tipo='feriado' WHERE abrangencia IS NULL`.

RLS **inalterada** (leitura/escrita para autenticado).

### 2. Módulo puro novo — `feriados-calculo.js` (+ `test-feriados-calculo.js`)

Mesmo padrão dos demais `*-calculo.js`: sem DOM, sem Supabase, `module.exports` no fim para os testes
Node e `window.*` (via escopo global do `<script>`) no navegador.

```
calcularDomingoPascoa(ano) -> Date (UTC)         // algoritmo Anonymous Gregorian / Meeus
resolverDataMovel(regra, ano) -> 'DD/MM/AAAA'    // usa REGRAS_MOVEIS[regra].offset em dias sobre a Páscoa
REGRAS_MOVEIS = { sexta_santa:-2, carnaval_segunda:-48, carnaval_terca:-47, quarta_cinzas:-46, corpus_christi:+60 }
expandirFeriados(rows, ano) -> [{ id, descricao, tipo, abrangencia, uf, municipio, movel, data }]
   // descarta ativo === false; resolve regra_movel -> data 'DD/MM/AAAA' do ano; mantém data fixa
   // ('DD/MM' recorrente ou 'DD/MM/AAAA'); descarta itens sem data resolvida.
feriadosDaEmpresa(expandidos, { uf, municipio, cidade }) -> subconjunto
   // nacional: sempre. estadual: _norm(uf) igual. municipal: _norm(uf) igual E
   // _norm(municipio) === _norm(empresa.municipio || empresa.cidade).
_norm(s) -> uppercase, trim, sem acento (NFD)
```

O formato de `data` no resultado continua sendo `'DD/MM'` ou `'DD/MM/AAAA'`, então a checagem
existente `f.data === dia.data || f.data === dia.data.substring(0,5)` segue válida.

### 3. `calcularResumoMes` passa a considerar feriados (`escala-calculo.js`)

Nova assinatura (7º parâmetro opcional, retrocompatível):

```
calcularResumoMes(escala, competencia, periodosFerias, diaInicio=null, diaFim=null,
                  datasExcecaoFolga=null, feriados=null)
```

`feriados`: `[{ data:'DD/MM'|'DD/MM/AAAA', tipo:'feriado'|'facultativo', descricao }]`.

Para cada dia, além dos campos atuais:
- `feriado` (bool), `feriadoTipo` (`'feriado'|'facultativo'|null`), `feriadoDescricao` (`string|null`).
- **Prioridade: férias > feriado > exceção > escala.** Um dia que casa com um feriado (e não está em
  férias) vira `tipo: 'folga'`.
- `feriado` (feriado *ou* facultativo) → `feriadoTipo` guarda qual. Nesta v1 os dois viram descanso
  em todas as ferramentas; o campo distingue para uso/exibição e ajustes futuros.

Retorno ganha `totalFeriados` (contagem de dias com `feriado === true`). `totalTrabalho` cai
naturalmente.

Novo helper exportado `_feriadoDoDia(feriados, dataBR)` → o registro casado ou `null`.

### 4. Consumidores em `Projeto RH/script.js`

- **`carregarEmpresas()` (select ~L93):** acrescentar `uf, municipio, cidade`. Passa a valer em todo
  `state.empresas` (usado pela tela Gerar Escala).
- **Benefícios (select `rh_empresas` ~L4079):** acrescentar `municipio, cidade, uf`.
- **`carregarFeriadosGlobais()`:** passa a guardar `state.feriadosRaw` (linhas cruas da tabela, ou o
  fallback fixo em forma crua). Não popula mais `state.feriados` diretamente.
- **Nova `recalcularFeriadosContexto()`:** resolve
  `state.feriados = feriadosDaEmpresa(expandirFeriados(state.feriadosRaw, anoDaCompetencia), state.empresaSelecionada)`.
  `anoDaCompetencia` = `state.competencia.split('/')[1]` (fallback: ano corrente). Chamada em
  `selecionarEmpresa`, ao definir `state.competencia`, e no loop do lote (por empresa da fila,
  ~L3053).
- **Gerar Escala** (`calcularResumoMes` em L6038, e recálculos em L6214/L6394): passar
  `feriadosDaEmpresa(expandirFeriados(state.feriadosRaw, ano), <empresa da linha>)`. Guardar em
  `linha.feriados` na montagem para reusar nos recálculos. `empresa` já vem de `state.empresas.find`
  (agora com UF/município).
- **Gerar Folha de Ponto** (`calcularResumoMes` em L5592): `empresaInfo` já tem `uf/municipio/cidade`.
  Passar os feriados resolvidos. `montarLinhasFolhaPonto` propaga `feriado/feriadoTipo/feriadoDescricao`
  (via spread `...d`, já acontece; horário previsto vira `'—'` quando `d.feriado`).
- **Gerar Benefícios** (L4179): passar `excluirFeriados ? feriadosResolvidosDaEmpresa : []` como 7º
  arg de `calcularResumoMes`. O filtro pós-cálculo `!(excluirFeriados && _isFeriadoNoDia(d.data))`
  vira só `d.tipo === 'trabalho'` (feriado já é folga). Config `beneficios_excluir_feriados`
  preservada: quando `'0'`, passa `[]` e os números não mudam.
- **`_isFeriadoNoDia`:** mantém, agora lendo `state.feriados` já resolvido por empresa/ano.

### 5. Folha de Ponto — exibir feriado

- **PDF** (`didParseCell` / `body` em ~L5830): quando `linha.feriado`, célula "Observações" recebe
  `FERIADO` ou `PONTO FACULTATIVO` (como já faz com `FÉRIAS`); o cinza de folga já é aplicado por
  `linha.tipo === 'folga'`.
- **Prévia** (`_linhaFolhaPontoPreviaHtml` ~L5637): idem, rótulo na coluna Observações.

### 6. Gerar Escala — exibir feriado

`_renderizarListaEscala` / detalhe por dia: dia com `feriado` mostra rótulo "Feriado" /
"Facultativo" e não conta em "Dias a Trabalhar" (consequência automática do `tipo: 'folga'`).

### 7. Modal "Feriados" do Controle de Frequência (`index.html` + `script.js`)

- Remover inputs de cadastro (`novaDataFeriado`, `novaDescricaoFeriado`, `addFeriadoBtn`) e as
  funções `adicionarFeriado` / `removerFeriado`.
- Modal passa a listar **somente leitura** `state.feriados` (resolvido p/ empresa+competência
  atuais): colunas Data · Descrição · Tipo · Abrangência.
- Botão "➕ Gerenciar feriados" → abre `admin.html#feriados`.
- `renderizarTabelaFeriados` simplificada (sem botão excluir).

### 8. Nova aba "🗓️ Feriados" em `admin.html` / `admin.js`

- Item na sidebar (após "Jornada de Trabalho").
- `admin.html` inclui `<script src="feriados-calculo.js"></script>`.
- **Formulário de cadastro/edição:** Descrição · Tipo (feriado/facultativo) · Abrangência
  (nacional/estadual/municipal — revela UF e Município) · UF (`<select>` das 27) · Município
  (`<input>` + `<datalist>` com municípios distintos de `rh_empresas`) · Regra de data (radio:
  "Recorrente todo ano (DD/MM)" | "Data específica (DD/MM/AAAA)" | "Móvel (base Páscoa)" →
  `<select>` das 5 regras) · Ativo (checkbox). Salvar / Cancelar.
- **Filtros:** texto (descrição), abrangência, UF, tipo, "mostrar inativos".
- **Tabela:** Data (ou badge "Móvel · <descrição da regra>") · Descrição · Tipo (badge) ·
  Abrangência ("Nacional" / "SP" / "Santos/SP") · Ativo (badge clicável para alternar) · Ações
  (✏️ editar / 🗑️ excluir com `confirm()`).
- **Prévia:** seletor de Ano (default = ano atual) + Empresa (opcional, respeita `_filtrarPorEscopo`)
  → tabela read-only das datas resolvidas (`expandirFeriados` + `feriadosDaEmpresa`), ordenadas por
  data, com o dia da semana. Serve para conferir Carnaval/Páscoa e os locais.
- Funções `admin.js`: `carregarFeriados()` (no `DOMContentLoaded`), `buscarFeriados()`,
  `renderizarTabelaFeriadosAdmin()`, `filtrarFeriadosAdmin()`, `abrirFormFeriado()` /
  `editarFeriado(id)` / `salvarFeriado()` / `excluirFeriado(id)` / `toggleAtivoFeriado(id)`,
  `previewFeriados()`, `_onAbrangenciaFeriadoChange()`, `_carregarDatalistMunicipios()`.
- Escrita: `insert` / `update` / `delete` diretos em `rh_feriados` (RLS já permite autenticado).

### 9. Calendário da Folha (`Projeto Calendario Folha/app.js` + `index.html`)

- `index.html` inclui `../Projeto RH/feriados-calculo.js`.
- `carregarFeriados()`: `select` inclui as colunas novas; guarda cru em `feriadosRaw`.
- Render de mês/ano: `expandirFeriados(feriadosRaw, ano)`; considera **nacionais + todos os locais**
  (sem filtro por empresa — o calendário é global), com rótulo `(UF)` / `(Município/UF)`.
  `nomeFeriado(d)` ajustado. Móveis passam a aparecer automaticamente.

## O que NÃO muda

- `feriados_json` dentro de `rh_saves` (snapshot por lote — segue gravando `state.feriados` já
  resolvido, e a retomada segue lendo o snapshot).
- RLS de `rh_feriados`.
- Fluxo de cálculo de horas extras / DSR da Exportação TXT (só passa a ver os feriados resolvidos
  por empresa em vez da lista global).

## Fora de escopo

- Importar feriados de API externa.
- Persistir/gerar feriados por ano (móveis são calculados sob demanda).
- Regra de "facultativo conta como dia útil" configurável por ferramenta.
- Escopo por responsável na aba Feriados (dado global; qualquer autenticado edita, como hoje).
