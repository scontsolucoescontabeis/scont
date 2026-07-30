# Período de Apuração Customizado por Empresa — Controle de Frequência

## Problema

Na ferramenta Controle de Frequência (`index.html` / `script.js`), o intervalo de dias
apurado sempre corresponde ao mês calendário da competência (dia 1 ao último dia do
mês). Algumas empresas, porém, apuram um período deslocado — ex.: para a competência
07/2026, o período real é 28/06/2026 a 28/07/2026. O arquivo TXT de lançamento continua
identificado pela competência do mês (07/2026); apenas o conjunto de dias apurados na
tela, nos modelos de planilha e nos cálculos precisa refletir o intervalo real.

## Escopo

Somente a ferramenta Controle de Frequência (`index.html` / `script.js`). Gerar Escala,
Gerar Benefícios, Ajuda de Custo ITC e Fechamento de Folha usam seus próprios cálculos de
mês/competência, não dependem de `gerarDiasDoMes` e não são alterados.

## 1. Configuração por empresa

No modal "Configurar Rubricas por Empresa" (index.html), nova seção **"Período de
Apuração"**, inserida após a seção "Jornada de Trabalho":

- Checkbox `cfgPeriodoApuracaoAtivo` — "Usar período customizado (fora do mês calendário)"
- Input numérico `cfgPeriodoApuracaoDiaInicio` (1–31) — "Dia de início (mês anterior à
  competência)", visível apenas quando o checkbox está marcado
- Input numérico `cfgPeriodoApuracaoDiaFim` (1–31) — "Dia de fim (mês da competência)",
  visível apenas quando o checkbox está marcado
- Texto auxiliar dinâmico exemplificando com a competência atual do formulário (ou, na
  ausência, com um exemplo fixo), no formato "Ex.: para competência MM/AAAA → DD/MM/AAAA
  a DD/MM/AAAA"

Segue o mesmo padrão visual (bloco com cabeçalho cinza, checkbox + inputs recuados) das
seções já existentes no modal.

## 2. Persistência

Reaproveita a tabela `rh_config_rubricas_txt` (key-value por empresa, já usada para
jornada, terceiro turno, regras de horas extras etc.) — **sem SQL novo a rodar**. Três
eventos novos, salvos/lidos igual aos existentes (`_CFG_EVENTOS`-like, tipo_valor
`'config'`):

- `periodo_apuracao_ativo` — `'1'` ou `'0'`
- `periodo_apuracao_dia_inicio` — dia do mês como texto (ex.: `'28'`)
- `periodo_apuracao_dia_fim` — dia do mês como texto (ex.: `'28'`)

Persistidos via `salvarConfigRubricas()` (upsert em `rh_config_rubricas_txt`), lidos via
`_buscarConfigRubricas()` (já cacheado por empresa) e aplicados em
`_preencherCamposConfigRubricas()` / `_limparCamposConfigRubricas()`, junto dos campos de
jornada existentes.

## 3. Núcleo: `gerarDiasDoMes`

Assinatura nova: `gerarDiasDoMes(competencia, diaInicio = null, diaFim = null)`.

- `diaInicio`/`diaFim` nulos ou omitidos → comportamento atual, inalterado (dia 1 ao
  último dia do mês calendário da competência).
- Quando fornecidos, gera as datas de `diaInicio` do mês **anterior** ao da competência
  até `diaFim` do mês **da** competência (inclusive em ambas as pontas), iterando sobre
  objetos `Date` reais — o rollover de mês/ano (ex.: dezembro → janeiro do ano seguinte)
  é resolvido nativamente pelo construtor `Date`.
- Cada dia gerado é rotulado com seu **próprio** mês/ano real (`DD/MM/AAAA`), corrigindo
  a limitação atual da função, que rotula todo dia com o mês/ano fixo da competência —
  hoje inofensivo porque o intervalo nunca cruza meses, mas passa a ser necessário aqui.
- Se `diaFim` (ou `diaInicio`) não existir no mês correspondente (ex.: dia 31 em
  fevereiro), usa o último dia real daquele mês como fallback.
- Se `diaInicio > diaFim` ou algum valor for inválido/fora de 1–31, o período customizado
  é ignorado e cai no comportamento padrão (mês calendário completo) — evita gerar um
  período vazio ou invertido.

## 4. Pontos de integração

`gerarDiasDoMes` é chamada em 6 lugares em `script.js`. Cada um resolve a config da
empresa correspondente (já disponível ou buscável via `_buscarConfigRubricas`, que é
cacheada) e repassa `diaInicio`/`diaFim`:

1. **Submit do formulário de seleção** (`selectionForm`, competência + empresa) — busca
   `cfg` da empresa, resolve o período e guarda em `state.periodoApuracaoInicio` /
   `state.periodoApuracaoFim` (ou `null`/`null` se inativo) para uso durante toda a
   sessão daquela folha.
2. **Novo empregado na folha aberta** — usa `state.periodoApuracaoInicio/Fim` já
   resolvidos.
3. **Modelos em lote de grupo** (`baixarModelosGrupo`) — hoje `gerarDiasDoMes(comp)` é
   chamada uma única vez fora do loop de empresas, antes de `cfg` ser buscado por
   empresa; passa a ser chamada **dentro** do loop, por empresa, usando o `cfg` já
   buscado ali (linha onde `comTerceiroTurno` é lido).
4. **`_parseExcelParaFolhas`** — ganha parâmetros `diaInicio`/`diaFim`, repassados pelo
   chamador (`processarLoteGrupo`), que já busca `cfg` por empresa antes de chamar.
5. **Modelo Excel individual** (`gerarModeloExcel`) — busca `cfg` da empresa selecionada
   antes de gerar os dias.
6. **Importar Excel na sessão ativa** (`importarExcel`) — usa
   `state.periodoApuracaoInicio/Fim` já resolvidos na sessão.

## 5. Compatibilidade downstream (sem alterações necessárias)

Consumidores de `dia.data` já operam sobre a data completa, não assumem mês fixo:

- DSR automático (`_calcularDomingosDSR` / `proximoDomingo`) — já lida com o domingo
  seguinte caindo em outro mês.
- Checagem de férias por dia (`_diaEstaEmFerias`) — compara ISO por dia individual.
- Casamento de feriados (`DD/MM` ou `DD/MM/AAAA`) — por data individual.
- Importação de Excel — casa linhas pela string de data exata (`d.data === dataStr`), não
  por índice de posição.
- Tabela de lançamento (`renderizarConteudoAba`) — lista `folha.dados` em ordem, sem
  assumir dia 1 como início.
- Exportação TXT — usa `state.competencia` (rótulo MM/AAAA) diretamente, independente do
  range de dias; o arquivo continua identificado pela competência do mês mesmo com dados
  desde o mês anterior.

## 6. Feedback visual

Onde hoje aparece "Competência: MM/AAAA" (banner da empresa selecionada na tela de
lançamento, cabeçalho do Excel exportado), quando o período customizado estiver ativo,
complementar com `(período: DD/MM/AAAA a DD/MM/AAAA)`.

## Fora de escopo

- Gerar Escala, Gerar Benefícios, Ajuda de Custo ITC, Fechamento de Folha.
- Qualquer migração de dados existentes em `rh_saves` — folhas já salvas no formato mês
  calendário continuam válidas; a mudança só se aplica a partir da ativação do período
  customizado para a empresa.
