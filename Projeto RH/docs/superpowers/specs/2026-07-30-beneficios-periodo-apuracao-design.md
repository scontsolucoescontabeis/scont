# Período de Apuração Customizado — Gerar Benefícios (VT/VA)

## Problema

Na tela "Gerar Benefícios" (`index.html` / `script.js`, tela `beneficiosScreen`), o
cálculo de "Dias a Trabalhar" (`calcularResumoMes`, via `escala-calculo.js`) sempre
apura o mês calendário completo da competência informada. Algumas empresas, porém,
pagam VT/VA sobre um intervalo de dias deslocado — ex.: de 05 de um mês a 05 do mês
seguinte — independente do mês calendário da competência trabalhada.

Esse conceito é análogo ao "Período de Apuração" já implementado no Controle de
Frequência (`docs/superpowers/specs/2026-07-30-controle-frequencia-periodo-apuracao-design.md`),
mas **independente** dele: uma empresa pode ter um período de apuração de ponto
(Frequência) diferente do período de pagamento de benefícios (Benefícios), ou só um
dos dois, ou nenhum.

## Escopo

Somente a tela "Gerar Benefícios" (`beneficiosScreen`). Afeta apenas o cálculo de
"Dias a Trabalhar" e a coluna de férias exibida na prévia. "Dias a Descontar"
(faltas/atestados da Folha de Ponto salva) não muda — continua vindo da folha salva da
competência, sempre editável manualmente, como hoje.

## 1. Configuração por empresa

No modal "Configurar Rubricas por Empresa" (`index.html`), dentro da seção já
existente **"Benefícios (VT/VA)"** (abaixo do checkbox "Excluir feriados nacionais..."),
novo bloco:

- Checkbox `cfgBeneficiosPeriodoAtivo` — "Usar período customizado para 'Dias a
  Trabalhar' (fora do mês calendário)"
- Input numérico `cfgBeneficiosPeriodoDiaInicio` (1–31) — "Dia de início (mês
  anterior)", visível apenas quando o checkbox está marcado
- Input numérico `cfgBeneficiosPeriodoDiaFim` (1–31) — "Dia de fim (mês da
  competência)", visível apenas quando o checkbox está marcado
- Texto auxiliar dinâmico `cfgBeneficiosPeriodoExemplo`, exemplificando com o mês
  atual (não depende do campo "competência" da Frequência, que pertence a outra tela)

Mesma convenção de ancoragem já usada na Frequência: para a competência MM/AAAA,
início = dia do mês **anterior**, fim = dia do mês **da competência**. Ex.: competência
07/2026 com início=05/fim=05 → 05/06/2026 a 05/07/2026.

Segue o mesmo padrão visual (checkbox + inputs recuados) das demais seções do modal.

## 2. Persistência

Reaproveita a tabela `rh_config_rubricas_txt` (key-value por empresa) — **sem SQL
novo a rodar**. Três eventos novos, `tipo_valor = 'config'`:

- `beneficios_periodo_ativo` — `'1'` ou `'0'`
- `beneficios_periodo_dia_inicio` — dia do mês como texto (ex.: `'5'`)
- `beneficios_periodo_dia_fim` — dia do mês como texto (ex.: `'5'`)

Persistidos via `salvarConfigRubricas()`, lidos via `_buscarConfigRubricas()` (já
cacheada por empresa) e aplicados em `_preencherCamposConfigRubricas()` /
`_limparCamposConfigRubricas()`, junto dos campos já existentes.

Nova função `_resolverPeriodoBeneficios(cfg)`, paralela a `_resolverPeriodoApuracao`
já existente, mas lendo as chaves `beneficios_periodo_*`:

```js
function _resolverPeriodoBeneficios(cfg) {
    if (!cfg || cfg['beneficios_periodo_ativo']?.cod !== '1') return { diaInicio: null, diaFim: null };
    const diaInicio = parseInt(cfg['beneficios_periodo_dia_inicio']?.cod, 10);
    const diaFim = parseInt(cfg['beneficios_periodo_dia_fim']?.cod, 10);
    return {
        diaInicio: Number.isInteger(diaInicio) ? diaInicio : null,
        diaFim: Number.isInteger(diaFim) ? diaFim : null
    };
}
```

## 3. Núcleo: `escala-calculo.js`

`_gerarDiasDoMes` e `calcularResumoMes` ganham parâmetros opcionais `diaInicio` /
`diaFim`, replicando a mesma lógica já validada em `gerarDiasDoMes` (script.js, usada
pela Frequência):

- `diaInicio`/`diaFim` nulos ou omitidos → comportamento atual, inalterado (dia 1 ao
  último dia do mês calendário da competência).
- Quando fornecidos, gera as datas de `diaInicio` do mês **anterior** ao da
  competência até `diaFim` do mês **da** competência (inclusive em ambas as pontas),
  iterando sobre objetos `Date` reais — o rollover de mês/ano é resolvido nativamente.
- Cada dia gerado é rotulado com seu **próprio** mês/ano real (`DD/MM/AAAA`).
- Se `diaFim` (ou `diaInicio`) não existir no mês correspondente (ex.: dia 31 em
  fevereiro), usa o último dia real daquele mês como fallback.
- Se algum valor for inválido/fora de 1–31, o período customizado é ignorado e cai no
  comportamento padrão (mês calendário completo). `diaInicio` (dia do mês anterior)
  maior que `diaFim` (dia do mês da competência) como número **não** é inválido — ex.:
  início=20/fim=05 gera um intervalo curto e válido de 20/06 a 05/07 (mês anterior é
  sempre cronologicamente anterior ao mês da competência).

Novas assinaturas: `_gerarDiasDoMes(competencia, diaInicio = null, diaFim = null)` e
`calcularResumoMes(escala, competencia, periodosFerias, diaInicio = null, diaFim = null)`.

## 4. Integração em `gerarPreviaBeneficios`

Junto do loop já existente que resolve `excluirFeriadosPorEmpresa[cod]` por empresa
(busca `cfg` via `_buscarConfigRubricas`), resolve também
`periodoBeneficiosPorEmpresa[cod] = _resolverPeriodoBeneficios(cfg)`.

Ao montar cada linha do empregado:

- `calcularResumoMes(escala, comp, periodos, diaInicio, diaFim)` — "Dias a Trabalhar"
  passa a contar sobre o intervalo customizado da empresa do empregado, quando ativo.
- `_periodosFeriasNoMesTexto(periodos, comp, diaInicio, diaFim)` — ganha os mesmos
  parâmetros opcionais. Quando o período customizado está ativo, usa o primeiro/último
  dia retornado por `gerarDiasDoMes(comp, diaInicio, diaFim)` (convertidos para ISO)
  como limites da sobreposição, em vez dos limites do mês calendário. Mantém a coluna
  de férias da prévia coerente com o novo cálculo de dias.
- `diasDescontar` (via `_calcularDiasDescontarFolhaSalva`) não muda.

## 5. Feedback visual

Nova caixa informativa na prévia (mesmo estilo visual da caixa azul de "Observações"
já existente, `_renderizarObservacoesBeneficios`), exibida somente quando ao menos uma
empresa selecionada tem o período customizado ativo. Nova função
`_renderizarPeriodosBeneficios(periodosPorEmpresa)`, renderizando em nova div
`beneficiosPeriodosContainer` (inserida no `index.html` ao lado de
`beneficiosObservacoesContainer`), chamada junto de `_renderizarObservacoesBeneficios`
dentro de `gerarPreviaBeneficios`.

Formato por empresa: "📅 Período de apuração (Dias a Trabalhar): DD/MM/AAAA a
DD/MM/AAAA".

## Fora de escopo

- Período de Apuração da Frequência (config e cálculo já existentes, não tocados).
- "Dias a Descontar" — continua vindo integralmente da Folha de Ponto salva.
- Recibo (PDF), TXT de Lançamentos na Folha e Excel exportado — continuam
  identificados pela competência (MM/AAAA); não recebem o texto do período no
  cabeçalho nesta iteração.
- Gerar Escala, Ajuda de Custo ITC, Fechamento de Folha.
