# Desconto de Vale Transporte / Vale Alimentação por faltas — Track & Field

**Data:** 2026-07-06
**Escopo:** `trackfield.html`, `trackfield.js` (Track & Field)

## Problema

Ao gerar o TXT de fechamento da folha do Track & Field, não existe forma de
lançar descontos pontuais de Vale Transporte (VT) e Vale Alimentação (VA)
decorrentes de faltas ou atestados de um empregado na competência. Esses
descontos não vêm da planilha importada — são decididos manualmente pelo
usuário após o processamento, olhando os afastamentos do período.

## Objetivo

Ao clicar em "Gerar TXT", perguntar ao usuário se há desconto de VT e/ou VA
por faltas/atestados na competência. Se houver, permitir que ele lance,
para um ou mais empregados, o valor a descontar de cada rubrica — usando o
código de rubrica cadastrado por empresa na tela de Configurações — e incluir
essas linhas no TXT final.

## Design

### 1. Configuração das rubricas de desconto (tela Configurações)

Novo card em `#telaConfig`, logo após o card "Comissão Domingos/Feriados",
seguindo o mesmo padrão visual e técnico (reaproveita a tabela já existente
`fechamento_rubricas_config`, sem migração de banco):

```html
<div class="config-card" style="border-left:4px solid #26A69A;margin-bottom:20px;">
    <h3>🎫 Desconto Vale Transporte / Vale Alimentação (Faltas/Atestados)</h3>
    <!-- select cfgDescEmpresa + inputs cfgDescCodVT / cfgDescCodVA + botão Salvar -->
    <!-- tabela cfgDescTableBody: 1 linha por empresa, colunas Empresa | Cód. VT | Cód. VA | Ações -->
</div>
```

Reaproveita o padrão de `COL_87_DOMINGO`/`COL_87_FERIADO` com duas colunas
sentinela novas em `trackfield.js`:

```js
const COL_DESCONTO_VT = 'DESCONTO VALE TRANSPORTE (MANUAL)';
const COL_DESCONTO_VA = 'DESCONTO VALE ALIMENTAÇÃO (MANUAL)';
```

(Nomeadas sem a palavra "falta" de propósito — `isColunaFalta()` já usa esse
termo para disparar a lógica de inserção de datas de falta/DSR, que não se
aplica aqui.)

Funções novas, espelhando `carregar87Config`/`salvar87Config`/`deletar87Config`/
`preencherEditar87`:
- `carregarDescontoConfig()` — lê `fechamento_rubricas_config` filtrando
  `coluna_planilha IN (COL_DESCONTO_VT, COL_DESCONTO_VA)`, monta a tabela por
  empresa.
- `salvarDescontoConfig()` — `upsert` com `onConflict: 'codigo_empresa,coluna_planilha'`,
  `tipo_valor: 'monetario'`, `tipo_processo: '11'`.
- `deletarDescontoConfig(id)`.

Popula o select de empresa (`cfgDescEmpresa`) com a mesma lista de lojas
(`_assocEmpresas`) já usada em `cfgEmpresa`/`cfg87Empresa`.

### 2. Modal "Há desconto de VT/VA?"

Fluxo atual: `irStep3()` → modal `#modalTipoProcesso` → `confirmarTipoProcesso()`
→ `gerarTxt(tipo)`.

Novo fluxo: `confirmarTipoProcesso()` fecha o modal de tipo de processo e, em
vez de chamar `gerarTxt(tipo)` direto, guarda o tipo escolhido e abre um novo
modal `#modalDescontoPergunta`:

> "Há desconto de vale transporte e/ou vale alimentação decorrente de
> faltas/atestados nesta competência?"
> **[Não]** **[Sim]**

- **Não** (`descontoNaoInformar()`) → fecha o modal e chama `gerarTxt(tipo)`
  como hoje.
- **Sim** (`descontoAbrirForm()`) → fecha esse modal e abre o modal de
  lançamento (seção 3).

### 3. Modal de lançamento (`#modalDescontoForm`)

Formulário com lista repetível, mais um botão final de conclusão:

- Select **Empresa** (`descEmpresa`) — mesma lista de empresas do
  processamento atual (códigos presentes em `planilhaData`, via
  `codigoEmpresaPorLoja`), não todas as lojas do sistema.
- Select **Empregado** (`descEmpregado`) — populado ao trocar a empresa,
  com os empregados **já presentes na planilha processada** desta
  competência (derivado de `planilhaData`: nome + `codigoEmpresaPorLoja` +
  `buscarCodigoEmpregado`), não a base completa de `rh_empregados`.
- Campo **Valor desconto VT (R$)** (`descValorVT`, opcional).
- Campo **Valor desconto VA (R$)** (`descValorVA`, opcional).
- Botão **Adicionar** (`adicionarDescontoLinha()`):
  - Exige empresa + empregado + pelo menos um dos dois valores > 0.
  - Para cada valor preenchido, busca a rubrica configurada
    (`COL_DESCONTO_VT`/`COL_DESCONTO_VA`) da empresa selecionada.
  - Se faltar rubrica cadastrada para o tipo de desconto preenchido,
    **bloqueia** com mensagem de erro apontando para a tela de
    Configurações (ex: "Cadastre o código da rubrica de Vale Transporte
    para a empresa 128 em Configurações antes de lançar este desconto.").
    Não adiciona nenhuma linha nesse caso.
  - Caso ok, adiciona a linha a uma tabela de pendentes
    (`#descontoPendentesBody`): Empresa | Empregado | VT | VA | Ações
    (remover), e limpa os campos de valor para o próximo lançamento.
- Botão final **Concluir e Gerar TXT** (`confirmarDescontosEGerarTxt()`):
  - Exige ao menos uma linha na tabela de pendentes.
  - Para cada linha pendente e cada valor preenchido (VT e/ou VA), monta uma
    entrada sintética no mesmo formato usado em `linhasRelatorio` e dá
    `push` nela:
    ```js
    {
        nome, loja: '', cargo: '',
        codEmpresa, codEmpregado,
        coluna: 'DESCONTO VT (MANUAL)' /* ou VA */,
        descricao: 'Desconto Vale Transporte' /* ou Alimentação */,
        codigoRubrica: <código da config>,
        fonteRubrica: 'manual',
        tipoProcesso: tipo, // tipo escolhido no modal de Tipo de Processo
        tipoValor: 'monetario',
        bruto: valorReais,
        valorInt: Math.round(valorReais * 100),
    }
    ```
  - Fecha o modal e chama `gerarTxt(tipo)` — reaproveitando 100% da lógica
    já existente de consolidação (`mapa`), resumo (`resumoConsolidado`) e
    geração de linhas TXT (`gerarLinhaTxt`), sem duplicar nada.
  - Limpa a tabela de pendentes ao final (para não duplicar em uma nova
    geração de TXT na mesma sessão).

### Reuso confirmado

- `gerarLinhaTxt`, `gerarTxt`, `mapa` (consolidação), `codigoEmpresaPorLoja`,
  `buscarCodigoEmpregado`, `_assocEmpresas`/`populaSelect`, padrão de
  `fechamento_rubricas_config` com colunas sentinela (igual ao card R$87),
  padrão de modal (`.modal`, `.modal-content`, `.modal-header`, `.modal-footer`)
  e de card de configuração (`.config-card`, `.config-table`).
- Nenhuma tabela nova no banco — reaproveita `fechamento_rubricas_config`.

### Fora de escopo

- `quadrante.js`/`ananke.js` (outras ferramentas do portal com "Gerar TXT"
  próprio) não são alteradas.
- Persistência dos lançamentos de desconto entre sessões/recarregamentos de
  página não é necessária — se o usuário sair do Step 3 antes de baixar o
  TXT, os lançamentos precisam ser refeitos (mesmo comportamento de
  `linhasRelatorio`/`linhasTxt` hoje, que também não persistem em memória
  entre reloads).

## Teste / Verificação

1. Processar uma planilha do Track & Field normalmente até o Step 2.
2. Clicar em "Gerar TXT" → escolher Tipo de Processo → confirmar.
3. No modal "Há desconto de VT/VA?", clicar **Não** → confirmar que o TXT é
   gerado normalmente, sem alteração no comportamento atual.
4. Repetir e clicar **Sim** → lançar um desconto de VT para um empregado
   cuja empresa **não** tem rubrica VT cadastrada → confirmar bloqueio com
   mensagem de erro.
5. Cadastrar a rubrica de VT (e VA) para a empresa em Configurações →
   repetir o lançamento → confirmar que a linha é aceita, aparece na tabela
   de pendentes, e some ao clicar remover.
6. Lançar 2+ linhas (empregados diferentes, um só com VT, outro só com VA,
   um com ambos) → "Concluir e Gerar TXT" → conferir no preview do TXT e no
   resumo consolidado que as linhas de desconto aparecem com o código de
   rubrica correto e o valor em centavos correto.
