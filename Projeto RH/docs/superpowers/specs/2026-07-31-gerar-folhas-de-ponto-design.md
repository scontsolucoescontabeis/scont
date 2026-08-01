# Gerar Folhas de Ponto — Controle de Frequência

## Problema

A ferramenta Controle de Frequência (`index.html` / `script.js`) não gera a Folha
Individual de Ponto em branco (documento que o empregado preenche e assina à mão,
substituindo o Quadro de Horário de Trabalho conforme Portaria Ministerial nº 3162/1982).
Hoje esse documento é montado manualmente fora da plataforma. Modelo de referência:
`Folha de Ponto_227 082026.pdf` (uma página por empregado, tabela com todos os dias do
mês/período).

## Escopo

Nova tela "Gerar Folhas de Ponto" dentro do Controle de Frequência, ao lado de "Gerar
Escala" e "Gerar Benefícios" na sidebar. Gera um PDF por empresa selecionada (uma página
por empregado), pronto para impressão e assinatura.

## 1. UI

Nova tela `folhaPontoScreen`, seguindo exatamente o padrão visual/estrutural de
`escalaScreen`/`beneficiosScreen`:

- Input `Competência (MM/AAAA)`
- Seção "Grupos de Empresas (opcional)" com busca (mesmo componente de
  `_filtrarListaGruposEscala`/`_selecionarTodasEmpresasEscala`, duplicado para este
  contexto)
- Seção "Empresas" com busca, "Todas"/"Nenhuma"
- Botão "🔎 Gerar Prévia"
- Após gerar: lista de empresas/empregados encontrados (contagem, avisos de empresas
  puladas), com botão "📥 Baixar PDF(s)"

Novo item na sidebar (`index.html`, junto aos demais `sidebar-item` da nav), entre
"Gerar Escala" e "Conversor de Folha".

## 2. Fonte de dados

**Nenhum SQL novo.** Reaproveita tabelas e helpers já existentes:

- `rh_empregados` — filtro `situacao = 'Trabalhando'` AND `tipo_empregado = 'Empregado'`
  (mesmo filtro de `gerarEscala`), campos `codigo_empregado`, `nome_empregado`,
  `desc_cargo` (→ "Função"), `desc_dpto` (→ "Departamento")
- `rh_empresas` — `nome_empresa`, `cnpj`, `endereco`, `municipio` (→ rótulo "Bairro" na
  folha), `cidade`, `uf`, `cep`
- `rh_escala_trabalho`, `rh_ferias_calculadas`, `rh_escala_excecoes` — mesmas três
  consultas de `gerarEscala`, alimentando `calcularResumoMes` (`escala-calculo.js`) para
  classificar cada dia do período em `trabalho` / `folga` / `ferias` por empregado
- `rh_config_rubricas_txt` via `_buscarConfigRubricas` + `_resolverPeriodoApuracao` —
  resolve o período de apuração customizado por empresa (mesmo mecanismo já usado em
  Frequência/Benefícios); passa `diaInicio`/`diaFim` para `calcularResumoMes`
- **`rh_jornada_trabalho`** — horário de entrada/intervalo/saída por
  `codigo_empresa` + `codigo_empregado` + `dia_semana`. Esta é a tabela do módulo de
  Administração RH (`admin.html`/`admin.js`, aba "Jornada de Trabalho", populada via
  importação do PDF "Horário de Trabalho"). **Importante:** não confundir com o campo
  `jornada`/`jornadaSexta`/`jornadaSabado` de `script.js` (state da própria Folha de
  Ponto) — este último é só a duração diária usada no cálculo de hora extra do
  lançamento, sem relação de entrada/saída por dia da semana, e não é usado aqui.

## 3. Cálculo por empregado

Para cada empregado retornado pelo filtro:

1. Resolve `escala` (`rh_escala_trabalho` ou `null` → padrão 5x2, igual a Gerar Escala)
2. Resolve `cfg` da empresa → `diaInicio`/`diaFim` do período de apuração
3. `calcularResumoMes(escala, competencia, periodosFerias, diaInicio, diaFim, excecoesFolga)`
   retorna `{ dias: [{data, diaSemana, tipo, ferias, excecao}], ... }` — a lista exata de
   dias da folha, já com o mês/ano real de cada um (cobre período cruzando virada de mês)
4. Para cada dia da lista: se `tipo === 'trabalho'`, busca em `rh_jornada_trabalho` o
   registro do empregado para aquele `dia_semana` (convertido de `diaSemana` abreviado —
   mesma tabela `ABREV_PARA_CHAVE` de `escala-calculo.js`) e formata
   `HH:MM-HH:MM / HH:MM-HH:MM` (com intervalo) ou `HH:MM-HH:MM` (sem intervalo); se não
   houver registro para aquele dia da semana, ou o dia for `folga`, o horário previsto é
   `—`.

## 4. Layout do PDF

jsPDF + autoTable (já carregados em `index.html`), **orientação paisagem** (landscape) —
necessário pela coluna extra de horário previsto, mantendo as demais colunas legíveis.
Uma página por empregado.

Cabeçalho (replicando o modelo, sem a linha fixa "Horário:"):

```
FOLHA INDIVIDUAL DE PONTO                                    Período: MM/AAAA
Empresa: {codigo} - {nome_empresa}          CNPJ: {cnpj}
Endereço: {endereco}                        Bairro: {municipio}
Cidade: {cidade}                            UF: {uf}   CEP: {cep}
Nome: {codigo} - {nome_empregado}           Departamento: {desc_dpto}
Função: {desc_cargo}
```

`Período:` mostra `MM/AAAA` no padrão, ou `DD/MM/AAAA a DD/MM/AAAA` quando o período de
apuração customizado da empresa estiver ativo (mesmo texto usado em
`_textoPeriodoApuracao`).

Tabela (uma linha por dia do período):

| Dia | Horário Previsto | Entrada | Saída | Interv. Entrada | Interv. Saída | H.Extra Entrada | H.Extra Saída | N° Horas | Assinatura |
|---|---|---|---|---|---|---|---|---|---|

- Coluna "Dia" mostra `DD` + abreviação do dia da semana (`03 Seg`), igual ao modelo
- Linha com `tipo === 'folga'` (e não `ferias`) → fundo cinza claro (`fillColor` no
  autoTable), colunas preenchíveis em branco
- Linha com `ferias === true` → texto "FÉRIAS" mesclado/repetido nas colunas
  preenchíveis (Entrada até N° Horas), sem o sombreamento de folga; Assinatura
  permanece em branco

Rodapé, igual ao modelo:

```
Obs.: Substitui o Quadro de Horário de Trabalho, de acordo com o disposto na Portaria
Ministerial nº 3162 de 08/09/1982
Reconheço a exatidão destas anotações. Data: ___/___/______

_____________________________          _____________________________
        Visto chefia                          Visto funcionário
```

## 5. Geração e download

- 1 empresa selecionada → gera o PDF (todas as páginas de empregados) e baixa
  diretamente: `FolhaDePonto_{codigo_empresa}_{MM}-{AAAA}.pdf`
- Mais de 1 empresa selecionada → JSZip (já usado em `baixarModelosGrupo`) com um PDF por
  empresa, baixado como `FolhasDePonto_{MM}-{AAAA}.zip`
- Empresa sem nenhum empregado "Trabalhando" após o filtro → pulada, listada como aviso
  ao final (mesmo padrão de `baixarModelosGrupo`), sem interromper o lote

## 6. Fora de escopo

- Preenchimento de entrada/saída reais (documento é gerado em branco para assinatura)
- Qualquer novo SQL/migração — tudo já existe (`rh_escala_trabalho`,
  `rh_jornada_trabalho`, `rh_ferias_calculadas`, `rh_escala_excecoes`,
  `rh_config_rubricas_txt`)
- Alterações em Gerar Escala, Gerar Benefícios, ou no conceito de `jornada` do state de
  `script.js`
