# Design: Tela "Gerar Benefícios" (VT/VA)

**Data:** 2026-07-09
**Status:** Aprovado
**Arquivos principais:** `Projeto RH/index.html`, `Projeto RH/script.js`

---

## Contexto

O sistema fonte de folha de pagamento não gera nenhum relatório de VT/VA pronto para pagamento — hoje isso é montado manualmente pela equipe (arquivo de referência: `Projeto RH/BENEFÍCIOS.xlsx`). O Controle de Frequência já tem duas peças do quebra-cabeça: os valores diários de VT/VA configurados por empregado (`rh_valores_va_vt`, tela "Valores VT/VA") e a Folha de Ponto processada por competência (`rh_saves`), da qual já se extraem contagens de falta/atestado (mesma lógica usada no aviso de descontos ao baixar TXT, `2026-07-07-aviso-descontos-va-vt-design.md`, e na Exportação TXT, `_construirConteudoTXTExportacao`).

**Particularidade importante confirmada com o usuário:** o benefício de um mês trabalhado é pago no mês seguinte (ex.: dias trabalhados em 07/2026 geram o benefício pago em 08/2026). Isso significa que esta tela precisa funcionar mesmo quando a Folha de Ponto da competência de referência **ainda não foi processada/salva** no Controle de Frequência — nesses casos os campos de dias vêm com uma estimativa e o operador ajusta manualmente. Além disso, há empresas que descontam falta/atestado diretamente na folha de pagamento (portanto, para elas, o desconto nesta tela deveria ficar zerado) e empresas que preferem descontar VT/VA "por fora" da folha — por isso os campos de dias precisam ser sempre editáveis, nunca só informativos.

---

## Escopo confirmado com o usuário

- Nova tela no **sidebar** do Controle de Frequência (`Projeto RH/index.html`/`script.js`), não um modal — `mostrarTela('beneficiosScreen')`.
- Seleção de **múltiplas empresas de uma vez** por competência (não uma de cada vez).
- "Dias a Descontar" = Falta + Atestado médico integral (mesma regra já usada hoje no aviso de descontos), pré-calculado quando há Folha salva, mas **sempre editável**.
- "Dias a Trabalhar" também sempre editável; quando não há Folha salva para a competência, o placeholder assume **jornada 5x2** (segunda a sexta, sábado e domingo de folga) descontando os feriados globais (`rh_feriados`) que caem em dia útil.
- Tela de **prévia/revisão** na própria aplicação antes de exportar (tabela editável).
- Exportação em Excel replicando **apenas a aba "Empregados"** do `BENEFÍCIOS.xlsx` (13 colunas) — sem a aba "EMPRESAS".
- Nenhuma persistência nova no banco: é um relatório pontual, os ajustes manuais na prévia não são salvos entre sessões.

---

## Fluxo de telas

### 1. Filtros iniciais

```
┌─ GERAR BENEFÍCIOS (VT/VA) ─────────────────────────────────┐
│ Competência de referência (mês trabalhado): [ MM/AAAA ]     │
│ O benefício correspondente é pago no mês seguinte (MM/AAAA). │
│                                                                │
│ Empresas:                                                     │
│  [Todas] [Nenhuma]     🔍 Buscar empresa...                   │
│  ☑ 2 - CENTRO AUTOMOTIVO...     ☑ 5 - V. DE SOUZA VIANA ME    │
│  ☐ 63 - AGUAS CLARAS...          ...                          │
│                                                                │
│              [ Gerar Prévia ]                                 │
└────────────────────────────────────────────────────────────┘
```

- Lista de empresas = todas cadastradas em `rh_empresas` (mesmo padrão de carregamento já usado em `state.empresas`), com busca por texto e "Todas"/"Nenhuma" — **não** filtra só empresas com Folha processada (diferença proposital em relação à tela de Exportação TXT), já que a tela precisa funcionar mesmo sem processamento.
- Texto do "mês seguinte" é só label informativo (calculado a partir da competência digitada), não é gravado em lugar nenhum — o arquivo exportado não tem coluna de competência (confirmado no `BENEFÍCIOS.xlsx`).

### 2. Prévia editável

Uma linha por empregado, de todas as empresas marcadas. Empregados incluídos: `rh_empregados` com `situacao = 'Trabalhando'` e `tipo_empregado` diferente de `'Contribuinte'` (assunção — sinalizar se estiver errado na revisão da spec).

| Empresa | Empregado | Cargo | 🏖️ | Dias a Trabalhar | Dias a Descontar | Dias a Pagar | VT Diário | VA Diário | VT Mensal | VA Mensal |
|---|---|---|---|---|---|---|---|---|---|---|
| 2 - CENTRO AUTOMOTIVO | 9 - LUIZ FELIPE... | AUX SERV GERAIS | 🏖️ | `[23]` | `[1]` | 22 | 7,60 | 17,90 | 167,20 | 393,80 |

- **🏖️**: badge exibido quando há um período em `rh_ferias_calculadas` (`ferias_inicio`..`ferias_fim`) que sobrepõe o mês da competência de referência — só identificação visual (tooltip com as datas), não altera nenhum cálculo automaticamente. O operador decide se ajusta "Dias a Descontar" manualmente nesse caso.
- **Dias a Trabalhar / Dias a Descontar**: `<input type="number">` editável em cada linha.
  - **Com Folha salva** (`rh_saves`, última versão por empregado, mesmo critério de `_construirConteudoTXTExportacao`): pré-preenche Dias a Trabalhar = contagem de dias que não são DSR/feriado (`!isDiaDescanso`); Dias a Descontar = contagem de dias com falta integral ou atestado médico integral (mesma regra do aviso de descontos existente).
  - **Sem Folha salva** para aquela empresa+competência: Dias a Trabalhar = estimativa por calendário, jornada 5x2 (conta segunda a sexta do mês, subtrai feriados de `rh_feriados`/`state.feriados` que caiam em dia útil); Dias a Descontar = 0.
- **Dias a Pagar** = Dias a Trabalhar − Dias a Descontar (somente leitura, recalculado a cada alteração dos dois campos editáveis, nunca negativo).
- **VT Diário / VA Diário**: de `rh_valores_va_vt` (somente leitura nesta tela — configuração continua sendo feita na tela "Valores VT/VA" já existente); em branco/zero se o empregado não tiver valor configurado.
- **VT Mensal / VA Mensal** = Dias a Pagar × valor diário correspondente (somente leitura, recalculado ao vivo).

### 3. Exportação

Botão "📥 Gerar Excel" no rodapé da prévia. Gera um `.xlsx` (SheetJS, já carregado em `index.html`) com uma única aba **"Empregados"**, replicando exatamente as colunas do `BENEFÍCIOS.xlsx`:

```
Cód Emp | NOME | CNPJ | Cód Epr | Nome | Descrição cargo | DIAS | DESCONTAR | DIAS A PAGAR | VT DIARIO | VA DIARIO | VT MENSAL | VA MENSAL
```

Mapeamento: `Cód Emp`=`codigo_empresa`, `NOME`=`nome_empresa`, `CNPJ`=`cnpj` (de `rh_empresas`), `Cód Epr`=`codigo_empregado`, `Nome`=`nome_empregado`, `Descrição cargo`=`desc_cargo`, e as 7 colunas numéricas conforme calculado na prévia (usando os valores **já editados** pelo operador, não os pré-preenchidos originais). Nome do arquivo: `Beneficios_VT_VA_<mes_pagamento><ano>_<timestamp>.xlsx` (mês de pagamento = referência + 1, só no nome do arquivo).

---

## O que NÃO muda / fora de escopo

- Tela "Valores VT/VA" (configuração de VT/VA diário por empregado) — usada apenas como fonte de leitura aqui.
- Cálculo de desconto de VA/VT já embutido na Exportação TXT (`_construirConteudoTXTExportacao`/`_linhasTxt`) — fluxo separado, não é tocado.
- Nenhuma tabela nova no Supabase; nenhuma persistência dos ajustes manuais da prévia.
- Aba "EMPRESAS" no Excel exportado (só "Empregados", conforme decisão do usuário).

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `index.html` | Novo item de sidebar; nova tela `beneficiosScreen` (filtros + tabela de prévia editável) |
| `script.js` | Carregamento de empresas/empregados/valores VA-VT/férias, recomputo de dias por empregado (reaproveitando lógica de `_construirConteudoTXTExportacao` e `_dataEmFerias`), estimativa 5x2 usando `state.feriados`, recálculo ao vivo dos campos somente-leitura, geração do Excel |

---

## Pontos de atenção para o plano de implementação

- Confirmar o filtro de empregados (`situacao = 'Trabalhando'` e `tipo_empregado != 'Contribuinte'`) contra dados reais antes de fechar — é uma assunção deste design, não uma decisão explícita do usuário.
- Reaproveitar (não duplicar por cópia-colar sem necessidade) a lógica de recomputo por dia já existente em `_construirConteudoTXTExportacao`, extraindo se fizer sentido uma função utilitária comum para os dois fluxos.
- Tratar corretamente competências com mais de uma versão salva por empregado em `rh_saves` (pegar a mais recente, mesmo critério já usado na Exportação TXT).
- Garantir que "Dias a Pagar" nunca fique negativo na tela (Dias a Descontar > Dias a Trabalhar é um erro de digitação plausível do operador).
