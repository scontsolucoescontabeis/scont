# Rubricas Configuradas + Observações + Tela de Configurações no Lançamentos

Data: 2026-07-14
Arquivos afetados: `lancamentos.html`, `lancamentos.js`, `schema_rh.sql`

## Contexto

Hoje, no Passo 3 de Lançamentos (`lancamentos.html`/`lancamentos.js`), o código de rubrica é digitado livremente pelo usuário a cada rubrica adicionada à grade. Isso obriga a consulta manual aos códigos já configurados no Controle de Frequência (`index.html`/`script.js`, tabela `rh_config_rubricas_txt`) para cada empresa, sujeito a erro de digitação.

Este design tem duas partes:

1. Reaproveitar, no seletor de rubrica do Passo 3, as rubricas já configuradas em `rh_config_rubricas_txt` para as empresas do lote, e exibir as observações cadastradas por empresa.
2. Criar uma tela de Configurações dentro do Lançamentos que visualiza a mesma tabela (rubricas fixas + observações, somente leitura) e permite cadastrar rubricas personalizadas (código + descrição + tipo) por empresa — recurso exclusivo do Lançamentos.

## Fonte de dados

Tabela `rh_config_rubricas_txt` (já existente, gerenciada hoje só pelo Controle de Frequência), chave `(codigo_empresa, evento)`.

### Eventos fixos (mesmos do Controle de Frequência)

```js
const EVENTOS_FIXOS_RUBRICA = [
  { ev: 'horasTrab',  label: 'Horas Trabalhadas',  tipoValor: 'horas'     },
  { ev: 'he50',       label: 'Horas Extras 50%',   tipoValor: 'horas'     },
  { ev: 'he100',      label: 'Horas Extras 100%',  tipoValor: 'horas'     },
  { ev: 'noturno',    label: 'Adicional Noturno',  tipoValor: 'horas'     },
  { ev: 'atraso',     label: 'Atraso',             tipoValor: 'horas'     },
  { ev: 'falta',      label: 'Falta (dias)',       tipoValor: 'dias'      },
  { ev: 'descontoVT', label: 'Desconto VT',        tipoValor: 'monetario' },
  { ev: 'descontoVA', label: 'Desconto VA',        tipoValor: 'monetario' },
];
```

`evento = 'observacoes'` guarda texto livre (nota de contexto por empresa), tratado à parte (não é rubrica).

### Rubricas personalizadas (novo)

Qualquer linha de `rh_config_rubricas_txt` cujo `evento` não esteja na lista acima e não seja `'observacoes'` é uma **rubrica personalizada**. Só pode ser criada pela tela de Configurações do Lançamentos (o modal do Controle de Frequência não ganha essa capacidade). Identidade: `evento` gerado como `'custom_' + crypto.randomUUID()` (não precisa ser legível — quem rotula é `descricao_rubrica`).

### Migração de schema

```sql
ALTER TABLE public.rh_config_rubricas_txt
  ADD COLUMN IF NOT EXISTS descricao_rubrica TEXT;
```

Nula para os 8 eventos fixos e para `observacoes` (rótulo fixo no código). Preenchida só para rubricas personalizadas.

## Parte 1 — Passo 3: seletor de rubrica + observações

### Estado novo em `lancamentos.js`

```js
let empresasCadastradas = [];        // [{codigo_empresa, nome_empresa}] — carregado 1x em carregarEmpresas()
let configRubricasPorEmpresa = {};   // { [codEmpresa]: { [evento]: {codigo, tipo, descricao} } }
```

`empresasCadastradas` é preenchido dentro de `carregarEmpresas()` (além de renderizar os checkboxes, guarda o array em memória) — reaproveitado tanto para resolver nome de empresa em observações/erros quanto pelo seletor de empresa da tela de Configurações (Parte 2).

### Busca de config do lote

Nova função, chamada em `avancarParaParametros()` (Passo 2 → 3), assim que sabemos quais empresas estão representadas em `empregadosSelecionadosAtual`:

```js
async function carregarConfigRubricasLote(codigosEmpresa) {
  // SELECT codigo_empresa, evento, codigo_rubrica, tipo_valor, descricao_rubrica
  // FROM rh_config_rubricas_txt WHERE codigo_empresa IN (codigosEmpresa)
  // preenche configRubricasPorEmpresa = { [codEmpresa]: { [evento]: {codigo, tipo, descricao} } }
}
```

`avancarParaParametros()` vira `async`; mostra estado de carregamento ("Carregando rubricas configuradas...") na área da grade enquanto a busca roda. Busca sempre nova a cada leva — sem cache entre chamadas de `avancarParaParametros`.

### Seletor de rubrica (substitui o input livre "Código da Rubrica")

`<select id="gradeRubricaEvento">`, populado a partir de `configRubricasPorEmpresa` cruzado com as empresas representadas em `empregadosSelecionadosAtual`:

- Um `<option>` por evento (fixo ou personalizado) que tenha código configurado em **pelo menos uma** dessas empresas.
- Rótulo: `label (código)` quando o código é igual em todas as empresas representadas que o configuraram; `label (Empresa A: cód1, Empresa B: cód2)` quando diverge. Rótulo de evento fixo vem de `EVENTOS_FIXOS_RUBRICA`; de personalizado vem de `descricao_rubrica`.
- Última opção fixa: **"Outra rubrica (digitar código)"** — reexibe o input de texto livre + select de Tipo do Valor, mesmo comportamento de hoje. Cobre eventos sem config em nenhuma empresa do lote.
- Quando um evento (fixo ou personalizado) é selecionado, o "Tipo do Valor" deixa de ser editável (mostrado como texto, derivado do evento) — só volta a ser select quando "Outra rubrica" está selecionado.
- "Valor Padrão" (bulk-fill opcional) não muda.

### Modelo de dados da grade

```js
// rubricasGrid[i]:
{ id, evento, label, tipoValor, codigosPorEmpresa: { [codEmpresa]: codigo } }
// "Outra rubrica": codigosPorEmpresa ausente, usa `codigo` fixo (comportamento atual)
```

### Geração do TXT

`gerarConteudoTXT` resolve o código por linha usando a empresa do próprio item (`codigosPorEmpresa[codEmpresa]`), em vez de um código único fixo pra coluna toda:

```js
gerarConteudoTXT(comp, tipoProcesso, rubricaColuna, tipoValor, itens)
// rubricaColuna: string (modo "Outra rubrica") OU objeto codigosPorEmpresa (modo evento)
// resolve por item: typeof rubricaColuna === 'string' ? rubricaColuna : rubricaColuna[codEmpresa]
```

Layout fixo de posições/paddings do TXT não muda.

### Validação em `gerarParametrizacoes()`

Para cada item com valor preenchido cuja coluna usa `codigosPorEmpresa`: se `codigosPorEmpresa[codEmpresa]` estiver ausente/vazio, bloqueia com mensagem apontando empregado + empresa + evento (ex: "Empregado X (Empresa Y): rubrica 'Desconto VA' não está configurada para essa empresa."), mesmo padrão de erro já usado hoje pra valor inválido.

### Observações por empresa

Caixa informativa no topo do Passo 3 (acima de "Tipo do Processo"), montada junto com `carregarConfigRubricasLote`. Para cada empresa representada em `empregadosSelecionadosAtual` cujo `configRubricasPorEmpresa[cod].observacoes.codigo` (texto) não seja vazio, mostra uma linha `Nome da Empresa: <texto>`. Some inteiramente se nenhuma empresa do lote tiver observação. Somente leitura, não entra no TXT.

## Parte 2 — Tela de Configurações do Lançamentos

### Acesso

Botão **"⚙️ Configurações"** no header de `lancamentos.html`, ao lado de "← Voltar ao Portal". Abre modal (`configLancamentosModal`), mesmo padrão visual do `configRubricasModal` de `index.html`.

### Comportamento

1. Campo de busca/seleção de empresa (reaproveita `empresasCadastradas`, mesmo padrão de autocomplete usado em Empresas do Passo 1).
2. Ao selecionar empresa, busca todas as linhas de `rh_config_rubricas_txt` daquela empresa (`_buscarLinhasConfigRubricas(codigoEmpresa)`, retorna array bruto com `id`) e separa em 3 blocos:
   - **Rubricas do Controle de Frequência** — tabela somente leitura (Evento | Código | Tipo), uma linha por item de `EVENTOS_FIXOS_RUBRICA`; "—" quando não configurado.
   - **Observações** — bloco de texto somente leitura ("Nenhuma observação cadastrada." quando vazio).
   - **Rubricas Personalizadas (Lançamentos)** — lista editável: Código | Descrição | Tipo | 🗑️. Mini-formulário acima (Código — dígitos, maxlength 9; Descrição — texto livre obrigatório; Tipo — select horas/monetário/dias) com botão "➕ Adicionar".
3. Adicionar/remover rubrica personalizada grava direto no Supabase (INSERT/DELETE imediato, sem "Salvar" em lote — os outros dois blocos não são editáveis aqui). Após cada ação, recarrega a lista da empresa selecionada e invalida a entrada correspondente em `configRubricasPorEmpresa` (cache da Parte 1), se existir.
4. Rodapé: só **[Fechar]**.

### Funções novas em `lancamentos.js`

- `abrirModalConfigLancamentos()` / `fecharModalConfigLancamentos()`
- `selecionarEmpresaConfigLancamentos(codigoEmpresa)` — busca e renderiza os 3 blocos
- `adicionarRubricaPersonalizada()` — valida campos, gera `evento = 'custom_' + crypto.randomUUID()`, insere linha
- `removerRubricaPersonalizada(id)` — `confirm()` de segurança, deleta por `id`

### Fora de escopo (Parte 2)

- Nenhuma mudança em `index.html`/`script.js` (Controle de Frequência) — continua exibindo só os 8 fixos + observações, sem capacidade de criar rubrica personalizada.
- Sem edição de rubricas fixas nem de observações a partir do Lançamentos — view-only para esses dois blocos.

## Validações / edge cases gerais

- Nenhum evento configurado pra nenhuma empresa do lote → seletor mostra só "Outra rubrica (digitar código)".
- Config parcial entre empresas do lote (uma empresa configurou o evento, outra não) → evento aparece no seletor, mas gera erro de validação ao tentar gerar parametrização com valor preenchido pra empregado da empresa sem config (ver seção de validação acima).
- Remover rubrica personalizada que já tem código igual usado em alguma parametrização já gerada na sessão atual → sem cascata; a parametrização já gerada mantém seu `conteudoTXT` (imutável), só afeta rubricas futuras adicionadas à grade.
- Layout binário do TXT exportado não muda.

## Fora de escopo

- Sem alterações no Passo 1 (competência/empresas) nem no Passo 2 (seleção de empregados), além da leitura de `empresasCadastradas`.
- Sem persistência de parametrizações entre sessões (continuam em memória).
- Sem paginação/busca na lista de rubricas personalizadas por empresa (lista simples).
